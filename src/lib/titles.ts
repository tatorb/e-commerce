import type { PrismaClient } from '@/generated/prisma/client';
import { cleanTitleProposals, requestTitles, type TitleInput, type TitleResult } from '@/ai/titles';
import { ProposalError } from '@/ai/request';
import { comboParts } from '@/domain/combos';
import { structureFor } from '@/domain/title-rules';
import { loadCombo } from '@/lib/queries/combos';
import { loadTitleContext } from '@/lib/queries/title-step';

// Pide a la IA 3 títulos con las palabras tildadas y los guarda en el trabajo
// del título. Recibe la base y el pedido por parámetro para poder probarlo
// con una base de prueba y una IA simulada.

export type TitlesOutcome =
  | { ok: true; count: number; costUsd: number }
  | { ok: false; error: string; costUsd: number };

export async function generateTitles(
  db: PrismaClient,
  args: { accountId: string; publicationId: string },
  request: (input: TitleInput) => Promise<TitleResult> = requestTitles,
): Promise<TitlesOutcome> {
  const ctx = await loadTitleContext(db, args.accountId, args.publicationId);
  if (!ctx) return { ok: false, error: 'La publicación no existe en esta cuenta.', costUsd: 0 };
  // Se puede pedir desde cualquier paso, para trabajar el título antes de llegar; no fuera del pipeline.
  if (ctx.publication.pipelineStatus !== 'IN_PIPELINE') {
    return { ok: false, error: 'La publicación no está en el pipeline. Agregala para pedir títulos a la IA.', costUsd: 0 };
  }
  const words = ctx.words
    .filter((w) => w.status === 'use')
    .sort((a, b) => a.order - b.order)
    .map((w) => w.word);
  if (words.length === 0) return { ok: false, error: 'Tildá al menos una palabra del mapa para que la IA arme los títulos.', costUsd: 0 };

  const input: TitleInput = {
    channelName: ctx.channel.name,
    rules: ctx.rules,
    structure: structureFor(ctx.rules, ctx.product.productType),
    product: ctx.product,
    combo: comboParts(await loadCombo(db, ctx.publication.productId)),
    currentTitle: ctx.publication.title,
    words,
    suggestions: ctx.suggestions,
    competitorTitles: ctx.competitors.map((c) => c.title),
  };

  try {
    const r = await request(input);
    const proposals = cleanTitleProposals(r.output);
    if (proposals.length === 0) return { ok: false, error: 'Claude no devolvió títulos. Probá de nuevo.', costUsd: r.usage.costUsd };
    await db.titleWork.upsert({
      where: { publicationId: args.publicationId },
      update: { proposals, proposalsAt: new Date(), proposalUsage: r.usage },
      create: { publicationId: args.publicationId, proposals, proposalsAt: new Date(), proposalUsage: r.usage },
    });
    return { ok: true, count: proposals.length, costUsd: r.usage.costUsd };
  } catch (e) {
    if (e instanceof ProposalError) return { ok: false, error: e.message, costUsd: e.usage?.costUsd ?? 0 };
    throw e;
  }
}
