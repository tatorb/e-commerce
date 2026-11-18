'use server';

import { pendingClipUploads } from '@/lib/clip-uploads';
import type { ClipUploadAsk } from '@/components/clips/clip-uploader';
import { act } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { CryptoError } from '@/lib/crypto';
import { DriveError, trashFile, withDriveToken } from '@/lib/drive';
import { approveEdit, clipRulesFor, discardEdit, loadAccountVideo, redoEdit, requestEdit, VideoEditError } from '@/lib/video-edits';
import { proposeVideoScript, saveVideoScript, VideoScriptError } from '@/lib/video-script';
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
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Actualizó los videos del Drive', productId }, async () => {
    await requireUser();
    const accountId = await accountIdOf(accountSlug);
    if (!accountId) return NO_ACCOUNT;
    return guard(() => syncProductVideos(prisma, { accountId, productId: String(productId) }));
  });
}

/** Abre la subida de un video: el navegador manda el archivo directo a Google. */
export async function startVideoUploadAction(
  accountSlug: string,
  productId: string,
  file: { name: string; size: number; type: string },
): Promise<({ ok: true } & { uploadUrl: string }) | Fail> {
  return act(accountSlug, { section: ['pipeline', 'productos'] }, async () => {
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
  });
}

export async function finishVideoUploadAction(
  accountSlug: string,
  productId: string,
  fileId: string,
  size: number,
  measure: unknown,
): Promise<({ ok: true } & { videoId: string }) | Fail> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Subió un video', productId }, async () => {
    const user = await requireUser();
    const accountId = await accountIdOf(accountSlug);
    if (!accountId) return NO_ACCOUNT;
    const r = await guard(() =>
      finishVideoUpload(prisma, { accountId, productId: String(productId), fileId: String(fileId), size: Number(size), measure, userId: user.id }),
    );
    if (r.ok) revalidatePath(`/a/${accountSlug}`, 'layout');
    return r;
  });
}

/** Las medidas que tomó el navegador al reproducir el video. */
export async function saveVideoMeasureAction(accountSlug: string, videoId: string, measure: unknown): Promise<{ ok: true; changed: boolean } | Fail> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Cambió la medida de un video' }, async () => {
    await requireUser();
    const accountId = await accountIdOf(accountSlug);
    if (!accountId) return NO_ACCOUNT;
    return guard(async () => ({ changed: await saveVideoMeasure(prisma, { accountId, videoId: String(videoId), measure }) }));
  });
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
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Mandó un video a la papelera' }, async () => {
    return simple(accountSlug, (accountId) => trashVideo(prisma, { accountId, videoId: String(videoId) }), 'Video en la papelera del Drive.');
  });
}

export async function chooseClipAction(accountSlug: string, publicationId: string, videoId: string): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Eligió un clip', publicationId }, async () => {
    return simple(accountSlug, (accountId, userId) =>
      chooseClip(prisma, { accountId, publicationId: String(publicationId), videoId: String(videoId), userId }),
    );
  });
}

export async function removeClipAction(accountSlug: string, publicationId: string, videoId: string): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Sacó un clip', publicationId }, async () => {
    return simple(accountSlug, (accountId) => removeClip(prisma, { accountId, publicationId: String(publicationId), videoId: String(videoId) }));
  });
}

export async function moveClipAction(accountSlug: string, publicationId: string, videoId: string, by: number): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Reordenó los clips', publicationId }, async () => {
    return simple(accountSlug, (accountId) =>
      moveClip(prisma, { accountId, publicationId: String(publicationId), videoId: String(videoId), by: Number(by) < 0 ? -1 : 1 }),
    );
  });
}

export async function markClipUploadedAction(accountSlug: string, publicationId: string, videoId: string, uploaded: boolean): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: (uploaded ? 'Marcó un clip como subido' : 'Marcó un clip como no subido'), publicationId }, async () => {
    return simple(accountSlug, (accountId, userId) =>
      markClipUploaded(prisma, { accountId, publicationId: String(publicationId), videoId: String(videoId), uploaded: Boolean(uploaded), userId }),
    );
  });
}

// ───────────────────────────── Editor de videos ─────────────────────────────

async function guardEdit<T extends object>(run: () => Promise<T>): Promise<({ ok: true } & T) | Fail> {
  try {
    return { ok: true, ...(await run()) };
  } catch (e) {
    if (e instanceof VideoEditError || e instanceof VideoScriptError || e instanceof VideoError || e instanceof DriveError || e instanceof CryptoError) return { ok: false, error: e.message };
    throw e;
  }
}

/** El clip descartado va a la papelera del Drive. Si no se puede, queda ahí: ya salió de la lista. */
async function trashClipFile(fileId: string | null): Promise<void> {
  if (!fileId) return;
  await withDriveToken(prisma, (token) => trashFile(token, fileId)).catch(() => undefined);
}

/** Pone un video en la cola del editor: la Mac del estudio lo edita cuando puede. */
export async function requestVideoEditAction(
  accountSlug: string,
  videoId: string,
  // Con un plan, la Mac lo aplica tal cual. La voz dice el guión del producto.
  ask: { targetSeconds?: number; note?: string; stepId?: string | null; plan?: unknown },
): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Pidió editar un video' }, async () => {
    const user = await requireUser();
    const accountId = await accountIdOf(accountSlug);
    if (!accountId) return NO_ACCOUNT;
    const r = await guardEdit(() => requestEdit(prisma, {
        accountId,
        videoId: String(videoId),
        targetSeconds: ask?.targetSeconds,
        note: ask?.note,
        plan: ask?.plan,
        ...(ask?.stepId !== undefined ? { stepId: ask.stepId ? String(ask.stepId) : null } : {}),
        userId: user.id,
      }));
    revalidatePath(`/a/${accountSlug}/pipeline`, 'layout');
    return r.ok ? { ok: true } : r;
  });
}

/** Aprueba el clip que armó la Mac. */
/** Aprueba el clip. Devuelve lo que hace falta para subirlo a Mercado Libre, si quedó para subir. */
export async function approveVideoEditAction(accountSlug: string, editId: string): Promise<({ ok: true; upload: ClipUploadAsk | null }) | Fail> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Aprobó un clip editado' }, async () => {
    const user = await requireUser();
    const accountId = await accountIdOf(accountSlug);
    if (!accountId) return NO_ACCOUNT;
    const r = await guardEdit(async () => {
      await approveEdit(prisma, { accountId, editId: String(editId), userId: user.id });
      const edit = await prisma.videoEdit.findUnique({ where: { id: String(editId) }, select: { clipId: true } });
      const u = edit?.clipId ? (await pendingClipUploads(prisma, accountId)).find((c) => c.videoId === edit.clipId) : undefined;
      return { upload: u ? { publicationId: u.publicationId, videoId: u.videoId, externalId: u.externalId, fileName: u.fileName, mimeType: u.mimeType } : null };
    });
    revalidatePath(`/a/${accountSlug}/pipeline`, 'layout');
    return r;
  });
}

/** Pide la edición de nuevo, con otra duración o con una indicación para el editor. */
export async function redoVideoEditAction(
  accountSlug: string,
  editId: string,
  // Con un plan, la Mac lo aplica tal cual. La voz dice el guión del producto, como está ahora.
  ask: { targetSeconds?: number; note?: string; plan?: unknown },
): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Pidió de nuevo la edición de un video' }, async () => {
    const user = await requireUser();
    const accountId = await accountIdOf(accountSlug);
    if (!accountId) return NO_ACCOUNT;
    const r = await guardEdit(() => redoEdit(prisma, { accountId, editId: String(editId), targetSeconds: ask?.targetSeconds, note: ask?.note, plan: ask?.plan, userId: user.id }));
    if (r.ok) await trashClipFile(r.clipFileId);
    revalidatePath(`/a/${accountSlug}/pipeline`, 'layout');
    return r.ok ? { ok: true } : r;
  });
}

/** Descarta la edición: sale de la cola, o su clip va a la papelera del Drive. */
export async function discardVideoEditAction(accountSlug: string, editId: string): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Descartó la edición de un video' }, async () => {
    const user = await requireUser();
    const accountId = await accountIdOf(accountSlug);
    if (!accountId) return NO_ACCOUNT;
    const r = await guardEdit(() => discardEdit(prisma, { accountId, editId: String(editId), userId: user.id }));
    if (r.ok) await trashClipFile(r.clipFileId);
    revalidatePath(`/a/${accountSlug}/pipeline`, 'layout');
    return r.ok ? { ok: true } : r;
  });
}

// ───────────────────────────── Guión del clip ─────────────────────────────

/** Guarda el guión de la voz en off de los clips del producto, escrito o corregido a mano. */
export async function saveVideoScriptAction(accountSlug: string, productId: string, lines: string[]): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Cambió el guión del clip', productId }, async () => {
    const user = await requireUser();
    const accountId = await accountIdOf(accountSlug);
    if (!accountId) return NO_ACCOUNT;
    const r = await guardEdit(async () => {
      await saveVideoScript(prisma, { accountId, productId: String(productId), lines, userId: user.id, rules: await clipRulesFor(prisma, String(productId)) });
      return {};
    });
    revalidatePath(`/a/${accountSlug}/pipeline`, 'layout');
    return r;
  });
}

/** Le pide a Claude el guión, con la información de la publicación, y lo guarda. */
export async function proposeVideoScriptAction(accountSlug: string, publicationId: string, replace: boolean): Promise<({ ok: true } & { costUsd: number }) | Fail> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Pidió a Claude el guión del clip', publicationId }, async () => {
    const user = await requireUser();
    const accountId = await accountIdOf(accountSlug);
    if (!accountId) return NO_ACCOUNT;
    try {
      const pub = await prisma.publication.findFirst({ where: { id: String(publicationId), product: { accountId } }, select: { productId: true } });
      if (!pub) return { ok: false, error: 'La publicación no es de esta cuenta.' };
      const [settings, rules] = await Promise.all([loadAccountVideo(prisma, accountId), clipRulesFor(prisma, pub.productId)]);
      const r = await proposeVideoScript(prisma, { accountId, publicationId: String(publicationId), clipSeconds: settings.targetSeconds, userId: user.id, replace: Boolean(replace), rules });
      revalidatePath(`/a/${accountSlug}/pipeline`, 'layout');
      return r.ok ? { ok: true, costUsd: r.costUsd } : { ok: false, error: r.error };
    } catch (e) {
      if (e instanceof VideoScriptError) return { ok: false, error: e.message };
      throw e;
    }
  });
}
