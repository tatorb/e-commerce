import type { Compat, MeasureLine } from '@/domain/content';
import { nameValueSchema, type NameValue } from '@/domain/name-value';

// Celdas con varios datos, como la ficha técnica o las fotos: un dato por
// línea, o separados por punto y coma. Cada lector devuelve lo que entendió y
// un aviso por cada cosa que no.

export type Parsed<T> = { items: T[]; warnings: string[] };

const MAX_TEXT = 200;

export function splitItems(raw: string): string[] {
  return raw
    .split(/\r?\n|\r|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "Nombre: valor", uno por línea. */
export function parseSpecs(raw: string): Parsed<NameValue> {
  const items: NameValue[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const item of splitItems(raw)) {
    const i = item.indexOf(':');
    if (i <= 0) {
      warnings.push(`«${item}» no tiene la forma Nombre: valor.`);
      continue;
    }
    const parsed = nameValueSchema.safeParse({ name: item.slice(0, i), value: item.slice(i + 1) });
    if (!parsed.success) {
      warnings.push(`«${item.slice(0, 40)}…» es demasiado largo.`);
      continue;
    }
    const { name, value } = parsed.data;
    if (!value) {
      warnings.push(`«${name}» no tiene valor.`);
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      warnings.push(`«${name}» está repetido: vale el primero.`);
      continue;
    }
    seen.add(key);
    items.push({ name, value });
  }
  return { items: items.slice(0, 200), warnings };
}

function validYear(n: number): boolean {
  return Number.isInteger(n) && n >= 1900 && n <= 2100;
}

/**
 * Años de una compatibilidad: "1995-2012", "1995 a 2012", "2010" (solo ese
 * año), "2010-" (desde) o "-2012" (hasta).
 */
export function parseYears(raw: string): { from: number | null; to: number | null; ok: boolean; swapped: boolean } {
  const s = raw.trim().toLowerCase();
  const none = { from: null, to: null, ok: true, swapped: false };
  if (s === '') return none;
  let m = s.match(/^(\d{4})$/);
  if (m) {
    const y = Number(m[1]);
    return validYear(y) ? { from: y, to: y, ok: true, swapped: false } : { ...none, ok: false };
  }
  m = s.match(/^(\d{4})\s*(?:-|–|\/|a|al|hasta)\s*(\d{4})$/);
  if (m) {
    let from = Number(m[1]);
    let to = Number(m[2]);
    if (!validYear(from) || !validYear(to)) return { ...none, ok: false };
    const swapped = from > to;
    if (swapped) [from, to] = [to, from];
    return { from, to, ok: true, swapped };
  }
  m = s.match(/^(?:desde\s*)?(\d{4})\s*(?:-|–|\+|en adelante)$/) ?? s.match(/^desde\s*(\d{4})$/);
  if (m) {
    const y = Number(m[1]);
    return validYear(y) ? { from: y, to: null, ok: true, swapped: false } : { ...none, ok: false };
  }
  m = s.match(/^(?:-|–|hasta)\s*(\d{4})$/);
  if (m) {
    const y = Number(m[1]);
    return validYear(y) ? { from: null, to: y, ok: true, swapped: false } : { ...none, ok: false };
  }
  return { ...none, ok: false };
}

const part = (s: string | undefined): string | null => {
  const v = (s ?? '').trim();
  return v === '' ? null : v.slice(0, MAX_TEXT);
};

/** "Marca | Modelo | Motor | Años", un vehículo por línea. */
export function parseCompatibilities(raw: string): Parsed<Compat> {
  const items: Compat[] = [];
  const warnings: string[] = [];
  for (const item of splitItems(raw)) {
    const parts = item.split('|');
    if (parts.length < 2) {
      warnings.push(`«${item}» no separa marca, modelo y motor con «|»: se guardó entera como nota.`);
      items.push({ vehicleBrand: null, model: null, engine: null, yearFrom: null, yearTo: null, note: part(item) });
      continue;
    }
    const [brand, model, engine, years, ...rest] = parts;
    const y = parseYears(years ?? '');
    let note = part(rest.join(' | '));
    if (!y.ok) {
      warnings.push(`No se entienden los años «${(years ?? '').trim()}» de «${item}»: quedaron como nota.`);
      note = part([years?.trim(), note].filter(Boolean).join(' | '));
    } else if (y.swapped) {
      warnings.push(`Los años de «${item}» estaban al revés: se dieron vuelta.`);
    }
    items.push({
      vehicleBrand: part(brand),
      model: part(model),
      engine: part(engine),
      yearFrom: y.from,
      yearTo: y.to,
      note,
    });
  }
  return { items: items.slice(0, 500), warnings };
}

/** "SKU: medida", una por línea. Sin SKU, vale si el producto tiene uno solo. */
export function parseMeasures(raw: string): Parsed<MeasureLine> {
  const items: MeasureLine[] = [];
  const warnings: string[] = [];
  for (const item of splitItems(raw)) {
    const i = item.indexOf(':');
    const sku = i > 0 ? item.slice(0, i).trim() : null;
    const measure = (i > 0 ? item.slice(i + 1) : item).trim();
    // "SKU:" sin medida es lo que trae la planilla para completar.
    if (!measure) continue;
    if (measure.length > 100) {
      warnings.push(`La medida «${measure.slice(0, 40)}…» es demasiado larga.`);
      continue;
    }
    items.push({ sku: sku ? sku.slice(0, MAX_TEXT) : null, measure });
  }
  return { items, warnings };
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Links, uno por línea. Se descartan los que no empiezan con http. */
export function parseLinks(raw: string): Parsed<string> {
  const items: string[] = [];
  const warnings: string[] = [];
  for (const item of splitItems(raw).flatMap((s) => s.split(/\s+/)).filter(Boolean)) {
    if (!isHttpUrl(item)) {
      warnings.push(`«${item.slice(0, 60)}» no es un link.`);
      continue;
    }
    if (!items.includes(item)) items.push(item);
  }
  return { items: items.slice(0, 100), warnings };
}
