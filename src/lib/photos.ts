import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { channelPhotoUrl } from '@/channels';
import { isUniqueViolation } from '@/domain/publications';
import { folderUrl, getFile, knownFolderId, listFiles, withDriveToken, type DriveFile } from './drive';
import { CHANNEL_PHOTO_MAX_BYTES, ORIGINAL_MAX_BYTES, originalTypeFor, photoFolderId, photoOwner } from './photo-files';
import { startPhoto } from './photo-queue';
import { driveRef } from './stored-files';

// Las fotos de un producto en la línea de imágenes. Los originales se guardan
// en la carpeta Fotos / Originales del producto en el Drive: los que se suben
// desde la app, los que se bajan del canal y los que se copian a la carpeta
// desde la Mac. Recibe la base por parámetro para poder probarlo con una base
// de prueba y un Google simulado.

export class PhotoError extends Error {}

// ───────────────────────────── Sumar fotos ─────────────────────────────

async function createEdit(
  db: PrismaClient,
  data: Omit<Prisma.PhotoEditUncheckedCreateInput, 'position'>,
) {
  return db.$transaction(async (tx) => {
    const last = await tx.photoEdit.aggregate({ where: { productId: data.productId }, _max: { position: true } });
    const edit = await tx.photoEdit.create({ data: { ...data, position: (last._max.position ?? -1) + 1 } });
    await startPhoto(tx, edit.id);
    return edit;
  });
}

/** Si el archivo sirve como original. Null si sirve, o el motivo. */
export function originalProblem(file: { name: string; size?: string | number | null }): string | null {
  if (!originalTypeFor(file.name)) return `${file.name}: solo fotos JPG, PNG, HEIC o TIFF.`;
  if (Number(file.size ?? 0) > ORIGINAL_MAX_BYTES) return `${file.name}: pesa más de 100 MB.`;
  return null;
}

/** Anota un original que ya está en el Drive y arranca su línea. Si ya estaba anotado, no lo repite. */
export async function addDriveOriginal(
  db: PrismaClient,
  args: { productId: string; file: { id: string; name: string; size?: string | number | null }; userId: string | null },
) {
  const problem = originalProblem(args.file);
  if (problem) throw new PhotoError(problem);
  const originalUrl = driveRef(args.file.id);
  const existing = await db.photoEdit.findUnique({ where: { originalUrl } });
  if (existing) return existing;
  try {
    return await createEdit(db, {
      productId: args.productId,
      source: 'UPLOAD',
      originalUrl,
      originalName: args.file.name.trim().slice(0, 200) || 'foto',
      originalType: originalTypeFor(args.file.name)!,
      originalSize: Number(args.file.size ?? 0),
      createdById: args.userId,
    });
  } catch (e) {
    // La anotó otro pedido a la vez, por ejemplo al leer la carpeta.
    if (!isUniqueViolation(e)) throw e;
    return db.photoEdit.findUniqueOrThrow({ where: { originalUrl } });
  }
}

async function productInAccount(db: PrismaClient, accountId: string, productId: string) {
  const p = await db.product.findFirst({ where: { id: productId, accountId }, select: { id: true } });
  if (!p) throw new PhotoError('El producto no es de esta cuenta.');
}

/**
 * Anota los originales que el navegador terminó de subir al Drive. Confirma
 * con Google que estén en la carpeta Originales del producto.
 */
export async function addUploadedOriginals(
  db: PrismaClient,
  args: { accountId: string; productId: string; fileIds: string[]; userId: string | null },
): Promise<{ added: number; problems: string[] }> {
  await productInAccount(db, args.accountId, args.productId);
  const owner = await photoOwner(db, args.productId);
  return withDriveToken(db, async (token, email) => {
    const folderId = await photoFolderId(db, token, email, owner, 'originales');
    let added = 0;
    const problems: string[] = [];
    for (const id of args.fileIds.slice(0, 50)) {
      const file = await getFile(token, id, 'id,name,size,parents,trashed');
      if (!file || file.trashed || !file.parents?.includes(folderId)) {
        problems.push('Una foto no quedó en la carpeta del producto. Probá de nuevo.');
        continue;
      }
      try {
        await addDriveOriginal(db, { productId: args.productId, file, userId: args.userId });
        added++;
      } catch (e) {
        if (!(e instanceof PhotoError)) throw e;
        problems.push(e.message);
      }
    }
    return { added, problems };
  });
}

/**
 * Lee la carpeta Originales del producto: las fotos que se copiaron desde la
 * Mac entran a la línea. Las que se sacaron de la lista no vuelven a entrar.
 */
export async function syncOriginals(
  db: PrismaClient,
  args: { accountId: string; productId: string },
): Promise<{ added: number; skipped: string[]; folderUrl: string | null }> {
  await productInAccount(db, args.accountId, args.productId);
  const owner = await photoOwner(db, args.productId);
  return withDriveToken(db, async (token, email) => {
    const folderId = await photoFolderId(db, token, email, owner, 'originales');
    const photos = await knownFolderId(db, `fotos:${args.productId}`, email);
    const files: DriveFile[] = await listFiles(token, `'${folderId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`, 'id,name,size,createdTime');
    const known = new Set(
      (await db.photoEdit.findMany({ where: { originalUrl: { in: files.map((f) => driveRef(f.id)) } }, select: { originalUrl: true } })).map((e) => e.originalUrl),
    );
    let added = 0;
    const skipped: string[] = [];
    for (const f of files) {
      if (known.has(driveRef(f.id))) continue;
      const problem = originalProblem(f);
      if (problem) {
        skipped.push(problem);
        continue;
      }
      await addDriveOriginal(db, { productId: args.productId, file: f, userId: null });
      added++;
    }
    return { added, skipped, folderUrl: photos ? folderUrl(photos) : null };
  });
}

const CHANNEL_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export type ChannelPhotoDeps = {
  fetch: typeof fetch;
  // Guarda la foto en la carpeta Originales y devuelve dónde quedó.
  put: (name: string, body: ArrayBuffer, contentType: string) => Promise<{ url: string }>;
};

async function downloadPhoto(f: typeof fetch, url: string): Promise<{ body: ArrayBuffer; type: string } | null> {
  const res = await f(url, { signal: AbortSignal.timeout(30_000), redirect: 'follow' });
  if (!res.ok) return null;
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!CHANNEL_TYPES[type]) throw new PhotoError('El canal no devolvió una foto JPG, PNG o WEBP.');
  const body = await res.arrayBuffer();
  if (body.byteLength > CHANNEL_PHOTO_MAX_BYTES) throw new PhotoError('La foto del canal pesa demasiado.');
  return { body, type };
}

/**
 * Suma a la línea las fotos que el producto tiene publicadas, en su tamaño
 * más grande. Las baja del canal y las guarda como original.
 * Las que ya están en la línea no se repiten.
 */
export async function addChannelPhotos(
  db: PrismaClient,
  args: { productId: string; userId: string | null },
  deps: ChannelPhotoDeps,
): Promise<{ added: number; already: number; failed: string[] }> {
  const [assets, edits] = await Promise.all([
    db.asset.findMany({ where: { productId: args.productId, kind: 'PHOTO' }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
    db.photoEdit.findMany({ where: { productId: args.productId, archivedAt: null, channelUrl: { not: null } }, select: { channelUrl: true } }),
  ]);
  const taken = new Set(edits.map((e) => e.channelUrl));
  let added = 0;
  let already = 0;
  const failed: string[] = [];
  for (const [i, asset] of assets.entries()) {
    const full = channelPhotoUrl(asset.url);
    if (!full) {
      failed.push(`Foto ${i + 1}: no es un link de un canal conocido.`);
      continue;
    }
    if (taken.has(asset.url)) {
      already++;
      continue;
    }
    try {
      // Si la versión grande no está, vale la que está publicada.
      const photo = (await downloadPhoto(deps.fetch, full)) ?? (full !== asset.url ? await downloadPhoto(deps.fetch, asset.url) : null);
      if (!photo) throw new PhotoError('El canal no la entregó.');
      const name = `publicada-${i + 1}.${CHANNEL_TYPES[photo.type]}`;
      const stored = await deps.put(name, photo.body, photo.type);
      await createEdit(db, {
        productId: args.productId,
        source: 'CHANNEL',
        originalUrl: stored.url,
        originalName: name,
        originalType: photo.type,
        originalSize: photo.body.byteLength,
        channelUrl: asset.url,
        createdById: args.userId,
      });
      taken.add(asset.url);
      added++;
    } catch (e) {
      failed.push(`Foto ${i + 1}: ${e instanceof PhotoError ? e.message : 'no se pudo bajar.'}`);
    }
  }
  return { added, already, failed };
}

// ───────────────────────────── Para la pantalla ─────────────────────────────

/** Las fotos del producto en la línea, con todos sus intentos. */
export async function loadPhotoLine(db: PrismaClient, productId: string) {
  return db.photoEdit.findMany({
    where: { productId, archivedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: {
      runs: { orderBy: { createdAt: 'asc' }, include: { decidedBy: { select: { name: true } } } },
    },
  });
}

export async function countChannelPhotos(db: PrismaClient, productId: string) {
  const assets = await db.asset.findMany({ where: { productId, kind: 'PHOTO' }, select: { url: true } });
  return assets.filter((a) => channelPhotoUrl(a.url) !== null).length;
}
