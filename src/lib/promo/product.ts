import type { ChannelStatus } from '@/generated/prisma/enums';
import type { PrismaClient } from '@/generated/prisma/client';
import { finalPriceOf, type InstallmentPlan } from '@/domain/pricing';
import { marginAt, type Invite, type OptionEconomics } from '@/domain/promo/entry';
import { readTags, type PromoTags, type TagGroup } from '@/domain/promo/tags';
import { competitorOwner, loadCompetitors } from '@/lib/competitors';
import { loadOptionTable } from '@/lib/option-table';

// Lo que hace falta de un producto para sus promociones: sus etiquetas, cada
// forma de cobro de cada medida con su costo y su precio de hoy, lo que el
// canal informa de cada campaña y el stock de cada medida. Solo lee. Recibe
// la base por parámetro para poder probarlo.

type Db = PrismaClient;

/** Una forma de cobro de una medida: una publicación con su código. */
export type PromoOption = {
  publicationId: string;
  externalId: string | null;
  // La publicación principal de su medida.
  mainId: string;
  main: boolean;
  measure: string | null;
  plan: InstallmentPlan | null;
  status: ChannelStatus;
  // El canal la frenó o la está revisando: no se le puede subir nada.
  held: boolean;
  eco: OptionEconomics;
  // El descuento propio que tiene hoy en el canal, en %, y lo que deja hoy.
  discountNow: number | null;
  marginNow: number | null;
  // Decidido a mano: no entra a ninguna oferta.
  excluded: boolean;
  excludedWhy: string | null;
  // Las unidades de su medida. Null si la app no lleva su stock.
  stock: number | null;
};

/** Lo que el canal informa de una campaña para una forma de cobro, como está guardado. */
export type StoredCampaign = Invite & {
  publicationId: string;
  group: string;
  ref: string;
  type: string;
  name: string;
  kind: string;
  start: Date | null;
  finish: Date | null;
  deadline: Date | null;
  // La parte del descuento que pone la tienda, en %.
  sellerPct: number | null;
  stockMin: number | null;
  stockMax: number | null;
  canLeave: boolean;
  pausesOwnDiscount: boolean;
  seenAt: Date;
};

export type ProductPromo = {
  productId: string;
  name: string;
  brand: string | null;
  channelName: string;
  tags: PromoTags;
  // Las etiquetas puestas a mano y por qué la regla propuso las demás.
  manual: TagGroup[];
  why: Partial<Record<TagGroup, string>>;
  plannedAt: Date | null;
  // Las formas de cobro, en el orden de las medidas y de los modos.
  options: PromoOption[];
  campaigns: StoredCampaign[];
  // El precio para el comprador del competidor más barato, y de quién es.
  competitor: { price: number; seller: string | null; surveyedAt: Date | null } | null;
};

const num = (v: { toString(): string } | null | undefined) => (v === null || v === undefined ? null : Number(v.toString()));
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Las publicaciones desde donde se arma la tabla de un producto: la principal de cada familia y las sueltas. */
export async function productHeads(db: Db, productId: string): Promise<string[]> {
  const pubs = await db.publication.findMany({
    where: { productId, mainOptionId: null, channelCopy: { is: { missingSince: null } } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, familyId: true, family: { select: { leadId: true } } },
  });
  const heads: string[] = [];
  for (const p of pubs) {
    const head = p.family?.leadId ?? p.id;
    if (!heads.includes(head)) heads.push(head);
  }
  return heads;
}

export function campaignOfRow(r: {
  publicationId: string;
  group: string;
  ref: string;
  type: string;
  name: string | null;
  kind: string;
  status: string;
  price: { toString(): string } | null;
  channelPct: { toString(): string } | null;
  sellerPct: { toString(): string } | null;
  start: Date | null;
  finish: Date | null;
  deadline: Date | null;
  join: string | null;
  minPrice: { toString(): string } | null;
  maxPrice: { toString(): string } | null;
  stockMin: number | null;
  stockMax: number | null;
  canLeave: boolean;
  pausesOwnDiscount: boolean;
  listPrice: { toString(): string } | null;
  seenAt: Date;
}): StoredCampaign {
  return {
    publicationId: r.publicationId,
    group: r.group,
    ref: r.ref,
    type: r.type,
    name: r.name ?? r.kind,
    kind: r.kind,
    status: r.status === 'active' ? 'active' : r.status === 'scheduled' ? 'scheduled' : 'invited',
    join: r.join === 'price' ? 'price' : r.join === 'accept' ? 'accept' : null,
    price: num(r.price),
    minPrice: num(r.minPrice),
    maxPrice: num(r.maxPrice),
    channelPct: num(r.channelPct),
    sellerPct: num(r.sellerPct),
    listPrice: num(r.listPrice),
    start: r.start,
    finish: r.finish,
    deadline: r.deadline,
    stockMin: r.stockMin,
    stockMax: r.stockMax,
    canLeave: r.canLeave,
    pausesOwnDiscount: r.pausesOwnDiscount,
    seenAt: r.seenAt,
  };
}

/** Todo lo de promociones de un producto. Null si no es de la cuenta. */
export async function loadProductPromo(db: Db, accountId: string, productId: string): Promise<ProductPromo | null> {
  const product = await db.product.findFirst({
    where: { id: productId, accountId },
    select: { id: true, name: true, brand: true, stockSince: true, promotion: true, stock: { select: { key: true, label: true, quantity: true } } },
  });
  if (!product) return null;
  const heads = await productHeads(db, productId);
  const options: PromoOption[] = [];
  let channelName = '';
  for (const head of heads) {
    const table = await loadOptionTable(db, { accountId, publicationId: head, campaigns: false });
    if (!table) continue;
    channelName = table.channelName;
    for (const g of table.groups) {
      for (const m of g.measures) {
        // El stock de la medida, si la app lo lleva: por el nombre de la medida, o el único que hay.
        const stockRow = product.stock.length === 1 && !m.measure ? product.stock[0] : product.stock.find((s) => norm(s.label) === norm(m.measure) && norm(s.label) !== '');
        const stock = product.stockSince && stockRow ? stockRow.quantity : null;
        const push = (plan: InstallmentPlan | null, o: (typeof m.modes)[number]['options'][number]) => {
          if (options.some((x) => x.publicationId === o.id)) return;
          const eco: OptionEconomics = { cost: g.cost, params: table.params, plan, listPrice: o.priceNow };
          options.push({
            publicationId: o.id,
            externalId: o.externalId,
            mainId: m.mainId,
            main: o.main,
            measure: m.measure,
            plan,
            status: o.status,
            held: o.blocked || (o.status === 'UNDER_REVIEW' && !o.needsFix),
            eco,
            discountNow: o.discountNow,
            marginNow: o.priceNow !== null ? marginAt(eco, finalPriceOf(o.priceNow, o.discountNow ?? 0)) : null,
            excluded: false,
            excludedWhy: null,
            stock,
          });
        };
        for (const mode of m.modes) for (const o of mode.options) push(mode.plan, o);
        for (const o of m.unknownPlan) push(null, o);
      }
    }
  }
  const ids = options.map((o) => o.publicationId);
  const [excluded, rows] = await Promise.all([
    db.promotionOption.findMany({ where: { publicationId: { in: ids }, excluded: true }, select: { publicationId: true, why: true } }),
    db.channelPromotionItem.findMany({ where: { publicationId: { in: ids } }, orderBy: [{ start: 'asc' }, { name: 'asc' }] }),
  ]);
  for (const e of excluded) {
    const o = options.find((x) => x.publicationId === e.publicationId);
    if (o) Object.assign(o, { excluded: true, excludedWhy: e.why });
  }
  // La competencia: la de la publicación o, si el tipo la comparte, la del producto.
  let competitor: ProductPromo['competitor'] = null;
  if (heads.length > 0) {
    const owner = await competitorOwner(db, heads[0]);
    const listed = owner ? await loadCompetitors(db, owner, { sellerName: true, title: true, listPrice: true, discountPct: true, surveyedAt: true }) : [];
    for (const c of listed) {
      if (c.listPrice === null) continue;
      const price = Math.round(finalPriceOf(Number(c.listPrice), Number(c.discountPct ?? 0)));
      if (price > 0 && (!competitor || price < competitor.price)) competitor = { price, seller: c.sellerName?.trim() || c.title, surveyedAt: c.surveyedAt };
    }
  }
  const why = product.promotion?.why && typeof product.promotion.why === 'object' && !Array.isArray(product.promotion.why) ? (product.promotion.why as Partial<Record<TagGroup, string>>) : {};
  return {
    productId: product.id,
    name: product.name,
    brand: product.brand,
    channelName,
    tags: readTags(product.promotion),
    manual: (product.promotion?.manual ?? []) as TagGroup[],
    why,
    plannedAt: product.promotion?.plannedAt ?? null,
    options,
    campaigns: rows.map(campaignOfRow),
    competitor,
  };
}

/** El producto de una publicación de la cuenta. */
export async function productOfPublication(db: Db, accountId: string, publicationId: string): Promise<string | null> {
  const p = await db.publication.findFirst({ where: { id: publicationId, product: { accountId } }, select: { productId: true } });
  return p?.productId ?? null;
}
