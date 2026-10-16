import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { ProposalError, requestProposal, toDraft, type ProposalInput, type ProposalResult } from '@/ai/proposal';
import { loadContent } from '@/domain/content';
import { parseMetrics } from '@/domain/measurements';
import { canGenerateProposal, ProposalStageError, saveProposal, toProposalFields } from '@/domain/proposals';
import { describeCheck, scorePublication } from '@/domain/standard';
import { toScoreInput } from '@/lib/queries/score-input';

// Genera la propuesta de una publicación: junta lo que sabe la app, se lo
// pide a la IA y guarda la respuesta. Recibe la base por parámetro para
// poder probarlo con una base de prueba y una IA simulada.

export type GenerateOutcome =
  | { ok: true; proposalId: string; fieldsChanged: number; costUsd: number }
  | { ok: false; error: string; costUsd: number; retryable?: boolean };

type Requester = (input: ProposalInput) => Promise<ProposalResult>;

export async function generateProposal(
  db: PrismaClient,
  args: { accountId: string; publicationId: string; userId: string | null },
  request: Requester = requestProposal,
): Promise<GenerateOutcome> {
  const pub = await db.publication.findFirst({
    where: { id: args.publicationId, product: { accountId: args.accountId } },
    select: {
      id: true,
      stage: true,
      title: true,
      description: true,
      attributes: true,
      store: { select: { channel: { select: { id: true, kind: true, name: true } } } },
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
          account: { select: { name: true } },
        },
      },
    },
  });
  if (!pub) return { ok: false, error: 'La publicación no existe en esta cuenta.', costUsd: 0 };
  if (!canGenerateProposal(pub.stage)) return { ok: false, error: new ProposalStageError().message, costUsd: 0 };

  const channel = pub.store.channel;
  const adapter = getChannelAdapter(channel.kind, channel.name);
  const rules = await db.standardRule.findMany({
    where: { accountId: args.accountId, channelId: channel.id },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  const score = scorePublication(rules, toScoreInput(pub.product, pub));
  const baseline = await loadContent(db, pub.product.id, pub.id);
  const metrics = pub.measurements[0] ? parseMetrics(pub.measurements[0].metrics) : {};

  const input: ProposalInput = {
    accountName: pub.product.account.name,
    channel: { name: adapter.name, titleMaxLength: adapter.titleMaxLength },
    rules: rules
      .filter((r) => r.active)
      .map((r) => ({ name: r.name, description: r.description, checks: describeCheck(r.check, r.params), weight: r.weight })),
    missing: score.missing.map((m) => ({ name: m.name, detail: m.detail })),
    productName: pub.product.name,
    content: baseline,
    listing: {
      photoCount: typeof metrics.photo_count === 'number' ? metrics.photo_count : null,
      hasVideo: typeof metrics.has_video === 'boolean' ? metrics.has_video : null,
      channelQuality: typeof metrics.channel_quality === 'number' ? metrics.channel_quality : null,
      channelGoals: typeof metrics.channel_goals === 'string' ? metrics.channel_goals : null,
    },
  };

  let result: ProposalResult;
  try {
    result = await request(input);
  } catch (e) {
    if (e instanceof ProposalError) {
      return { ok: false, error: e.message, costUsd: e.usage?.costUsd ?? 0, retryable: e.retryable };
    }
    // Sin el contenido: nunca se registra lo que va y viene de la IA.
    console.error('Error al pedir la propuesta', e instanceof Error ? e.name : typeof e);
    return { ok: false, error: 'No se pudo pedir la propuesta. Probá de nuevo.', costUsd: 0 };
  }

  const draft = toDraft(result.output);
  const { fields, notes } = toProposalFields(baseline, draft, { titleMaxLength: adapter.titleMaxLength });
  try {
    const saved = await db.$transaction((tx) =>
      saveProposal(tx, {
        publicationId: pub.id,
        userId: args.userId,
        summary: draft.summary,
        fields,
        notes,
        baseline,
        model: result.model,
        usage: result.usage,
      }),
    );
    return { ok: true, proposalId: saved.id, fieldsChanged: fields.length, costUsd: result.usage.costUsd };
  } catch (e) {
    if (e instanceof ProposalStageError) return { ok: false, error: e.message, costUsd: result.usage.costUsd };
    throw e;
  }
}
