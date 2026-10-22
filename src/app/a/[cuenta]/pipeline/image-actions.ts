'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getChannelAdapter } from '@/channels';
import { asIsProblem } from '@/domain/media';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { startResumableUpload, uploadContent, withDriveToken } from '@/lib/drive';
import { originalTypeFor, photoFolderId, photoOwner, syncCorrected } from '@/lib/photo-files';
import { addChannelPhotos, addUploadedOriginals, originalProblem, PhotoError, syncOriginals, type AsIsCheck } from '@/lib/photos';
import { approveStep, archivePhoto, PhotoQueueError, redoStep, retryStep, setAsIs, skipStep } from '@/lib/photo-queue';
import { publicAppUrl } from '@/lib/public-url';
import { driveRef, storageError } from '@/lib/stored-files';
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

/** Qué impide usar una foto tal cual en el canal de la publicación. */
async function asIsCheckFor(publicationId: string): Promise<AsIsCheck> {
  const pub = await prisma.publication.findUniqueOrThrow({ where: { id: publicationId }, select: { store: { select: { channel: true } } } });
  const adapter = getChannelAdapter(pub.store.channel.kind, pub.store.channel.name);
  return (file) => asIsProblem(file, adapter.photos, adapter.name);
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

/**
 * Deja Corregidas al día después de una decisión. Si el Drive no responde no
 * corta nada: se pone al día en la próxima.
 */
async function tidyCorrected(productId: string) {
  try {
    await syncCorrected(prisma, productId);
  } catch (e) {
    console.error('No se pudo ordenar la carpeta Corregidas.', storageError(e) ?? e);
  }
}

/** Abre la subida de un original a la carpeta Originales del producto: el navegador lo sube directo al Drive. */
export async function startPhotoUploadAction(
  accountSlug: string,
  publicationId: string,
  file: { name: string; size: number },
): Promise<{ ok: true; uploadUrl: string } | { ok: false; error: string }> {
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
}

/** Anota los originales que el navegador ya subió al Drive y arranca su línea, o los deja para usarlos tal cual. */
export async function addUploadedPhotosAction(accountSlug: string, publicationId: string, fileIds: string[], asIs = false): Promise<Result> {
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
      asIs: asIs === true ? await asIsCheckFor(publicationId) : undefined,
    });
    if (r.added === 0 && r.problems.length > 0) throw new PhotoError(r.problems.join(' '));
    return [`${plural(r.added, 'foto')} en la línea.`, ...r.problems].join(' ');
  });
}

/**
 * Usa el original tal cual, porque ya viene editado, o lo vuelve a mandar a
 * corregir en la Mac. Para usarlo tal cual, el canal lo tiene que aceptar así.
 */
export async function setPhotoAsIsAction(accountSlug: string, publicationId: string, editId: string, asIs: boolean): Promise<Result> {
  await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  const edit = await prisma.photoEdit.findFirst({
    where: { id: editId, productId: productId ?? '' },
    select: { id: true, productId: true, originalType: true, originalSize: true },
  });
  if (!productId || !edit) return NOT_FOUND;
  return guard(accountSlug, async () => {
    if (asIs === true) {
      const problem = (await asIsCheckFor(publicationId))({ type: edit.originalType, size: edit.originalSize });
      if (problem) throw new PhotoError(problem);
    }
    await setAsIs(prisma, { editId: edit.id, asIs: asIs === true });
    await tidyCorrected(edit.productId);
    return asIs === true ? 'Se usa el original tal cual.' : 'Vuelve a la línea para corregirla en la Mac.';
  });
}

/** Lee la carpeta Originales: las fotos copiadas desde la Mac entran a la línea. */
export async function syncOriginalsAction(
  accountSlug: string,
  publicationId: string,
): Promise<{ ok: true; added: number; skipped: string[]; folderUrl: string | null } | { ok: false; error: string }> {
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
}

/** Suma las fotos publicadas en el canal, en su tamaño más grande. */
export async function addChannelPhotosAction(accountSlug: string, publicationId: string): Promise<Result> {
  const user = await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND;
  return guard(accountSlug, async () => {
    const owner = await photoOwner(prisma, productId);
    const r = await withDriveToken(prisma, async (token, email) => {
      const folderId = await photoFolderId(prisma, token, email, owner, 'originales');
      return addChannelPhotos(
        prisma,
        { productId, userId: user.id },
        {
          fetch,
          put: async (name, body, contentType) => ({
            url: driveRef((await uploadContent(token, { folderId, name, type: contentType, data: body, properties: { mrbProducto: productId } })).id),
          }),
        },
      );
    });
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
  const run = await runInAccount(accountSlug, runId);
  if (!run) return NOT_FOUND;
  return guard(accountSlug, async () => {
    await approveStep(prisma, { runId, userId: user.id });
    await tidyCorrected(run.productId);
  });
}

export async function skipPhotoStepAction(accountSlug: string, runId: string): Promise<Result> {
  const user = await requireUser();
  const run = await runInAccount(accountSlug, runId);
  if (!run) return NOT_FOUND;
  return guard(accountSlug, async () => {
    await skipStep(prisma, { runId, userId: user.id });
    await tidyCorrected(run.productId);
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
    await tidyCorrected(run.productId);
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
  const edit = await prisma.photoEdit.findFirst({ where: { id: editId, product: { account: { slug: accountSlug } } }, select: { id: true, productId: true } });
  if (!edit) return NOT_FOUND;
  return guard(accountSlug, async () => {
    await archivePhoto(prisma, edit.id);
    await tidyCorrected(edit.productId);
    return 'Se sacó de la lista.';
  });
}
