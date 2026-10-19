import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { parseMetrics } from '@/domain/measurements';
import { resolveTitleLock } from '@/domain/title-lock';
import { buildSeeds, buildWordMap, sameText } from '@/domain/titles';
import { parseProposals, parseStrings, parseWordStatuses } from '@/domain/title-work';
import { loadTitleRules } from '@/lib/title-rules';

// Todo lo que usan los pasos Información y Título de una publicación: la
// ficha, la competencia, lo leído del buscador, las posiciones, las reglas y
// el trabajo del título. Recibe la base por parámetro para poder probarlo.

export type Capture = {
  id: string;
  seed: string;
  query: string;
  suggestions: string[];
  source: 'AUTO' | 'MANUAL';
  capturedAt: Date;
};

/** Las sugerencias de todas las capturas, sin repetir, en el orden de las semillas y del buscador. */
export function flattenSuggestions(captures: Capture[], seeds: string[]): string[] {
  const out: string[] = [];
  const bySeed = (seed: string) =>
    captures
      .filter((c) => sameText(c.seed, seed))
      // La semilla sola primero; después, con cada letra.
      .sort((a, b) => Number(a.query !== a.seed) - Number(b.query !== b.seed) || a.query.localeCompare(b.query));
  for (const seed of seeds) {
    for (const c of bySeed(seed)) {
      for (const s of c.suggestions) if (!out.some((o) => sameText(o, s))) out.push(s);
    }
  }
  return out;
}

export async function loadTitleContext(db: PrismaClient, accountId: string, publicationId: string) {
  const pub = await db.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    select: {
      id: true,
      title: true,
      externalId: true,
      productId: true,
      pipelineStatus: true,
      pipelineStep: true,
      titleLockedManual: true,
      store: { select: { id: true, channel: { select: { id: true, kind: true, name: true } } } },
      measurements: { orderBy: { takenAt: 'desc' }, take: 1, select: { metrics: true } },
      product: {
        select: {
          name: true,
          productType: true,
          brand: true,
          partNumber: true,
          line: true,
          origin: true,
          variants: { orderBy: { position: 'asc' }, select: { id: true, sku: true, measure: true } },
          compatibilities: {
            orderBy: { position: 'asc' },
            select: {
              vehicleBrand: true,
              model: true,
              engine: true,
              displacement: true,
              fuel: true,
              yearFrom: true,
              yearTo: true,
              note: true,
            },
          },
        },
      },
      titleWork: true,
      competitors: { orderBy: { position: 'asc' } },
      positions: { orderBy: { checkedAt: 'desc' }, take: 50 },
      titleApprovals: { orderBy: { createdAt: 'desc' }, take: 1, include: { user: { select: { name: true } } } },
    },
  });
  if (!pub) return null;
  const channel = pub.store.channel;
  const adapter = getChannelAdapter(channel.kind, channel.name);
  const { rules, custom } = await loadTitleRules(db, accountId, channel);
  const work = pub.titleWork;
  const seedsSaved = work?.seeds !== null && work?.seeds !== undefined;
  const seeds = seedsSaved ? parseStrings(work!.seeds) : buildSeeds(pub.product);

  // Lo leído para estas semillas, de cualquier publicación de la cuenta: lo más nuevo de cada cosa escrita.
  const rows = await db.searchSuggestion.findMany({
    where: { accountId, channelId: channel.id, seed: { in: seeds } },
    orderBy: { capturedAt: 'desc' },
  });
  const captures: Capture[] = [];
  for (const r of rows) {
    if (captures.some((c) => c.query === r.query)) continue;
    captures.push({ id: r.id, seed: r.seed, query: r.query, suggestions: parseStrings(r.suggestions), source: r.source, capturedAt: r.capturedAt });
  }
  const suggestions = flattenSuggestions(captures, seeds);
  const statuses = parseWordStatuses(work?.words);
  const words = buildWordMap(
    suggestions,
    pub.competitors.map((c) => c.title),
    statuses,
  );
  const metrics = pub.measurements[0] ? parseMetrics(pub.measurements[0].metrics) : {};

  return {
    publication: { id: pub.id, title: pub.title, externalId: pub.externalId, productId: pub.productId, pipelineStatus: pub.pipelineStatus, pipelineStep: pub.pipelineStep },
    channel,
    storeId: pub.store.id,
    product: pub.product,
    titleLock: resolveTitleLock(adapter.titleLock(metrics), pub.titleLockedManual),
    rules,
    customRules: custom,
    seeds,
    seedsSaved,
    captures,
    suggestions,
    words,
    lockDecision: work?.lockDecision ?? null,
    mainSearches: parseStrings(work?.mainSearches),
    proposals: parseProposals(work?.proposals),
    proposalsAt: work?.proposalsAt ?? null,
    competitors: pub.competitors,
    positions: pub.positions,
    lastApproval: pub.titleApprovals[0] ?? null,
  };
}

export type TitleContext = NonNullable<Awaited<ReturnType<typeof loadTitleContext>>>;
