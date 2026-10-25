'use server';

import { act } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { ApplicationError, markApplied, undoApplied } from '@/domain/applications';

type Result = { ok: true } | { ok: false; error: string };

async function publicationFor(accountSlug: string, publicationId: string) {
  return prisma.publication.findFirst({
    where: { id: publicationId, product: { account: { slug: accountSlug } } },
    select: { id: true, store: { select: { applyMethod: true } }, product: { select: { account: { select: { timezone: true } } } } },
  });
}

/** Marca la publicación como aplicada en el canal, en el día que eligió la persona. */
export async function markAppliedAction(accountSlug: string, publicationId: string, day: string): Promise<Result> {
  return act(accountSlug, { section: 'publicaciones', does: 'Marcó la propuesta como aplicada en el canal', publicationId }, async () => {
    const user = await requireUser();
    const pub = await publicationFor(accountSlug, publicationId);
    if (!pub) return { ok: false, error: 'La publicación no existe en esta cuenta.' };
    if (pub.store.applyMethod !== 'MANUAL') {
      return { ok: false, error: 'Esta tienda usa una forma de aplicar que todavía no está disponible.' };
    }
    try {
      await prisma.$transaction((tx) =>
        markApplied(tx, {
          publicationId,
          userId: user.id,
          method: pub.store.applyMethod,
          day: String(day),
          timeZone: pub.product.account.timezone,
        }),
      );
    } catch (e) {
      if (e instanceof ApplicationError) return { ok: false, error: e.message };
      throw e;
    }
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true };
  });
}

/** Para corregir un error: vuelve a "Aprobado". */
export async function undoAppliedAction(accountSlug: string, publicationId: string): Promise<Result> {
  return act(accountSlug, { section: 'publicaciones', does: 'Deshizo la marca de propuesta aplicada', publicationId }, async () => {
    await requireUser();
    const pub = await publicationFor(accountSlug, publicationId);
    if (!pub) return { ok: false, error: 'La publicación no existe en esta cuenta.' };
    try {
      await prisma.$transaction((tx) => undoApplied(tx, { publicationId }));
    } catch (e) {
      if (e instanceof ApplicationError) return { ok: false, error: e.message };
      throw e;
    }
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true };
  });
}
