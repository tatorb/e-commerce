import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { ConnectError } from '@/channels/connect';
import { FlexError, getChannelFlex, type FlexService } from '@/channels/flex';
import { siteOf } from '@/channels/mercadolibre/flex';
import { dayIn } from '@/domain/tasks';
import { withAccessToken } from '@/lib/connections';
import { parseLines } from '@/lib/sales/read';
import { listingTargets } from '@/lib/variant-listings';

// Envíos Flex desde la app: prender y apagar Flex en las publicaciones, las
// ventas Flex del día y la configuración de Flex de la cuenta. Prender o apagar
// lo decide una persona: la app no lo hace sola. En una familia, el cambio va a
// todas sus medidas. Cada intento queda en el registro. Recibe la base por
// parámetro para poder probarlo.

type Db = PrismaClient;

export type FlexResult = {
  done: { id: string; title: string | null; externalId: string | null }[];
  failed: { id: string; title: string | null; externalId: string | null; message: string }[];
};

const SELECT = {
  id: true,
  title: true,
  externalId: true,
  variantListings: true,
  store: { select: { id: true, channel: { select: { kind: true, name: true } }, connection: { select: { status: true } } } },
  channelCopy: { select: { flex: true } },
} as const;

/** Las publicaciones a cambiar: esas y, si son de una familia, todas sus medidas. */
async function expand(db: Db, accountId: string, publicationIds: string[]) {
  const asked = await db.publication.findMany({
    where: { id: { in: [...new Set(publicationIds)] }, product: { accountId } },
    select: { id: true, familyId: true },
  });
  const familyIds = asked.flatMap((p) => (p.familyId ? [p.familyId] : []));
  const ids = new Set(asked.map((p) => p.id));
  if (familyIds.length > 0) {
    for (const m of await db.publication.findMany({ where: { familyId: { in: familyIds } }, select: { id: true } })) ids.add(m.id);
  }
  const found = new Set(asked.map((p) => p.id));
  const missing = publicationIds.filter((id) => !found.has(id));
  const rows = await db.publication.findMany({ where: { id: { in: [...ids] } }, select: SELECT, orderBy: { externalId: 'asc' } });
  return { rows, missing: [...new Set(missing)] };
}

type Row = Awaited<ReturnType<typeof expand>>['rows'][number];

/** Por qué no se puede, o null si se puede. */
function blockedReason(p: Row): string | null {
  const channelName = getChannelAdapter(p.store.channel.kind, p.store.channel.name).name;
  if (!p.externalId) return `Todavía no está publicada en ${channelName}.`;
  if (!getChannelFlex(p.store.channel.kind)) return `${channelName} no tiene Envíos Flex.`;
  if (p.store.connection?.status !== 'ACTIVE') return `La tienda no está conectada con ${channelName}, conectala en Conexión.`;
  return null;
}

/**
 * Prende o apaga Envíos Flex en esas publicaciones, de a una. En una familia,
 * en todas sus medidas. Lo que no se pudo vuelve con el motivo.
 */
export async function setPublicationsFlex(
  db: Db,
  args: { accountId: string; publicationIds: string[]; on: boolean; userId: string | null },
): Promise<FlexResult> {
  const result: FlexResult = { done: [], failed: [] };
  const { rows, missing } = await expand(db, args.accountId, args.publicationIds);
  for (const id of missing) result.failed.push({ id, title: null, externalId: null, message: 'La publicación no está en la cuenta.' });
  for (const p of rows) {
    const blocked = blockedReason(p);
    if (blocked) {
      result.failed.push({ id: p.id, title: p.title, externalId: p.externalId, message: blocked });
      continue;
    }
    const flex = getChannelFlex(p.store.channel.kind)!;
    // En el registro, sin dato va como nulo de JSON.
    const before = p.channelCopy?.flex ?? Prisma.JsonNull;
    try {
      await withAccessToken(db, p.store.id, async (token) => {
        for (const target of listingTargets(p)) await flex.setFlex(token, target, args.on);
      });
    } catch (e) {
      if (!(e instanceof FlexError) && !(e instanceof ConnectError)) throw e;
      result.failed.push({ id: p.id, title: p.title, externalId: p.externalId, message: e.message });
      await db.channelSyncChange.create({
        data: { publicationId: p.id, field: 'flex', kind: 'STATUS_FAILED', before, after: args.on, message: e.message, userId: args.userId },
      });
      continue;
    }
    await db.$transaction([
      db.channelCopy.updateMany({ where: { publicationId: p.id }, data: { flex: args.on } }),
      db.channelSyncChange.create({ data: { publicationId: p.id, field: 'flex', kind: 'STATUS_CHANGED', before, after: args.on, userId: args.userId } }),
    ]);
    result.done.push({ id: p.id, title: p.title, externalId: p.externalId });
  }
  return result;
}

/** Si la publicación ofrece Flex, leído en el momento del canal. Guarda lo leído. Null si no se puede saber. */
export async function readPublicationFlex(db: Db, args: { accountId: string; publicationId: string }): Promise<boolean | null> {
  const p = await db.publication.findFirst({ where: { id: args.publicationId, product: { accountId: args.accountId } }, select: SELECT });
  if (!p || blockedReason(p)) return p?.channelCopy?.flex ?? null;
  const flex = getChannelFlex(p.store.channel.kind)!;
  const on = await withAccessToken(db, p.store.id, (token) => flex.hasFlex(token, p.externalId!));
  await db.channelCopy.updateMany({ where: { publicationId: p.id }, data: { flex: on } });
  return on;
}

// ───────────────────────────── Las ventas Flex del día ─────────────────────────────

export type FlexSale = {
  id: string;
  orderId: string;
  what: string;
  buyer: string | null;
  dispatchBy: Date | null;
  shipDetail: string | null;
  deliveredAt: Date | null;
};

export type FlexToday = {
  day: string;
  // Hay que prepararlas y entregarlas.
  toDeliver: FlexSale[];
  // Salieron y todavía no se entregaron.
  onTheWay: FlexSale[];
  // Se entregaron hoy.
  delivered: FlexSale[];
  // No se pudieron entregar o volvieron.
  problems: FlexSale[];
};

// Solo las ventas de estos últimos días: las viejas sin cerrar se ven en Envíos.
const RECENT_MS = 7 * 86_400_000;

/** Las ventas Flex del día de la cuenta, en el día de su zona horaria. */
export async function flexToday(db: Db, args: { accountId: string; timeZone: string; now?: Date }): Promise<FlexToday> {
  const now = args.now ?? new Date();
  const day = dayIn(now, args.timeZone);
  const sales = await db.sale.findMany({
    where: {
      store: { accountId: args.accountId },
      shipKind: 'flex',
      state: { not: 'CANCELLED' },
      orderedAt: { gte: new Date(now.getTime() - RECENT_MS) },
    },
    orderBy: [{ dispatchBy: 'asc' }, { orderedAt: 'asc' }],
    select: { id: true, orderId: true, lines: true, buyerNickname: true, dispatchBy: true, shipState: true, shipDetail: true, deliveredAt: true },
  });
  const out: FlexToday = { day, toDeliver: [], onTheWay: [], delivered: [], problems: [] };
  for (const s of sales) {
    const l = parseLines(s.lines);
    const first = l[0]?.title ?? 'la venta';
    const row: FlexSale = {
      id: s.id,
      orderId: s.orderId,
      what: l.length > 1 ? `${first} y ${l.length - 1} más` : first,
      buyer: s.buyerNickname,
      dispatchBy: s.dispatchBy,
      shipDetail: s.shipDetail,
      deliveredAt: s.deliveredAt,
    };
    if (s.shipState === 'TO_SHIP' || s.shipState === 'PENDING') out.toDeliver.push(row);
    else if (s.shipState === 'SHIPPED') out.onTheWay.push(row);
    else if (s.shipState === 'DELIVERED' && s.deliveredAt && dayIn(s.deliveredAt, args.timeZone) === day) out.delivered.push(row);
    else if (s.shipState === 'NOT_DELIVERED' || s.shipState === 'RETURNED') out.problems.push(row);
  }
  return out;
}

// ───────────────────────────── La configuración de la cuenta ─────────────────────────────

export type FlexStoreConfig = { store: string; channel: string; services: FlexService[] | null; error: string | null };

/** La configuración de Flex de cada tienda conectada de la cuenta, leída en el momento. */
export async function flexConfiguration(db: Db, accountId: string): Promise<FlexStoreConfig[]> {
  const stores = await db.store.findMany({
    where: { accountId, connection: { status: 'ACTIVE' } },
    select: {
      id: true,
      name: true,
      channel: { select: { kind: true, name: true } },
      publications: { where: { externalId: { not: null } }, take: 1, select: { externalId: true } },
    },
  });
  const out: FlexStoreConfig[] = [];
  for (const s of stores) {
    const flex = getChannelFlex(s.channel.kind);
    if (!flex) continue;
    const site = s.publications[0]?.externalId ? siteOf(s.publications[0].externalId) : 'MLA';
    try {
      const services = await withAccessToken(db, s.id, (token, userId) => flex.config(token, userId, site));
      out.push({ store: s.name, channel: s.channel.name, services, error: null });
    } catch (e) {
      if (!(e instanceof ConnectError)) throw e;
      out.push({ store: s.name, channel: s.channel.name, services: null, error: e.message });
    }
  }
  return out;
}
