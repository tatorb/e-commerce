import type { PrismaClient } from '@/generated/prisma/client';
import type { Transfer } from '@/domain/video-edit';
import { driveQueryValue, ensureFolder, folderOwner, listFiles, ROOT_FOLDER_NAME, startResumableUpload, trashFile, VIDEO_FIELDS, videosFolder, type FolderSpec } from './drive';
import type { UploadedClip } from './video-edits';

// Los archivos del editor de videos en el Drive del estudio. El clip que arma
// la Mac va a la carpeta de videos del producto, al lado del original, con una
// subida que sirve solo para ese archivo: la llave del Drive nunca sale de la
// app. Cada clip lleva la marca de su edición, para encontrarlo.

/** Los nombres de las carpetas desde la raíz de la app hasta la de videos del producto. */
export async function videosFolderPath(db: PrismaClient, productId: string): Promise<string[]> {
  const owner = await folderOwner(db, productId);
  const names: string[] = [];
  for (let f: FolderSpec | null = videosFolder(owner.account, owner.product); f; f = f.parent) names.unshift(f.name);
  // La raíz se llama siempre igual, aunque alguien la haya renombrado en el Drive.
  names[0] = ROOT_FOLDER_NAME;
  return names;
}

/** El permiso para que la Mac suba el clip de una edición a la carpeta de videos del producto. */
export async function clipUpload(db: PrismaClient, token: string, email: string, args: { productId: string; editId: string; lease: number; name: string }): Promise<Transfer> {
  const owner = await folderOwner(db, args.productId);
  const folderId = await ensureFolder(db, token, email, videosFolder(owner.account, owner.product));
  const url = await startResumableUpload(token, {
    folderId,
    name: args.name,
    type: 'video/mp4',
    properties: { mrbEdicion: args.editId, mrbTurno: String(args.lease), mrbProducto: args.productId },
  });
  return { url, metodo: 'PUT', encabezados: { 'Content-Type': 'video/mp4' } };
}

/**
 * El clip que subió la Mac para una edición: el último. Si un intento se
 * repitió y quedaron dos, el viejo va a la papelera.
 */
export async function uploadedClip(token: string, editId: string): Promise<UploadedClip | null> {
  const files = await listFiles(token, `appProperties has { key='mrbEdicion' and value='${driveQueryValue(editId)}' } and trashed=false`, `${VIDEO_FIELDS},appProperties`);
  const whole = files.filter((f) => Number(f.size) > 0).sort((a, b) => (b.createdTime ?? '').localeCompare(a.createdTime ?? ''));
  const [newest, ...older] = whole;
  if (!newest) return null;
  for (const f of older) await trashFile(token, f.id).catch(() => undefined);
  return {
    fileId: newest.id,
    name: newest.name,
    mimeType: newest.mimeType,
    size: newest.size && /^\d+$/.test(newest.size) ? BigInt(newest.size) : null,
    webViewLink: newest.webViewLink ?? null,
    createdAt: newest.createdTime ? new Date(newest.createdTime) : null,
  };
}
