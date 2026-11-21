import type { PrismaClient } from '@/generated/prisma/client';
import { planLabel } from '@/domain/pricing';
import { OUT_REASON_LABEL, type OutReason } from '@/domain/promo/entry';
import { layerOfType, type Layer, type SlotKind } from '@/domain/promo/plan';
import { objectiveOf, type Objective, type PromoTags, type TagGroup } from '@/domain/promo/tags';
import { decideItem, ITEM_STATE_LABEL, type ItemState } from './plan';
import { loadProductPromo, type ProductPromo } from './product';
import { loadPromoSettings, type PromoSettings } from './settings';

// La vista de promociones de un producto: la grilla de medidas por formas de
// cobro y, para cada franja u oferta del canal, qué pasa en cada casillero:
// adentro, al tope o afuera y por qué. Las franjas del almanaque van con lo
// guardado; las campañas del canal que todavía no tienen franja se calculan
// en el momento con la rentabilidad saludable. Solo lee.

type Db = PrismaClient;

export type GridCell = {
  publicationId: string;
  state: ItemState;
  // En palabras: "Adentro", "Al tope", "Afuera: bajo el piso".
  label: string;
  capped: boolean;
  reason: OutReason | null;
  text: string | null;
  price: number | null;
  discountPct: number | null;
  marginPct: number | null;
  lastError: string | null;
  itemId: string | null;
};

export type GridColumn = {
  // El id de la franja, o null si es una campaña del canal sin franja.
  slotId: string | null;
  group: string | null;
  layer: Layer;
  kind: SlotKind;
  name: string;
  campaignKind: string | null;
  start: Date | null;
  finish: Date | null;
  targetMarginPct: number;
  // PLAN, MANUAL, o CHANNEL si todavía no está en el almanaque.
  source: 'PLAN' | 'MANUAL' | 'CHANNEL';
  cancelled: boolean;
  note: string | null;
  cells: GridCell[];
  counts: { in: number; capped: number; out: number; failed: number };
};

export type GridOption = {
  publicationId: string;
  externalId: string | null;
  plan: number | null;
  planLabel: string;
  status: string;
  listPrice: number | null;
  discountNow: number | null;
  marginNow: number | null;
  cost: number | null;
  excluded: boolean;
  excludedWhy: string | null;
};

// title: el título de su publicación principal, para distinguir dos publicaciones distintas de la misma medida.
export type GridMeasure = { mainId: string; measure: string | null; title: string | null; stock: number | null; options: GridOption[] };

export type ProductGrid = {
  productId: string;
  name: string;
  brand: string | null;
  channelName: string;
  tags: PromoTags;
  manual: TagGroup[];
  why: Partial<Record<TagGroup, string>>;
  objective: Objective | null;
  plannedAt: Date | null;
  competitor: ProductPromo['competitor'];
  thresholds: PromoSettings['thresholds'];
  autoApply: boolean;
  // Cuándo se leyeron del canal las invitaciones de este producto: lo más viejo.
  invitationsAt: Date | null;
  measures: GridMeasure[];
  columns: GridColumn[];
};

export function cellLabel(state: ItemState, capped: boolean, reason: OutReason | null): string {
  if (state === 'OUT') return reason ? `Afuera: ${OUT_REASON_LABEL[reason].toLowerCase()}` : 'Afuera';
  if (capped && (state === 'PLANNED' || state === 'SCHEDULED' || state === 'ON')) return state === 'PLANNED' ? 'Por entrar, al tope' : `${ITEM_STATE_LABEL[state]}, al tope`;
  return ITEM_STATE_LABEL[state];
}

const num = (v: { toString(): string } | null) => (v === null ? null : Number(v.toString()));

function counts(cells: GridCell[]): GridColumn['counts'] {
  const live = (c: GridCell) => c.state === 'PLANNED' || c.state === 'SCHEDULED' || c.state === 'ON';
  return { in: cells.filter(live).length, capped: cells.filter((c) => live(c) && c.capped).length, out: cells.filter((c) => c.state === 'OUT').length, failed: cells.filter((c) => c.state === 'FAILED').length };
}

/** La grilla de un producto. Null si no es de la cuenta. */
export async function loadProductGrid(db: Db, accountId: string, productId: string, now = new Date()): Promise<ProductGrid | null> {
  const promo = await loadProductPromo(db, accountId, productId);
  if (!promo) return null;
  const settings = await loadPromoSettings(db, accountId);
  const live = promo.options.filter((o) => o.status !== 'CLOSED' && o.status !== 'DELETED');
  const measures: GridMeasure[] = [];
  for (const o of live) {
    let m = measures.find((x) => x.mainId === o.mainId);
    if (!m) measures.push((m = { mainId: o.mainId, measure: o.measure, title: live.find((x) => x.publicationId === o.mainId)?.title ?? o.title, stock: o.stock, options: [] }));
    m.options.push({
      publicationId: o.publicationId,
      externalId: o.externalId,
      plan: o.plan,
      planLabel: o.plan === null ? 'Otra forma de cobro' : planLabel(o.plan),
      status: o.status,
      listPrice: o.eco.listPrice,
      discountNow: o.discountNow,
      marginNow: o.marginNow === null ? null : Math.round(o.marginNow * 100) / 100,
      cost: o.eco.cost,
      excluded: o.excluded,
      excludedWhy: o.excludedWhy,
    });
  }
  const slots = await db.promotionSlot.findMany({ where: { productId, finish: { gt: now } }, orderBy: [{ start: 'asc' }, { createdAt: 'asc' }], include: { items: true } });
  const kindOf = new Map(promo.campaigns.map((c) => [c.group, c.kind]));
  const columns: GridColumn[] = slots.map((s) => {
    const cells = live.flatMap((o): GridCell[] => {
      const i = s.items.find((x) => x.publicationId === o.publicationId);
      if (!i) return [];
      const state = i.state as ItemState;
      const reason = i.reason as OutReason | null;
      return [{ publicationId: o.publicationId, state, label: cellLabel(state, i.capped, reason), capped: i.capped, reason, text: i.reasonText, price: num(i.price), discountPct: num(i.discountPct), marginPct: num(i.marginPct), lastError: i.lastError, itemId: i.id }];
    });
    return {
      slotId: s.id,
      group: s.group,
      layer: s.layer as Layer,
      kind: s.kind as SlotKind,
      name: s.name,
      campaignKind: s.group ? (kindOf.get(s.group) ?? null) : null,
      start: s.start,
      finish: s.finish,
      targetMarginPct: Number(s.targetMarginPct),
      source: s.source === 'MANUAL' ? 'MANUAL' : 'PLAN',
      cancelled: s.cancelled,
      note: s.note,
      cells,
      counts: counts(cells),
    };
  });
  // Las campañas del canal que todavía no tienen franja: se muestran igual, calculadas con la rentabilidad saludable.
  const withSlot = new Set(slots.map((s) => s.group).filter(Boolean));
  const seen = new Set<string>();
  for (const c of promo.campaigns) {
    if (withSlot.has(c.group) || seen.has(c.group)) continue;
    if (c.finish && c.finish.getTime() <= now.getTime()) continue;
    seen.add(c.group);
    const { layer, kind } = layerOfType(c.type);
    const target = settings.thresholds.healthyMarginPct;
    const cells = live.map((o): GridCell => {
      const d = decideItem({ slot: { kind, group: c.group, targetMarginPct: target }, option: o, promo, settings });
      return { publicationId: o.publicationId, state: d.state, label: cellLabel(d.state, d.capped, d.reason), capped: d.capped, reason: d.reason, text: d.reasonText, price: d.price, discountPct: d.discountPct, marginPct: d.marginPct, lastError: null, itemId: null };
    });
    const same = promo.campaigns.filter((x) => x.group === c.group);
    const starts = same.map((x) => x.start).filter((d): d is Date => d !== null);
    const finishes = same.map((x) => x.finish).filter((d): d is Date => d !== null);
    columns.push({
      slotId: null,
      group: c.group,
      layer,
      kind,
      name: c.name,
      campaignKind: c.kind,
      start: starts.length > 0 ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null,
      finish: finishes.length > 0 ? new Date(Math.max(...finishes.map((d) => d.getTime()))) : null,
      targetMarginPct: target,
      source: 'CHANNEL',
      cancelled: false,
      note: null,
      cells,
      counts: counts(cells),
    });
  }
  const seenAt = promo.campaigns.map((c) => c.seenAt.getTime());
  return {
    productId: promo.productId,
    name: promo.name,
    brand: promo.brand,
    channelName: promo.channelName,
    tags: promo.tags,
    manual: promo.manual,
    why: promo.why,
    objective: objectiveOf(promo.tags),
    plannedAt: promo.plannedAt,
    competitor: promo.competitor,
    thresholds: settings.thresholds,
    autoApply: settings.autoApply,
    invitationsAt: seenAt.length > 0 ? new Date(Math.min(...seenAt)) : settings.sweptAt,
    measures,
    columns,
  };
}
