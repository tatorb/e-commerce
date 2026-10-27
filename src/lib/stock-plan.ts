import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { parseVariations, variantKey, type VariantLike } from '@/domain/media';
import { channelQuantities, quantityText, sameQuantities, type QuantityLine } from '@/domain/quantities';
import { copySkus, isManaged, listingMeasure, plannedQuantities, stockSlots, type StockProduct, type StockSource } from '@/domain/stock';

// Qué cantidad le toca a cada publicación según el stock de su producto, o
// por qué todavía sigue a la de su canal. Recibe la base por parámetro para
// poder probarlo.

type Db = PrismaClient | Prisma.TransactionClient;

export const STOCK_MANAGED = 'La cantidad sale del stock del producto: cambiala en el producto y se sube sola.';

/** Con la actualización automática apagada. */
export const STOCK_OFF = 'La cantidad automática está apagada: la cantidad se cambia a mano en la publicación. Sus ventas igual descuentan del stock del producto.';

const STOCK_PRODUCT_SELECT = {
  id: true,
  name: true,
  stockSince: true,
  variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } },
  stock: { select: { key: true, quantity: true } },
} satisfies Prisma.ProductSelect;

/** Lo que hace falta del producto de una publicación para saber su stock, también si es combo. */
export const SOURCE_SELECT = {
  ...STOCK_PRODUCT_SELECT,
  kind: true,
  comboItems: { orderBy: { position: 'asc' }, select: { quantity: true, product: { select: STOCK_PRODUCT_SELECT } } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof STOCK_PRODUCT_SELECT }>;
export type SourceRow = Prisma.ProductGetPayload<{ select: typeof SOURCE_SELECT }>;

export function stockProduct(p: ProductRow): StockProduct {
  return {
    id: p.id,
    name: p.name,
    slots: stockSlots(p.variants),
    stock: p.stockSince ? Object.fromEntries(p.stock.map((s) => [s.key, s.quantity])) : null,
  };
}

export function sourceOf(p: SourceRow): StockSource {
  return p.kind === 'COMBO'
    ? { kind: 'COMBO', parts: p.comboItems.map((i) => ({ product: stockProduct(i.product), quantity: i.quantity })) }
    : { kind: 'INDIVIDUAL', product: stockProduct(p) };
}

export const PLAN_SELECT = {
  id: true,
  title: true,
  externalId: true,
  variantListings: true,
  variantKey: true,
  followsStock: true,
  channelStatus: true,
  store: { select: { id: true, name: true, salesSince: true, salesError: true, channel: { select: { kind: true, name: true } } } },
  channelCopy: { select: { quantity: true, variations: true, stockInChannel: true, missingSince: true, readAt: true, details: true } },
  product: { select: SOURCE_SELECT },
} satisfies Prisma.PublicationSelect;

export type PlanRow = Prisma.PublicationGetPayload<{ select: typeof PLAN_SELECT }>;

/** La medida que vende una publicación sin medidas en el canal, y el SKU por el que se sabe. */
export type ListingMeasure = { label: string; sku: string | null };

export type StockPlan =
  // Sigue al stock: lo que le toca, lo que tiene en el canal, si hay que subirlo
  // y, si vende una sola medida del producto, cuál.
  | { managed: true; lines: QuantityLine[]; channel: QuantityLine[] | null; pending: boolean; measure: ListingMeasure | null }
  // off: la cantidad automática está apagada en la publicación.
  | { managed: false; reason: string; off?: boolean };

type ManagedPlan = Extract<StockPlan, { managed: true }>;

/** Si la publicación tiene prendida la cantidad automática. Sin plan, como viene de entrada. */
export const followsStockOf = (plan: StockPlan | null | undefined): boolean => !(plan && !plan.managed && plan.off);

/** Lo que le toca, en texto, con la medida si vende una sola: "0.50: 2". */
export function plannedText(plan: ManagedPlan): string {
  return plan.measure ? `${plan.measure.label}: ${quantityText(plan.lines)}` : quantityText(plan.lines);
}

/** Por qué la cantidad no se cambia en la publicación, con la medida que vende si es una sola. */
export function managedNote(plan: ManagedPlan, channelName: string): string {
  if (!plan.measure) return STOCK_MANAGED;
  const { label, sku } = plan.measure;
  // Sin medida cargada en la ficha, la medida se nombra por su SKU: no se repite.
  const which = sku && sku !== label ? `la medida ${label} del producto, por su SKU ${sku} en ${channelName}` : `la medida ${label} del producto`;
  return `Vende solo ${which}. ${STOCK_MANAGED}`;
}

/** Si la tienda lee las ventas: sin eso, el stock del producto no sabe lo que se vendió en ella. */
export const readsSales = (store: { salesSince: Date | null; salesError: string | null }) => store.salesSince !== null && store.salesError === null;

/**
 * La medida de una publicación que se publica sola, sin medidas en el canal:
 * la elegida en la publicación (variantKey) o, si no hay, la de su SKU.
 */
export function singleMeasure(product: { variants: VariantLike[] }, copy: { details: unknown } | null, chosen?: string | null): VariantLike | null {
  const slots = stockSlots(product.variants);
  if (chosen && slots.length >= 2) {
    const found = product.variants.find((v) => variantKey(v) === chosen);
    return found ? { sku: found.sku, measure: found.measure } : null;
  }
  return copy ? listingMeasure(slots, copySkus(copy.details)) : null;
}

export function planFor(p: PlanRow): StockPlan {
  const channelName = getChannelAdapter(p.store.channel.kind, p.store.channel.name).name;
  const copy = p.channelCopy;
  if (!p.followsStock) return { managed: false, reason: STOCK_OFF, off: true };
  const source = sourceOf(p.product);
  if (!isManaged(source)) {
    return {
      managed: false,
      reason: source.kind === 'COMBO' ? 'Alguna pieza del combo todavía no tiene stock en la app: la cantidad sigue a la del canal.' : 'El producto todavía no tiene stock en la app: la cantidad sigue a la del canal.',
    };
  }
  if (!p.externalId) return { managed: false, reason: `Todavía no está publicada en ${channelName}.` };
  if (copy?.stockInChannel) return { managed: false, reason: `El stock lo maneja ${channelName}, por ejemplo porque está en Full: no sale del producto.` };
  if (!readsSales(p.store)) {
    return { managed: false, reason: `La tienda todavía no lee las ventas de ${channelName}: hasta que pueda, la cantidad sigue a la del canal.` };
  }
  if (!copy || copy.missingSince) return { managed: false, reason: `Todavía no se leyó de ${channelName}.` };
  const variations = parseVariations(copy.variations);
  const single = variations.length === 0 ? singleMeasure(p.product, copy, p.variantKey) : null;
  const planned = plannedQuantities(variations, source, single);
  if ('reason' in planned) return { managed: false, reason: planned.reason };
  const channel = channelQuantities(copy.quantity, variations);
  const measure = single ? { label: single.measure ?? single.sku ?? '', sku: single.sku ?? null } : null;
  return { managed: true, lines: planned.lines, channel, pending: !sameQuantities(planned.lines, channel), measure };
}

/** Si la cantidad de la publicación sale del stock del producto. */
export async function stockManaged(db: Db, publicationId: string): Promise<boolean> {
  const p = await db.publication.findUnique({ where: { id: publicationId }, select: PLAN_SELECT });
  return p ? planFor(p).managed : false;
}

/** El plan de varias publicaciones, por su id. */
export async function plansFor(db: Db, publicationIds: string[]): Promise<Map<string, StockPlan>> {
  if (publicationIds.length === 0) return new Map();
  const rows = await db.publication.findMany({ where: { id: { in: publicationIds } }, select: PLAN_SELECT });
  return new Map(rows.map((r) => [r.id, planFor(r)]));
}
