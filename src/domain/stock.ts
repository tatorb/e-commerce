import type { StockMoveKind } from '@/generated/prisma/enums';
import { measureText, variantKey, type VariantLike } from './media';
import { MAX_QUANTITY, quantityKey, type QuantityLine } from './quantities';
import { cushionShown, SHOWN_WHEN_SHORT, type CushionState } from './stock-cushion';

// El stock es del producto: uno por medida, o uno solo si no tiene medidas.
// Sus publicaciones lo heredan; un combo, de sus piezas. Este módulo no sabe
// nada de canales ni de la base de datos, para poder probarlo solo.

export class StockError extends Error {}

/** La clave del stock de un producto sin medidas. */
export const NO_MEASURE = '';

export const STOCK_MOVE_LABEL: Record<StockMoveKind, string> = {
  INITIAL: 'Stock inicial',
  SALE: 'Venta',
  CANCEL: 'Venta cancelada',
  MANUAL: 'Cambio a mano',
};

/** Una medida del producto en que se lleva el stock. */
export type StockSlot = VariantLike & { key: string; label: string };

/**
 * Las medidas en que se lleva el stock: una por medida si tiene dos o más, o
 * una sola, con la clave vacía. Las claves son las mismas que las de las
 * cantidades de las publicaciones, así no se pierden al volver a guardar la ficha.
 */
export function stockSlots(variants: VariantLike[]): StockSlot[] {
  if (variants.length < 2) {
    const only = variants[0];
    return [{ key: NO_MEASURE, label: only?.measure ?? '', sku: only?.sku ?? null, measure: only?.measure ?? null }];
  }
  return variants.map((v, i) => ({ key: quantityKey(v, i), label: v.measure ?? v.sku ?? `Medida ${i + 1}`, sku: v.sku, measure: v.measure }));
}

const skuText = (sku: string | null | undefined) => sku?.trim().toUpperCase() || null;

/**
 * Qué medida del producto es una del canal: la misma clave, si no el mismo SKU
 * y si no la misma medida. Null si no hay una sola que coincida.
 */
export function matchSlot(slots: StockSlot[], v: VariantLike): string | null {
  if (slots.length === 1 && slots[0].key === NO_MEASURE) return NO_MEASURE;
  const key = variantKey(v);
  const exact = key ? slots.find((s) => variantKey(s) === key) : undefined;
  if (exact) return exact.key;
  const sku = skuText(v.sku);
  const bySku = sku ? slots.filter((s) => skuText(s.sku) === sku) : [];
  if (bySku.length === 1) return bySku[0].key;
  const measure = measureText(v.measure);
  const byMeasure = measure ? slots.filter((s) => measureText(s.measure) === measure) : [];
  return byMeasure.length === 1 ? byMeasure[0].key : null;
}

/** Los SKU que leyó el canal de la publicación, guardados con su copia. */
export function copySkus(details: unknown): string[] {
  const skus = details && typeof details === 'object' && !Array.isArray(details) ? (details as { skus?: unknown }).skus : null;
  return Array.isArray(skus) ? skus.filter((s): s is string => typeof s === 'string') : [];
}

/** El producto del canal al que pertenece la publicación, guardado con su copia. Null si el canal no lo informa. */
export function copyChannelProduct(details: unknown): string | null {
  const id = details && typeof details === 'object' && !Array.isArray(details) ? (details as { channelProductId?: unknown }).channelProductId : null;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

/**
 * De qué medida es una publicación que en el canal no tiene medidas, de un
 * producto que sí las tiene: cuando cada medida se publica aparte. Sale de su
 * SKU. Null si no hay una sola medida con ese SKU.
 */
export function listingMeasure(slots: StockSlot[], skus: string[]): VariantLike | null {
  if (slots.length < 2) return null;
  const wanted = new Set(skus.map(skuText));
  const found = slots.filter((s) => {
    const sku = skuText(s.sku);
    return sku !== null && wanted.has(sku);
  });
  return found.length === 1 ? { sku: found[0].sku, measure: found[0].measure } : null;
}

// ───────────────────────────── De dónde sale el stock ─────────────────────────────

/** Un producto con su stock. stock null: la app todavía no lo maneja. */
export type StockProduct = {
  id: string;
  name: string;
  slots: StockSlot[];
  stock: Record<string, number> | null;
  // "Mostrar más de 5" y cómo está la alarma de cada medida (src/domain/stock-cushion.ts).
  showMore?: boolean;
  alarms?: Record<string, CushionState>;
};

/** Lo que vende una publicación: un producto, o las piezas de un combo con cuántas lleva de cada una. */
export type StockSource = { kind: 'INDIVIDUAL'; product: StockProduct } | { kind: 'COMBO'; parts: { product: StockProduct; quantity: number }[] };

/** Si la app maneja el stock de lo que vende la publicación. */
export function isManaged(source: StockSource): boolean {
  return source.kind === 'INDIVIDUAL' ? source.product.stock !== null : source.parts.length > 0 && source.parts.every((p) => p.product.stock !== null);
}

/**
 * La medida de una pieza para una medida del canal. En un combo las piezas
 * tienen otro SKU que el combo: se buscan por la medida.
 */
function partKey(product: StockProduct, v: VariantLike | null, byMeasureOnly: boolean): string | null {
  if (product.slots.length === 1) return NO_MEASURE;
  if (!v) return null;
  return matchSlot(product.slots, byMeasureOnly ? { sku: null, measure: v.measure } : v);
}

/** Lo que sale del stock al vender una unidad de esa medida: cada producto, su medida y cuántas. Null si no se sabe. */
export function unitParts(source: StockSource, v: VariantLike | null): { productId: string; key: string; quantity: number }[] | null {
  if (source.kind === 'INDIVIDUAL') {
    const key = partKey(source.product, v, false);
    return key === null ? null : [{ productId: source.product.id, key, quantity: 1 }];
  }
  const out: { productId: string; key: string; quantity: number }[] = [];
  for (const part of source.parts) {
    const key = partKey(part.product, v, true);
    if (key === null) return null;
    out.push({ productId: part.product.id, key, quantity: part.quantity });
  }
  return out.length > 0 ? out : null;
}

/** Cuántas hay disponibles de esa medida: las del producto, o los combos que se pueden armar. Null si no se sabe. */
export function available(source: StockSource, v: VariantLike | null): number | null {
  const parts = unitParts(source, v);
  if (!parts) return null;
  const products = source.kind === 'INDIVIDUAL' ? [source.product] : source.parts.map((p) => p.product);
  let best = Infinity;
  for (const part of parts) {
    const stock = products.find((p) => p.id === part.productId)?.stock;
    if (!stock) return null;
    // Una medida nueva en la ficha, sin stock cargado todavía: no hay.
    best = Math.min(best, Math.floor(Math.max(stock[part.key] ?? 0, 0) / part.quantity));
  }
  return Number.isFinite(best) ? Math.min(best, MAX_QUANTITY) : null;
}

/**
 * Cuántas tiene que mostrar el canal de esa medida: las que hay o, con
 * "Mostrar más de 5", 6 aunque haya menos. Un combo muestra 6 solo si todas
 * sus piezas tienen la opción y alcanza para armar al menos uno: un combo
 * nunca se vende sin tener. Null si no se sabe.
 */
export function shownAvailable(source: StockSource, v: VariantLike | null): number | null {
  const n = available(source, v);
  if (n === null) return null;
  if (source.kind === 'COMBO') {
    const all = source.parts.length > 0 && source.parts.every((p) => p.product.showMore);
    return all && n >= 1 ? Math.min(Math.max(n, SHOWN_WHEN_SHORT), MAX_QUANTITY) : n;
  }
  const product = source.product;
  if (!product.showMore || !product.stock) return n;
  const key = unitParts(source, v)![0].key;
  return Math.min(cushionShown(product.stock[key] ?? 0, true, product.alarms?.[key] ?? null), MAX_QUANTITY);
}

/**
 * Las cantidades que tiene que tener la publicación: una por cada medida que
 * tiene en el canal, o una sola. single: la medida de una publicación sin
 * medidas, si se sabe por su SKU. Si alguna no se puede saber, el motivo.
 */
export function plannedQuantities(variations: VariantLike[], source: StockSource, single: VariantLike | null = null): { lines: QuantityLine[] } | { reason: string } {
  if (variations.length === 0) {
    const n = shownAvailable(source, single);
    if (n === null) {
      return { reason: 'La publicación no tiene medidas y el producto sí, y su SKU no dice de cuál es: no se sabe de qué medida sale su cantidad.' };
    }
    return { lines: [{ key: '', label: '', quantity: n }] };
  }
  const lines: QuantityLine[] = [];
  const unknown: string[] = [];
  variations.forEach((v, i) => {
    const label = v.measure ?? v.sku ?? `Variante ${i + 1}`;
    const n = shownAvailable(source, v);
    if (n === null) unknown.push(label);
    else lines.push({ key: quantityKey(v, i), label, quantity: n });
  });
  if (unknown.length > 0) {
    return { reason: `${unknown.length === 1 ? 'La medida' : 'Las medidas'} ${unknown.join(', ')} de la publicación no ${unknown.length === 1 ? 'está' : 'están'} en el producto.` };
  }
  return { lines };
}

// ───────────────────────────── El de partida ─────────────────────────────

/** Lo que tiene cada publicación en el canal, por medida del producto. single: como en plannedQuantities. */
export function observedStock(slots: StockSlot[], channel: QuantityLine[], variations: VariantLike[], single: VariantLike | null = null): Record<string, number> {
  const out: Record<string, number> = {};
  if (variations.length === 0) {
    const key = slots.length === 1 ? NO_MEASURE : single ? matchSlot(slots, single) : null;
    if (key !== null && channel.length === 1) out[key] = channel[0].quantity;
    return out;
  }
  variations.forEach((v, i) => {
    const key = matchSlot(slots, v);
    const line = channel.find((l) => l.key === quantityKey(v, i));
    if (key !== null && line) out[key] = Math.min(out[key] ?? Infinity, line.quantity);
  });
  return out;
}

/**
 * El stock de partida: en cada medida, la cantidad más baja de sus
 * publicaciones, para no vender de más. Si eran distintas o falta alguna, lo
 * dice para revisar.
 */
export function initialStock(slots: StockSlot[], observed: Record<string, number>[]): { lines: { key: string; label: string; quantity: number }[]; review: string | null } {
  const notes: string[] = [];
  const lines = slots.map((s) => {
    const values = observed.flatMap((o) => (s.key in o ? [o[s.key]] : []));
    const name = s.label ? `${s.label}: ` : '';
    if (values.length === 0) {
      notes.push(`${name}ninguna publicación tenía cantidad, quedó en 0`);
      return { key: s.key, label: s.label, quantity: 0 };
    }
    const unique = [...new Set(values)].sort((a, b) => a - b);
    if (unique.length > 1) notes.push(`${name}las publicaciones tenían ${unique.join(', ')}, quedó ${unique[0]}`);
    return { key: s.key, label: s.label, quantity: Math.max(0, unique[0]) };
  });
  return { lines, review: notes.length > 0 ? `Al empezar a llevar el stock, ${notes.join('; ')}.` : null };
}

// ───────────────────────────── Lo que se escribe ─────────────────────────────

/** El stock que se carga a mano, por medida. Solo números enteros de 0 en adelante. */
export function parseStockChange(raw: unknown, slots: StockSlot[]): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new StockError('No llegó el stock.');
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!slots.some((s) => s.key === key)) throw new StockError('Las medidas del producto cambiaron: volvé a cargar la página.');
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > MAX_QUANTITY) {
      throw new StockError(`El stock tiene que ser un número entero de 0 a ${MAX_QUANTITY.toLocaleString('es-AR')}.`);
    }
    out[key] = n;
  }
  if (Object.keys(out).length === 0) throw new StockError('No llegó el stock.');
  return out;
}

/** El stock en texto: "12" o "STD: 5 · 0.50: 3". */
export function stockText(lines: { label: string; quantity: number }[]): string {
  if (lines.length === 1) return String(lines[0].quantity);
  return lines.map((l) => `${l.label || 'Sin medida'}: ${l.quantity}`).join(' · ');
}
