'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { act } from '@/lib/auth/guard';
import { publicAppUrl } from '@/lib/public-url';
import { PipelineError } from '@/domain/pipeline';
import {
  addShootMeasures,
  createShootProduct,
  finishShotPhoto,
  finishShotVideo,
  markShotCheck,
  ShootError,
  shootToPipeline,
  startShotUpload,
  undoShotCheck,
} from '@/lib/shoot';
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
    if (e instanceof ShootError || e instanceof PhotoError || e instanceof VideoError || e instanceof PipelineError) return { ok: false, error: e.message };
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
): Promise<Result<{ id: string }>> {
  const productId = String(args?.productId ?? '');
  return act(accountSlug, { section: 'captura', does: 'Registró una foto', productId }, ({ user, account }) =>
    guard(accountSlug, async () => {
      const id = await finishShotPhoto(prisma, {
        accountId: account.id,
        productId,
        fileId: String(args.fileId ?? ''),
        userId: user.id,
        stepId: idOrNull(args.stepId),
        variantKey: idOrNull(args.variantKey),
      });
      return { id };
    }),
  );
}

export async function finishShotVideoAction(
  accountSlug: string,
  args: { productId: string; fileId: string; size: number; measure: unknown; stepId: string | null; variantKey: string | null },
): Promise<Result<{ id: string }>> {
  const productId = String(args?.productId ?? '');
  return act(accountSlug, { section: 'captura', does: 'Registró un video', productId }, ({ user, account }) =>
    guard(accountSlug, async () => {
      const id = await finishShotVideo(prisma, {
        accountId: account.id,
        productId,
        fileId: String(args.fileId ?? ''),
        size: Number(args.size),
        measure: args.measure,
        userId: user.id,
        stepId: idOrNull(args.stepId),
        variantKey: idOrNull(args.variantKey),
      });
      return { id };
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

/**
 * Deja el producto en el pipeline al empezar el registro, si se prendió
 * Agregar al pipeline. Lo puede hacer quien usa Registro de productos.
 */
export async function shootToPipelineAction(
  accountSlug: string,
  args: { productId: string; storeId: string | null },
): Promise<Result<{ publicationId: string; outcome: 'created' | 'added' | 'already' }>> {
  const productId = String(args?.productId ?? '');
  return act(accountSlug, { section: 'captura', does: 'Agregó al pipeline desde Registro de productos', productId }, ({ user, account }) =>
    guard(accountSlug, () => shootToPipeline(prisma, { accountId: account.id, productId, storeId: idOrNull(args?.storeId), userId: user.id })),
  );
}

/** Crea un producto que entra por primera vez, con lo básico, para empezar a registrarlo. */
export async function createShootProductAction(accountSlug: string, input: unknown): Promise<Result<{ id: string }>> {
  return act(accountSlug, { section: 'captura', does: 'Creó un producto desde Registro de productos' }, ({ account }) =>
    guard(accountSlug, async () => ({ id: await createShootProduct(prisma, { accountId: account.id, input }) })),
  );
}

/** Suma medidas a un producto desde el registro. */
export async function addShootMeasuresAction(accountSlug: string, productId: string, input: unknown): Promise<Result<{ added: number }>> {
  const id = String(productId ?? '');
  return act(accountSlug, { section: 'captura', does: 'Agregó medidas desde Registro de productos', productId: id }, ({ user, account }) =>
    guard(accountSlug, async () => ({ added: await addShootMeasures(prisma, { accountId: account.id, productId: id, input, userId: user.id }) })),
  );
}
