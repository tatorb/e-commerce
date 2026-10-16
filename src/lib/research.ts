import type { PrismaClient } from '@/generated/prisma/client';
import type { ChannelKind } from '@/generated/prisma/enums';
import { getChannelResearch, pause, ResearchError } from '@/channels/research';
import { MAX_PAGES, savePosition, saveSuggestions } from '@/domain/title-work';

// Lecturas automáticas del canal, con lo que ya se leyó guardado para no
// volver a pedirlo. Recibe la base por parámetro para poder probarlo.

type Channel = { id: string; kind: ChannelKind };

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
// Lo leído hace menos de esto no se vuelve a pedir.
const CACHE_DAYS = 7;
const PAUSE_MS = 300;

/** Qué se puede leer solo, según la última prueba de conexión. */
export async function autoAvailable(db: PrismaClient, channel: Channel): Promise<{ suggestions: boolean; positions: boolean }> {
  const research = getChannelResearch(channel.kind);
  if (!research) return { suggestions: false, positions: false };
  const latest = async (check: string) =>
    (await db.channelProbe.findFirst({ where: { channelId: channel.id, check }, orderBy: { checkedAt: 'desc' } }))?.ok ?? false;
  const [suggestions, positions] = await Promise.all([latest(research.checks.suggestions), latest(research.checks.positions)]);
  return { suggestions, positions };
}

/** Corre la prueba de conexión y guarda cada resultado con fecha. */
export async function runProbe(db: PrismaClient, channel: Channel) {
  const research = getChannelResearch(channel.kind);
  if (!research) return [];
  const results = await research.probe();
  await db.channelProbe.createMany({
    data: results.map((r) => ({ channelId: channel.id, check: r.check, ok: r.ok, detail: r.detail })),
  });
  return results;
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

/** Lee la posición de la publicación en una búsqueda y la guarda con fecha. */
export async function readPosition(
  db: PrismaClient,
  args: { channel: Channel; publicationId: string; externalId: string; query: string },
): Promise<{ ok: true; page: number | null; position: number | null } | { ok: false; error: string }> {
  const research = getChannelResearch(args.channel.kind);
  if (!research) return { ok: false, error: 'Este canal no tiene buscador para leer.' };
  try {
    const found = await research.findPosition(args.query, args.externalId, MAX_PAGES);
    await savePosition(db, {
      publicationId: args.publicationId,
      query: args.query,
      page: found?.page ?? null,
      position: found?.position ?? null,
      source: 'AUTO',
    });
    return { ok: true, page: found?.page ?? null, position: found?.position ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof ResearchError ? e.message : 'No se pudo leer la búsqueda.' };
  }
}
