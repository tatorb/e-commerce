import type { NameValue } from '@/domain/name-value';
import { normalizeText } from '@/domain/catalog-data';

// El paquete cargado en los datos de catálogo contra el empaque que calcula el
// canal para el producto. Si el cargado es más chico, el canal rechaza crear
// otra opción o medida ("too small for the product dimensions").

export type Package = { height: number; width: number; length: number; weight: number };

const LABELS: Record<keyof Package, string> = {
  height: 'altura del paquete',
  width: 'ancho del paquete',
  length: 'largo del paquete',
  weight: 'peso del paquete',
};

function amount(raw: string, unit: 'cm' | 'g'): number | null {
  const m = raw.trim().replace(',', '.').match(/^([\d.]+)\s*(mm|cm|m|g|kg)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const u = (m[2] ?? unit).toLowerCase();
  return u === 'mm' ? n / 10 : u === 'm' ? n * 100 : u === 'kg' ? n * 1000 : n;
}

/** El paquete cargado en los datos de catálogo. Null si falta alguna medida. */
export function loadedPackage(attributes: NameValue[]): Package | null {
  const out: Partial<Package> = {};
  for (const key of Object.keys(LABELS) as (keyof Package)[]) {
    const a = attributes.find((x) => normalizeText(x.name).startsWith(LABELS[key]));
    const n = a ? amount(a.value, key === 'weight' ? 'g' : 'cm') : null;
    if (n === null || !(n > 0)) return null;
    out[key] = n;
  }
  return out as Package;
}

/** El paquete del canal guardado en los detalles de la copia. */
export function factoryPackageOf(details: unknown): Package | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const p = (details as Record<string, unknown>).factoryPackage;
  if (!p || typeof p !== 'object') return null;
  const v = p as Record<string, unknown>;
  const ok = (x: unknown) => typeof x === 'number' && x > 0;
  return ok(v.height) && ok(v.width) && ok(v.length) && ok(v.weight) ? { height: v.height as number, width: v.width as number, length: v.length as number, weight: v.weight as number } : null;
}

const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/** "23 x 23 x 10 cm, 1,68 kg". */
export function packageText(p: Package): string {
  const weight = p.weight >= 1000 ? `${num(Math.round(p.weight / 10) / 100)} kg` : `${num(p.weight)} g`;
  return `${num(p.height)} x ${num(p.width)} x ${num(p.length)} cm, ${weight}`;
}

/**
 * Si el cargado es más chico que el del canal: las medidas se comparan de la
 * más grande a la más chica, porque el paquete se puede girar. Null si entra.
 */
export function packageTooSmall(loaded: Package, factory: Package): string | null {
  const a = [loaded.height, loaded.width, loaded.length].sort((x, y) => y - x);
  const b = [factory.height, factory.width, factory.length].sort((x, y) => y - x);
  const sizes = a.some((v, i) => v < b[i]);
  const weight = loaded.weight < factory.weight;
  if (!sizes && !weight) return null;
  const what = sizes && weight ? 'las medidas y el peso' : sizes ? 'las medidas' : 'el peso';
  return `El paquete cargado (${packageText(loaded)}) es más chico que el empaque que calcula el canal (${packageText(factory)}) en ${what}: el canal rechaza crear otra opción o medida así. Cargá al menos ese paquete con save_catalog_data.`;
}
