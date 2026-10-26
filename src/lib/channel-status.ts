import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { ConnectError } from '@/channels/connect';
import { getChannelPublisher, PublishError } from '@/channels/publish';
import { CHANNEL_STATUS_LABEL, STATUS_ACTIONS, type StatusAction } from '@/domain/channel-status';
import { parseVariantListings, parseVariations, variantKey, type VariantLike } from '@/domain/media';
import { readOne } from '@/lib/channel-sync';
import { settleReactivations } from '@/lib/restock';
import { withAccessToken } from '@/lib/connections';
import { listingTargets } from '@/lib/variant-listings';

// Cambiar el estado de las publicaciones en el canal desde la app: pausar,
// reactivar, finalizar, eliminar y republicar. Si el canal guarda cada medida
// como una publicación aparte, el cambio va a todas. Cada intento queda en el
// registro. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

export class StatusError extends Error {}

async function load(db: Db, accountId: string, publicationId: string) {
  const p = await db.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    select: {
      id: true,
      title: true,
      externalId: true,
      channelStatus: true,
      variantListings: true,
      price: true,
      store: { select: { id: true, channel: { select: { kind: true, name: true } }, connection: { select: { status: true } } } },
      channelCopy: { select: { variations: true } },
    },
  });
  if (!p) throw new StatusError('La publicación no está en la cuenta.');
  return p;
}

type Loaded = Awaited<ReturnType<typeof load>>;

const channelNameOf = (p: Loaded) => getChannelAdapter(p.store.channel.kind, p.store.channel.name).name;

/** Por qué no se puede hacer, o null si se puede. */
function blockedReason(p: Loaded, action: StatusAction): string | null {
  const channelName = channelNameOf(p);
  if (!p.externalId) return `Todavía no está publicada en ${channelName}.`;
  if (!getChannelPublisher(p.store.channel.kind)) return `Todavía no se puede cambiar el estado en ${channelName} desde la app.`;
  if (p.store.connection?.status !== 'ACTIVE') return `La tienda no está conectada con ${channelName}, conectala en Conexión.`;
  const step = STATUS_ACTIONS[action];
  if (!step.from.includes(p.channelStatus)) {
    return `Está ${CHANNEL_STATUS_LABEL[p.channelStatus].toLowerCase()}, no se puede ${step.label.toLowerCase()}.`;
  }
  return null;
}

export type StatusResult = {
  done: { id: string; title: string | null }[];
  failed: { id: string; title: string | null; message: string }[];
};

/**
 * Pausa, reactiva, finaliza o elimina esas publicaciones en el canal, de a
 * una. Lo que no se pudo vuelve con el motivo; lo que el canal no aceptó
 * también queda en el registro.
 */
export async function changeStatus(
  db: Db,
  args: { accountId: string; publicationIds: string[]; action: Exclude<StatusAction, 'relist'>; userId: string | null },
): Promise<StatusResult> {
  const step = STATUS_ACTIONS[args.action];
  const result: StatusResult = { done: [], failed: [] };
  for (const publicationId of [...new Set(args.publicationIds)]) {
    let p: Loaded;
    try {
      p = await load(db, args.accountId, publicationId);
    } catch (e) {
      if (!(e instanceof StatusError)) throw e;
      result.failed.push({ id: publicationId, title: null, message: e.message });
      continue;
    }
    const blocked = blockedReason(p, args.action);
    if (blocked) {
      result.failed.push({ id: p.id, title: p.title, message: blocked });
      continue;
    }
    const publisher = getChannelPublisher(p.store.channel.kind)!;
    try {
      await withAccessToken(db, p.store.id, async (token) => {
        for (const target of listingTargets(p)) await publisher.setStatus(token, target, args.action);
      });
    } catch (e) {
      if (!(e instanceof PublishError) && !(e instanceof ConnectError)) throw e;
      result.failed.push({ id: p.id, title: p.title, message: e.message });
      await db.channelSyncChange.create({
        data: { publicationId: p.id, field: 'status', kind: 'STATUS_FAILED', before: p.channelStatus, after: step.to, message: e.message, userId: args.userId },
      });
      continue;
    }
    await db.$transaction([
      db.publication.update({ where: { id: p.id }, data: { channelStatus: step.to } }),
      db.channelCopy.updateMany({ where: { publicationId: p.id }, data: { status: step.to } }),
      db.channelSyncChange.create({
        data: { publicationId: p.id, field: 'status', kind: 'STATUS_CHANGED', before: p.channelStatus, after: step.to, userId: args.userId },
      }),
    ]);
    result.done.push({ id: p.id, title: p.title });
  }
  // Las reactivadas ya no necesitan su tarea de reactivar.
  if (args.action === 'activate' && result.done.length > 0) await settleReactivations(db, { publicationIds: result.done.map((d) => d.id) });
  return result;
}

type RelistMeasure = VariantLike & { key: string; label: string; externalId: string | null };

/** Las medidas de la publicación en el canal, para pedir la cantidad de cada una. Vacío si tiene una sola. */
function measuresOf(p: Loaded): RelistMeasure[] {
  const family = parseVariantListings(p.variantListings);
  const list = family.length >= 2 ? family : parseVariations(p.channelCopy?.variations);
  if (list.length < 2) return [];
  return list.map((v, i) => ({
    key: variantKey(v) ?? `variante-${i + 1}`,
    label: v.measure ?? v.sku ?? `Variante ${i + 1}`,
    sku: v.sku,
    measure: v.measure,
    externalId: 'externalId' in v && v.externalId ? v.externalId : null,
  }));
}

/** Lo que hace falta para republicar: el tipo de publicación, el precio de antes y las medidas, si tiene. */
export async function relistInfo(db: Db, args: { accountId: string; publicationId: string }) {
  const p = await load(db, args.accountId, args.publicationId);
  return {
    channelName: channelNameOf(p),
    blocked: blockedReason(p, 'relist'),
    listingTypes: getChannelPublisher(p.store.channel.kind)?.listingTypes ?? [],
    price: p.price === null ? null : Number(p.price),
    measures: measuresOf(p).map((m) => ({ key: m.key, label: m.label })),
  };
}

export type RelistInfo = Awaited<ReturnType<typeof relistInfo>>;

const quantityOk = (n: number | undefined): n is number => n !== undefined && Number.isInteger(n) && n >= 1;

/**
 * Republica una finalizada: el canal crea otra con los mismos datos y otro
 * código. En la app sigue siendo la misma publicación, con el código nuevo.
 * Si el canal guarda cada medida aparte, se republica cada una.
 */
export async function relistInChannel(
  db: Db,
  args: {
    accountId: string;
    publicationId: string;
    price: number;
    quantity?: number;
    quantities?: Record<string, number>;
    listingType: string;
    userId: string | null;
  },
): Promise<{ externalId: string; warnings: string[] }> {
  const p = await load(db, args.accountId, args.publicationId);
  const blocked = blockedReason(p, 'relist');
  if (blocked) throw new StatusError(blocked);
  const publisher = getChannelPublisher(p.store.channel.kind)!;
  if (!(args.price > 0)) throw new StatusError('Cargá el precio.');
  if (!publisher.listingTypes.some((t) => t.value === args.listingType)) throw new StatusError('Elegí el tipo de publicación.');
  const measures = measuresOf(p);
  if (measures.length === 0 && !quantityOk(args.quantity)) throw new StatusError('La cantidad tiene que ser 1 o más.');
  const short = measures.filter((m) => !quantityOk(args.quantities?.[m.key])).map((m) => m.label);
  if (short.length > 0) throw new StatusError(`La cantidad de ${short.join(', ')} tiene que ser 1 o más.`);

  const before = p.externalId!;
  const separate = measures.length > 0 && measures.every((m) => m.externalId);
  const warnings: string[] = [];
  let head: { externalId: string; url: string | null } | null = null;
  let family = parseVariantListings(p.variantListings);
  try {
    await withAccessToken(db, p.store.id, async (token) => {
      if (!separate) {
        head = await publisher.relist(token, before, {
          price: args.price,
          quantity: args.quantity ?? 0,
          listingType: args.listingType,
          variants: measures.map((m) => ({ sku: m.sku, measure: m.measure, quantity: args.quantities![m.key] })),
        });
        return;
      }
      // Cada medida aparte: si una no se pudo, queda finalizada y se avisa.
      family = [];
      for (const m of measures) {
        try {
          const r = await publisher.relist(token, m.externalId!, { price: args.price, quantity: args.quantities![m.key], listingType: args.listingType, variants: [] });
          head ??= r;
          family.push({ externalId: r.externalId, sku: m.sku, measure: m.measure });
        } catch (e) {
          if (!(e instanceof PublishError) || !head) throw e;
          warnings.push(`La medida ${m.label} no se republicó: ${e.message}`);
          family.push({ externalId: m.externalId!, sku: m.sku, measure: m.measure });
        }
      }
    });
  } catch (e) {
    if (!(e instanceof PublishError) && !(e instanceof ConnectError)) throw e;
    await db.channelSyncChange.create({
      data: { publicationId: p.id, field: 'status', kind: 'STATUS_FAILED', before: p.channelStatus, after: 'ACTIVE', message: e.message, userId: args.userId },
    });
    throw new StatusError(e.message);
  }
  const created = head as { externalId: string; url: string | null } | null;
  if (!created) throw new StatusError('El canal no devolvió el código de la publicación republicada.');

  await db.$transaction([
    db.publication.update({
      where: { id: p.id },
      data: {
        externalId: created.externalId,
        url: created.url,
        channelStatus: 'ACTIVE',
        price: args.price,
        ...(separate ? { variantListings: family } : {}),
      },
    }),
    db.channelCopy.updateMany({ where: { publicationId: p.id }, data: { status: 'ACTIVE', url: created.url, missingSince: null } }),
    db.channelSyncChange.create({
      data: { publicationId: p.id, field: 'publication', kind: 'RELISTED', before: { externalId: before }, after: { externalId: created.externalId }, userId: args.userId },
    }),
  ]);
  // Lo que guardó el canal en la nueva, para que la app quede al día.
  try {
    await readOne(db, { accountId: args.accountId, publicationId: p.id });
  } catch (e) {
    console.error('No se pudo leer la publicación republicada', e instanceof Error ? e.message : e);
  }
  return { externalId: created.externalId, warnings };
}
