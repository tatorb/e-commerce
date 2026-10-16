import { prisma } from '@/lib/db';
import { parseMetrics } from '@/domain/measurements';
import { parseNameValueList } from '@/domain/name-value';
import { scorePublication, type RuleConfig, type ScoreInput, type ScoreResult } from '@/domain/standard';

// Arma lo que necesita el puntaje y lo calcula. El puntaje no se guarda:
// se calcula cada vez, con las reglas y los datos de ese momento.

export async function loadRulesByChannel(accountId: string): Promise<Map<string, RuleConfig[]>> {
  const rules = await prisma.standardRule.findMany({
    where: { accountId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  const byChannel = new Map<string, RuleConfig[]>();
  for (const r of rules) {
    const list = byChannel.get(r.channelId) ?? [];
    list.push(r);
    byChannel.set(r.channelId, list);
  }
  return byChannel;
}

type ProductForScore = {
  warranty: string | null;
  kitContents: string | null;
  partNumber: string | null;
  specs: unknown;
  variants: { measure: string | null }[];
  compatibilities: { vehicleBrand: string | null; model: string | null; engine: string | null }[];
  assets: { kind: 'PHOTO' | 'VIDEO' }[];
};

type PublicationForScore = {
  title: string | null;
  description: string | null;
  attributes: unknown;
  measurements: { takenAt: Date; metrics: unknown }[];
};

export function toScoreInput(product: ProductForScore, publication: PublicationForScore): ScoreInput {
  // La medición más reciente: viene ordenada de la más nueva a la más vieja.
  const last = publication.measurements[0];
  return {
    product: {
      warranty: product.warranty,
      kitContents: product.kitContents,
      partNumber: product.partNumber,
      specs: parseNameValueList(product.specs),
      variants: product.variants,
      compatibilities: product.compatibilities,
      assets: product.assets,
    },
    publication: {
      title: publication.title,
      description: publication.description,
      attributes: parseNameValueList(publication.attributes),
    },
    measurement: last ? { takenAt: last.takenAt, metrics: parseMetrics(last.metrics) } : null,
  };
}

export type ScoredPublication = Awaited<ReturnType<typeof listScoredPublications>>[number];

export async function listScoredPublications(accountId: string) {
  const [rules, publications] = await Promise.all([
    loadRulesByChannel(accountId),
    prisma.publication.findMany({
      where: { product: { accountId } },
      select: {
        id: true,
        title: true,
        description: true,
        attributes: true,
        externalId: true,
        channelStatus: true,
        stage: true,
        updatedAt: true,
        store: { select: { name: true, channelId: true } },
        measurements: { orderBy: { takenAt: 'desc' }, take: 1, select: { takenAt: true, metrics: true } },
        product: {
          select: {
            id: true,
            name: true,
            warranty: true,
            kitContents: true,
            partNumber: true,
            specs: true,
            variants: { select: { measure: true, sku: true }, orderBy: { position: 'asc' } },
            compatibilities: { select: { vehicleBrand: true, model: true, engine: true } },
            assets: { select: { kind: true } },
          },
        },
      },
    }),
  ]);

  return publications.map((p) => {
    const result: ScoreResult = scorePublication(rules.get(p.store.channelId) ?? [], toScoreInput(p.product, p));
    const metrics = p.measurements[0] ? parseMetrics(p.measurements[0].metrics) : {};
    return {
      id: p.id,
      title: p.title ?? p.product.name,
      productId: p.product.id,
      externalId: p.externalId,
      skus: p.product.variants.map((v) => v.sku).filter((s): s is string => Boolean(s)),
      storeName: p.store.name,
      channelStatus: p.channelStatus,
      stage: p.stage,
      visits: typeof metrics.visits_90d === 'number' ? metrics.visits_90d : null,
      score: result.score,
      missing: result.missing,
    };
  });
}
