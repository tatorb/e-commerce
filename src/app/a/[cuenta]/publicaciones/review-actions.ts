'use server';

import { act } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getChannelAdapter } from '@/channels';
import {
  approveProposal,
  nextPendingProposal,
  rejectProposal,
  ReviewError,
  ReviewValidationError,
  saveReviewDraft,
  startReview,
} from '@/domain/proposals';
import { reviewFieldsInputSchema, type ReviewProblem } from '@/domain/review';

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; problems?: ReviewProblem[] };

/** La propuesta, solo si es de esta cuenta, con lo que hace falta del canal. */
async function proposalFor(accountSlug: string, proposalId: string) {
  const proposal = await prisma.proposal.findFirst({
    where: { id: proposalId, publication: { product: { account: { slug: accountSlug } } } },
    select: {
      id: true,
      publicationId: true,
      publication: { select: { product: { select: { accountId: true } }, store: { select: { channel: true } } } },
    },
  });
  if (!proposal) return null;
  const channel = proposal.publication.store.channel;
  return {
    id: proposal.id,
    publicationId: proposal.publicationId,
    accountId: proposal.publication.product.accountId,
    titleMaxLength: getChannelAdapter(channel.kind, channel.name).titleMaxLength,
  };
}

function failure(e: unknown): { ok: false; error: string; problems?: ReviewProblem[] } {
  if (e instanceof ReviewValidationError) return { ok: false, error: 'Todavía no se puede aprobar.', problems: e.problems };
  if (e instanceof ReviewError) return { ok: false, error: e.message };
  throw e;
}

export async function startReviewAction(accountSlug: string, proposalId: string): Promise<Result> {
  return act(accountSlug, { section: 'publicaciones', does: 'Empezó a revisar una propuesta' }, async () => {
    const user = await requireUser();
    const proposal = await proposalFor(accountSlug, proposalId);
    if (!proposal) return { ok: false, error: 'La propuesta no existe en esta cuenta.' };
    try {
      await prisma.$transaction((tx) => startReview(tx, { proposalId, userId: user.id }));
    } catch (e) {
      return failure(e);
    }
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true };
  });
}

export async function saveReviewDraftAction(accountSlug: string, proposalId: string, rawFields: unknown): Promise<Result> {
  return act(accountSlug, { section: 'publicaciones' }, async () => {
    const user = await requireUser();
    const proposal = await proposalFor(accountSlug, proposalId);
    if (!proposal) return { ok: false, error: 'La propuesta no existe en esta cuenta.' };
    const fields = reviewFieldsInputSchema.safeParse(rawFields);
    if (!fields.success) return { ok: false, error: 'Lo que llegó de la pantalla no tiene la forma esperada.' };
    try {
      await prisma.$transaction((tx) => saveReviewDraft(tx, { proposalId, userId: user.id, fields: fields.data }));
    } catch (e) {
      return failure(e);
    }
    return { ok: true };
  });
}

/** Aprueba. Con `next`, además empieza la revisión de la próxima pendiente y devuelve cuál es. */
export async function approveProposalAction(
  accountSlug: string,
  proposalId: string,
  rawFields: unknown,
  opts: { next: boolean },
): Promise<Result<{ productId: string; nextPublicationId: string | null }>> {
  return act(accountSlug, { section: 'publicaciones', does: 'Aprobó una propuesta' }, async () => {
    const user = await requireUser();
    const proposal = await proposalFor(accountSlug, proposalId);
    if (!proposal) return { ok: false, error: 'La propuesta no existe en esta cuenta.' };
    const fields = reviewFieldsInputSchema.safeParse(rawFields);
    if (!fields.success) return { ok: false, error: 'Lo que llegó de la pantalla no tiene la forma esperada.' };
    try {
      await prisma.$transaction((tx) =>
        approveProposal(tx, {
          proposalId,
          userId: user.id,
          fields: fields.data,
          titleMaxLength: proposal.titleMaxLength,
        }),
      );
    } catch (e) {
      return failure(e);
    }

    let nextPublicationId: string | null = null;
    if (opts.next) {
      const next = await nextPendingProposal(prisma, {
        accountId: proposal.accountId,
        excludePublicationId: proposal.publicationId,
      });
      if (next) {
        try {
          await prisma.$transaction((tx) => startReview(tx, { proposalId: next.proposalId, userId: user.id }));
          nextPublicationId = next.publicationId;
        } catch {
          // Si otra persona la tomó justo, se vuelve a la ficha.
        }
      }
    }
    const pub = await prisma.publication.findUniqueOrThrow({
      where: { id: proposal.publicationId },
      select: { productId: true },
    });
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, productId: pub.productId, nextPublicationId };
  });
}

export async function rejectProposalAction(
  accountSlug: string,
  proposalId: string,
  reason: string,
): Promise<Result<{ productId: string }>> {
  return act(accountSlug, { section: 'publicaciones', does: 'Rechazó una propuesta', detail: reason }, async () => {
    const user = await requireUser();
    const proposal = await proposalFor(accountSlug, proposalId);
    if (!proposal) return { ok: false, error: 'La propuesta no existe en esta cuenta.' };
    try {
      await prisma.$transaction((tx) =>
        rejectProposal(tx, { proposalId, userId: user.id, reason: String(reason ?? '').slice(0, 2000) }),
      );
    } catch (e) {
      return failure(e);
    }
    const pub = await prisma.publication.findUniqueOrThrow({
      where: { id: proposal.publicationId },
      select: { productId: true },
    });
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, productId: pub.productId };
  });
}
