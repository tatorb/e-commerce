import { del, issueSignedToken, presignUrl } from '@vercel/blob';
import type { PrismaClient } from '@/generated/prisma/client';
import { driveRef, ensureFolder, folderOwner, getFile, manufacturerFolder, withDriveToken } from './drive';
import { extensionOf, FILE_TYPES, MAX_FILES } from './file-rules';

export { extensionOf, FILE_TYPES, fileHref, MAX_FILES } from './file-rules';

// Los archivos del fabricante: van directo del navegador a la carpeta
// Fabricante del producto en el Drive, y la app anota cada uno en la ficha.
// También lo que queda del depósito de Vercel (Vercel Blob), donde se
// guardaba todo antes de pasar al Drive: leerlo, firmar links y borrarlo.
// Recibe la base por parámetro para poder probarlo con una base de prueba.

export const BLOB_NOT_CONFIGURED = 'Falta conectar el depósito de archivos de Vercel.';

// La app entra al depósito con el permiso automático de Vercel (OIDC), que
// llega con BLOB_STORE_ID al conectar el depósito al proyecto, o con la clave
// BLOB_READ_WRITE_TOKEN si está cargada. La librería de Vercel elige sola.
export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
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

/** Si el archivo del fabricante se acepta: el tipo por la extensión y el peso. */
export function productFileProblem(file: { name: string; size?: string | number | null }): string | null {
  const type = FILE_TYPES[extensionOf(file.name)];
  if (!type) return `${file.name}: solo imágenes JPG, PNG, WEBP o GIF, y PDF.`;
  if (Number(file.size ?? 0) > type.maxBytes) return `${file.name}: pesa demasiado.`;
  return null;
}

/** Anota en la ficha un archivo del fabricante que ya está en el Drive. Si ya estaba anotado, no lo repite. */
export async function registerProductFile(
  db: PrismaClient,
  args: { productId: string; file: { id: string; name: string; size?: string | number | null }; userId: string | null },
) {
  const problem = productFileProblem(args.file);
  if (problem) throw new FileError(problem);
  const type = FILE_TYPES[extensionOf(args.file.name)];
  const url = driveRef(args.file.id);
  const existing = await db.productFile.findUnique({ where: { url } });
  if (existing) return existing;
  if ((await db.productFile.count({ where: { productId: args.productId } })) >= MAX_FILES) {
    throw new FileError(`Hasta ${MAX_FILES} archivos por producto.`);
  }
  return db.productFile.upsert({
    where: { url },
    update: {},
    create: {
      productId: args.productId,
      kind: type.kind,
      name: args.file.name.trim().slice(0, 200) || 'archivo',
      contentType: type.contentType,
      size: Number(args.file.size ?? 0),
      url,
      uploadedById: args.userId,
    },
  });
}

/** La carpeta Fabricante del producto, creada si hace falta. */
export async function manufacturerFolderId(db: PrismaClient, token: string, email: string, productId: string): Promise<string> {
  const owner = await folderOwner(db, productId);
  return ensureFolder(db, token, email, manufacturerFolder(owner.account, owner.product));
}

/** Anota el archivo que el navegador terminó de subir. Confirma con Google que esté en la carpeta Fabricante del producto. */
export async function addUploadedProductFile(db: PrismaClient, args: { productId: string; fileId: string; userId: string | null }) {
  return withDriveToken(db, async (token, email) => {
    const folderId = await manufacturerFolderId(db, token, email, args.productId);
    const file = await getFile(token, args.fileId, 'id,name,size,parents,trashed');
    if (!file || file.trashed || !file.parents?.includes(folderId)) throw new FileError('El archivo no quedó en la carpeta del producto. Probá de nuevo.');
    return registerProductFile(db, { productId: args.productId, file, userId: args.userId });
  });
}

/** Un link para bajar un archivo del depósito privado que vence solo. */
export async function signedDownloadUrl(url: string, validMs: number, download = false): Promise<string> {
  if (!isOwnBlobUrl(url)) throw new FileError('El archivo no está en el depósito de la app.');
  // En pruebas, el depósito simulado está en otra dirección.
  const testPrefix = process.env.BLOB_TEST_URL_PREFIX;
  const local = testPrefix && url.startsWith(testPrefix) ? url.slice(testPrefix.length).split('?')[0] : new URL(url).pathname.slice(1);
  const pathname = decodeURIComponent(local);
  const validUntil = Date.now() + validMs;
  const token = await issueSignedToken({ pathname, operations: ['get'], validUntil });
  let { presignedUrl } = await presignUrl(token, { operation: 'get', pathname, access: 'private', validUntil });
  if (testPrefix) presignedUrl = presignedUrl.replace(/^https:\/\/[^/]+\//, testPrefix);
  if (!download) return presignedUrl;
  const u = new URL(presignedUrl);
  u.searchParams.set('download', '1');
  return u.toString();
}

/**
 * Lee un archivo del depósito privado para mostrarlo a quien tiene sesión:
 * con la clave si está cargada, o con un link firmado de un minuto. Null si
 * ya no está.
 */
export async function readBlob(url: string): Promise<Response | null> {
  if (!isOwnBlobUrl(url)) throw new FileError('El archivo no está en el depósito de la app.');
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const res = token ? await fetch(url, { headers: { authorization: `Bearer ${token}` } }) : await fetch(await signedDownloadUrl(url, 60_000));
  if (res.status === 404) return null;
  if (!res.ok || !res.body) throw new FileError(`El depósito respondió ${res.status}.`);
  return res;
}

/** Borra un archivo del depósito. */
export async function deleteBlob(url: string): Promise<void> {
  if (!isOwnBlobUrl(url)) throw new FileError('El archivo no está en el depósito de la app.');
  await del(url);
}

/** Saca el archivo de la ficha. El archivo va a la papelera del Drive, o se borra del depósito si estaba ahí. */
export async function deleteProductFile(
  db: PrismaClient,
  args: { productId: string; fileId: string },
  remove: (url: string) => Promise<void>,
) {
  const file = await db.productFile.findFirst({ where: { id: args.fileId, productId: args.productId } });
  if (!file) return;
  await remove(file.url);
  await db.productFile.delete({ where: { id: file.id } });
}
