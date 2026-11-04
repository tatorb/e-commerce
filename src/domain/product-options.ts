// Los tipos de producto y las marcas son listas fijas de cada cuenta: la
// ficha solo guarda uno de sus nombres. Acá se decide cuándo dos textos son
// la misma opción. No sabe nada de la base de datos, para poder probarlo solo.

export type OptionKind = 'TYPE' | 'BRAND';

export const OPTION_LABEL: Record<OptionKind, { one: string; many: string; field: string }> = {
  TYPE: { one: 'tipo de producto', many: 'tipos de producto', field: 'Tipo de producto' },
  BRAND: { one: 'marca', many: 'marcas', field: 'Marca' },
};

/** El nombre como se guarda: sin espacios de más. */
export const cleanOptionName = (s: string) => s.trim().replace(/\s+/g, ' ');

/** La clave para comparar: sin mayúsculas, acentos ni espacios de más. "Sabó" y "SABO" son la misma. */
export function optionKey(s: string): string {
  return cleanOptionName(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** La opción de la lista que corresponde al texto, o null si no está. */
export function matchOption(options: readonly string[], raw: string): string | null {
  const key = optionKey(raw);
  return options.find((o) => optionKey(o) === key) ?? null;
}

/** Por qué no se acepta un valor que no está en la lista. */
export function notInListMessage(kind: OptionKind, raw: string, options: readonly string[]): string {
  const l = OPTION_LABEL[kind];
  const some = options.length > 0 ? ` Las que hay: ${options.join(', ')}.` : '';
  return `«${cleanOptionName(raw)}» no está en la lista de ${l.many}. Elegí uno de la lista o agregalo en Ajustes, Tipos y marcas.${some}`;
}

/** Si el nombre nuevo se puede usar: no vacío, no muy largo y que no esté ya. Devuelve el motivo si no. */
export function optionNameProblem(kind: OptionKind, name: string, options: readonly string[], except?: string): string | null {
  const clean = cleanOptionName(name);
  if (!clean) return `Escribí el nombre del ${OPTION_LABEL[kind].one}.`;
  if (clean.length > 200) return 'El nombre es muy largo: hasta 200 letras.';
  const same = matchOption(
    options.filter((o) => o !== except),
    clean,
  );
  return same ? `Ya está «${same}» en la lista.` : null;
}
