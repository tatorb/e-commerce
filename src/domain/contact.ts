// Datos de contacto que los canales no aceptan en los textos que ven los
// compradores. Los números largos solos no cuentan: los códigos de los
// repuestos también los tienen. Sin la base de datos, para poder probarlo solo.
const CONTACT: [RegExp, string][] = [
  [/\bhttps?:\/\/|\bwww\.|\b[\w-]+\.(com|net|org)(\.ar)?\b/i, 'links'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, 'mails'],
  [/\b(whats?app|wsp|wpp|tel[eé]fono|celular|instagram|facebook|telegram)|\bllam(anos|[aá] al)\b/i, 'datos de contacto'],
  [/\+\s?54\b/, 'teléfonos'],
];

// Los sitios de los propios canales: un link a otra publicación de la tienda
// no es contacto, el canal lo acepta y lo promueve en las respuestas.
const OWN_SITES = /\b(?:https?:\/\/)?(?:[\w-]+\.)*(?:mercadolibre|mercadoshops|mercadolivre)\.com(?:\.[a-z]{2})?(?:\/[^\s<>"']*)?/gi;

/** El texto sin los links a los sitios de los canales, para que no cuenten como contacto. */
export function withoutOwnLinks(text: string): string {
  return text.replace(OWN_SITES, ' ');
}

/** Qué datos de contacto tiene el texto, por ejemplo ["links", "mails"]. Vacía si no tiene. */
export function contactFound(text: string): string[] {
  return [...new Set(CONTACT.filter(([pattern]) => pattern.test(text)).map(([, what]) => what))];
}

/** "links", "links y mails", "links, mails y teléfonos". */
export function contactList(found: string[]): string {
  return found.length <= 1 ? (found[0] ?? '') : `${found.slice(0, -1).join(', ')} y ${found[found.length - 1]}`;
}
