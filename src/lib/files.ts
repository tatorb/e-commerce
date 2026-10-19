import { del, head } from '@vercel/blob';
import type { PrismaClient } from '@/generated/prisma/client';
import { extensionOf, FILE_TYPES, filesPrefix, MAX_FILES } from './file-rules';

export { extensionOf, FILE_TYPES, fileHref, filesPrefix, MAX_FILES, safeFileName } from './file-rules';

// Los archivos del fabricante: van directo del navegador al depósito de
// Vercel (Vercel Blob) y la app anota cada uno en la ficha. Recibe la base
// por parámetro para poder probarlo con una base de prueba y un depósito
// simulado.

export const BLOB_NOT_CONFIGURED = 'Falta conectar el depósito de archivos de Vercel.';

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Si la dirección es de un depósito de Vercel. En pruebas vale también BLOB_TEST_URL_PREFIX. */
export function isOwnBlobUrl(raw: string): boolean {
  const testPrefix = process.env.BLOB_TEST_URL_PREFIX;
  if (testPrefix && raw.startsWith(testPrefix)) return true;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && u.hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

export class FileError extends Error {}

/**
 * Anota en la ficha un archivo ya subido. Pregunta al depósito su tipo y su
 * peso reales, y que esté en la carpeta del producto.
 */
export async function registerProductFile(
  db: PrismaClient,
  args: { productId: string; url: string; name: string; userId: string | null },
) {
  if (!isOwnBlobUrl(args.url)) throw new FileError('El archivo no está en el depósito de la app.');
  const info = await head(args.url);
  if (!info.pathname.startsWith(filesPrefix(args.productId))) throw new FileError('El archivo es de otro producto.');
  const type = FILE_TYPES[extensionOf(info.pathname)];
  if (!type || type.contentType !== info.contentType) throw new FileError('Ese tipo de archivo no se acepta.');
  if (info.size > type.maxBytes) throw new FileError('El archivo pesa demasiado.');
  if ((await db.productFile.count({ where: { productId: args.productId } })) >= MAX_FILES) {
    throw new FileError(`Hasta ${MAX_FILES} archivos por producto.`);
  }
  const name = args.name.trim().slice(0, 200) || info.pathname.split('/').pop()!;
  return db.productFile.upsert({
    where: { url: info.url },
    update: {},
    create: {
      productId: args.productId,
      kind: type.kind,
      name,
      contentType: info.contentType,
      size: info.size,
      url: info.url,
      uploadedById: args.userId,
    },
  });
}

/**
 * Lee un archivo del depósito privado con la clave de la app, para mostrarlo
 * a quien tiene sesión. Null si ya no está.
 */
export async function readBlob(url: string): Promise<Response | null> {
  if (!isOwnBlobUrl(url)) throw new FileError('El archivo no está en el depósito de la app.');
  const res = await fetch(url, { headers: { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN ?? ''}` } });
  if (res.status === 404) return null;
  if (!res.ok || !res.body) throw new FileError(`El depósito respondió ${res.status}.`);
  return res;
}

/** Borra el archivo del depósito y de la ficha. */
export async function deleteProductFile(db: PrismaClient, args: { productId: string; fileId: string }) {
  const file = await db.productFile.findFirst({ where: { id: args.fileId, productId: args.productId } });
  if (!file) return;
  await del(file.url);
  await db.productFile.delete({ where: { id: file.id } });
}
