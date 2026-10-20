import { normalizeText } from './catalog-data';
import { nameValueSchema, type NameValue } from './name-value';

// La ficha técnica del producto: datos técnicos como nombre y valor con su
// unidad, por ejemplo «Diámetro del cilindro: 83,00 mm». Es del producto, así
// que la comparten todas sus publicaciones. Este módulo no sabe nada de
// canales: solo arma la lista nueva a partir de la que había y lo que llega.

export const MAX_SPECS = 200;

export class TechnicalSheetError extends Error {}

/**
 * completar: cambia los datos que tienen el mismo nombre, sin importar
 * mayúsculas ni tildes, y suma los nuevos al final; un valor vacío borra ese
 * dato. reemplazar: la ficha técnica entera es lo que llega.
 */
export function mergeSpecs(
  current: NameValue[],
  incoming: { name: string; value: string | null }[],
  mode: 'merge' | 'replace',
): NameValue[] {
  const out = mode === 'replace' ? [] : current.map((s) => ({ ...s }));
  for (const raw of incoming) {
    const name = raw.name.replace(/\s+/g, ' ').trim();
    const value = (raw.value ?? '').replace(/\s+/g, ' ').trim();
    if (!name) throw new TechnicalSheetError('Cada dato de la ficha técnica necesita un nombre.');
    const parsed = nameValueSchema.safeParse({ name, value });
    if (!parsed.success) throw new TechnicalSheetError(`«${name.slice(0, 60)}»: el nombre o el valor es demasiado largo.`);
    const at = out.findIndex((s) => normalizeText(s.name) === normalizeText(name));
    if (!value) {
      if (at >= 0) out.splice(at, 1);
      continue;
    }
    if (at >= 0) out[at] = { name, value };
    else out.push({ name, value });
  }
  if (out.length > MAX_SPECS) throw new TechnicalSheetError(`La ficha técnica puede tener hasta ${MAX_SPECS} datos.`);
  return out;
}

/** Cuáles de los campos esperados ya están en la ficha técnica, por nombre. */
export function missingSpecs(specs: NameValue[], expected: string[]): string[] {
  const have = new Set(specs.map((s) => normalizeText(s.name)));
  return expected.filter((name) => !have.has(normalizeText(name)));
}
