import type { PrismaClient } from '@/generated/prisma/client';
import type { ChannelKind } from '@/generated/prisma/enums';
import { ConnectError } from '@/channels/connect';
import { getChannelResearch, pause, ResearchError, type ProbeResult } from '@/channels/research';
import type { SearchResult } from '@/channels/research-types';
import { listingTargets } from '@/lib/variant-listings';
import { MAX_PAGES, parseStrings, savePosition, saveSuggestions } from '@/domain/title-work';
import { withAccessToken } from '@/lib/connections';

// Lecturas automáticas del canal, con lo que ya se leyó guardado para no
// volver a pedirlo. Recibe la base por parámetro para poder probarlo.

type Channel = { id: string; kind: ChannelKind };

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
// Lo leído hace menos de esto no se vuelve a pedir.
const CACHE_DAYS = 7;
const PAUSE_MS = 300;

async function latestOk(db: PrismaClient, channelId: string, check: string, storeId: string | null): Promise<boolean> {
  const row = await db.channelProbe.findFirst({ where: { channelId, check, storeId }, orderBy: { checkedAt: 'desc' } });
  return row?.ok ?? false;
}

async function isConnected(db: PrismaClient, storeId: string | null): Promise<boolean> {
  if (!storeId) return false;
  const c = await db.channelConnection.findUnique({ where: { storeId }, select: { status: true } });
  return c?.status === 'ACTIVE';
}

/**
 * Qué se puede leer solo, según la última prueba de conexión. Las posiciones
 * se leen sin cuenta si la búsqueda pública anda, o con la cuenta conectada
 * de la tienda si la búsqueda con la cuenta anda.
 */
export async function autoAvailable(
  db: PrismaClient,
  channel: Channel,
  storeId: string | null = null,
): Promise<{ suggestions: boolean; positions: boolean; positionsWithAccount: boolean }> {
  const research = getChannelResearch(channel.kind);
  if (!research) return { suggestions: false, positions: false, positionsWithAccount: false };
  const [suggestions, publicSearch, connectedSearch, connected] = await Promise.all([
    latestOk(db, channel.id, research.checks.suggestions, null),
    latestOk(db, channel.id, research.checks.positions, null),
    storeId ? latestOk(db, channel.id, research.checks.positionsConnected, storeId) : Promise.resolve(false),
    isConnected(db, storeId),
  ]);
  const withAccount = connected && connectedSearch;
  return { suggestions, positions: publicSearch || withAccount, positionsWithAccount: !publicSearch && withAccount };
}

/**
 * Corre la prueba de conexión y guarda cada resultado con fecha. Si la tienda
 * está conectada, suma las pruebas con su cuenta.
 */
export async function runProbe(db: PrismaClient, args: { channel: Channel; storeId: string | null }): Promise<ProbeResult[]> {
  const research = getChannelResearch(args.channel.kind);
  if (!research) return [];
  const results = await research.probe();
  await db.channelProbe.createMany({
    data: results.map((r) => ({ channelId: args.channel.id, check: r.check, ok: r.ok, detail: r.detail })),
  });
  if (!args.storeId || !(await isConnected(db, args.storeId))) return results;
  let connected: ProbeResult[];
  try {
    connected = await withAccessToken(db, args.storeId, (token, userId) => research.probeConnected(token, userId));
  } catch (e) {
    connected = [
      {
        check: 'connected_user',
        label: 'Cuenta conectada',
        ok: false,
        detail: e instanceof ConnectError ? e.message : 'No se pudo usar la cuenta conectada.',
      },
    ];
  }
  await db.channelProbe.createMany({
    data: connected.map((r) => ({ channelId: args.channel.id, storeId: args.storeId, check: r.check, ok: r.ok, detail: r.detail })),
  });
  return [...results, ...connected];
}

export type ReadOutcome = { read: number; cached: number; empty: number; error: string | null };

/**
 * Lee las sugerencias del buscador para una semilla. Con "expand" suma la
 * semilla con cada letra de la a a la z. Si el canal frena los pedidos, para
 * y guarda lo que alcanzó a leer.
 */
export async function readSuggestions(
  db: PrismaClient,
  args: { accountId: string; channel: Channel; publicationId: string; seed: string; expand: boolean; force?: boolean },
): Promise<ReadOutcome> {
  const research = getChannelResearch(args.channel.kind);
  if (!research) return { read: 0, cached: 0, empty: 0, error: 'Este canal no tiene buscador para leer.' };
  const seed = args.seed.toLowerCase().replace(/\s+/g, ' ').trim();
  const queries = args.expand ? LETTERS.map((l) => `${seed} ${l}`) : [seed];
  const since = new Date(Date.now() - CACHE_DAYS * 86_400_000);
  const out: ReadOutcome = { read: 0, cached: 0, empty: 0, error: null };
  let first = true;
  for (const query of queries) {
    if (!args.force) {
      const recent = await db.searchSuggestion.count({
        where: { accountId: args.accountId, channelId: args.channel.id, query, capturedAt: { gte: since } },
      });
      if (recent > 0) {
        out.cached++;
        continue;
      }
    }
    if (!first) await pause(PAUSE_MS);
    first = false;
    try {
      const suggestions = await research.suggest(query);
      if (suggestions.length === 0) out.empty++;
      else out.read++;
      await saveSuggestions(db, {
        accountId: args.accountId,
        channelId: args.channel.id,
        seed,
        query,
        suggestions,
        source: 'AUTO',
        publicationId: args.publicationId,
      });
    } catch (e) {
      out.error = e instanceof ResearchError ? e.message : 'No se pudo leer el buscador.';
      if (!(e instanceof ResearchError) || e.blocked) break;
    }
  }
  return out;
}

/** Lee la posición de la publicación en una búsqueda y la guarda con fecha. Usa la cuenta conectada si hace falta. */
export async function readPosition(
  db: PrismaClient,
  args: { channel: Channel; storeId?: string | null; publicationId: string; externalId: string; query: string },
): Promise<{ ok: true; page: number | null; position: number | null } | { ok: false; error: string }> {
  const research = getChannelResearch(args.channel.kind);
  if (!research) return { ok: false, error: 'Este canal no tiene buscador para leer.' };
  try {
    const auto = await autoAvailable(db, args.channel, args.storeId ?? null);
    const find = (token?: string) => research.findPosition(args.query, args.externalId, MAX_PAGES, token);
    const found =
      auto.positionsWithAccount && args.storeId ? await withAccessToken(db, args.storeId, (token) => find(token)) : await find();
    await savePosition(db, {
      publicationId: args.publicationId,
      query: args.query,
      page: found?.page ?? null,
      position: found?.position ?? null,
      source: 'AUTO',
    });
    return { ok: true, page: found?.page ?? null, position: found?.position ?? null };
  } catch (e) {
    if (e instanceof ResearchError || e instanceof ConnectError) return { ok: false, error: e.message };
    return { ok: false, error: 'No se pudo leer la búsqueda.' };
  }
}

export type MeasuredSearch = {
  query: string;
  // Dónde apareció, o null si no está en las páginas que se miran.
  found: { page: number; position: number; code: string; organic: boolean } | null;
  top: SearchResult[];
  // La medición anterior de la misma búsqueda, para ver el antes y el después.
  before: { page: number | null; position: number | null; at: Date } | null;
  error: string | null;
};

/**
 * Mide la publicación en sus búsquedas principales con la API oficial del
 * canal y la llave de la tienda conectada: busca cualquier código de la
 * familia y de sus opciones de venta, y el del producto del canal. Guarda cada
 * medición con su fecha, como el histórico de posiciones.
 */
export async function measureSearchPositions(
  db: PrismaClient,
  args: { accountId: string; publicationId: string; queries?: string[]; now?: Date },
): Promise<{ codes: string[]; searches: MeasuredSearch[] }> {
  const pub = await db.publication.findFirst({
    where: { id: args.publicationId, product: { accountId: args.accountId } },
    select: { id: true, familyId: true, mainOptionId: true, storeId: true, store: { select: { channel: { select: { kind: true } } } }, titleWork: { select: { mainSearches: true } } },
  });
  if (!pub) throw new ResearchError('La publicación no está en la cuenta.');
  const research = getChannelResearch(pub.store.channel.kind);
  if (!research?.ranking) throw new ResearchError('Este canal no tiene buscador para medir.');
  const queries = (args.queries ?? parseStrings(pub.titleWork?.mainSearches)).map((q) => q.toLowerCase().replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (queries.length === 0) throw new ResearchError('La publicación no tiene búsquedas principales: elegilas en el paso Título.');

  // Toda la familia y las opciones de venta de cada medida.
  const mainIds = new Set([pub.mainOptionId ?? pub.id]);
  if (pub.familyId) for (const m of await db.publication.findMany({ where: { familyId: pub.familyId }, select: { id: true, mainOptionId: true } })) mainIds.add(m.mainOptionId ?? m.id);
  const related = await db.publication.findMany({
    where: { OR: [{ id: { in: [...mainIds] } }, { mainOptionId: { in: [...mainIds] } }] },
    select: { externalId: true, variantListings: true, channelCopy: { select: { channelProductId: true } } },
  });
  const codes = [...new Set(related.flatMap((r) => [...listingTargets(r), ...(r.channelCopy?.channelProductId ? [r.channelCopy.channelProductId] : [])]).map((c) => c.toUpperCase()))];
  if (codes.length === 0) throw new ResearchError('Todavía no está publicada en el canal.');

  const searches: MeasuredSearch[] = [];
  await withAccessToken(db, pub.storeId, async (token) => {
    for (const [i, query] of queries.entries()) {
      if (i > 0) await pause(PAUSE_MS);
      const last = await db.searchPosition.findFirst({ where: { publicationId: pub.id, query }, orderBy: { checkedAt: 'desc' }, select: { page: true, position: true, checkedAt: true } });
      const before = last ? { page: last.page, position: last.position, at: last.checkedAt } : null;
      try {
        const r = await research.ranking!(query, codes, MAX_PAGES, token);
        await savePosition(db, {
          publicationId: pub.id,
          query,
          page: r.found?.page ?? null,
          position: r.found?.position ?? null,
          source: 'AUTO',
          matchedCode: r.found?.code ?? null,
          organic: r.found?.organic ?? null,
          top: r.top,
          at: args.now,
        });
        searches.push({ query, found: r.found, top: r.top, before, error: null });
      } catch (e) {
        if (!(e instanceof ResearchError)) throw e;
        searches.push({ query, found: null, top: [], before, error: e.message });
        if (e.blocked) break;
      }
    }
  });
  return { codes, searches };
}
