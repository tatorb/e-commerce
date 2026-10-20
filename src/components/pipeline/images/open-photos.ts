// Las fotos abiertas del paso Imágenes van en la dirección, en `fotos`, separadas
// por coma: así se pueden abrir varias juntas y el link se puede compartir.

const MAX_OPEN = 50;

/** Las fotos abiertas según la dirección. Acepta también `foto`, de los links viejos. */
export function openPhotoIds(params: { fotos?: string | string[]; foto?: string | string[] }): string[] {
  const raw = [params.fotos, params.foto].flat().filter((v): v is string => typeof v === 'string');
  const ids = raw.flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);
  return [...new Set(ids)].slice(0, MAX_OPEN);
}

/** La dirección del paso con esas fotos abiertas. */
export function photosHref(pageHref: string, ids: string[]): string {
  return ids.length ? `${pageHref}&fotos=${ids.map(encodeURIComponent).join(',')}` : pageHref;
}

/** Abre la foto si estaba cerrada y la cierra si estaba abierta. */
export function toggledPhotos(open: string[], id: string): string[] {
  return open.includes(id) ? open.filter((x) => x !== id) : [...open, id];
}
