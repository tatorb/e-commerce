import type { NameValue } from './name-value';

// Datos de catálogo: los campos del formulario de un canal para la categoría
// de la publicación, por ejemplo "Tipo de embrague" o "Incluye disco". Cada
// canal define sus categorías y campos; este módulo no conoce ninguno: solo
// lee las definiciones, limpia los valores y los guarda en los atributos de la
// publicación, como { name, value } con el nombre del campo.

export type CatalogFieldType = 'text' | 'list' | 'boolean' | 'number' | 'number_unit';

/** Los datos de la ficha que un canal también pide. */
export type ProductSourceField = 'brand' | 'partNumber' | 'origin';

export type CatalogField = {
  id: string;
  label: string;
  type: CatalogFieldType;
  /** En list, las únicas opciones válidas. En text, sugerencias: se puede escribir otra cosa. */
  options?: string[];
  units?: string[];
  defaultUnit?: string;
  /** Acepta varios valores, por ejemplo varios códigos OEM. */
  multiple?: boolean;
  required?: boolean;
  /** Sale de la ficha: se muestra y no se carga dos veces. */
  fromProduct?: ProductSourceField;
};

export type CatalogCategory = { id: string; name: string; fields: CatalogField[] };

/** Lo que un canal sabe de sus categorías. */
export interface ChannelCatalog {
  /** Todas, para elegir a mano. */
  categories: { id: string; name: string }[];
  /** La categoría que le toca a una familia de producto, si tiene una. */
  categoryForFamily(family: string | null): string | null;
  /** Al revés: la familia de una categoría. Si varias comparten la categoría, decide el título. */
  familyForCategory(categoryId: string, title: string | null): string | null;
  category(id: string): CatalogCategory | null;
}

export class CatalogError extends Error {}

export const BOOLEAN_OPTIONS = ['Sí', 'No'] as const;
export const MAX_VALUES = 30;
const MAX_TEXT = 255;

export const PRODUCT_FIELD_LABEL: Record<ProductSourceField, string> = {
  brand: 'Marca',
  partNumber: 'Número de pieza',
  origin: 'Origen',
};

/** Para comparar nombres y opciones sin mayúsculas, tildes ni espacios de más. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ───────────────────────────── Categoría ─────────────────────────────

export type ResolvedCatalog = {
  category: CatalogCategory | null;
  /** De dónde salió: la familia del producto o la elección a mano. */
  source: 'family' | 'manual' | null;
  /** La que le toca a la familia, aunque se haya elegido otra. */
  familyCategory: CatalogCategory | null;
};

/** La categoría de la publicación: la elegida a mano o, si no hay, la de la familia. */
export function resolveCatalog(catalog: ChannelCatalog, family: string | null, chosen: string | null): ResolvedCatalog {
  const familyId = catalog.categoryForFamily(family);
  const familyCategory = familyId ? catalog.category(familyId) : null;
  const manual = chosen ? catalog.category(chosen) : null;
  if (manual) return { category: manual, source: 'manual', familyCategory };
  return { category: familyCategory, source: familyCategory ? 'family' : null, familyCategory };
}

/** Busca una categoría por código o por nombre. */
export function findCategory(catalog: ChannelCatalog, key: string): CatalogCategory | null {
  const k = normalizeText(key);
  const match = catalog.categories.find((c) => normalizeText(c.id) === k || normalizeText(c.name) === k);
  return match ? catalog.category(match.id) : null;
}

/** Los campos que se cargan en la tarjeta: todos menos los que salen de la ficha. */
export function editableFields(category: CatalogCategory): CatalogField[] {
  return category.fields.filter((f) => !f.fromProduct);
}

/** Busca un campo por código o por nombre. */
export function findField(fields: CatalogField[], key: string): CatalogField | null {
  const k = normalizeText(key);
  return fields.find((f) => normalizeText(f.id) === k || normalizeText(f.label) === k) ?? null;
}

// ───────────────────────────── Valores ─────────────────────────────

const UNIT_ALIASES: Record<string, string> = { pulgada: '"', pulgadas: '"', in: '"', "''": '"', '″': '"' };

function parseNumber(raw: string): number | null {
  const t = raw.replace(/\s/g, '');
  if (!/^\d+(?:[.,]\d+)?$/.test(t)) return null;
  return Number(t.replace(',', '.'));
}

/** "76,5 mm" da { number: "76.5", unit: "mm" }. Sin unidad, la unidad es null. */
export function splitNumberUnit(value: string): { number: string; unit: string | null } {
  const m = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return { number: value.trim(), unit: null };
  return { number: m[1].replace(',', '.'), unit: m[2].trim() || null };
}

const list = (items: readonly string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} o ${items[items.length - 1]}`;

function matchOption(options: readonly string[], value: string): string | null {
  const v = normalizeText(value);
  return options.find((o) => normalizeText(o) === v) ?? null;
}

function cleanOne(field: CatalogField, raw: string): string {
  const value = raw.replace(/\s+/g, ' ').trim();
  if (value.length > MAX_TEXT) throw new CatalogError(`${field.label}: máximo ${MAX_TEXT} caracteres.`);
  switch (field.type) {
    case 'text':
      return (field.options && matchOption(field.options, value)) ?? value;
    case 'list': {
      const option = matchOption(field.options ?? [], value);
      if (!option) throw new CatalogError(`${field.label}: «${value}» no es una opción. Puede ser ${list(field.options ?? [])}.`);
      return option;
    }
    case 'boolean': {
      const v = normalizeText(value);
      if (['si', 'yes', 'true'].includes(v)) return 'Sí';
      if (['no', 'false'].includes(v)) return 'No';
      throw new CatalogError(`${field.label}: tiene que ser Sí o No.`);
    }
    case 'number': {
      const n = parseNumber(value);
      if (n === null) throw new CatalogError(`${field.label}: tiene que ser un número.`);
      return String(n);
    }
    case 'number_unit': {
      const { number, unit } = splitNumberUnit(value);
      const n = parseNumber(number);
      if (n === null) throw new CatalogError(`${field.label}: tiene que ser un número con su unidad, por ejemplo 76.5 ${field.defaultUnit ?? ''}.`.trim());
      const units = field.units ?? [];
      const wanted = unit ? (UNIT_ALIASES[unit.toLowerCase()] ?? unit) : (field.defaultUnit ?? units[0]);
      const match = units.find((u) => u.toLowerCase() === wanted?.toLowerCase());
      if (!match) throw new CatalogError(`${field.label}: la unidad tiene que ser ${list(units)}.`);
      return `${n} ${match}`;
    }
  }
}

/** Limpia el valor de un campo. Vacío da null. Si no es válido, explica por qué. */
export function cleanCatalogValue(field: CatalogField, raw: string | string[] | null | undefined): string | null {
  if (field.fromProduct) {
    throw new CatalogError(`${field.label} sale de la ficha del producto: se cambia ahí.`);
  }
  if (raw === null || raw === undefined) return null;
  const parts = (Array.isArray(raw) ? raw : field.multiple ? raw.split(/[,;\n]/) : [raw])
    .map((p) => p.trim())
    .filter((p) => p !== '');
  if (parts.length === 0) return null;
  if (!field.multiple && parts.length > 1) throw new CatalogError(`${field.label} acepta un solo valor.`);
  const out: string[] = [];
  for (const p of parts) {
    const clean = cleanOne(field, p);
    if (!out.some((o) => normalizeText(o) === normalizeText(clean))) out.push(clean);
  }
  if (out.length > MAX_VALUES) throw new CatalogError(`${field.label}: hasta ${MAX_VALUES} valores.`);
  return out.join(', ');
}

/** Limpia todos los valores que llegan, por código o nombre de campo. */
export function cleanCatalogValues(
  fields: CatalogField[],
  input: Record<string, string | string[] | null | undefined>,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [key, raw] of Object.entries(input)) {
    const field = findField(fields, key);
    if (!field) {
      const own = fields.filter((f) => !f.fromProduct).map((f) => f.id);
      throw new CatalogError(`No hay un campo «${key}» en esta categoría. Los campos son ${list(own)}.`);
    }
    out[field.id] = cleanCatalogValue(field, raw);
  }
  return out;
}

/** Lo que ya está cargado en los atributos de la publicación, por código de campo. */
export function readCatalogValues(fields: CatalogField[], attributes: NameValue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f.fromProduct) continue;
    const rows = attributes.filter((a) => normalizeText(a.name) === normalizeText(f.label) && a.value.trim() !== '');
    if (rows.length === 0) continue;
    out[f.id] = f.multiple ? rows.map((r) => r.value).join(', ') : rows[0].value;
  }
  return out;
}

/**
 * Pone en los atributos los campos que llegan, en el orden del formulario. Un
 * campo con null se borra. Los campos que no llegan y los atributos que no son
 * de la categoría quedan como estaban, al final.
 */
export function mergeCatalogAttributes(
  attributes: NameValue[],
  fields: CatalogField[],
  values: Record<string, string | null>,
): NameValue[] {
  const own = fields.filter((f) => !f.fromProduct);
  const ownNames = new Set(own.map((f) => normalizeText(f.label)));
  const out: NameValue[] = [];
  for (const f of own) {
    if (f.id in values) {
      const v = values[f.id];
      if (v) out.push({ name: f.label, value: v });
    } else {
      out.push(...attributes.filter((a) => normalizeText(a.name) === normalizeText(f.label)));
    }
  }
  out.push(...attributes.filter((a) => !ownNames.has(normalizeText(a.name))));
  return out;
}
