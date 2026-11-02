// Links dentro de un texto, como en las tareas que arma la app: [lo que se lee](https://...).
// Se muestran como links en la pantalla y en el mail; en el mail de texto,
// con la dirección entre paréntesis. Sin la base de datos, para poder probarlo solo.

export type TextPart = { text: string; href?: string };

const LINK = /\[([^\]\n]{1,300})\]\((https?:\/\/[^\s)]{1,2000})\)/g;

/** Un link para poner en el texto. */
export function textLink(label: string, href: string): string {
  return `[${label.replace(/[[\]\n]/g, ' ').trim()}](${href})`;
}

/** El texto en pedazos: los que son links y los que no. */
export function linkParts(text: string): TextPart[] {
  const out: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[1], href: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** El texto sin la forma de los links, para el mail de texto: "lo que se lee (https://...)". */
export function plainLinks(text: string): string {
  return linkParts(text)
    .map((p) => (p.href ? `${p.text} (${p.href})` : p.text))
    .join('');
}
