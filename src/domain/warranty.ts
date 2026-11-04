// La garantía de una publicación: de qué tipo es y cuánto dura. La app la
// guarda en este formato propio; cada canal la traduce al suyo en
// src/channels/<canal>/. No usa la base.

export const WARRANTY_TYPES = ['seller', 'factory', 'none'] as const;
export type WarrantyType = (typeof WARRANTY_TYPES)[number];

export const WARRANTY_UNITS = ['days', 'months', 'years'] as const;
export type WarrantyUnit = (typeof WARRANTY_UNITS)[number];

// Sin garantía no tiene tiempo: amount y unit van en null.
export type Warranty = { type: WarrantyType; amount: number | null; unit: WarrantyUnit | null };

export const WARRANTY_TYPE_LABEL: Record<WarrantyType, string> = {
  seller: 'Garantía del vendedor',
  factory: 'Garantía de fábrica',
  none: 'Sin garantía',
};

const UNIT_WORDS: Record<WarrantyUnit, [string, string]> = {
  days: ['día', 'días'],
  months: ['mes', 'meses'],
  years: ['año', 'años'],
};

// Lo más largo que se acepta, para que un error de tipeo no quede como garantía.
const MAX_AMOUNT: Record<WarrantyUnit, number> = { days: 3650, months: 120, years: 10 };

export class WarrantyError extends Error {}

/** El tiempo en palabras, por ejemplo "15 días" o "1 año". */
export function warrantyTimeText(amount: number, unit: WarrantyUnit): string {
  return `${amount} ${UNIT_WORDS[unit][amount === 1 ? 0 : 1]}`;
}

/** La garantía en palabras, por ejemplo "Garantía del vendedor, 15 días". */
export function warrantyLabel(w: Warranty | null): string {
  if (!w) return 'Sin definir';
  if (w.type === 'none' || w.amount === null || w.unit === null) return WARRANTY_TYPE_LABEL[w.type];
  return `${WARRANTY_TYPE_LABEL[w.type]}, ${warrantyTimeText(w.amount, w.unit)}`;
}

const isType = (v: unknown): v is WarrantyType => typeof v === 'string' && (WARRANTY_TYPES as readonly string[]).includes(v);
const isUnit = (v: unknown): v is WarrantyUnit => typeof v === 'string' && (WARRANTY_UNITS as readonly string[]).includes(v);

/** Lee la garantía guardada; null si no hay o no se reconoce. */
export function parseWarranty(raw: unknown): Warranty | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!isType(r.type)) return null;
  if (r.type === 'none') return { type: 'none', amount: null, unit: null };
  const amount = typeof r.amount === 'number' && Number.isInteger(r.amount) && r.amount > 0 ? r.amount : null;
  const unit = isUnit(r.unit) ? r.unit : null;
  return { type: r.type, amount: amount !== null && unit !== null ? amount : null, unit: amount !== null && unit !== null ? unit : null };
}

/**
 * Arma una garantía para guardar a partir de lo que se eligió. Sin garantía
 * no lleva tiempo; las otras lo piden. Lanza WarrantyError con el motivo.
 */
export function makeWarranty(type: WarrantyType, amount?: number | null, unit?: WarrantyUnit | null): Warranty {
  if (type === 'none') return { type, amount: null, unit: null };
  if (amount === null || amount === undefined || unit === null || unit === undefined) {
    throw new WarrantyError(`Falta el tiempo de la ${WARRANTY_TYPE_LABEL[type].toLowerCase()}, por ejemplo 15 días.`);
  }
  if (!Number.isInteger(amount) || amount < 1) throw new WarrantyError('El tiempo de la garantía tiene que ser un número entero mayor que 0.');
  if (amount > MAX_AMOUNT[unit]) throw new WarrantyError(`El tiempo de la garantía no puede pasar de ${warrantyTimeText(MAX_AMOUNT[unit], unit)}.`);
  return { type, amount, unit };
}

/** Lee "15 días", "6 meses" o "1 año". Null si no tiene esa forma. */
export function parseWarrantyTime(raw: string | null | undefined): { amount: number; unit: WarrantyUnit } | null {
  const m = (raw ?? '')
    .trim()
    .toLowerCase()
    .match(/^(\d{1,4})\s*(d[ií]as?|mes(?:es)?|a[ñn]os?)$/);
  if (!m) return null;
  const amount = Number(m[1]);
  if (!(amount > 0)) return null;
  const unit: WarrantyUnit = m[2].startsWith('d') ? 'days' : m[2].startsWith('m') ? 'months' : 'years';
  return { amount, unit };
}

/** La garantía que escribió la ficha, como "6 meses", tomada como del vendedor. Null si no tiene esa forma. */
export function warrantyFromText(raw: string | null | undefined): Warranty | null {
  const time = parseWarrantyTime(raw);
  return time ? { type: 'seller', ...time } : null;
}

/** La garantía como se compara: el mismo tiempo dicho de otra forma no cuenta como cambio. */
export function warrantyKey(w: Warranty | null): string {
  if (!w) return '';
  if (w.type === 'none') return 'none';
  if (w.amount === null || w.unit === null) return w.type;
  // Un año son 12 meses: se comparan en la unidad más chica que sea exacta.
  const months = w.unit === 'years' ? w.amount * 12 : w.unit === 'months' ? w.amount : null;
  return months !== null ? `${w.type} ${months}m` : `${w.type} ${w.amount}d`;
}

export const sameWarranty = (a: Warranty | null, b: Warranty | null) => warrantyKey(a) === warrantyKey(b);

/** Cómo llega una garantía desde una pantalla o desde Claude, antes de validarla. */
export type WarrantyInput = { type: WarrantyType; amount?: number | null; unit?: WarrantyUnit | null };

/** Valida lo que llegó y arma la garantía. Lanza WarrantyError con el motivo. */
export function warrantyFromInput(raw: unknown): Warranty {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new WarrantyError('Elegí el tipo de garantía.');
  const r = raw as Record<string, unknown>;
  if (typeof r.type !== 'string' || !(WARRANTY_TYPES as readonly string[]).includes(r.type)) throw new WarrantyError('Elegí el tipo de garantía.');
  const amount = r.amount === null || r.amount === undefined || r.amount === '' ? null : Number(r.amount);
  if (amount !== null && !Number.isFinite(amount)) throw new WarrantyError('El tiempo de la garantía tiene que ser un número.');
  const unit = typeof r.unit === 'string' && (WARRANTY_UNITS as readonly string[]).includes(r.unit) ? (r.unit as WarrantyUnit) : null;
  return makeWarranty(r.type as WarrantyType, amount, unit);
}
