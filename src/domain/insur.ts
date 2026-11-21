// El sistema de Insur: cómo se cruza cada artículo de Insur con una medida de
// un producto de la app, cuánto stock queda y qué costo se acepta. Insur es la
// fuente del stock y del costo; las ventas de los canales no las registra, así
// que se restan acá desde la fecha de corte. Sin la base de datos, para poder
// probarlo solo.

// ───────────────────────────── Códigos y medidas ─────────────────────────────

/** Un número de pieza para comparar: mayúsculas, sin espacios, puntos, guiones ni barras ("10070/4" y "10070-4" son el mismo). */
export const normPart = (s: string | null | undefined): string => (s ?? '').toUpperCase().replace(/[\s.\-/]+/g, '');

/**
 * El código de Insur separado en número de pieza y medida. Con medida, el
 * código es "número de pieza + espacio + medida" ("SP-169 040"); sin medida,
 * Insur manda "-" y el código es el número de pieza tal cual.
 */
export function splitInsurCode(code: string, measureName: string | null | undefined): { part: string; measure: string | null } {
  const whole = code.trim();
  const measure = (measureName ?? '').trim();
  if (!measure || measure === '-') return { part: whole, measure: null };
  if (whole.toUpperCase().endsWith(` ${measure.toUpperCase()}`)) return { part: whole.slice(0, whole.length - measure.length).trim(), measure };
  // La medida no está al final del código: el código entero es el número de pieza.
  return { part: whole, measure };
}

// Las sobremedidas que se escriben con tres cifras ("020" es 0,20). Otra cosa
// con tres cifras, como "005" o "013", no se adivina.
const KNOWN_HUNDREDTHS = new Set([10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90]);

/**
 * Una medida como número, en centésimas: STD es 0, "040" es 40, "0.50" o
 * "0,50" es 50, "-030" o "-0,30" es -30, "+0,50" es 50. Null si no se puede
 * traducir sin dudas ("+4", "005", "-411").
 */
export function measureHundredths(text: string | null | undefined): number | null {
  const t = (text ?? '').trim().toUpperCase().replace(/\s*MM$/, '').replace(',', '.');
  if (!t) return null;
  if (t === 'STD' || t === 'STANDARD' || t === 'ESTANDAR' || t === 'ESTÁNDAR') return 0;
  const decimal = t.match(/^([+-])?(\d)\.(\d{1,2})$/);
  if (decimal) {
    const value = Number(decimal[2]) * 100 + Number(decimal[3].padEnd(2, '0'));
    return decimal[1] === '-' ? -value : value;
  }
  const three = t.match(/^([+-])?0(\d{2})$/);
  if (three) {
    const value = Number(three[2]);
    if (value === 0) return three[1] ? null : 0;
    if (!KNOWN_HUNDREDTHS.has(value)) return null;
    return three[1] === '-' ? -value : value;
  }
  return null;
}

/**
 * La medida que dice el final de un SKU: "SP-169-00" es STD, "SP-169-50" es
 * 0,50 y "364632+50" es +0,50. Un guion antes del número puede ser un
 * separador o un menos ("317615-30" es -0,30): es separador si en la familia
 * hay un SKU terminado en "-00", y es un menos si hay alguno con "+". Si no se
 * sabe, null.
 */
export function skuHundredths(sku: string | null | undefined, partNumber: string | null | undefined, family: (string | null | undefined)[]): number | null {
  const m = (sku ?? '').trim().toUpperCase().match(/^(.*?)([+-])(\d{2,3})$/);
  if (!m) return null;
  if (partNumber && normPart(m[1]) !== normPart(partNumber)) return null;
  const digits = m[3].length === 3 ? (m[3].startsWith('0') ? m[3].slice(1) : null) : m[3];
  if (digits === null) return null;
  const value = Number(digits);
  if (value === 0) return m[2] === '-' ? 0 : null;
  if (!KNOWN_HUNDREDTHS.has(value)) return null;
  if (m[2] === '+') return value;
  const others = family.map((s) => (s ?? '').trim().toUpperCase());
  const separator = others.some((s) => /-0?00$/.test(s));
  const minus = others.some((s) => /\+\d{2,3}$/.test(s));
  if (separator === minus) return null;
  return separator ? value : -value;
}

// ───────────────────────────── El cruce ─────────────────────────────

/** Una medida de un producto de la app, lista para cruzar. */
export type AppSlot = {
  productId: string;
  // La clave del stock de la medida; vacía si el producto no tiene medidas.
  key: string;
  // El número de pieza del producto y el SKU de la medida, ya normalizados. Vacío si falta.
  part: string;
  sku: string;
  // La medida en centésimas. Null si el producto no tiene medidas o no se pudo traducir.
  measure: number | null;
  // Si el producto se vende en varias medidas.
  measured: boolean;
};

export type AppProduct = {
  id: string;
  partNumber: string | null;
  // Las medidas en que se lleva el stock (stockSlots en src/domain/stock.ts).
  slots: { key: string; sku: string | null; measure: string | null }[];
};

/** Las medidas de los productos de la app, para cruzar. */
export function appSlots(products: AppProduct[]): AppSlot[] {
  return products.flatMap((p) => {
    const measured = p.slots.length > 1;
    const skus = p.slots.map((s) => s.sku);
    return p.slots.map((s) => {
      const written = (s.measure ?? '').trim();
      // Primero la medida escrita en la ficha. Si no tiene, o si en la medida
      // está escrito el SKU ("10070/4-10"), el final del SKU.
      const isSku = written !== '' && normPart(written) === normPart(s.sku);
      const measure = written && !isSku ? measureHundredths(written) : skuHundredths(s.sku, p.partNumber, skus);
      return { productId: p.id, key: s.key, part: normPart(p.partNumber), sku: normPart(s.sku), measure, measured };
    });
  });
}

export type SlotIndex = { byPart: Map<string, AppSlot[]>; bySku: Map<string, AppSlot[]> };

export function slotIndex(slots: AppSlot[]): SlotIndex {
  const byPart = new Map<string, AppSlot[]>();
  const bySku = new Map<string, AppSlot[]>();
  const add = (map: Map<string, AppSlot[]>, key: string, slot: AppSlot) => {
    if (key) map.set(key, [...(map.get(key) ?? []), slot]);
  };
  for (const s of slots) {
    add(byPart, s.part, s);
    add(bySku, s.sku, s);
  }
  return { byPart, bySku };
}

/** Las claves con que la extensión sabe qué artículos de Insur mandar: números de pieza y SKU normalizados. */
export function catalogKeys(slots: AppSlot[]): string[] {
  return [...new Set(slots.flatMap((s) => [s.part, s.sku]).filter(Boolean))].sort();
}

export type SlotRef = { productId: string; key: string };

export type Match =
  // Número de pieza y medida coinciden con una sola medida de la app.
  | { kind: 'auto'; productId: string; key: string }
  // Coincide el número de pieza, pero no se puede asegurar la medida.
  | { kind: 'doubtful'; reason: string; candidates: SlotRef[] }
  | { kind: 'none' };

const refs = (slots: AppSlot[]): SlotRef[] => slots.map((s) => ({ productId: s.productId, key: s.key }));
const products = (slots: AppSlot[]) => new Set(slots.map((s) => s.productId)).size;

/** A qué medida de la app va un artículo de Insur, por su código y su medida. No adivina. */
export function matchArticle(article: { code: string; measureName: string | null | undefined }, index: SlotIndex): Match {
  const { part, measure } = splitInsurCode(article.code, article.measureName);
  const whole = normPart(article.code);
  if (measure === null) {
    // El código entero es el SKU de una medida.
    const bySku = index.bySku.get(whole) ?? [];
    if (bySku.length === 1) return { kind: 'auto', ...refs(bySku)[0] };
    const found = bySku.length > 1 ? bySku : (index.byPart.get(whole) ?? []);
    if (found.length === 0) return { kind: 'none' };
    if (found.length === 1) return { kind: 'auto', ...refs(found)[0] };
    if (products(found) > 1) return { kind: 'doubtful', reason: 'Hay más de un producto en la app con ese número de pieza.', candidates: refs(found) };
    return { kind: 'doubtful', reason: 'El artículo de Insur no dice la medida y el producto de la app tiene varias.', candidates: refs(found) };
  }
  const found = index.byPart.get(normPart(part)) ?? [];
  if (found.length === 0) return { kind: 'none' };
  if (products(found) > 1) return { kind: 'doubtful', reason: 'Hay más de un producto en la app con ese número de pieza.', candidates: refs(found) };
  const value = measureHundredths(measure);
  if (value === null) return { kind: 'doubtful', reason: `La medida "${measure}" de Insur no se puede traducir sin dudas.`, candidates: refs(found) };
  if (!found[0].measured) {
    return { kind: 'doubtful', reason: `Insur lo tiene en la medida "${measure}" y el producto de la app no tiene medidas.`, candidates: refs(found) };
  }
  const same = found.filter((s) => s.measure === value);
  if (same.length === 1) return { kind: 'auto', ...refs(same)[0] };
  if (same.length > 1) return { kind: 'doubtful', reason: `La medida "${measure}" coincide con más de una medida del producto.`, candidates: refs(same) };
  const unread = found.filter((s) => s.measure === null);
  return {
    kind: 'doubtful',
    reason: unread.length > 0 ? `No se pudo leer la medida de ${unread.length === 1 ? 'una medida' : 'algunas medidas'} del producto para compararla con "${measure}".` : `El producto de la app no tiene la medida "${measure}".`,
    candidates: refs(found),
  };
}

/** Si el código sin medida de la ficha de Insur (precodigo) es el número de pieza del producto. */
export function precodeMatches(precode: string | null | undefined, partNumber: string | null | undefined): boolean {
  const a = normPart(precode);
  return a !== '' && a === normPart(partNumber);
}

// ───────────────────────────── Stock ─────────────────────────────

/** Las unidades de un depósito: un negativo de Insur vale 0. */
export const depositUnits = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/**
 * El stock de una medida en la app: Córdoba más Santa Fe en Insur, menos lo
 * vendido en los canales desde la fecha de corte. Nunca menos de 0. Rosario
 * cerró y no se suma: ni siquiera llega acá.
 */
export function insurStock(args: { cordoba: number; santaFe: number; sold: number }): number {
  return Math.max(0, depositUnits(args.cordoba) + depositUnits(args.santaFe) - Math.max(0, args.sold));
}

/**
 * Cuánto queda en cada sucursal, para que entre todas sumen `sum`. Cada una
 * arranca de lo que tiene en Insur menos lo vendido que salió de ella; lo
 * vendido sin sucursal conocida sale de la que más tiene. Ninguna queda en
 * negativo: lo que le falta a una sale de las otras.
 */
export function branchTargets(insur: number[], assigned: number[], unknown: number, sum: number): number[] {
  const out = insur.map((n, i) => depositUnits(n) - Math.max(0, assigned[i] ?? 0));
  if (out.length === 0) return out;
  const biggest = () => out.reduce((best, n, i) => (n > out[best] ? i : best), 0);
  // Saca de a una unidad de la que más tiene: son pocas.
  const take = (units: number) => {
    for (let left = units; left > 0; left--) out[biggest()] -= 1;
  };
  take(Math.max(0, Math.min(unknown, 100_000)));
  // Lo que una sucursal debe lo ponen las otras.
  for (let i = 0; i < out.length; i++) {
    if (out[i] >= 0) continue;
    const owed = -out[i];
    out[i] = 0;
    for (let left = owed; left > 0 && out[biggest()] > 0; left--) out[biggest()] -= 1;
  }
  const total = out.reduce((a, b) => a + b, 0);
  const wanted = Math.max(0, sum);
  if (total > wanted) {
    for (let left = total - wanted; left > 0 && out[biggest()] > 0; left--) out[biggest()] -= 1;
  } else if (total < wanted) {
    // Falta: va a la que más tiene en Insur.
    const top = insur.reduce((best, n, i) => (depositUnits(n) > depositUnits(insur[best]) ? i : best), 0);
    out[top] += wanted - total;
  }
  return out;
}

/** Un cambio de stock que conviene mirar: más de 50 unidades en una medida. */
export const STOCK_JUMP = 50;
export const stockJumps = (before: number | null, after: number): boolean => Math.abs(after - (before ?? 0)) > STOCK_JUMP;

// ───────────────────────────── Costo ─────────────────────────────

/** Un costo cambió mucho si se movió más de 30 % contra el que tenía la app. */
export const COST_JUMP = 0.3;

export type CostCheck =
  // No se aplica: vacío, 0, negativo, o marcado como sospechoso al leerlo.
  // against: cómo queda el costo de Insur contra el que ya tiene la app, sin montos.
  | { apply: false; reason: string; against?: CostAgainst }
  // Se aplica. changed: es distinto del que tenía. big: cambió más de 30 %.
  | { apply: true; cost: number; changed: boolean; big: boolean };

/** El costo de Insur contra el de la app: parecido (hasta 30 % de diferencia), mucho menor, mucho mayor, o la app no tiene. */
export type CostAgainst = 'near' | 'lower' | 'higher' | 'none';

export function costAgainst(cost: number, current: number | null): CostAgainst {
  if (current === null || current <= 0) return 'none';
  if (Math.abs(cost - current) / current <= COST_JUMP) return 'near';
  return cost < current ? 'lower' : 'higher';
}

export const COST_AGAINST_TEXT: Record<CostAgainst, string> = {
  near: 'Es parecido al costo que ya tiene la app (hasta 30 % de diferencia).',
  lower: 'Es más de 30 % menor que el costo que ya tiene la app.',
  higher: 'Es más de 30 % mayor que el costo que ya tiene la app.',
  none: 'La app no tiene un costo cargado para comparar.',
};

/**
 * Si el costo de Insur se aplica. suspicious lo calcula la extensión: el costo
 * es mayor que el precio del proveedor, que no viaja a la app.
 */
export function checkCost(args: { cost: unknown; suspicious: boolean; current: number | null }): CostCheck {
  const cost = typeof args.cost === 'number' && Number.isFinite(args.cost) ? Math.round(args.cost * 100) / 100 : null;
  if (cost === null) return { apply: false, reason: 'Insur no tiene el costo cargado.' };
  if (cost <= 0) return { apply: false, reason: 'El costo de Insur es 0 o negativo.' };
  if (args.suspicious) return { apply: false, reason: 'El costo de Insur es mayor que su precio del proveedor.', against: costAgainst(cost, args.current) };
  const current = args.current;
  const changed = current === null || Math.round(current * 100) !== Math.round(cost * 100);
  const big = changed && current !== null && current > 0 && Math.abs(cost - current) / current > COST_JUMP;
  return { apply: true, cost, changed, big };
}

// ───────────────────────────── La ficha de Insur ─────────────────────────────

/** Lo de la ficha de Insur que se guarda, solo como referencia. Sin precios. */
export type InsurFicha = {
  precode: string | null;
  detailGroupId: string | null;
  detail: string | null;
  bocas: string | null;
  observations: string | null;
  line: string | null;
  vehicles: string | null;
  measures: string | null;
};

// Los nombres con que un precio podría colarse dentro de un dato de la ficha.
const PRICE_KEY = /precio|costo|factor|margen|importe|alicuota|iva/i;

/** Un dato de la ficha como texto. De una lista o un objeto saca lo que parezca un precio. */
export function fichaText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const clean = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !PRICE_KEY.test(k)).map(([k, x]) => [k, clean(x)]));
    return v;
  };
  if (Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number')) return value.map(String).join('\n').trim() || null;
  const text = JSON.stringify(clean(value));
  return text === '[]' || text === '{}' ? null : text.slice(0, 20_000);
}

export type FichaChange = { field: 'detail' | 'observations' | 'vehicles'; before: string | null; after: string | null };

/** Lo que cambió en la ficha contra la lectura anterior: el detalle, las observaciones y los vehículos. */
export function fichaChanges(before: Pick<InsurFicha, 'detail' | 'observations' | 'vehicles'>, after: Pick<InsurFicha, 'detail' | 'observations' | 'vehicles'>): FichaChange[] {
  const same = (a: string | null, b: string | null) => (a ?? '').trim() === (b ?? '').trim();
  return (['detail', 'observations', 'vehicles'] as const).filter((f) => !same(before[f], after[f])).map((f) => ({ field: f, before: before[f], after: after[f] }));
}

// ───────────────────────────── Sucursales ─────────────────────────────

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/** Qué depósito de Insur es una sucursal de la app, por su nombre. Null si no es ninguno. */
export function depositOf(branchName: string): 'cordoba' | 'santaFe' | null {
  const n = plain(branchName);
  if (n === 'cordoba' || n === 'cba') return 'cordoba';
  if (n === 'santafe' || n === 'stafe' || n === 'sfe') return 'santaFe';
  return null;
}
