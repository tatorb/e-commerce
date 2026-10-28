'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { act } from '@/lib/auth/guard';
import { publicAppUrl } from '@/lib/public-url';
import { finishShotPhoto, finishShotVideo, markShotCheck, ShootError, startShotUpload, undoShotCheck } from '@/lib/shoot';
import { PhotoError } from '@/lib/photos';
import { storageError } from '@/lib/stored-files';
import { VideoError } from '@/lib/videos';

// Lo que sube el operario en Registro de productos. El navegador sube cada
// archivo directo al Drive, sin achicarlo; la app abre la subida y después
// anota la foto o el video con su paso y su medida. Los pasos sin registro se
// marcan Listo.

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function guard<T extends object>(accountSlug: string, run: () => Promise<T>): Promise<Result<T>> {
  try {
    const r = await run();
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ShootError || e instanceof PhotoError || e instanceof VideoError) return { ok: false, error: e.message };
    const storage = storageError(e);
    if (storage) return { ok: false, error: storage };
    throw e;
  }
}

const kindOf = (k: unknown) => (k === 'VIDEO' ? 'VIDEO' : 'PHOTO');
const idOrNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);

/** Abre la subida con el origen de la página, así el navegador la puede usar. */
export async function startShotUploadAction(
  accountSlug: string,
  productId: string,
  kind: 'PHOTO' | 'VIDEO',
  file: { name: string; size: number; type: string },
): Promise<Result<{ uploadUrl: string }>> {
  return act(accountSlug, { section: 'captura' }, async ({ account }) => {
    const origin = (await headers()).get('origin') ?? publicAppUrl();
    return guard(accountSlug, async () => ({
      uploadUrl: await startShotUpload(prisma, { accountId: account.id, productId: String(productId), kind: kindOf(kind), file, origin }),
    }));
  });
}

export async function finishShotPhotoAction(
  accountSlug: string,
  args: { productId: string; fileId: string; stepId: string | null; variantKey: string | null },
): Promise<Result> {
  const productId = String(args?.productId ?? '');
  return act(accountSlug, { section: 'captura', does: 'Registró una foto', productId }, ({ user, account }) =>
    guard(accountSlug, async () => {
      await finishShotPhoto(prisma, {
        accountId: account.id,
        productId,
        fileId: String(args.fileId ?? ''),
        userId: user.id,
        stepId: idOrNull(args.stepId),
        variantKey: idOrNull(args.variantKey),
      });
      return {};
    }),
  );
}

export async function finishShotVideoAction(
  accountSlug: string,
  args: { productId: string; fileId: string; size: number; measure: unknown; stepId: string | null; variantKey: string | null },
): Promise<Result> {
  const productId = String(args?.productId ?? '');
  return act(accountSlug, { section: 'captura', does: 'Registró un video', productId }, ({ user, account }) =>
    guard(accountSlug, async () => {
      await finishShotVideo(prisma, {
        accountId: account.id,
        productId,
        fileId: String(args.fileId ?? ''),
        size: Number(args.size),
        measure: args.measure,
        userId: user.id,
        stepId: idOrNull(args.stepId),
        variantKey: idOrNull(args.variantKey),
      });
      return {};
    }),
  );
}

/** Marca Listo un paso sin registro, para la medida elegida o para todas. */
export async function markShotCheckAction(accountSlug: string, args: { productId: string; stepId: string; variantKey: string | null }): Promise<Result> {
  const productId = String(args?.productId ?? '');
  return act(accountSlug, { section: 'captura', does: 'Marcó Listo un paso del registro', productId }, ({ user, account }) =>
    guard(accountSlug, async () => {
      await markShotCheck(prisma, { accountId: account.id, productId, stepId: String(args.stepId ?? ''), variantKey: idOrNull(args.variantKey), userId: user.id });
      return {};
    }),
  );
}

export async function undoShotCheckAction(accountSlug: string, args: { productId: string; stepId: string; variantKey: string | null }): Promise<Result> {
  const productId = String(args?.productId ?? '');
  return act(accountSlug, { section: 'captura', does: 'Deshizo el Listo de un paso del registro', productId }, ({ account }) =>
    guard(accountSlug, async () => {
      await undoShotCheck(prisma, { accountId: account.id, productId, stepId: String(args.stepId ?? ''), variantKey: idOrNull(args.variantKey) });
      return {};
    }),
  );
}
