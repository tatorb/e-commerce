import type { PrismaClient } from '@/generated/prisma/client';
import { loadPromoSettings } from './settings';

// La medición de cada oferta: unos días después de prenderla, se comparan las
// ventas, las visitas, la conversión y la posición en búsquedas de los días de
// antes con los de después, y queda en la bitácora de esa forma de cobro.
// Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

const DAY = 86_400_000;
const dayStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export type Window = { visits: number | null; units: number; conversionPct: number | null; position: number | null };
export type Measurement = { days: number; from: string; before: Window; after: Window };

/** Las unidades de una publicación entre dos momentos, sin las ventas canceladas. */
async function unitsBetween(db: Db, publicationId: string, externalId: string | null, storeId: string, from: Date, to: Date): Promise<number> {
  const rows = await db.$queryRaw<{ units: unknown }[]>`
    SELECT SUM(COALESCE((l->>'quantity')::numeric, 0)) AS units
    FROM sales s, jsonb_array_elements(s.lines) l
    WHERE s."storeId" = ${storeId} AND s.state <> 'CANCELLED' AND s."orderedAt" >= ${from}::timestamp AND s."orderedAt" < ${to}::timestamp
      AND (l->>'publicationId' = ${publicationId} OR l->>'listingId' = ${externalId ?? ''})`;
  return Number(rows[0]?.units ?? 0);
}

async function windowOf(db: Db, p: { id: string; externalId: string | null; storeId: string; productId: string }, from: Date, to: Date): Promise<Window> {
  const days = await db.publicationVisitDay.findMany({ where: { publicationId: p.id, day: { gte: dayStart(from), lt: dayStart(to) } }, select: { visits: true } });
  const visits = days.length > 0 ? days.reduce((n, d) => n + d.visits, 0) : null;
  const units = await unitsBetween(db, p.id, p.externalId, p.storeId, from, to);
  // La posición: la última medición hecha en esos días.
  // Se mide en la publicación principal: vale la de cualquier publicación del producto.
  const position = await db.searchPosition.findFirst({ where: { publication: { productId: p.productId }, checkedAt: { gte: from, lt: to }, position: { not: null } }, orderBy: { checkedAt: 'desc' }, select: { position: true, page: true } });
  return {
    visits,
    units,
    conversionPct: visits !== null && visits > 0 ? Math.round((units / visits) * 10_000) / 100 : null,
    position: position?.position ?? null,
  };
}

const change = (before: number | null, after: number | null, unit = '') => (before === null || after === null ? 'sin dato' : `${before.toLocaleString('es-AR')}${unit} → ${after.toLocaleString('es-AR')}${unit}`);

/** El antes y el después de una oferta prendida en ese momento. */
export async function measureAround(db: Db, publicationId: string, on: Date, days: number): Promise<Measurement | null> {
  const p = await db.publication.findUnique({ where: { id: publicationId }, select: { id: true, externalId: true, storeId: true, productId: true } });
  if (!p) return null;
  const start = dayStart(on);
  return {
    days,
    from: start.toISOString().slice(0, 10),
    before: await windowOf(db, p, new Date(start.getTime() - days * DAY), start),
    after: await windowOf(db, p, start, new Date(start.getTime() + days * DAY)),
  };
}

export function measurementText(name: string, m: Measurement): string {
  return `${name}, ${m.days} días antes y después: ventas ${change(m.before.units, m.after.units)}, visitas ${change(m.before.visits, m.after.visits)}, conversión ${change(m.before.conversionPct, m.after.conversionPct, ' %')}, posición ${change(m.before.position, m.after.position)}.`;
}

/**
 * Mide las ofertas a las que les llegó el día, hasta budgetMs, y lo anota en
 * la bitácora. itemIds: mide esas ahora, aunque no les haya llegado el día.
 */
export async function measureDue(db: Db, args: { accountId: string; budgetMs: number; itemIds?: string[]; userId?: string | null; now?: Date }): Promise<{ measured: { itemId: string; publicationId: string; name: string; measurement: Measurement }[]; pending: boolean }> {
  const now = args.now ?? new Date();
  const started = Date.now();
  const settings = await loadPromoSettings(db, args.accountId);
  const days = settings.rules.timing.measureDays;
  const items = await db.promotionSlotItem.findMany({
    where: {
      appliedAt: { not: null },
      slot: { accountId: args.accountId },
      // Un día más, para que estén leídas las visitas del último día.
      ...(args.itemIds ? { id: { in: args.itemIds } } : { measuredAt: null, measureAt: { lte: new Date(now.getTime() - DAY) } }),
    },
    orderBy: { measureAt: 'asc' },
    take: 200,
    include: { slot: { select: { name: true, start: true } } },
  });
  const measured: { itemId: string; publicationId: string; name: string; measurement: Measurement }[] = [];
  for (const item of items) {
    if (Date.now() - started > args.budgetMs) return { measured, pending: true };
    const on = item.slot.start > item.appliedAt! ? item.slot.start : item.appliedAt!;
    const m = await measureAround(db, item.publicationId, on, days);
    if (!m) continue;
    await db.promotionLog.create({
      data: { accountId: args.accountId, publicationId: item.publicationId, slotItemId: item.id, kind: 'MEASURE', text: measurementText(item.slot.name, m), data: m, auto: !args.itemIds, userId: args.userId ?? null },
    });
    await db.promotionSlotItem.update({ where: { id: item.id }, data: { measuredAt: now } });
    measured.push({ itemId: item.id, publicationId: item.publicationId, name: item.slot.name, measurement: m });
  }
  return { measured, pending: false };
}

/** La bitácora de unas publicaciones, lo más nuevo primero. */
export async function loadLog(db: Db, args: { accountId: string; publicationIds: string[]; limit?: number }) {
  return db.promotionLog.findMany({
    where: { accountId: args.accountId, publicationId: { in: args.publicationIds } },
    orderBy: { createdAt: 'desc' },
    take: Math.min(200, args.limit ?? 50),
    include: { publication: { select: { externalId: true } } },
  });
}
