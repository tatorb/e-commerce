import { pause, ResearchError, type ChannelResearch, type ProbeResult } from '../research';

// Lectura de Mercado Libre Argentina desde el servidor de la app.
//
// - Sugerencias: la dirección que usa el buscador de Mercado Libre mientras
//   escribís. No es una API oficial: puede cambiar o bloquearse sin aviso. Por
//   eso hay siempre un campo para pegarlas a mano.
// - Posición: la búsqueda de la API oficial. Desde 2025 suele rechazar los
//   pedidos sin cuenta conectada; la prueba de conexión dice si anda.
// - Página de resultados: solo se prueba, porque tiene protección anti robots.
//
// Pocos pedidos y con pausas, para no cargar al canal ni quedar bloqueados.
// Las direcciones se pueden cambiar con variables de entorno para probar.

const suggestUrl = () => process.env.MERCADOLIBRE_SUGGEST_URL || 'https://http2.mlstatic.com/resources/sites/MLA/autosuggest';
const apiUrl = () => process.env.MERCADOLIBRE_API_URL || 'https://api.mercadolibre.com';
const listingUrl = () => process.env.MERCADOLIBRE_LISTING_URL || 'https://listado.mercadolibre.com.ar';

// Publicaciones por página en los resultados de Mercado Libre Argentina.
export const PAGE_SIZE = 48;
const API_LIMIT = 50;
const PROBE_QUERY = 'kit de distribucion';

async function get(url: string, accept: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: accept,
        'Accept-Language': 'es-AR,es;q=0.9',
        'User-Agent': 'Mozilla/5.0 (compatible; StudioMRB/1.0; +https://e-commerce.studiomrb.com)',
      },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
  } catch {
    throw new ResearchError('No se pudo conectar con Mercado Libre.');
  }
  if (res.status === 401 || res.status === 403 || res.status === 429) {
    throw new ResearchError(`Mercado Libre no dejó leer (código ${res.status}).`, true);
  }
  if (!res.ok) throw new ResearchError(`Mercado Libre respondió con un error (código ${res.status}).`);
  return res;
}

async function json(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new ResearchError('Mercado Libre respondió algo que no se entiende.');
  }
}

/**
 * Las sugerencias de la respuesta del buscador. La forma conocida es
 * { suggested_queries: [{ q }] }; también se acepta la forma estándar de los
 * buscadores, ["lo escrito", ["sugerencia", ...]].
 */
export function parseSuggestions(body: unknown): string[] {
  let raw: unknown[] = [];
  if (body && typeof body === 'object' && Array.isArray((body as { suggested_queries?: unknown }).suggested_queries)) {
    raw = (body as { suggested_queries: unknown[] }).suggested_queries.map((s) =>
      s && typeof s === 'object' ? ((s as { q?: unknown; query?: unknown }).q ?? (s as { query?: unknown }).query) : s,
    );
  } else if (Array.isArray(body) && Array.isArray(body[1])) {
    raw = body[1];
  }
  const out: string[] = [];
  for (const s of raw) {
    if (typeof s !== 'string') continue;
    const clean = s.toLowerCase().replace(/\s+/g, ' ').trim();
    if (clean && !out.includes(clean)) out.push(clean);
  }
  return out;
}

/** Los códigos de las publicaciones de una respuesta de la búsqueda de la API, en orden. */
export function parseSearchIds(body: unknown): string[] {
  const results = body && typeof body === 'object' ? (body as { results?: unknown }).results : null;
  return Array.isArray(results)
    ? results.flatMap((r) => (r && typeof r === 'object' && typeof (r as { id?: unknown }).id === 'string' ? [(r as { id: string }).id] : []))
    : [];
}

/** Los códigos de publicación que aparecen en una página de resultados, sin repetir. */
export function listingIds(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/MLA-?(\d{8,})/g)) {
    const id = `MLA${m[1]}`;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** Página y posición a partir del puesto en la lista completa. */
export function toPagePosition(rank: number): { page: number; position: number } {
  const page = Math.ceil(rank / PAGE_SIZE);
  return { page, position: rank - (page - 1) * PAGE_SIZE };
}

async function suggest(query: string): Promise<string[]> {
  const url = `${suggestUrl()}?showFilters=true&limit=10&api_version=2&q=${encodeURIComponent(query)}`;
  return parseSuggestions(await json(await get(url, 'application/json')));
}

async function findPosition(query: string, externalId: string, pages: number) {
  const wanted = externalId.toUpperCase().replace('-', '');
  const total = pages * PAGE_SIZE;
  for (let offset = 0; offset < total; offset += API_LIMIT) {
    if (offset > 0) await pause(400);
    const url = `${apiUrl()}/sites/MLA/search?q=${encodeURIComponent(query)}&offset=${offset}&limit=${API_LIMIT}`;
    const ids = parseSearchIds(await json(await get(url, 'application/json')));
    const i = ids.findIndex((id) => id.toUpperCase() === wanted);
    if (i >= 0) {
      const rank = offset + i + 1;
      return rank <= total ? toPagePosition(rank) : null;
    }
    if (ids.length < API_LIMIT) return null;
  }
  return null;
}

async function check(check: string, label: string, run: () => Promise<string>): Promise<ProbeResult> {
  try {
    return { check, label, ok: true, detail: await run() };
  } catch (e) {
    return { check, label, ok: false, detail: e instanceof Error ? e.message : 'Falló.' };
  }
}

async function probe(): Promise<ProbeResult[]> {
  const suggestions = await check('suggestions', 'Sugerencias del buscador', async () => {
    const list = await suggest(PROBE_QUERY);
    if (list.length === 0) throw new ResearchError('Respondió, pero sin sugerencias.');
    return `Respondió ${list.length} sugerencias, por ejemplo «${list[0]}».`;
  });
  await pause(500);
  const api = await check('search_api', 'Búsqueda por la API oficial', async () => {
    const body = await json(await get(`${apiUrl()}/sites/MLA/search?q=${encodeURIComponent(PROBE_QUERY)}&limit=5`, 'application/json'));
    const ids = parseSearchIds(body);
    if (ids.length === 0) throw new ResearchError('Respondió, pero sin resultados.');
    return `Respondió ${ids.length} resultados.`;
  });
  await pause(500);
  const page = await check('search_page', 'Página de resultados', async () => {
    const res = await get(`${listingUrl()}/${PROBE_QUERY.replace(/\s+/g, '-')}`, 'text/html');
    const ids = listingIds(await res.text());
    if (ids.length < 5) throw new ResearchError('Respondió una página sin resultados, probablemente una verificación anti robots.');
    return `Se pudo leer: ${ids.length} publicaciones en la primera página.`;
  });
  return [suggestions, api, page];
}

export const mercadolibreResearch: ChannelResearch = {
  probe,
  suggest,
  findPosition,
  checks: { suggestions: 'suggestions', positions: 'search_api' },
};
