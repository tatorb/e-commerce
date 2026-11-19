import { optionKey } from '@/domain/product-options';

// El nombre de los productos armado con un formato, por ejemplo
// "[tipo_corto] [numero_de_pieza]" da "Subconjunto SP-413".

export const NAME_FIELDS = ['tipo', 'tipo_corto', 'marca', 'numero_de_pieza'] as const;
export type NameField = (typeof NAME_FIELDS)[number];

export const NAME_FIELD_LABEL: Record<NameField, string> = {
  tipo: 'tipo',
  tipo_corto: 'nombre corto del tipo',
  marca: 'marca',
  numero_de_pieza: 'número de pieza',
};

/** Los campos del formato, en orden, o el problema si no vale. */
export function parseNameFormat(format: string): { fields: NameField[] } | { error: string } {
  const found = [...format.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1].trim().toLowerCase());
  if (found.length === 0) return { error: `El formato no tiene campos entre corchetes. Los que hay: ${NAME_FIELDS.map((f) => `[${f}]`).join(', ')}.` };
  const unknown = found.filter((f) => !(NAME_FIELDS as readonly string[]).includes(f));
  if (unknown.length > 0) return { error: `No existe el campo [${unknown[0]}]. Los que hay: ${NAME_FIELDS.map((f) => `[${f}]`).join(', ')}.` };
  if (/[[\]]/.test(format.replace(/\[[^\]]*\]/g, ''))) return { error: 'Al formato le falta cerrar o abrir un corchete.' };
  return { fields: found as NameField[] };
}

/** El nombre con el formato, o los campos que le faltan al producto. */
export function buildName(format: string, values: Partial<Record<NameField, string | null>>): { name: string } | { missing: NameField[] } {
  const missing: NameField[] = [];
  const text = format.replace(/\[([^\]]*)\]/g, (_, raw: string) => {
    const field = raw.trim().toLowerCase() as NameField;
    const value = values[field]?.trim();
    if (!value) missing.push(field);
    return value ?? '';
  });
  if (missing.length > 0) return { missing: [...new Set(missing)] };
  return { name: text.replace(/\s+/g, ' ').trim() };
}

/** Para comparar nombres: sin mayúsculas, acentos ni espacios de más. */
export const nameKey = (name: string) => optionKey(name);
