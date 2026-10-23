import { variantKey, type VariantLike } from './media';

// Las cantidades disponibles de una publicación. Sin medidas, una sola, con la
// clave vacía; con medidas, una por cada una, con la clave de la medida. Este
// módulo no sabe nada de canales.

export type QuantityLine = { key: string; label: string; quantity: number };

// Lo que se puede cargar en una publicación o en una medida.
export const MAX_QUANTITY = 99_999;

export class QuantityError extends Error {}

/** La clave de una medida para las cantidades: la de la medida, o su lugar si no tiene SKU ni medida. */
export function quantityKey(v: VariantLike, index: number): string {
  return variantKey(v) ?? `#${index + 1}`;
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/**
 * Las cantidades como las tiene el canal: una por medida si las tiene, si no
 * el total. Null si no se sabe, por ejemplo si falta la de alguna medida.
 */
export function channelQuantities(total: number | null | undefined, variations: (VariantLike & { quantity?: number | null })[]): QuantityLine[] | null {
  if (variations.length > 0) {
    if (!variations.every((v) => isCount(v.quantity))) return null;
    return variations.map((v, i) => ({ key: quantityKey(v, i), label: v.measure ?? v.sku ?? `Variante ${i + 1}`, quantity: v.quantity as number }));
  }
  return isCount(total) ? [{ key: '', label: '', quantity: total }] : null;
}

/** Lee las cantidades guardadas en la app. Null: sigue a las del canal. */
export function parseQuantities(raw: unknown): QuantityLine[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const lines = raw.flatMap((r) => {
    if (!r || typeof r !== 'object') return [];
    const o = r as Record<string, unknown>;
    return typeof o.key === 'string' && isCount(o.quantity) ? [{ key: o.key, label: typeof o.label === 'string' ? o.label : '', quantity: o.quantity }] : [];
  });
  return lines.length > 0 ? lines : null;
}

/** El total de todas las medidas. */
export function totalQuantity(lines: QuantityLine[] | null): number | null {
  return lines === null ? null : lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Si son las mismas cantidades, sin fijarse en el orden ni en los nombres. */
export function sameQuantities(a: QuantityLine[] | null, b: QuantityLine[] | null): boolean {
  if (a === null || b === null) return a === b;
  const line = (l: QuantityLine) => `${l.key}=${l.quantity}`;
  return a.map(line).sort().join('\n') === b.map(line).sort().join('\n');
}

/** Las cantidades en texto, para mostrar: "12" o "STD: 5 · 0.50: 3". */
export function quantityText(lines: QuantityLine[] | null): string {
  if (lines === null) return '';
  if (lines.length === 1 && lines[0].key === '') return String(lines[0].quantity);
  return lines.map((l) => `${l.label || 'Sin medida'}: ${l.quantity}`).join(' · ');
}

export type QuantityChange = { all: number } | { byKey: Record<string, number> };

/** Cambia las cantidades: la misma en todas las medidas, o la de cada una por su clave. */
export function applyQuantities(base: QuantityLine[], change: QuantityChange): QuantityLine[] {
  const check = (n: number) => {
    if (!isCount(n) || n > MAX_QUANTITY) throw new QuantityError(`La cantidad tiene que ser un número entero de 0 a ${MAX_QUANTITY.toLocaleString('es-AR')}.`);
    return n;
  };
  if ('all' in change) {
    const n = check(change.all);
    return base.map((l) => ({ ...l, quantity: n }));
  }
  const unknown = Object.keys(change.byKey).filter((k) => !base.some((l) => l.key === k));
  if (unknown.length > 0) throw new QuantityError('Las medidas cambiaron: volvé a cargar la página.');
  return base.map((l) => (l.key in change.byKey ? { ...l, quantity: check(change.byKey[l.key]) } : l));
}
