'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { CryptoError } from '@/lib/crypto';
import { DriveError } from '@/lib/drive';
import { publicAppUrl } from '@/lib/public-url';
import {
  chooseClip,
  finishVideoUpload,
  markClipUploaded,
  moveClip,
  removeClip,
  saveVideoMeasure,
  startVideoUpload,
  syncProductVideos,
  trashVideo,
  VideoError,
  type SyncResult,
} from '@/lib/videos';

// Lo que se hace desde el paso Videos: revisar la carpeta del Drive, subir,
// medir y borrar videos, y elegir el clip de la publicación. Los videos son
// del producto: los ven todas sus publicaciones.

type Fail = { ok: false; error: string };
type Result = { ok: true; message?: string } | Fail;

async function accountIdOf(accountSlug: string): Promise<string | null> {
  return (await getAccountBySlug(accountSlug))?.id ?? null;
}

async function guard<T extends object>(run: () => Promise<T>): Promise<({ ok: true } & T) | Fail> {
  try {
    return { ok: true, ...(await run()) };
  } catch (e) {
    if (e instanceof VideoError || e instanceof DriveError || e instanceof CryptoError) return { ok: false, error: e.message };
    throw e;
  }
}

const NO_ACCOUNT: Fail = { ok: false, error: 'La cuenta no existe.' };

/** Lee la carpeta del producto en el Drive. */
export async function syncVideosAction(accountSlug: string, productId: string): Promise<({ ok: true } & SyncResult) | Fail> {
  await requireUser();
  const accountId = await accountIdOf(accountSlug);
  if (!accountId) return NO_ACCOUNT;
  return guard(() => syncProductVideos(prisma, { accountId, productId: String(productId) }));
}

/** Abre la subida de un video: el navegador manda el archivo directo a Google. */
export async function startVideoUploadAction(
  accountSlug: string,
  productId: string,
  file: { name: string; size: number; type: string },
): Promise<({ ok: true } & { uploadUrl: string }) | Fail> {
  await requireUser();
  const accountId = await accountIdOf(accountSlug);
  if (!accountId) return NO_ACCOUNT;
  // La subida se abre con el origen de la página, así el navegador puede usarla.
  const origin = (await headers()).get('origin') ?? publicAppUrl();
  return guard(() =>
    startVideoUpload(prisma, {
      accountId,
      productId: String(productId),
      file: { name: String(file?.name ?? ''), size: Number(file?.size), type: String(file?.type ?? '') },
      origin,
    }),
  );
}

export async function finishVideoUploadAction(
  accountSlug: string,
  productId: string,
  fileId: string,
  size: number,
  measure: unknown,
): Promise<({ ok: true } & { videoId: string }) | Fail> {
  const user = await requireUser();
  const accountId = await accountIdOf(accountSlug);
  if (!accountId) return NO_ACCOUNT;
  const r = await guard(() =>
    finishVideoUpload(prisma, { accountId, productId: String(productId), fileId: String(fileId), size: Number(size), measure, userId: user.id }),
  );
  if (r.ok) revalidatePath(`/a/${accountSlug}`, 'layout');
  return r;
}

/** Las medidas que tomó el navegador al reproducir el video. */
export async function saveVideoMeasureAction(accountSlug: string, videoId: string, measure: unknown): Promise<{ ok: true; changed: boolean } | Fail> {
  await requireUser();
  const accountId = await accountIdOf(accountSlug);
  if (!accountId) return NO_ACCOUNT;
  return guard(async () => ({ changed: await saveVideoMeasure(prisma, { accountId, videoId: String(videoId), measure }) }));
}

async function simple(accountSlug: string, run: (accountId: string, userId: string) => Promise<unknown>, message?: string): Promise<Result> {
  const user = await requireUser();
  const accountId = await accountIdOf(accountSlug);
  if (!accountId) return NO_ACCOUNT;
  const r = await guard(async () => {
    await run(accountId, user.id);
    return message ? { message } : {};
  });
  if (r.ok) revalidatePath(`/a/${accountSlug}`, 'layout');
  return r;
}

export async function trashVideoAction(accountSlug: string, videoId: string): Promise<Result> {
  return simple(accountSlug, (accountId) => trashVideo(prisma, { accountId, videoId: String(videoId) }), 'Video en la papelera del Drive.');
}

export async function chooseClipAction(accountSlug: string, publicationId: string, videoId: string): Promise<Result> {
  return simple(accountSlug, (accountId, userId) =>
    chooseClip(prisma, { accountId, publicationId: String(publicationId), videoId: String(videoId), userId }),
  );
}

export async function removeClipAction(accountSlug: string, publicationId: string, videoId: string): Promise<Result> {
  return simple(accountSlug, (accountId) => removeClip(prisma, { accountId, publicationId: String(publicationId), videoId: String(videoId) }));
}

export async function moveClipAction(accountSlug: string, publicationId: string, videoId: string, by: number): Promise<Result> {
  return simple(accountSlug, (accountId) =>
    moveClip(prisma, { accountId, publicationId: String(publicationId), videoId: String(videoId), by: Number(by) < 0 ? -1 : 1 }),
  );
}

export async function markClipUploadedAction(accountSlug: string, publicationId: string, videoId: string, uploaded: boolean): Promise<Result> {
  return simple(accountSlug, (accountId, userId) =>
    markClipUploaded(prisma, { accountId, publicationId: String(publicationId), videoId: String(videoId), uploaded: Boolean(uploaded), userId }),
  );
}
