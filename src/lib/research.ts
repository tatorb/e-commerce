import type { PrismaClient } from '@/generated/prisma/client';
import type { ChannelKind } from '@/generated/prisma/enums';
import { ConnectError } from '@/channels/connect';
import { getChannelResearch, pause, ResearchError, type ProbeResult } from '@/channels/research';
import { MAX_PAGES, savePosition, saveSuggestions } from '@/domain/title-work';
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
