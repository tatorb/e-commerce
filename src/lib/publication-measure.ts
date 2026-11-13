import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { parseVariations } from '@/domain/media';
import { copySkus, skuText } from '@/domain/stock';
import { getChannelPublisher } from '@/channels/publish';
import { PublishError } from '@/channels/publish-types';
import { withAccessToken } from '@/lib/connections';
import { measuresOf, type Measure } from '@/lib/media';
import { PLAN_SELECT, planFor, singleMeasure } from '@/lib/stock-plan';
import { syncStock, type SyncResult } from '@/lib/stock';

// La medida que vende una publicación publicada sola en el canal, cuando su
// SKU no dice cuál es (por ejemplo "SP-413", sin la medida). Se elige una vez
// y vale para todas sus opciones de venta: la misma medida con otra forma de
// cobro. Con la medida, su cantidad sale del stock de esa medida, el precio
// toma su costo y la familia la muestra. El SKU correcto se puede dejar para
// mandar al canal desde Por subir.

type Db = PrismaClient;

export class MeasureError extends Error {}

const GROUP_SELECT = {
  ...PLAN_SELECT,
  mainOptionId: true,
  familyId: true,
  skuToPush: true,
} satisfies Prisma.PublicationSelect;

type GroupRow = Prisma.PublicationGetPayload<{ select: typeof GROUP_SELECT }>;

/** Cuánto pasaría a tener en el canal cada opción de venta con esa medida. */
export type QuantityChange = { externalId: string | null; from: number | null; to: number };

export type MeasureChoice = {
  // La principal: ahí se mira la medida de todas.
  mainId: string;
  channelName: string;
  // La medida elegida, si hay.
  current: Measure | null;
  // Si la app no sabe de qué medida es: ni elegida ni por su SKU.
  unknown: boolean;
  measures: (Measure & {
    // Otra publicación de la familia que ya vende esa medida.
    takenBy: string | null;
    // Lo que pasa con la cantidad al elegirla; reason si no sale del stock.
    quantities: QuantityChange[];
    quantityNote: string | null;
  })[];
  // Las opciones de venta, la principal primero, con el SKU que tienen en el canal.
  options: { id: string; externalId: string | null; channelSku: string | null; skuToPush: string | null }[];
};

const total = (lines: { quantity: number }[] | null) => (lines ? lines.reduce((s, l) => s + l.quantity, 0) : null);

async function loadGroup(db: Db, accountId: string, publicationId: string): Promise<GroupRow[]> {
  const p = await db.publication.findFirst({ where: { id: publicationId, product: { accountId } }, select: { id: true, mainOptionId: true } });
  if (!p) throw new MeasureError('La publicación no existe en esta cuenta.');
  const mainId = p.mainOptionId ?? p.id;
  const rows = await db.publication.findMany({ where: { OR: [{ id: mainId }, { mainOptionId: mainId }] }, select: GROUP_SELECT, orderBy: { externalId: 'asc' } });
  return rows.sort((a, b) => Number(a.id !== mainId) - Number(b.id !== mainId));
}

/** Si se le puede elegir la medida: publicada sola, sin medidas en el canal, de un producto con varias. */
function choosable(rows: GroupRow[]): boolean {
  const main = rows[0];
  if (measuresOf(main.product.variants).length < 2) return false;
  return rows.every((r) => parseVariations(r.channelCopy?.variations).length === 0);
}

/** La medida de la publicación y las que se pueden elegir. Null si no se le elige medida. */
export async function loadMeasureChoice(db: Db, args: { accountId: string; publicationId: string }): Promise<MeasureChoice | null> {
  const rows = await loadGroup(db, args.accountId, args.publicationId);
  if (!choosable(rows)) return null;
  const main = rows[0];
  const measures = measuresOf(main.product.variants);
  const others = main.familyId
    ? await db.publication.findMany({
        where: { familyId: main.familyId, mainOptionId: null, id: { not: main.id }, variantKey: { not: null } },
        select: { variantKey: true, externalId: true },
      })
    : [];
  const current = measures.find((m) => m.key === main.variantKey) ?? null;
  return {
    mainId: main.id,
    channelName: main.store.channel.name,
    current,
    unknown: !current && !singleMeasure(main.product, main.channelCopy, null),
    measures: measures.map((m) => {
      const changes: QuantityChange[] = [];
      let note: string | null = null;
      for (const r of rows) {
        const plan = planFor({ ...r, variantKey: m.key });
        if (!plan.managed) {
          note ??= plan.reason;
          continue;
        }
        changes.push({ externalId: r.externalId, from: total(plan.channel), to: total(plan.lines) ?? 0 });
      }
      return { ...m, takenBy: others.find((o) => o.variantKey === m.key)?.externalId ?? (others.some((o) => o.variantKey === m.key) ? 'otra publicación' : null), quantities: changes, quantityNote: note };
    }),
    options: rows.map((r) => ({ id: r.id, externalId: r.externalId, channelSku: copySkus(r.channelCopy?.details)[0] ?? null, skuToPush: r.skuToPush })),
  };
}

/** La medida de la ficha por su clave, su SKU o su nombre. */
export function findMeasure(measures: Measure[], wanted: string): Measure | null {
  const w = wanted.trim();
  const sku = skuText(w);
  const low = w.toLowerCase().replace(/\s+/g, ' ');
  return (
    measures.find((m) => m.key === w) ??
    measures.find((m) => sku !== null && skuText(m.sku) === sku) ??
    measures.find((m) => m.label.toLowerCase().replace(/\s+/g, ' ') === low || m.measure?.toLowerCase().replace(/\s+/g, ' ') === low) ??
    null
  );
}

export type SetMeasureResult = {
  measure: Measure;
  // Las opciones de venta a las que se les puso la medida.
  publications: { id: string; externalId: string | null }[];
  // Las que quedaron con el SKU para mandar desde Por subir.
  skuToPush: number;
  // La cantidad que se subió al canal con el stock de esa medida.
  stock: SyncResult;
};

/**
 * Elige la medida de la publicación y de todas sus opciones de venta. Con
 * sendSku, deja el SKU de la medida para mandar al canal desde Por subir en las
 * que tienen otro. La cantidad, si sigue al stock, se sube al momento.
 */
export async function setPublicationMeasure(
  db: Db,
  args: { accountId: string; publicationId: string; measure: string; sendSku?: boolean; userId: string | null },
): Promise<SetMeasureResult> {
  const rows = await loadGroup(db, args.accountId, args.publicationId);
  if (!choosable(rows)) {
    throw new MeasureError('A esta publicación no se le elige medida: su producto tiene una sola, o tiene las medidas adentro en el canal.');
  }
  const main = rows[0];
  const measure = findMeasure(measuresOf(main.product.variants), args.measure);
  if (!measure) {
    throw new MeasureError(`Esa medida no está en la ficha del producto. Las que hay: ${measuresOf(main.product.variants).map((m) => (m.sku ? `${m.label} (${m.sku})` : m.label)).join(', ')}.`);
  }
  if (main.familyId) {
    const taken = await db.publication.findFirst({
      where: { familyId: main.familyId, mainOptionId: null, id: { not: main.id }, variantKey: measure.key },
      select: { externalId: true },
    });
    if (taken) throw new MeasureError(`La medida ${measure.label} ya la vende ${taken.externalId ?? 'otra publicación'} en la familia.`);
  }
  let skuToPush = 0;
  await db.$transaction(async (tx) => {
    for (const r of rows) {
      const channelSku = copySkus(r.channelCopy?.details)[0] ?? null;
      const send = Boolean(args.sendSku && measure.sku && r.externalId && skuText(channelSku) !== skuText(measure.sku));
      if (send) skuToPush++;
      await tx.publication.update({
        where: { id: r.id },
        data: { variantKey: measure.key, ...(send ? { skuToPush: measure.sku } : r.skuToPush && r.skuToPush !== measure.sku ? { skuToPush: null } : {}) },
      });
    }
  });
  const stock = await syncStock(db, { publicationIds: rows.map((r) => r.id), userId: args.userId, note: `Se eligió la medida ${measure.label}` });
  return { measure, publications: rows.map((r) => ({ id: r.id, externalId: r.externalId })), skuToPush, stock };
}

export type SkuOutcome = { sku: string; ok: true } | { sku: string; ok: false; message: string };

/** Manda al canal el SKU que quedó en Por subir. Null si no había. Para pedirlo, la persona ya confirmó. */
export async function sendPendingSku(db: Db, args: { accountId: string; publicationId: string }): Promise<SkuOutcome | null> {
  const p = await db.publication.findFirst({
    where: { id: args.publicationId, product: { accountId: args.accountId } },
    select: { id: true, externalId: true, skuToPush: true, store: { select: { id: true, channel: { select: { kind: true, name: true } }, connection: { select: { status: true } } } }, channelCopy: { select: { details: true, variations: true } } },
  });
  if (!p?.skuToPush) return null;
  const sku = p.skuToPush;
  const channelName = p.store.channel.name;
  const publisher = getChannelPublisher(p.store.channel.kind);
  const fail = (message: string): SkuOutcome => ({ sku, ok: false, message });
  if (!p.externalId) return fail(`Todavía no está publicada en ${channelName}.`);
  if (!publisher?.setSku) return fail(`Todavía no se puede mandar el SKU a ${channelName}.`);
  if (p.store.connection?.status !== 'ACTIVE') return fail(`La tienda no está conectada con ${channelName}: conectala en Conexión.`);
  if (parseVariations(p.channelCopy?.variations).length > 0) return fail(`En ${channelName} tiene las medidas adentro: el SKU va en cada una.`);
  try {
    await withAccessToken(db, p.store.id, (token) => publisher.setSku!(token, p.externalId!, sku));
  } catch (e) {
    if (e instanceof PublishError) return fail(e.message);
    throw e;
  }
  // Ya está en el canal: la copia lo tiene hasta la próxima lectura.
  const details = p.channelCopy?.details && typeof p.channelCopy.details === 'object' && !Array.isArray(p.channelCopy.details) ? (p.channelCopy.details as Record<string, unknown>) : {};
  await db.$transaction([
    db.publication.update({ where: { id: p.id }, data: { skuToPush: null } }),
    ...(p.channelCopy ? [db.channelCopy.update({ where: { publicationId: p.id }, data: { details: { ...details, skus: [sku] } as Prisma.InputJsonValue } })] : []),
  ]);
  return { sku, ok: true };
}

/** Saca el SKU de Por subir, sin mandarlo. */
export async function dropPendingSku(db: Db, args: { accountId: string; publicationId: string }): Promise<void> {
  await db.publication.updateMany({ where: { id: args.publicationId, product: { accountId: args.accountId } }, data: { skuToPush: null } });
}
