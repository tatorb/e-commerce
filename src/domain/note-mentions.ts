// Las menciones en las notas: "@Nombre" en el texto. Sin la base de datos,
// para poder probarlo solo.

export type MentionPerson = { id: string; name: string };

/** Si el cursor está escribiendo una mención: desde dónde empieza y lo escrito después de la @. */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = /(^|\s)@([^\s@]{0,30})$/.exec(before);
  if (!m) return null;
  return { start: caret - m[2].length - 1, query: m[2] };
}

/** Pone "@Nombre " en lugar de lo que se estaba escribiendo. Devuelve el texto y dónde queda el cursor. */
export function insertMention(text: string, at: { start: number; query: string }, name: string): { text: string; caret: number } {
  const insert = `@${name} `;
  const end = at.start + 1 + at.query.length;
  return { text: text.slice(0, at.start) + insert + text.slice(end), caret: at.start + insert.length };
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Las personas que coinciden con lo escrito después de la @. */
export function mentionMatches(people: MentionPerson[], query: string, max = 6): MentionPerson[] {
  const q = fold(query);
  return people.filter((p) => fold(p.name).split(/\s+/).some((w) => w.startsWith(q)) || fold(p.name).startsWith(q)).slice(0, max);
}

/**
 * A quiénes menciona el texto. Las elegidas de la lista cuentan si su @Nombre
 * sigue en el texto; además, las personas con un nombre que nadie más tiene y
 * que aparecen escritas a mano.
 */
export function mentionedIds(text: string, people: MentionPerson[], picked: string[] = []): string[] {
  const has = (name: string) => text.includes(`@${name}`);
  const out = new Set(picked.filter((id) => {
    const p = people.find((x) => x.id === id);
    return p ? has(p.name) : false;
  }));
  const count = new Map<string, number>();
  for (const p of people) count.set(p.name, (count.get(p.name) ?? 0) + 1);
  for (const p of people) if (count.get(p.name) === 1 && has(p.name)) out.add(p.id);
  return [...out];
}
