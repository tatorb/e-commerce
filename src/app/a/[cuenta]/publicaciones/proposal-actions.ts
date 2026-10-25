'use server';

import { act } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { AI_NOT_CONFIGURED, isAiConfigured } from '@/ai/claude';
import { generateProposal, type GenerateOutcome } from '@/lib/proposals';

/** Genera la propuesta de una publicación. Una por llamada: la tanda la arma la pantalla. */
export async function generateProposalAction(accountSlug: string, publicationId: string): Promise<GenerateOutcome> {
  const r = await act<GenerateOutcome>(accountSlug, { section: 'publicaciones', does: 'Pidió una propuesta completa a la IA', publicationId }, async () => {
    const user = await requireUser();
    if (!isAiConfigured()) return { ok: false, error: AI_NOT_CONFIGURED, costUsd: 0 };
    const account = await prisma.account.findUnique({ where: { slug: accountSlug }, select: { id: true } });
    if (!account) return { ok: false, error: 'La cuenta no existe.', costUsd: 0 };

    const outcome = await generateProposal(prisma, { accountId: account.id, publicationId, userId: user.id });
    if (outcome.ok) revalidatePath(`/a/${accountSlug}`, 'layout');
    return outcome;
  });
  return 'costUsd' in r ? r : { ...r, costUsd: 0 };
}
