import { contactFound, contactList } from './contact';

// La descripción de una publicación: qué se revisa antes de guardarla y cómo
// se arma con el encabezado y el pie fijos de la cuenta. Sin la base de
// datos, para poder probarlo solo.

// Lo más largo que acepta Mercado Libre, y el tope de la app para todos los canales.
export const DESCRIPTION_MAX = 50_000;

// Lo que Claude deja para que lo confirme una persona.
const TO_CONFIRM = /\[A CONFIRMAR[^\]]*\]/gi;

const HTML = /<\/?[a-z][a-z0-9]*(\s[^>]*)?\/?>|&(nbsp|amp|lt|gt|quot);/i;

/** Lo marcado [A CONFIRMAR: ...], sin repetir. */
export function toConfirmMarks(text: string): string[] {
  return [...new Set([...text.matchAll(TO_CONFIRM)].map((m) => m[0]))];
}

/** Lo que hay que corregir antes de guardar la descripción. Vacía si está lista. */
export function checkDescription(text: string): string[] {
  const value = text.trim();
  const problems: string[] = [];
  if (toConfirmMarks(value).length > 0) problems.push('Confirmá o sacá lo marcado con [A CONFIRMAR].');
  if (value.length > DESCRIPTION_MAX) problems.push(`La descripción puede tener hasta 50.000 caracteres; tiene ${value.length.toLocaleString('es-AR')}.`);
  if (HTML.test(value)) problems.push('Sacá el HTML: el canal acepta solo texto.');
  const found = contactFound(value);
  if (found.length > 0) problems.push(`Sacá ${contactList(found)}: el canal no los acepta en la descripción.`);
  return problems;
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\r\n?/g, '\n').trim();

/** La descripción completa: el encabezado, el cuerpo y el pie, separados por una línea en blanco. */
export function composeDescription(parts: { header: string | null; body: string; footer: string | null }): string {
  return [clean(parts.header), clean(parts.body), clean(parts.footer)].filter(Boolean).join('\n\n');
}

/**
 * Separa el cuerpo de una descripción guardada. Si no empieza con el
 * encabezado o no termina con el pie de la cuenta, el cuerpo es todo el texto
 * y se avisa que le faltan.
 */
export function splitDescription(full: string | null, frame: { header: string | null; footer: string | null }): { body: string; framed: boolean } {
  let body = clean(full);
  const header = clean(frame.header);
  const footer = clean(frame.footer);
  if (!header && !footer) return { body, framed: true };
  const hasHeader = !header || body.startsWith(header);
  const hasFooter = !footer || body.endsWith(footer);
  if (!body || !hasHeader || !hasFooter) return { body, framed: !body };
  if (header) body = body.slice(header.length);
  if (footer) body = body.slice(0, body.length - footer.length);
  return { body: body.trim(), framed: true };
}
