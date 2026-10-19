'use server';

import { revalidatePath } from 'next/cache';
import { head, put } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { BLOB_NOT_CONFIGURED, isBlobConfigured } from '@/lib/files';
import { BLOB_ACCESS } from '@/lib/file-rules';
import { addChannelPhotos, addUploadedOriginal, PhotoError } from '@/lib/photos';
import { approveStep, archivePhoto, PhotoQueueError, redoStep, retryStep, skipStep } from '@/lib/photo-queue';
import { plural } from '@/lib/format';

// Lo que se hace desde el paso Imágenes: sumar fotos y decidir cada paso de
// su línea. Las fotos son del producto: las ven todas sus publicaciones.

type Result = { ok: true; message?: string } | { ok: false; error: string };

const NOT_FOUND: Result = { ok: false, error: 'La publicación no existe en esta cuenta.' };

async function productOf(accountSlug: string, publicationId: string): Promise<string | null> {
  const pub = await prisma.publication.findFirst({
    where: { id: publicationId, product: { account: { slug: accountSlug } } },
    select: { productId: true },
  });
  return pub?.productId ?? null;
}

async function runInAccount(accountSlug: string, runId: string): Promise<boolean> {
  const run = await prisma.photoStepRun.findFirst({
    where: { id: runId, edit: { product: { account: { slug: accountSlug } } } },
    select: { id: true },
  });
  return run !== null;
}

async function guard(accountSlug: string, run: () => Promise<string | void>): Promise<Result> {
  try {
    const message = await run();
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, message: message ?? undefined };
  } catch (e) {
    if (e instanceof PhotoError || e instanceof PhotoQueueError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Anota los originales que el navegador ya subió al depósito y arranca su línea. */
export async function addUploadedPhotosAction(
  accountSlug: string,
  publicationId: string,
  files: { url: string; name: string }[],
): Promise<Result> {
  const user = await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND;
  return guard(accountSlug, async () => {
    for (const f of files.slice(0, 50)) {
      await addUploadedOriginal(prisma, { productId, url: String(f.url), name: String(f.name ?? ''), userId: user.id }, { head });
    }
    return `${plural(files.length, 'foto')} en la línea.`;
  });
}

/** Suma las fotos publicadas en el canal, en su tamaño más grande. */
export async function addChannelPhotosAction(accountSlug: string, publicationId: string): Promise<Result> {
  const user = await requireUser();
  if (!isBlobConfigured()) return { ok: false, error: BLOB_NOT_CONFIGURED };
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND;
  return guard(accountSlug, async () => {
    const r = await addChannelPhotos(
      prisma,
      { productId, userId: user.id },
      {
        fetch,
        put: (pathname, body, contentType) => put(pathname, body, { access: BLOB_ACCESS, contentType, addRandomSuffix: true }),
      },
    );
    const parts = [
      r.added > 0 ? `Se sumaron ${plural(r.added, 'foto')}.` : 'No se sumó ninguna foto.',
      r.already > 0 ? `${plural(r.already, 'ya estaba', 'ya estaban')} en la línea.` : '',
      ...r.failed,
    ];
    if (r.added === 0 && r.failed.length > 0) throw new PhotoError(parts.filter(Boolean).join(' '));
    return parts.filter(Boolean).join(' ');
  });
}

export async function approvePhotoStepAction(accountSlug: string, runId: string): Promise<Result> {
  const user = await requireUser();
  if (!(await runInAccount(accountSlug, runId))) return NOT_FOUND;
  return guard(accountSlug, () => approveStep(prisma, { runId, userId: user.id }));
}

export async function skipPhotoStepAction(accountSlug: string, runId: string): Promise<Result> {
  const user = await requireUser();
  if (!(await runInAccount(accountSlug, runId))) return NOT_FOUND;
  return guard(accountSlug, () => skipStep(prisma, { runId, userId: user.id }));
}

/** Rehace el paso con los valores de la pantalla, o sin valores para que Claude proponga de nuevo. */
export async function redoPhotoStepAction(
  accountSlug: string,
  runId: string,
  values: Record<string, number> | null,
): Promise<Result> {
  const user = await requireUser();
  if (!(await runInAccount(accountSlug, runId))) return NOT_FOUND;
  const clean = values
    ? Object.fromEntries(Object.entries(values).map(([k, v]) => [String(k), Number(v)]))
    : null;
  return guard(accountSlug, async () => {
    await redoStep(prisma, { runId, userId: user.id, values: clean });
    return 'En cola para rehacer.';
  });
}

export async function retryPhotoStepAction(accountSlug: string, runId: string): Promise<Result> {
  const user = await requireUser();
  if (!(await runInAccount(accountSlug, runId))) return NOT_FOUND;
  return guard(accountSlug, async () => {
    await retryStep(prisma, { runId, userId: user.id });
    return 'En cola de nuevo.';
  });
}

/** Saca la foto de la lista. El original queda guardado. */
export async function archivePhotoAction(accountSlug: string, editId: string): Promise<Result> {
  await requireUser();
  const edit = await prisma.photoEdit.findFirst({ where: { id: editId, product: { account: { slug: accountSlug } } }, select: { id: true } });
  if (!edit) return NOT_FOUND;
  return guard(accountSlug, async () => {
    await archivePhoto(prisma, edit.id);
    return 'Se sacó de la lista.';
  });
}
