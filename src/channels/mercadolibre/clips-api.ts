import { MercadoLibreRequestError, mlGet } from './http';

// Los clips de una publicación en Mercado Libre. La documentación pública es
// la de ventas internacionales (/marketplace/items/{id}/clips, con subida en
// /clips/upload) y no dice si vale para una publicación local. Esto solo
// pregunta, no cambia nada: sirve para saber qué responde la cuenta antes de
// armar la subida.

export type ClipsAnswer = { path: string; status: number; body: unknown };

const PATHS = (id: string) => [`/marketplace/items/${id}/clips`, `/items/${id}/clips`];

/** Qué responde Mercado Libre al pedir los clips de una publicación, por cada dirección conocida. */
export async function askClips(accessToken: string, itemId: string): Promise<ClipsAnswer[]> {
  const out: ClipsAnswer[] = [];
  for (const path of PATHS(encodeURIComponent(itemId))) {
    try {
      out.push({ path, status: 200, body: await mlGet(path, accessToken) });
    } catch (e) {
      // Sin llave válida no hay nada que aprender: que se renueve y se pruebe de nuevo.
      if (!(e instanceof MercadoLibreRequestError)) throw e;
      if (e.status === 401 && !mentionsPermission(e.body)) throw e;
      out.push({ path, status: e.status, body: e.body });
    }
  }
  return out;
}

// Un 401 de clips puede ser "esta cuenta no tiene permiso", que no es una llave vencida.
function mentionsPermission(body: unknown): boolean {
  return typeof body === 'object' && body !== null && /permission/i.test(String((body as { message?: unknown }).message ?? ''));
}

/** Lo que significa cada respuesta, en palabras. */
export function readClipsAnswer(a: ClipsAnswer): string {
  if (a.status === 200) return 'Responde: la cuenta puede consultar los clips de esta publicación.';
  const message = typeof a.body === 'object' && a.body !== null ? String((a.body as { message?: unknown }).message ?? '') : '';
  if (a.status === 404 && /no clips found/i.test(message)) return 'Responde que la publicación existe y no tiene clips: la cuenta tiene acceso.';
  if (a.status === 401 || a.status === 403) return 'La cuenta no tiene permiso para los clips por esta dirección.';
  if (a.status === 404) return 'No encuentra la publicación o la dirección no existe para esta cuenta.';
  return `Respondió con el código ${a.status}.`;
}

