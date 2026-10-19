import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { channelPhotoUrl } from '@/channels';
import { extensionOf } from './file-rules';
import { isOwnBlobUrl } from './files';
import { CHANNEL_PHOTO_MAX_BYTES, ORIGINAL_MAX_BYTES, ORIGINAL_TYPES, originalPathname, photoPrefix } from './photo-files';
import { startPhoto } from './photo-queue';

// Las fotos de un producto en la línea de imágenes. Recibe la base por
// parámetro para poder probarlo con una base de prueba y un depósito simulado.

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

export type BlobHead = (url: string) => Promise<{ url: string; pathname: string; size: number; contentType: string }>;

/**
 * Anota un original que el navegador ya subió al depósito y arranca su línea.
 * Pregunta al depósito su tipo y su peso reales, y que esté en la carpeta del
 * producto.
 */
export async function addUploadedOriginal(
  db: PrismaClient,
  args: { productId: string; url: string; name: string; userId: string | null },
  deps: { head: BlobHead },
) {
  if (!isOwnBlobUrl(args.url)) throw new PhotoError('La foto no está en el depósito de la app.');
  const info = await deps.head(args.url);
  if (!info.pathname.startsWith(`${photoPrefix(args.productId)}originales/`)) throw new PhotoError('La foto es de otro producto.');
  const type = ORIGINAL_TYPES[extensionOf(info.pathname)];
  if (!type || type !== info.contentType) throw new PhotoError('Solo se aceptan fotos JPG, PNG, HEIC o TIFF.');
  if (info.size > ORIGINAL_MAX_BYTES) throw new PhotoError('La foto pesa más de 100 MB.');
  const existing = await db.photoEdit.findUnique({ where: { originalUrl: info.url } });
  if (existing) return existing;
  return createEdit(db, {
    productId: args.productId,
    source: 'UPLOAD',
    originalUrl: info.url,
    originalName: args.name.trim().slice(0, 200) || info.pathname.split('/').pop()!,
    originalType: info.contentType,
    originalSize: info.size,
    createdById: args.userId,
  });
}

const CHANNEL_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export type ChannelPhotoDeps = {
  fetch: typeof fetch;
  put: (pathname: string, body: ArrayBuffer, contentType: string) => Promise<{ url: string }>;
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
 * más grande. Las baja del canal y las guarda en el depósito como original.
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
      const stored = await deps.put(originalPathname(args.productId, name), photo.body, photo.type);
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
