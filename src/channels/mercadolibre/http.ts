import { ConnectError } from '../connect-types';
import { apiUrl, paymentsApiUrl } from './urls';

// Pedidos a la API de Mercado Libre con la llave de la cuenta conectada.
// Mercado Libre limita los pedidos sin publicar un número: ante "demasiados
// pedidos" o una falla pasajera, se espera lo que pide o un poco más cada
// vez, y se reintenta. Los cambios se reintentan solo ante "demasiados
// pedidos": ante una falla, Mercado Libre puede haberlo hecho igual, y
// repetirlo duplicaría una publicación o una respuesta.

export class MercadoLibreRequestError extends ConnectError {
  constructor(
    message: string,
    readonly status: number,
    // Lo que respondió Mercado Libre, para explicar por qué no aceptó un cambio.
    readonly body: unknown = null,
    // Un cambio que falló del lado de Mercado Libre: no se sabe si lo hizo.
    readonly changeUnknown = false,
  ) {
    super(message, status === 401, status === 429);
  }
}

const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
// En un cambio, solo "demasiados pedidos": ahí Mercado Libre seguro no hizo nada.
const SEND_RETRY_STATUS = new Set([429]);
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
  return getFrom(apiUrl(), path, accessToken);
}

/** GET a Mercado Pago con la misma llave de la cuenta: los pagos de las ventas. */
export async function mpGet(path: string, accessToken: string): Promise<unknown> {
  return getFrom(paymentsApiUrl(), path, accessToken);
}

/**
 * POST que solo lee, como las listas del catálogo de vehículos: no cambia nada
 * en Mercado Libre, así que se reintenta igual que mlGet.
 */
export async function mlQuery(path: string, accessToken: string, body?: unknown): Promise<unknown> {
  return getFrom(apiUrl(), path, accessToken, body === undefined ? null : body);
}

async function getFrom(base: string, path: string, accessToken: string, postBody?: unknown): Promise<unknown> {
  // Sin postBody es un GET; con postBody (aunque sea null), un POST que solo lee.
  const post = postBody !== undefined;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        ...(post ? { method: 'POST' } : {}),
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...(post && postBody !== null ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(post && postBody !== null ? { body: JSON.stringify(postBody) } : {}),
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
    // Lo que respondió, para explicar el error.
    const body = await res.json().catch(() => null);
    if (res.status === 401) throw new MercadoLibreRequestError('Mercado Libre no aceptó la llave: hay que volver a conectar.', 401, body);
    if (res.status === 429) {
      throw new MercadoLibreRequestError('Mercado Libre pidió esperar porque hubo demasiados pedidos. Probá de nuevo en unos minutos.', 429, body);
    }
    throw new MercadoLibreRequestError(`Mercado Libre respondió con un error (código ${res.status}).`, res.status, body);
  }
}

/**
 * PUT, POST o DELETE con la llave y un cuerpo JSON. Reintenta solo cuando
 * Mercado Libre pide esperar; si se corta la conexión o falla de su lado,
 * avisa que no se sabe si hizo el cambio. Si no lo acepta, el error trae su
 * respuesta.
 */
export async function mlSend(method: 'PUT' | 'POST' | 'DELETE', path: string, accessToken: string, body?: unknown): Promise<unknown> {
  // Un formulario (para subir un archivo) va tal cual; lo demás, como JSON. DELETE va sin cuerpo.
  const form = body instanceof FormData;
  const json = body !== undefined && !form;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${apiUrl()}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(json ? { 'Content-Type': 'application/json' } : {}),
          Authorization: `Bearer ${accessToken}`,
        },
        body: form ? body : json ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
        cache: 'no-store',
      });
    } catch {
      // El pedido pudo haber llegado: repetirlo podría duplicar el cambio.
      throw new ConnectError('Se cortó la conexión con Mercado Libre y no se sabe si hizo el cambio. Revisalo en Mercado Libre antes de volver a probar.');
    }
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (res.ok) return parsed;
    if (SEND_RETRY_STATUS.has(res.status) && attempt + 1 < TRIES) {
      await sleep(waitFor(res, attempt));
      continue;
    }
    if (res.status === 401) throw new MercadoLibreRequestError('Mercado Libre no aceptó la llave: hay que volver a conectar.', 401, parsed);
    if (res.status === 429) {
      throw new MercadoLibreRequestError('Mercado Libre pidió esperar porque hubo demasiados pedidos. Probá de nuevo en unos minutos.', 429, parsed);
    }
    // Falló de su lado: puede haberlo hecho igual.
    if (res.status >= 500) {
      throw new MercadoLibreRequestError(
        `Mercado Libre falló (código ${res.status}) y no se sabe si hizo el cambio. Revisalo en Mercado Libre antes de volver a probar.`,
        res.status,
        parsed,
        true,
      );
    }
    throw new MercadoLibreRequestError(`Mercado Libre respondió con un error (código ${res.status}).`, res.status, parsed);
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
