import { prisma } from '@/lib/db';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { faceSummary, faceValues, fingerprintsOf } from '@/domain/channel-sync';
import { LATEST_MEASUREMENTS, latestMetrics } from '@/domain/measurements';
import { resolveTitleLock } from '@/domain/title-lock';
import { scorePublication, type RuleConfig, type ScoreResult } from '@/domain/standard';
import { toScoreInput } from './score-input';

export { toScoreInput } from './score-input';

// Arma lo que necesita el puntaje y lo calcula. El puntaje no se guarda:
// se calcula cada vez, con las reglas y los datos de ese momento.

export async function loadRulesByChannel(accountId: string, db: PrismaClient = prisma): Promise<Map<string, RuleConfig[]>> {
  const rules = await db.standardRule.findMany({
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

export async function listScoredPublications(
  accountId: string,
  where: Prisma.PublicationWhereInput = {},
  db: PrismaClient = prisma,
) {
  const [rules, publications] = await Promise.all([
    loadRulesByChannel(accountId, db),
    db.publication.findMany({
      where: { ...where, product: { accountId } },
      select: {
        id: true,
        title: true,
        description: true,
        attributes: true,
        media: true,
        externalId: true,
        url: true,
        channelStatus: true,
        stage: true,
        pipelineStatus: true,
        pipelineStep: true,
        pipelineRemoval: true,
        titleLockedManual: true,
        updatedAt: true,
        store: { select: { name: true, channelId: true, channel: { select: { kind: true, name: true } } } },
        measurements: { orderBy: { takenAt: 'desc' }, take: LATEST_MEASUREMENTS, select: { takenAt: true, metrics: true } },
        channelCopy: { select: { fingerprints: true, agreed: true, rejections: true, missingSince: true } },
        product: {
          select: {
            id: true,
            name: true,
            kind: true,
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
    const metrics = latestMetrics(p.measurements);
    const channel = getChannelAdapter(p.store.channel.kind, p.store.channel.name);
    const copy = p.channelCopy && !p.channelCopy.missingSince ? p.channelCopy : null;
    const faces = faceSummary(fingerprintsOf(faceValues(p)), copy);
    return {
      id: p.id,
      title: p.title,
      productId: p.product.id,
      productName: p.product.name,
      externalId: p.externalId,
      url: p.url,
      skus: p.product.variants.map((v) => v.sku).filter((s): s is string => Boolean(s)),
      storeName: p.store.name,
      channelName: channel.name,
      channelAccent: channel.accent,
      channelStatus: p.channelStatus,
      stage: p.stage,
      pipelineStatus: p.pipelineStatus,
      pipelineStep: p.pipelineStep,
      pipelineRemoval: p.pipelineRemoval,
      titleLock: resolveTitleLock(channel.titleLock(metrics), p.titleLockedManual, Boolean(p.externalId)),
      family: p.product.productType?.trim() || null,
      kind: p.product.kind,
      visits: typeof metrics.visits_90d === 'number' ? metrics.visits_90d : null,
      sales: typeof metrics.sales_90d === 'number' ? metrics.sales_90d : null,
      score: result.score,
      missing: result.missing,
      // Cómo está frente a lo que se leyó del canal.
      sync: { read: copy !== null, draft: faces.draft.length > 0, choose: faces.choose.length > 0, rejected: faces.rejected.length > 0 },
    };
  });
}
