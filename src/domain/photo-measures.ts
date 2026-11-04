import { measureText, type VariantLike } from './media';

// De qué medida es cada foto o video sacado para una medida, y la medida que
// vende cada publicación de una familia. La app las reconoce por su SKU y su
// medida juntos (variantKey). Si la medida cambió de nombre o de SKU antes de
// que la app mudara las marcas sola, la marca quedó con la clave vieja: la
// foto ya no es de ninguna medida de la ficha. Acá se detecta y se adivina
// cuál era, para proponerla; nunca se cambia sola. No usa la base.

export type MeasureOption = { key: string; label: string; sku: string | null; measure: string | null };

export type MarkState =
  // Sin medida: es de todas.
  | { kind: 'all' }
  | { kind: 'measure'; key: string; label: string }
  // Con una medida que ya no está en la ficha. guess: la que parece ser, si se puede saber.
  | { kind: 'unknown'; label: string; guess: MeasureOption | null };

/** Una medida como se compara: además de measureText, la O que se escribió por un cero ("O.60" es 0.60). */
export function measureCompare(value: string | null | undefined): string | null {
  const m = measureText(value);
  return m ? m.replace(/^o(?=[.\d])/, '0') : null;
}

/** Lo que dice una clave vieja: su SKU y su medida. */
function keyParts(key: string): { sku: string | null; measure: string | null } {
  const sku = key.match(/sku:(\S+)/)?.[1] ?? null;
  const measure = key.match(/medida:(\S+)/)?.[1] ?? null;
  return { sku: sku?.toUpperCase() ?? null, measure };
}

/** La medida de la ficha que parece ser una clave o un nombre viejo. Null si no se puede saber con certeza. */
export function guessMeasure(key: string | null, label: string | null, measures: MeasureOption[]): MeasureOption | null {
  const parts = key ? keyParts(key) : { sku: null, measure: null };
  const only = (list: MeasureOption[]) => (list.length === 1 ? list[0] : null);
  // Primero el SKU, que no se repite entre medidas.
  if (parts.sku) {
    const bySku = only(measures.filter((m) => m.sku?.trim().toUpperCase() === parts.sku));
    if (bySku) return bySku;
  }
  for (const text of [parts.measure, label]) {
    const t = measureCompare(text);
    if (!t) continue;
    const byMeasure = only(measures.filter((m) => measureCompare(m.measure) === t || measureCompare(m.label) === t));
    if (byMeasure) return byMeasure;
  }
  return null;
}

/** De qué medida es una marca (de una foto, un video o una publicación de una familia). */
export function markState(key: string | null, label: string | null, measures: MeasureOption[]): MarkState {
  if (!key) return { kind: 'all' };
  const found = measures.find((m) => m.key === key);
  if (found) return { kind: 'measure', key: found.key, label: found.label };
  return { kind: 'unknown', label: label?.trim() || keyParts(key).measure || keyParts(key).sku || key, guess: guessMeasure(key, label, measures) };
}

/** Cómo se llama una medida en las marcas: su medida o, si no tiene, su SKU. */
export const markLabelOf = (v: VariantLike) => v.measure?.trim() || v.sku?.trim() || '';
