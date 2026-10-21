import { z } from 'zod';

// Las fotos de una publicación, en orden. Cada una sale de un lugar: una foto
// que ya está en el canal (con su código allá), una foto corregida en el paso
// Imágenes, o una foto del producto por su link. Sin elegir (null), la
// publicación usa las que tiene en el canal. Este módulo no sabe nada de canales.

// Lo que acepta la mayoría de las categorías.
export const MAX_PHOTOS = 12;

export const photoRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('channel'), id: z.string().min(1).max(100), url: z.string().max(2000).default('') }),
  z.object({ kind: z.literal('edit'), editId: z.string().min(1).max(40) }),
  z.object({ kind: z.literal('asset'), url: z.string().url().max(2000) }),
]);

export type PhotoRef = z.infer<typeof photoRefSchema>;

/** Lo que identifica a una foto, sin importar el link con que se la ve. */
export function photoKey(ref: PhotoRef): string {
  if (ref.kind === 'channel') return `canal:${ref.id}`;
  if (ref.kind === 'edit') return `corregida:${ref.editId}`;
  return `link:${ref.url}`;
}

/** Lee las fotos guardadas. Null: no se eligieron, siguen a las del canal. */
export function parseMedia(raw: unknown): PhotoRef[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((item) => {
    const parsed = photoRefSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Las fotos que tiene la publicación en el canal, como se leyeron. */
export function channelPhotos(photos: unknown, photoIds: unknown): PhotoRef[] {
  const urls = Array.isArray(photos) ? photos : [];
  const ids = Array.isArray(photoIds) ? photoIds : [];
  return ids.flatMap((id, i) => (typeof id === 'string' && id ? [{ kind: 'channel' as const, id, url: typeof urls[i] === 'string' ? urls[i] : '' }] : []));
}

/** Sin repetir y con el tope: lo que se guarda al elegir. */
export function cleanMedia(refs: PhotoRef[]): PhotoRef[] {
  const seen = new Set<string>();
  const out: PhotoRef[] = [];
  for (const r of refs) {
    const key = photoKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out.slice(0, MAX_PHOTOS);
}
