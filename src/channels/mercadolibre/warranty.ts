import { parseWarrantyTime, type Warranty, type WarrantyType, type WarrantyUnit } from '@/domain/warranty';

// La garantía en Mercado Libre: va en los términos de venta (sale_terms) de
// la publicación, con su tipo (WARRANTY_TYPE) y su tiempo (WARRANTY_TIME).
// Acá se traduce entre ese formato y el de la app.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : typeof v === 'number' ? String(v) : null);

export const WARRANTY_TYPE = 'WARRANTY_TYPE';
export const WARRANTY_TIME = 'WARRANTY_TIME';

// Los códigos de cada tipo en Mercado Libre, y su nombre.
const TYPE_IDS: Record<string, WarrantyType> = { '2230280': 'seller', '2230279': 'factory', '6150835': 'none' };
const TYPE_NAMES: Record<WarrantyType, string> = { seller: 'Garantía del vendedor', factory: 'Garantía de fábrica', none: 'Sin garantía' };
// Las unidades que acepta Mercado Libre para el tiempo.
const UNIT_NAMES: Record<WarrantyUnit, string> = { days: 'días', months: 'meses', years: 'años' };

function typeOf(term: Obj): WarrantyType | null {
  const id = str(term.value_id);
  if (id && TYPE_IDS[id]) return TYPE_IDS[id];
  const name = (str(term.value_name) ?? '').toLowerCase();
  if (/sin garant/.test(name)) return 'none';
  if (/f[aá]brica/.test(name)) return 'factory';
  if (/vendedor/.test(name)) return 'seller';
  return null;
}

function timeOf(term: Obj): { amount: number; unit: WarrantyUnit } | null {
  const struct = isObj(term.value_struct) ? term.value_struct : null;
  if (struct && typeof struct.number === 'number') {
    const parsed = parseWarrantyTime(`${struct.number} ${str(struct.unit) ?? ''}`);
    if (parsed) return parsed;
  }
  return parseWarrantyTime(str(term.value_name));
}

/** La garantía de una publicación leída de Mercado Libre. Sin términos de garantía: sin garantía. */
export function warrantyOf(item: Obj): Warranty {
  const terms = Array.isArray(item.sale_terms) ? item.sale_terms.filter(isObj) : [];
  const typeTerm = terms.find((t) => t.id === WARRANTY_TYPE);
  const timeTerm = terms.find((t) => t.id === WARRANTY_TIME);
  const time = timeTerm ? timeOf(timeTerm) : null;
  // Un tiempo sin tipo se toma como garantía del vendedor.
  const type = typeTerm ? typeOf(typeTerm) : time ? 'seller' : 'none';
  if (type === null || type === 'none') return { type: type ?? 'none', amount: null, unit: null };
  return { type, amount: time?.amount ?? null, unit: time?.unit ?? null };
}

/** Los términos de garantía que se mandan a Mercado Libre. */
export function warrantyTerms(w: Warranty): { id: string; value_name: string }[] {
  const type = { id: WARRANTY_TYPE, value_name: TYPE_NAMES[w.type] };
  if (w.type === 'none' || w.amount === null || w.unit === null) return [type];
  return [type, { id: WARRANTY_TIME, value_name: `${w.amount} ${UNIT_NAMES[w.unit]}` }];
}

/**
 * Los términos de venta para mandar: los que ya tenía, como estaban, salvo la
 * garantía, que va la nueva. Así no se pierde ninguno, por ejemplo los días de
 * disponibilidad.
 */
export function withWarranty(current: unknown, w: Warranty): Obj[] {
  const kept = (Array.isArray(current) ? current.filter(isObj) : [])
    .filter((t) => typeof t.id === 'string' && t.id !== WARRANTY_TYPE && t.id !== WARRANTY_TIME)
    .map((t) => {
      const valueId = str(t.value_id);
      const valueName = str(t.value_name);
      return { id: t.id as string, ...(valueId ? { value_id: valueId } : {}), ...(valueName ? { value_name: valueName } : {}) };
    })
    .filter((t) => 'value_id' in t || 'value_name' in t);
  return [...kept, ...warrantyTerms(w)];
}
