'use server';

import { act } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { startResumableUpload, withDriveToken } from '@/lib/drive';
import { originalTypeFor, photoFolderId, photoOwner } from '@/lib/photo-files';
import { addUploadedOriginals, originalProblem, PhotoError, syncOriginals } from '@/lib/photos';
import { approveStep, archivePhoto, PhotoQueueError, redoStep, retryStep, skipStep } from '@/lib/photo-queue';
import { publicAppUrl } from '@/lib/public-url';
import { storageError } from '@/lib/stored-files';
import { addChannelPhotosOf, asIsCheckFor, setPhotoAsIs, tidyCorrected } from '@/lib/photo-commands';
import { placeShotPhotosQuietly } from '@/lib/shoot';
import { plural } from '@/lib/format';

// Lo que se hace desde el paso Imágenes: sumar fotos y decidir cada paso de
// su línea. Las fotos son del producto: las ven todas sus publicaciones, y se
// guardan en su carpeta Fotos del Drive del estudio.

type Result = { ok: true; message?: string } | { ok: false; error: string };

const NOT_FOUND: Result = { ok: false, error: 'La publicación no existe en esta cuenta.' };

async function productOf(accountSlug: string, publicationId: string): Promise<string | null> {
  const pub = await prisma.publication.findFirst({
    where: { id: publicationId, product: { account: { slug: accountSlug } } },
    select: { productId: true },
  });
  return pub?.productId ?? null;
}

async function runInAccount(accountSlug: string, runId: string): Promise<{ productId: string } | null> {
  const run = await prisma.photoStepRun.findFirst({
    where: { id: runId, edit: { product: { account: { slug: accountSlug } } } },
    select: { edit: { select: { productId: true } } },
  });
  return run ? { productId: run.edit.productId } : null;
}

async function guard(accountSlug: string, run: () => Promise<string | void>): Promise<Result> {
  try {
    const message = await run();
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, message: message ?? undefined };
  } catch (e) {
    if (e instanceof PhotoError || e instanceof PhotoQueueError) return { ok: false, error: e.message };
    const storage = storageError(e);
    if (storage) return { ok: false, error: storage };
    throw e;
  }
}

/** Abre la subida de un original a la carpeta Originales del producto: el navegador lo sube directo al Drive. */
export async function startPhotoUploadAction(
  accountSlug: string,
  publicationId: string,
  file: { name: string; size: number },
): Promise<{ ok: true; uploadUrl: string } | { ok: false; error: string }> {
  return act(accountSlug, { section: ['pipeline', 'productos'] }, async () => {
    await requireUser();
    const productId = await productOf(accountSlug, publicationId);
    if (!productId) return NOT_FOUND as { ok: false; error: string };
    const name = String(file?.name ?? '').trim().slice(0, 200);
    const size = Number(file?.size);
    const problem = originalProblem({ name, size });
    if (problem) return { ok: false, error: problem };
    // La subida se abre con el origen de la página, así el navegador puede usarla.
    const origin = (await headers()).get('origin') ?? publicAppUrl();
    try {
      const owner = await photoOwner(prisma, productId);
      const uploadUrl = await withDriveToken(prisma, async (token, email) =>
        startResumableUpload(token, {
          folderId: await photoFolderId(prisma, token, email, owner, 'originales'),
          name,
          type: originalTypeFor(name)!,
          size,
          origin,
          properties: { mrbProducto: productId },
        }),
      );
      return { ok: true, uploadUrl };
    } catch (e) {
      const message = storageError(e);
      if (message) return { ok: false, error: message };
      throw e;
    }
  });
}

/** Anota los originales que el navegador ya subió al Drive y arranca su línea, o los deja para usarlos tal cual. */
export async function addUploadedPhotosAction(accountSlug: string, publicationId: string, fileIds: string[], asIs = false): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Subió fotos', publicationId }, async () => {
    const user = await requireUser();
    const account = await getAccountBySlug(accountSlug);
    const productId = await productOf(accountSlug, publicationId);
    if (!account || !productId) return NOT_FOUND;
    return guard(accountSlug, async () => {
      const r = await addUploadedOriginals(prisma, {
        accountId: account.id,
        productId,
        fileIds: (fileIds ?? []).map(String),
        userId: user.id,
        asIs: asIs === true ? await asIsCheckFor(prisma, publicationId) : undefined,
      });
      if (r.added === 0 && r.problems.length > 0) throw new PhotoError(r.problems.join(' '));
      return [`${plural(r.added, 'foto')} en la línea.`, ...r.problems].join(' ');
    });
  });
}

/**
 * Usa el original tal cual, porque ya viene editado, o lo vuelve a mandar a
 * corregir en la Mac. Para usarlo tal cual, el canal lo tiene que aceptar así.
 */
export async function setPhotoAsIsAction(accountSlug: string, publicationId: string, editId: string, asIs: boolean): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Cambió si una foto se usa tal cual', publicationId }, async () => {
    await requireUser();
    if (!(await productOf(accountSlug, publicationId))) return NOT_FOUND;
    let found = true;
    const r = await guard(accountSlug, async () => {
      const message = await setPhotoAsIs(prisma, { publicationId, editId, asIs: asIs === true });
      if (message === null) found = false;
      return message ?? undefined;
    });
    return found ? r : NOT_FOUND;
  });
}

/** Lee la carpeta Originales: las fotos copiadas desde la Mac entran a la línea. */
export async function syncOriginalsAction(
  accountSlug: string,
  publicationId: string,
): Promise<{ ok: true; added: number; skipped: string[]; folderUrl: string | null } | { ok: false; error: string }> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Actualizó las fotos originales', publicationId }, async () => {
    await requireUser();
    const account = await getAccountBySlug(accountSlug);
    const productId = await productOf(accountSlug, publicationId);
    if (!account || !productId) return NOT_FOUND as { ok: false; error: string };
    try {
      const r = await syncOriginals(prisma, { accountId: account.id, productId });
      if (r.added > 0) revalidatePath(`/a/${accountSlug}`, 'layout');
      return { ok: true, ...r };
    } catch (e) {
      const message = storageError(e) ?? (e instanceof PhotoError ? e.message : null);
      if (message) return { ok: false, error: message };
      throw e;
    }
  });
}

/** Suma las fotos publicadas en el canal, en su tamaño más grande. */
export async function addChannelPhotosAction(accountSlug: string, publicationId: string): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Sumó las fotos que tiene en el canal', publicationId }, async () => {
    const user = await requireUser();
    const productId = await productOf(accountSlug, publicationId);
    if (!productId) return NOT_FOUND;
    return guard(accountSlug, () => addChannelPhotosOf(prisma, { productId, userId: user.id }));
  });
}

export async function approvePhotoStepAction(accountSlug: string, runId: string): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Aprobó un paso de una foto' }, async () => {
    const user = await requireUser();
    const run = await runInAccount(accountSlug, runId);
    if (!run) return NOT_FOUND;
    return guard(accountSlug, async () => {
      await approveStep(prisma, { runId, userId: user.id });
      await tidyCorrected(prisma, run.productId);
      // Si era una foto de Registro de productos, ya está lista para sus publicaciones.
      await placeShotPhotosQuietly(prisma, run.productId);
    });
  });
}

export async function skipPhotoStepAction(accountSlug: string, runId: string): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Salteó un paso de una foto' }, async () => {
    const user = await requireUser();
    const run = await runInAccount(accountSlug, runId);
    if (!run) return NOT_FOUND;
    return guard(accountSlug, async () => {
      await skipStep(prisma, { runId, userId: user.id });
      await tidyCorrected(prisma, run.productId);
    });
  });
}

/**
 * Rehace el paso con los valores de la pantalla y los ajustes apagados, o sin
 * pedido para que Claude proponga de nuevo.
 */
export async function redoPhotoStepAction(
  accountSlug: string,
  runId: string,
  request: { valores: Record<string, Record<string, number>>; apagados: string[] } | null,
): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Pidió rehacer un paso de una foto' }, async () => {
    const user = await requireUser();
    const run = await runInAccount(accountSlug, runId);
    if (!run) return NOT_FOUND;
    const clean = request
      ? {
          valores: Object.fromEntries(
            Object.entries(request.valores ?? {}).map(([paso, v]) => [
              String(paso),
              Object.fromEntries(Object.entries(v ?? {}).map(([k, n]) => [String(k), Number(n)])),
            ]),
          ),
          apagados: Array.isArray(request.apagados) ? request.apagados.map(String) : [],
        }
      : null;
    return guard(accountSlug, async () => {
      await redoStep(prisma, { runId, userId: user.id, request: clean });
      await tidyCorrected(prisma, run.productId);
      return 'En cola para rehacer.';
    });
  });
}

export async function retryPhotoStepAction(accountSlug: string, runId: string): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Volvió a intentar un paso de una foto' }, async () => {
    const user = await requireUser();
    if (!(await runInAccount(accountSlug, runId))) return NOT_FOUND;
    return guard(accountSlug, async () => {
      await retryStep(prisma, { runId, userId: user.id });
      return 'En cola de nuevo.';
    });
  });
}

/** Saca la foto de la lista. El original queda guardado. */
export async function archivePhotoAction(accountSlug: string, editId: string): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Archivó una foto' }, async () => {
    await requireUser();
    const edit = await prisma.photoEdit.findFirst({ where: { id: editId, product: { account: { slug: accountSlug } } }, select: { id: true, productId: true } });
    if (!edit) return NOT_FOUND;
    return guard(accountSlug, async () => {
      await archivePhoto(prisma, edit.id);
      await tidyCorrected(prisma, edit.productId);
      return 'Se sacó de la lista.';
    });
  });
}
