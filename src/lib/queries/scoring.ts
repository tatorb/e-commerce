import { prisma } from '@/lib/db';
import { getChannelAdapter } from '@/channels';
import { parseMetrics } from '@/domain/measurements';
import { resolveTitleLock } from '@/domain/title-lock';
import { scorePublication, type RuleConfig, type ScoreResult } from '@/domain/standard';
import { toScoreInput } from './score-input';

export { toScoreInput } from './score-input';

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
        pipelineStatus: true,
        pipelineStep: true,
        pipelineRemoval: true,
        titleLockedManual: true,
        updatedAt: true,
        store: { select: { name: true, channelId: true, channel: { select: { kind: true, name: true } } } },
        measurements: { orderBy: { takenAt: 'desc' }, take: 1, select: { takenAt: true, metrics: true } },
        product: {
          select: {
            id: true,
            name: true,
            productType: true,
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
    const channel = getChannelAdapter(p.store.channel.kind, p.store.channel.name);
    return {
      id: p.id,
      title: p.title ?? p.product.name,
      productId: p.product.id,
      externalId: p.externalId,
      skus: p.product.variants.map((v) => v.sku).filter((s): s is string => Boolean(s)),
      storeName: p.store.name,
      channelStatus: p.channelStatus,
      stage: p.stage,
      pipelineStatus: p.pipelineStatus,
      pipelineStep: p.pipelineStep,
      pipelineRemoval: p.pipelineRemoval,
      titleLock: resolveTitleLock(channel.titleLock(metrics), p.titleLockedManual),
      family: p.product.productType?.trim() || null,
      visits: typeof metrics.visits_90d === 'number' ? metrics.visits_90d : null,
      sales: typeof metrics.sales_90d === 'number' ? metrics.sales_90d : null,
      score: result.score,
      missing: result.missing,
    };
  });
}
