import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { objectiveOf, readMode, readTags, type Competition, type Lifecycle, type Mode, type Objective, type Priority, type PromoTags } from '@/domain/promo/tags';

// La lista de promociones de la cuenta: cada producto con publicaciones en el
// canal, sus etiquetas y cómo están sus ofertas (cuántas formas de cobro
// adentro, por entrar, afuera y con error), con filtros. Solo lee.

type Db = PrismaClient;

export const OVERVIEW_STATES = ['sin_etiquetas', 'con_ofertas', 'por_entrar', 'con_afuera', 'con_errores', 'sin_almanaque'] as const;
export type OverviewState = (typeof OVERVIEW_STATES)[number];
export const OVERVIEW_STATE_LABEL: Record<OverviewState, string> = {
  sin_etiquetas: 'Sin ciclo de vida',
  con_ofertas: 'Con ofertas prendidas',
  por_entrar: 'Con ofertas por entrar',
  con_afuera: 'Con formas de cobro afuera',
  con_errores: 'Con errores',
  sin_almanaque: 'Con etiquetas y sin almanaque',
};

export type OverviewFilter = {
  mode?: Mode;
  lifecycle?: Lifecycle | 'none';
  competition?: Competition;
  priority?: Priority;
  stockControl?: boolean;
  brand?: string;
  state?: OverviewState;
  // Texto en el nombre del producto o código de una publicación.
  query?: string;
  limit?: number;
  offset?: number;
};

export type OverviewRow = {
  productId: string;
  name: string;
  brand: string | null;
  // Una publicación del producto, para abrirlo.
  publicationId: string;
  mode: Mode;
  tags: PromoTags;
  objective: Objective | null;
  // Cuántas publicaciones tiene en el canal, una por forma de cobro de cada medida.
  options: number;
  // Cuántas de sus publicaciones están adentro de alguna oferta, por entrar a alguna, afuera de alguna y con algún error.
  on: number;
  planned: number;
  out: number;
  failed: number;
  // La próxima franja que empieza.
  next: { name: string; start: Date } | null;
  plannedAt: Date | null;
};

export type Overview = { total: number; rows: OverviewRow[]; brands: string[]; totals: { products: number; auto: number; tagged: number; on: number; planned: number; out: number; failed: number } };

export async function loadOverview(db: Db, accountId: string, filter: OverviewFilter = {}, now = new Date()): Promise<Overview> {
  const live: Prisma.PublicationWhereInput = { externalId: { not: null }, channelStatus: { notIn: ['CLOSED', 'DELETED'] }, channelCopy: { is: { missingSince: null } } };
  const products = await db.product.findMany({
    where: { accountId, publications: { some: live } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      brand: true,
      promotion: true,
      publications: { where: live, orderBy: { createdAt: 'asc' }, select: { id: true, externalId: true, mainOptionId: true } },
    },
  });
  const states = await db.$queryRaw<{ productId: string; state: string; n: bigint }[]>`
    SELECT s."productId", CASE WHEN i.state IN ('ON', 'SCHEDULED') THEN 'IN' ELSE i.state END AS state, COUNT(DISTINCT i."publicationId") AS n
    FROM promotion_slot_items i JOIN promotion_slots s ON s.id = i."slotId"
    WHERE s."accountId" = ${accountId} AND s.finish > ${now} AND NOT s.cancelled
    GROUP BY 1, 2`;
  const count = new Map<string, Record<string, number>>();
  for (const r of states) count.set(r.productId, { ...(count.get(r.productId) ?? {}), [r.state]: Number(r.n) });
  const upcoming = await db.promotionSlot.findMany({ where: { accountId, cancelled: false, start: { gt: now } }, orderBy: { start: 'asc' }, select: { productId: true, name: true, start: true } });
  const next = new Map<string, { name: string; start: Date }>();
  for (const s of upcoming) if (!next.has(s.productId)) next.set(s.productId, { name: s.name, start: s.start });

  const all: OverviewRow[] = products.map((p) => {
    const tags = readTags(p.promotion);
    const c = count.get(p.id) ?? {};
    return {
      productId: p.id,
      name: p.name,
      brand: p.brand,
      publicationId: (p.publications.find((x) => x.mainOptionId === null) ?? p.publications[0]).id,
      mode: readMode(p.promotion?.mode),
      tags,
      objective: objectiveOf(tags),
      options: p.publications.length,
      on: c.IN ?? 0,
      planned: c.PLANNED ?? 0,
      out: c.OUT ?? 0,
      failed: c.FAILED ?? 0,
      next: next.get(p.id) ?? null,
      plannedAt: p.promotion?.plannedAt ?? null,
    };
  });
  const q = filter.query?.trim().toLowerCase();
  const codes = q ? new Set(products.filter((p) => p.publications.some((x) => x.externalId?.toLowerCase() === q)).map((p) => p.id)) : null;
  const rows = all.filter((r) => {
    if (filter.mode && r.mode !== filter.mode) return false;
    if (filter.lifecycle === 'none' ? r.tags.lifecycle !== null : filter.lifecycle && r.tags.lifecycle !== filter.lifecycle) return false;
    if (filter.competition && r.tags.competition !== filter.competition) return false;
    if (filter.priority && r.tags.priority !== filter.priority) return false;
    if (filter.stockControl !== undefined && r.tags.stockControl !== filter.stockControl) return false;
    if (filter.brand && (r.brand ?? '').trim().toLowerCase() !== filter.brand.trim().toLowerCase()) return false;
    if (q && !r.name.toLowerCase().includes(q) && !codes!.has(r.productId)) return false;
    switch (filter.state) {
      case 'sin_etiquetas':
        return r.tags.lifecycle === null;
      case 'con_ofertas':
        return r.on > 0;
      case 'por_entrar':
        return r.planned > 0;
      case 'con_afuera':
        return r.out > 0;
      case 'con_errores':
        return r.failed > 0;
      case 'sin_almanaque':
        return r.tags.lifecycle !== null && r.plannedAt === null;
      default:
        return true;
    }
  });
  const offset = Math.max(0, filter.offset ?? 0);
  const limit = Math.min(500, Math.max(1, filter.limit ?? 50));
  const sum = (f: (r: OverviewRow) => number) => all.reduce((n, r) => n + f(r), 0);
  return {
    total: rows.length,
    rows: rows.slice(offset, offset + limit),
    brands: [...new Set(all.map((r) => r.brand?.trim()).filter((b): b is string => !!b))].sort((a, b) => a.localeCompare(b, 'es')),
    totals: { products: all.length, auto: all.filter((r) => r.mode === 'AUTO').length, tagged: all.filter((r) => r.tags.lifecycle !== null).length, on: sum((r) => r.on), planned: sum((r) => r.planned), out: sum((r) => r.out), failed: sum((r) => r.failed) },
  };
}

/** Los productos que pasan el filtro, todos: para las acciones en lote. */
export async function overviewProductIds(db: Db, accountId: string, filter: OverviewFilter, now = new Date()): Promise<string[]> {
  return (await loadOverview(db, accountId, { ...filter, limit: 500, offset: 0 }, now)).rows.map((r) => r.productId);
}
