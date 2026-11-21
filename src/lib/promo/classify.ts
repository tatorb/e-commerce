import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { finalPriceOf } from '@/domain/pricing';
import { proposeCompetition, proposeLifecycle, type ProductFacts } from '@/domain/promo/classify';
import { COMPETITION_LABEL, LIFECYCLE_LABEL, readTags, type Competition, type Lifecycle, type TagGroup } from '@/domain/promo/tags';
import { competitorOwner, loadCompetitors } from '@/lib/competitors';
import { loadPromoSettings } from './settings';

// Clasificar los productos de la cuenta: la regla propone el ciclo de vida y
// la competencia de cada uno, con el porqué. Lo que una persona puso a mano
// no se pisa. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

const DAY = 86_400_000;

export type Classified = {
  productId: string;
  name: string;
  facts: ProductFacts;
  // Lo que propone la regla para cada grupo, y si cambia lo que tiene.
  lifecycle: { now: Lifecycle | null; proposed: Lifecycle | null; why: string; manual: boolean; changes: boolean } | null;
  competition: { now: Competition | null; proposed: Competition | null; why: string; manual: boolean; changes: boolean } | null;
};

/** Las unidades de cada producto desde una fecha, sin las ventas canceladas. */
async function unitsSince(db: Db, accountId: string, from: Date): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<{ productId: string; units: unknown }[]>`
    SELECT p."productId", SUM(COALESCE((l->>'quantity')::numeric, 0)) AS units
    FROM sales s
    JOIN stores st ON st.id = s."storeId"
    CROSS JOIN LATERAL jsonb_array_elements(s.lines) l
    JOIN publications p ON p."storeId" = s."storeId" AND (p.id = l->>'publicationId' OR p."externalId" = l->>'listingId')
    WHERE st."accountId" = ${accountId} AND s.state <> 'CANCELLED' AND s."orderedAt" >= ${from}::timestamp
    GROUP BY 1`;
  return new Map(rows.map((r) => [r.productId, Number(r.units ?? 0)]));
}

/**
 * Lo que la regla propone para cada producto con publicaciones en el canal.
 * apply: además lo guarda en los que no están puestos a mano. Devuelve los
 * productos a los que les cambió alguna etiqueta.
 */
export async function classifyAccount(db: Db, args: { accountId: string; productIds?: string[]; apply: boolean; now?: Date }): Promise<{ products: Classified[]; changed: string[] }> {
  const now = args.now ?? new Date();
  const settings = await loadPromoSettings(db, args.accountId);
  const rules = settings.rules.classify;
  const live: Prisma.PublicationWhereInput = { externalId: { not: null }, channelStatus: { notIn: ['CLOSED', 'DELETED'] }, channelCopy: { is: { missingSince: null } } };
  const products = await db.product.findMany({
    where: { accountId: args.accountId, publications: { some: live }, ...(args.productIds ? { id: { in: args.productIds } } : {}) },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      stockSince: true,
      promotion: true,
      stock: { select: { quantity: true } },
      publications: {
        where: live,
        orderBy: { createdAt: 'asc' },
        select: { id: true, createdAt: true, recreatedFromId: true, mainOptionId: true, installments: true, channelCopy: { select: { installments: true, price: true, discount: true } }, store: { select: { saleReader: { select: { historyDoneAt: true } } } } },
      },
    },
  });
  const ids = products.flatMap((p) => p.publications.map((x) => x.id));
  const [u90, u30, uClear, firstVisits, firstSales] = await Promise.all([
    unitsSince(db, args.accountId, new Date(now.getTime() - 90 * DAY)),
    unitsSince(db, args.accountId, new Date(now.getTime() - 30 * DAY)),
    unitsSince(db, args.accountId, new Date(now.getTime() - rules.clearanceDays * DAY)),
    db.publicationVisitDay.groupBy({ by: ['publicationId'], where: { publicationId: { in: ids }, visits: { gt: 0 } }, _min: { day: true } }),
    db.$queryRaw<{ productId: string; first: Date | null }[]>`
      SELECT p."productId", MIN(s."orderedAt") AS first
      FROM sales s
      JOIN stores st ON st.id = s."storeId"
      CROSS JOIN LATERAL jsonb_array_elements(s.lines) l
      JOIN publications p ON p."storeId" = s."storeId" AND (p.id = l->>'publicationId' OR p."externalId" = l->>'listingId')
      WHERE st."accountId" = ${args.accountId} AND s.state <> 'CANCELLED'
      GROUP BY 1`,
  ]);
  const visitOf = new Map(firstVisits.map((v) => [v.publicationId, v._min.day]));
  const saleOf = new Map(firstSales.map((s) => [s.productId, s.first]));
  const out: Classified[] = [];
  const changed: string[] = [];
  for (const p of products) {
    // La antigüedad: lo más viejo que se sabe de sus publicaciones, entre cuándo entró a la app, su primera visita y su primera venta.
    // Un producto recreado en otra categoría arranca de nuevo: cuenta solo desde que se recreó.
    const recreated = p.publications.some((x) => x.recreatedFromId !== null);
    const known: number[] = p.publications.map((x) => x.createdAt.getTime());
    if (!recreated) {
      for (const x of p.publications) {
        const v = visitOf.get(x.id);
        if (v) known.push(v.getTime());
      }
      const s = saleOf.get(p.id);
      if (s) known.push(s.getTime());
    }
    const complete = p.publications.every((x) => x.store.saleReader?.historyDoneAt != null);
    // El precio sin cuotas de hoy, para comparar con el competidor.
    const flat = p.publications.find((x) => (x.channelCopy?.installments ?? x.installments) === 0 && x.channelCopy?.price != null);
    const head = p.publications.find((x) => x.mainOptionId === null) ?? p.publications[0];
    const owner = await competitorOwner(db, head.id);
    const listed = owner ? await loadCompetitors(db, owner, { listPrice: true, discountPct: true }) : [];
    const prices = listed.filter((c) => c.listPrice !== null).map((c) => Math.round(finalPriceOf(Number(c.listPrice), Number(c.discountPct ?? 0)))).filter((n) => n > 0);
    const facts: ProductFacts = {
      ageDays: known.length > 0 ? Math.floor((now.getTime() - Math.min(...known)) / DAY) : null,
      units90: complete ? (u90.get(p.id) ?? 0) : null,
      units30: complete ? (u30.get(p.id) ?? 0) : null,
      unitsClearance: complete ? (uClear.get(p.id) ?? 0) : null,
      stock: p.stockSince ? p.stock.reduce((n, s) => n + s.quantity, 0) : null,
      flatPrice: flat ? Math.round(finalPriceOf(Number(flat.channelCopy!.price), Number(flat.channelCopy!.discount ?? 0))) : null,
      competitorPrice: prices.length > 0 ? Math.min(...prices) : null,
    };
    const tags = readTags(p.promotion);
    const manual = new Set((p.promotion?.manual ?? []) as TagGroup[]);
    const life = proposeLifecycle(facts, rules);
    const comp = proposeCompetition(facts, rules);
    // "Sin competencia" solo se pone a mano: la regla no la saca.
    const compKeeps = comp !== null && comp.value === null && tags.competition === 'NO_COMPETITION';
    const row: Classified = {
      productId: p.id,
      name: p.name,
      facts,
      lifecycle: life ? { now: tags.lifecycle, proposed: life.value, why: life.why, manual: manual.has('lifecycle'), changes: !manual.has('lifecycle') && life.value !== tags.lifecycle } : null,
      competition: comp ? { now: tags.competition, proposed: compKeeps ? tags.competition : comp.value, why: comp.why, manual: manual.has('competition'), changes: !manual.has('competition') && !compKeeps && comp.value !== tags.competition } : null,
    };
    out.push(row);
    const changes = row.lifecycle?.changes || row.competition?.changes;
    if (changes) changed.push(p.id);
    if (!args.apply) continue;
    const prevWhy = p.promotion?.why && typeof p.promotion.why === 'object' && !Array.isArray(p.promotion.why) ? (p.promotion.why as Record<string, string>) : {};
    const why = { ...prevWhy, ...(row.lifecycle && !row.lifecycle.manual ? { lifecycle: row.lifecycle.why } : {}), ...(row.competition && !row.competition.manual ? { competition: row.competition.why } : {}) };
    const data = {
      ...(row.lifecycle?.changes ? { lifecycle: row.lifecycle.proposed } : {}),
      ...(row.competition?.changes ? { competition: row.competition.proposed } : {}),
      why,
    };
    if (changes || JSON.stringify(why) !== JSON.stringify(prevWhy)) {
      await db.productPromotion.upsert({ where: { productId: p.id }, create: { productId: p.id, ...data }, update: data });
    }
  }
  if (args.apply && !args.productIds) await db.promotionSettings.upsert({ where: { accountId: args.accountId }, create: { accountId: args.accountId, classifiedAt: now }, update: { classifiedAt: now } });
  return { products: out, changed };
}

/** Lo propuesto, en una frase por grupo, para mostrarlo. */
export function classifiedText(c: Classified): string[] {
  const out: string[] = [];
  if (c.lifecycle) out.push(`Ciclo de vida: ${c.lifecycle.proposed ? LIFECYCLE_LABEL[c.lifecycle.proposed] : 'sin etiqueta'}. ${c.lifecycle.why}${c.lifecycle.manual ? ' Está puesto a mano: no se cambia.' : ''}`);
  if (c.competition) out.push(`Competencia: ${c.competition.proposed ? COMPETITION_LABEL[c.competition.proposed] : 'sin etiqueta'}. ${c.competition.why}${c.competition.manual ? ' Está puesta a mano: no se cambia.' : ''}`);
  return out;
}
