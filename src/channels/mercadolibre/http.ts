import { ConnectError } from '../connect-types';
import { apiUrl } from './urls';

// Pedidos a la API de Mercado Libre con la llave de la cuenta conectada.
// Mercado Libre limita los pedidos sin publicar un número: ante "demasiados
// pedidos" o una falla pasajera, se espera lo que pide o un poco más cada
// vez, y se reintenta.

export class MercadoLibreRequestError extends ConnectError {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message, status === 401, status === 429);
  }
}

const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const TRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function waitFor(res: Response, attempt: number): number {
  const raw = res.headers.get('retry-after');
  const after = raw === null ? NaN : Number(raw);
  if (Number.isFinite(after) && after >= 0) return Math.min(after, 30) * 1000;
  // "Demasiados pedidos" sin decir cuánto esperar: más pausa que ante una falla pasajera.
  const base = res.status === 429 ? 2000 : 500;
  return base * 2 ** attempt + Math.floor(Math.random() * 250);
}

/** GET con la llave. Devuelve el cuerpo ya leído. */
export async function mlGet(path: string, accessToken: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${apiUrl()}${path}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15_000),
        cache: 'no-store',
      });
    } catch {
      if (attempt + 1 < TRIES) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw new ConnectError('No se pudo conectar con Mercado Libre. Probá de nuevo.');
    }
    if (res.ok) return res.json();
    if (RETRY_STATUS.has(res.status) && attempt + 1 < TRIES) {
      await sleep(waitFor(res, attempt));
      continue;
    }
    if (res.status === 401) throw new MercadoLibreRequestError('Mercado Libre no aceptó la llave: hay que volver a conectar.', 401);
    if (res.status === 429) {
      throw new MercadoLibreRequestError('Mercado Libre pidió esperar porque hubo demasiados pedidos. Probá de nuevo en unos minutos.', 429);
    }
    throw new MercadoLibreRequestError(`Mercado Libre respondió con un error (código ${res.status}).`, res.status);
  }
}

// ───────────────────────────── Varias publicaciones a la vez ─────────────────────────────

export const BULK_MAX = 20;

/**
 * Los cuerpos de las publicaciones que vinieron bien. Mercado Libre no publicó
 * un ejemplo de /items/bulk: se aceptan las formas conocidas, [{code, body}],
 * [{id, status_code, body}] y [{body}], y el código se toma de body.id.
 */
export function parseBulk(body: unknown): Record<string, unknown>[] {
  if (!Array.isArray(body)) return [];
  const out: Record<string, unknown>[] = [];
  for (const entry of body) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as { code?: unknown; status_code?: unknown; body?: unknown };
    const status = e.code ?? e.status_code;
    if (status !== undefined && Number(status) !== 200) continue;
    const item = e.body;
    if (item && typeof item === 'object' && (item as { id?: unknown }).id) out.push(item as Record<string, unknown>);
  }
  return out;
}

/**
 * Varias publicaciones a la vez, hasta 20, con los campos pedidos. Usa
 * /items/bulk, que reemplaza a /items?ids= desde el 25/10/2026; si no lo
 * acepta, prueba con la forma vieja. allAttributes suma los datos de cada
 * variante, como su SKU.
 */
export async function readItems(
  accessToken: string,
  ids: string[],
  fields: string[],
  { allAttributes = false }: { allAttributes?: boolean } = {},
): Promise<Record<string, unknown>[]> {
  const list = ids.slice(0, BULK_MAX).map(encodeURIComponent).join(',');
  if (!list) return [];
  const extra = allAttributes ? '&include_attributes=all' : '';
  try {
    return parseBulk(await mlGet(`/items/bulk?ids=${list}&attributes=${fields.map((f) => `body.${f}`).join(',')}${extra}`, accessToken));
  } catch (e) {
    if (!(e instanceof MercadoLibreRequestError) || ![400, 404, 405].includes(e.status)) throw e;
    return parseBulk(await mlGet(`/items?ids=${list}&attributes=${fields.join(',')}${extra}`, accessToken));
  }
}
