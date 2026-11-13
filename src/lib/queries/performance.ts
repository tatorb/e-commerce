import type { PrismaClient } from '@/generated/prisma/client';
import { loadProductOptions } from '@/lib/product-options';
import type { ChannelStatus } from '@/generated/prisma/enums';
import { latestMetrics } from '@/domain/measurements';
import { copySkus } from '@/domain/stock';
import { singleMeasure } from '@/lib/stock-plan';
import { conversionPct, CORRECTION_FIELDS, lightOf, LIGHT_ORDER, PERIODS, TREND_WEEKS, weeklyVisits, type Light, type Period } from '@/domain/performance';

// Lo que muestra Rendimiento de publicaciones: por publicación, las visitas y
// las ventas del período, la conversión, el semáforo y la última corrección.
// Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

const DAY = 24 * 60 * 60 * 1000;

export type PerformanceSearch = {
  periodo?: string;
  marca?: string;
  tipo?: string;
  estado?: string;
  luz?: string;
  correccion?: string;
  orden?: string;
  dir?: string;
};

export const DEFAULT_BRAND = 'Persan';
export const DEFAULT_TYPE = 'Subconjunto (pistones + aros)';
// Lo que significa "todas" en los filtros de marca y tipo.
export const ALL = 'todas';

export const SORTS = ['luz', 'publicacion', 'visitas', 'ventas', 'conversion', 'correccion'] as const;
export type Sort = (typeof SORTS)[number];

export function parsePerformanceSearch(s: PerformanceSearch) {
  const period = Number(s.periodo);
  const pick = <T extends string>(v: string | undefined, options: readonly T[], fallback: T): T => (v && (options as readonly string[]).includes(v) ? (v as T) : fallback);
  const sort = pick(s.orden, SORTS, 'visitas');
  // Los textos, más grandes primero; el resto, de mayor a menor.
  const dir: 'asc' | 'desc' = s.dir === 'asc' || s.dir === 'desc' ? s.dir : sort === 'publicacion' ? 'asc' : 'desc';
  return {
    period: (PERIODS as readonly number[]).includes(period) ? (period as Period) : (30 as Period),
    brand: (s.marca ?? DEFAULT_BRAND).trim().slice(0, 100) || DEFAULT_BRAND,
    type: (s.tipo ?? DEFAULT_TYPE).trim().slice(0, 200) || DEFAULT_TYPE,
    status: pick(s.estado, ['activas', 'todas'] as const, 'activas'),
    light: pick(s.luz, ['todas', ...LIGHT_ORDER] as const, 'todas'),
    correction: pick(s.correccion, ['todas', '30d', 'sin'] as const, 'todas'),
    sort,
    dir,
  };
}

export type PerformanceFilters = ReturnType<typeof parsePerformanceSearch>;

export type PerformanceRow = {
  id: string;
  title: string | null;
  externalId: string;
  url: string | null;
  productId: string;
  // El SKU de la publicación, o los del producto si el canal no lo informa.
  sku: string | null;
  channelStatus: ChannelStatus;
  visits: number | null;
  sales: number;
  conversion: number | null;
  // Lo mismo en el período anterior del mismo largo. Visitas null si no están leídas todas las de ese período.
  previous: { visits: number | null; sales: number; conversion: number | null };
  // Las visitas por semana de las últimas 8 semanas, de la más vieja a la actual. Null sin visitas por día leídas.
  weeks: { from: string; visits: number | null }[] | null;
  light: Light;
  lastCorrection: { at: Date; fields: string[] } | null;
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Las unidades pagadas de cada código del canal desde una fecha y, con to, hasta otra (sin incluirla). */
async function paidUnits(db: Db, storeIds: string[], from: Date, to: Date = new Date(8.64e15)): Promise<Map<string, number>> {
  if (storeIds.length === 0) return new Map();
  const rows = await db.$queryRaw<{ storeId: string; listingId: string; units: unknown }[]>`
    SELECT s."storeId", l->>'listingId' AS "listingId", SUM(COALESCE((l->>'quantity')::numeric, 0)) AS units
    FROM sales s, jsonb_array_elements(s.lines) l
    WHERE s."storeId" = ANY(${storeIds}) AND s.state = 'PAID' AND s."orderedAt" >= ${from}::timestamp AND s."orderedAt" < ${to}::timestamp
    GROUP BY 1, 2`;
  return new Map(rows.map((r) => [`${r.storeId}:${r.listingId}`, Number(r.units ?? 0)]));
}

/** Las visitas de cada publicación entre dos días (el último sin incluir), sumando los días leídos. */
async function periodVisits(db: Db, ids: string[], fromDay: Date, toDay?: Date): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await db.publicationVisitDay.groupBy({
    by: ['publicationId'],
    where: { publicationId: { in: ids }, day: { gte: fromDay, ...(toDay ? { lt: toDay } : {}) } },
    _sum: { visits: true },
  });
  return new Map(rows.map((r) => [r.publicationId, r._sum.visits ?? 0]));
}

/** El primer día con visitas leídas de cada publicación: si es posterior al inicio del período anterior, ese período no está completo. */
async function firstVisitDays(db: Db, ids: string[]): Promise<Map<string, Date>> {
  if (ids.length === 0) return new Map();
  const rows = await db.publicationVisitDay.groupBy({ by: ['publicationId'], where: { publicationId: { in: ids } }, _min: { day: true } });
  return new Map(rows.flatMap((r) => (r._min.day ? [[r.publicationId, r._min.day] as const] : [])));
}

/** Las visitas por día de las últimas semanas, para el gráfico. */
async function recentVisitDays(db: Db, ids: string[], fromDay: Date): Promise<Map<string, { day: string; visits: number }[]>> {
  const out = new Map<string, { day: string; visits: number }[]>();
  if (ids.length === 0) return out;
  const rows = await db.publicationVisitDay.findMany({ where: { publicationId: { in: ids }, day: { gte: fromDay } }, select: { publicationId: true, day: true, visits: true } });
  for (const r of rows) {
    const list = out.get(r.publicationId) ?? [];
    list.push({ day: r.day.toISOString().slice(0, 10), visits: r.visits });
    out.set(r.publicationId, list);
  }
  return out;
}

/** La última corrección de cada publicación y lo que se cambió en las 24 horas anteriores a ella. */
async function lastCorrections(db: Db, ids: string[]): Promise<Map<string, { at: Date; fields: string[] }>> {
  if (ids.length === 0) return new Map();
  const rows = await db.$queryRaw<{ publicationId: string; at: Date; fields: string[] }[]>`
    WITH c AS (
      SELECT "publicationId", field, "createdAt" FROM channel_sync_changes
      WHERE "publicationId" = ANY(${ids}) AND kind IN ('SENT', 'CREATED') AND field = ANY(${CORRECTION_FIELDS})
    ), last AS (SELECT "publicationId", max("createdAt") AS at FROM c GROUP BY 1)
    SELECT c."publicationId", last.at, array_agg(DISTINCT c.field) AS fields
    FROM c JOIN last ON last."publicationId" = c."publicationId"
    WHERE c."createdAt" > last.at - interval '24 hours'
    GROUP BY c."publicationId", last.at`;
  return new Map(rows.map((r) => [r.publicationId, { at: r.at, fields: r.fields }]));
}

/** El SKU que vende la publicación: el que leyó el canal, el de su medida o los del producto. */
function publicationSku(product: { variants: { sku: string | null; measure: string | null }[] }, copy: { details: unknown } | null, chosen: string | null): string | null {
  const read = copySkus(copy?.details);
  if (read.length > 0) return read.join(' / ');
  const sole = singleMeasure(product, copy, chosen)?.sku?.trim();
  if (sole) return sole;
  const all = product.variants.map((v) => v.sku?.trim()).filter((s): s is string => Boolean(s));
  return all.length > 0 ? all.join(' / ') : null;
}

/** Las opciones de marca y tipo de producto: las listas fijas de la cuenta. */
const options = (db: Db, accountId: string) => loadProductOptions(db, accountId).then((o) => ({ brands: o.brands, types: o.types }));

export async function loadPerformance(db: Db, accountId: string, f: PerformanceFilters, now = new Date()) {
  const from = new Date(now.getTime() - f.period * DAY);
  // Los días se guardan a la medianoche: el período empieza el día de hace N-1 días.
  const fromDay = new Date(`${new Date(now.getTime() - (f.period - 1) * DAY).toISOString().slice(0, 10)}T00:00:00Z`);
  // El período anterior, del mismo largo, justo antes.
  const prevFrom = new Date(from.getTime() - f.period * DAY);
  const prevFromDay = new Date(fromDay.getTime() - f.period * DAY);
  // El gráfico: las últimas 8 semanas, sea cual sea el período, hasta ayer: hoy
  // todavía no terminó y haría caer siempre la última semana.
  const yesterday = new Date(now.getTime() - DAY);
  const trendFromDay = new Date(`${new Date(yesterday.getTime() - (TREND_WEEKS * 7 - 1) * DAY).toISOString().slice(0, 10)}T00:00:00Z`);
  const publications = await db.publication.findMany({
    where: {
      product: {
        accountId,
        ...(f.brand !== ALL ? { brand: { equals: f.brand, mode: 'insensitive' } } : {}),
        ...(f.type !== ALL ? { productType: { equals: f.type, mode: 'insensitive' } } : {}),
      },
      externalId: { not: null },
      ...(f.status === 'activas' ? { channelStatus: 'ACTIVE' } : { channelStatus: { notIn: ['UNPUBLISHED', 'DELETED'] } }),
    },
    select: {
      id: true,
      title: true,
      externalId: true,
      url: true,
      storeId: true,
      productId: true,
      variantKey: true,
      channelStatus: true,
      visitsReadAt: true,
      channelCopy: { select: { details: true } },
      product: { select: { variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } },
      // Para las de 90 días todavía sin las visitas por día.
      measurements: { orderBy: { takenAt: 'desc' }, take: 1, select: { metrics: true } },
    },
  });
  const ids = publications.map((p) => p.id);
  const storeIds = [...new Set(publications.map((p) => p.storeId))];
  const [units, visits, corrections, opts, readers, prevUnits, prevVisits, firstDays, trend] = await Promise.all([
    paidUnits(db, storeIds, from),
    periodVisits(db, ids, fromDay),
    lastCorrections(db, ids),
    options(db, accountId),
    db.saleReader.findMany({ where: { storeId: { in: storeIds } }, select: { readAt: true } }),
    paidUnits(db, storeIds, prevFrom, from),
    periodVisits(db, ids, prevFromDay, fromDay),
    firstVisitDays(db, ids),
    recentVisitDays(db, ids, trendFromDay),
  ]);

  const correctedSince = new Date(now.getTime() - 30 * DAY);
  let rows: PerformanceRow[] = publications.map((p) => {
    const fallback = f.period === 90 ? latestMetrics(p.measurements).visits_90d : undefined;
    const v = p.visitsReadAt ? (visits.get(p.id) ?? 0) : typeof fallback === 'number' ? fallback : null;
    const sales = units.get(`${p.storeId}:${p.externalId}`) ?? 0;
    const prevSales = prevUnits.get(`${p.storeId}:${p.externalId}`) ?? 0;
    // Las visitas del período anterior cuentan solo si están leídos todos sus días.
    const first = firstDays.get(p.id);
    const pv = p.visitsReadAt && first && first <= prevFromDay ? (prevVisits.get(p.id) ?? 0) : null;
    return {
      id: p.id,
      title: p.title,
      externalId: p.externalId!,
      url: p.url,
      productId: p.productId,
      sku: publicationSku(p.product, p.channelCopy, p.variantKey),
      channelStatus: p.channelStatus,
      visits: v,
      sales,
      conversion: conversionPct(v, sales),
      previous: { visits: pv, sales: prevSales, conversion: conversionPct(pv, prevSales) },
      weeks: p.visitsReadAt ? weeklyVisits(trend.get(p.id) ?? [], yesterday) : null,
      light: lightOf(v, sales),
      lastCorrection: corrections.get(p.id) ?? null,
    };
  });

  if (f.light !== 'todas') rows = rows.filter((r) => r.light === f.light);
  if (f.correction === '30d') rows = rows.filter((r) => r.lastCorrection && r.lastCorrection.at >= correctedSince);
  if (f.correction === 'sin') rows = rows.filter((r) => !r.lastCorrection);

  const sign = f.dir === 'asc' ? 1 : -1;
  const num = (n: number | null | undefined) => (n === null || n === undefined ? -Infinity : n);
  const key: Record<Sort, (r: PerformanceRow) => number | string> = {
    luz: (r) => LIGHT_ORDER.length - LIGHT_ORDER.indexOf(r.light),
    publicacion: (r) => (r.title ?? '').toLowerCase(),
    visitas: (r) => num(r.visits),
    ventas: (r) => r.sales,
    conversion: (r) => num(r.conversion),
    correccion: (r) => r.lastCorrection?.at.getTime() ?? -Infinity,
  };
  rows.sort((a, b) => {
    const x = key[f.sort](a);
    const y = key[f.sort](b);
    const c = typeof x === 'string' ? x.localeCompare(String(y), 'es') : x === y ? 0 : x < (y as number) ? -1 : 1;
    // A igualdad, más visitas primero.
    return c * sign || num(b.visits) - num(a.visits);
  });

  const totalVisits = rows.reduce((s, r) => s + (r.visits ?? 0), 0);
  const totalSales = rows.reduce((s, r) => s + r.sales, 0);
  // Los datos son tan nuevos como la lectura más vieja de las dos: visitas y ventas.
  const visitsAt = publications.reduce<Date | null>((m, p) => (p.visitsReadAt && (!m || p.visitsReadAt > m) ? p.visitsReadAt : m), null);
  const salesAt = readers.reduce<Date | null>((m, r) => (r.readAt && (!m || r.readAt > m) ? r.readAt : m), null);
  const updatedAt = visitsAt && salesAt ? (visitsAt < salesAt ? visitsAt : salesAt) : (visitsAt ?? salesAt);

  return {
    rows,
    totals: { count: rows.length, visits: totalVisits, sales: totalSales, conversion: conversionPct(totalVisits, totalSales) },
    // Cuántas todavía no tienen las visitas por día leídas.
    withoutVisits: rows.filter((r) => r.visits === null).length,
    updatedAt,
    options: {
      brands: opts.brands.some((b) => same(b, f.brand)) || f.brand === ALL ? opts.brands : [f.brand, ...opts.brands],
      types: opts.types.some((t) => same(t, f.type)) || f.type === ALL ? opts.types : [f.type, ...opts.types],
    },
  };
}

export type PerformanceData = Awaited<ReturnType<typeof loadPerformance>>;
