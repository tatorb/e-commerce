// Datos de contacto que los canales no aceptan en los textos que ven los
// compradores. Los números largos solos no cuentan: los códigos de los
// repuestos también los tienen. Sin la base de datos, para poder probarlo solo.
const CONTACT: [RegExp, string][] = [
  [/\bhttps?:\/\/|\bwww\.|\b[\w-]+\.(com|net|org)(\.ar)?\b/i, 'links'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, 'mails'],
  [/\b(whats?app|wsp|wpp|tel[eé]fono|celular|instagram|facebook|telegram)|\bllam(anos|[aá] al)\b/i, 'datos de contacto'],
  [/\+\s?54\b/, 'teléfonos'],
];

/** Qué datos de contacto tiene el texto, por ejemplo ["links", "mails"]. Vacía si no tiene. */
export function contactFound(text: string): string[] {
  return [...new Set(CONTACT.filter(([pattern]) => pattern.test(text)).map(([, what]) => what))];
}

/** "links", "links y mails", "links, mails y teléfonos". */
export function contactList(found: string[]): string {
  return found.length <= 1 ? (found[0] ?? '') : `${found.slice(0, -1).join(', ')} y ${found[found.length - 1]}`;
}
