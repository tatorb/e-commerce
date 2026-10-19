'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { resolveExternalIds } from '@/lib/catalog';
import { addToPipeline, PipelineError, type Duplicate } from '@/domain/pipeline';

export type AddOutcome =
  | {
      ok: true;
      added: number;
      resumed: number;
      alreadyIn: number;
      // Del mismo producto o con el mismo título que otra: entraron igual.
      related: Duplicate[];
      notFound: string[];
      invalid: string[];
    }
  | { ok: false; error: string };

async function add(accountSlug: string, ids: string[], extra: { notFound: string[]; invalid: string[] }): Promise<AddOutcome> {
  const user = await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return { ok: false, error: 'La cuenta no existe.' };
  try {
    const r = await prisma.$transaction((tx) => addToPipeline(tx, { accountId: account.id, publicationIds: ids, userId: user.id }));
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, ...r, ...extra };
  } catch (e) {
    if (e instanceof PipelineError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Agrega al pipeline las publicaciones elegidas en el Catálogo. */
export async function addToPipelineAction(accountSlug: string, publicationIds: string[]): Promise<AddOutcome> {
  const ids = Array.isArray(publicationIds) ? publicationIds.filter((x) => typeof x === 'string').slice(0, 1000) : [];
  return add(accountSlug, ids, { notFound: [], invalid: [] });
}

/** Agrega al pipeline las publicaciones de los links o códigos pegados. */
export async function addByCodeAction(accountSlug: string, text: string): Promise<AddOutcome> {
  await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return { ok: false, error: 'La cuenta no existe.' };
  const r = await resolveExternalIds(prisma, account.id, String(text ?? ''));
  if (r.ids.length === 0) {
    if (r.notFound.length === 0 && r.invalid.length === 0) return { ok: false, error: 'Pegá al menos un link o código.' };
    return { ok: true, added: 0, resumed: 0, alreadyIn: 0, related: [], notFound: r.notFound, invalid: r.invalid };
  }
  return add(accountSlug, r.ids, { notFound: r.notFound, invalid: r.invalid });
}

/** Marca a mano si el título está bloqueado, para cuando no hay datos de ventas. Null quita la marca. */
export async function setTitleLockAction(
  accountSlug: string,
  publicationId: string,
  locked: boolean | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  const value = locked === true || locked === false ? locked : null;
  const r = await prisma.publication.updateMany({
    where: { id: publicationId, product: { account: { slug: accountSlug } } },
    data: { titleLockedManual: value },
  });
  if (r.count === 0) return { ok: false, error: 'La publicación no existe en esta cuenta.' };
  revalidatePath(`/a/${accountSlug}`, 'layout');
  return { ok: true };
}
