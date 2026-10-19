import { BlobNotFoundError, head, issueSignedToken, presignUrl } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import type { Transfer, UploadKind } from '@/domain/photo-contract';
import { isOwnBlobUrl } from './files';
import { photoPrefix } from './photo-rules';

export { CHANNEL_PHOTO_MAX_BYTES, ORIGINAL_MAX_BYTES, ORIGINAL_TYPES, originalPathname, originalTypeFor, photoPrefix } from './photo-rules';

// Las fotos de la línea de imágenes en el depósito de Vercel. El trabajador
// baja y sube directo, sin pasar por la app, con permisos de un solo archivo
// que vencen solos. Así no hay límite de peso de Vercel.

const MB = 1024 * 1024;

const OUTPUTS: Record<UploadKind, { name: string; contentType: string; maxBytes: number }> = {
  antes: { name: 'antes.jpg', contentType: 'image/jpeg', maxBytes: 20 * MB },
  vista: { name: 'vista.jpg', contentType: 'image/jpeg', maxBytes: 20 * MB },
  mascara: { name: 'mascara.png', contentType: 'image/png', maxBytes: 200 * MB },
  png: { name: 'final.png', contentType: 'image/png', maxBytes: 400 * MB },
  jpg: { name: 'final.jpg', contentType: 'image/jpeg', maxBytes: 100 * MB },
};

export function outputPathname(productId: string, editId: string, runId: string, kind: UploadKind) {
  return `${photoPrefix(productId)}${editId}/${runId}/${OUTPUTS[kind].name}`;
}
export const outputType = (kind: UploadKind) => OUTPUTS[kind].contentType;

const apiUrl = () => process.env.VERCEL_BLOB_API_URL || process.env.NEXT_PUBLIC_VERCEL_BLOB_API_URL || 'https://vercel.com/api/blob';
// La versión del pedido al depósito que usa @vercel/blob 2.8.
const BLOB_API_VERSION = '12';

/**
 * Permiso para que el trabajador suba un archivo: solo ese nombre, ese tipo,
 * hasta ese peso y por un rato. Es el mismo permiso que usa el navegador para
 * subir los archivos del fabricante.
 */
export async function uploadTransfer(kind: UploadKind, pathname: string, validMs: number): Promise<Transfer> {
  const { contentType, maxBytes } = OUTPUTS[kind];
  const token = await generateClientTokenFromReadWriteToken({
    pathname,
    allowedContentTypes: [contentType],
    maximumSizeInBytes: maxBytes,
    validUntil: Date.now() + validMs,
    addRandomSuffix: false,
    // Si una subida se corta, el trabajador la repite con el mismo nombre.
    allowOverwrite: true,
  });
  return {
    url: `${apiUrl()}/?${new URLSearchParams({ pathname })}`,
    metodo: 'PUT',
    encabezados: {
      authorization: `Bearer ${token}`,
      'x-api-version': BLOB_API_VERSION,
      'x-vercel-blob-store-id': token.split('_')[3] ?? '',
      'x-vercel-blob-access': 'private',
      'x-content-type': contentType,
      'x-add-random-suffix': '0',
      'x-allow-overwrite': '1',
    },
  };
}

function pathnameOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

/** Un link para bajar un archivo del depósito privado que vence solo. */
export async function signedDownloadUrl(url: string, validMs: number, download = false): Promise<string> {
  if (!isOwnBlobUrl(url)) throw new Error('El archivo no está en el depósito de la app.');
  const pathname = pathnameOf(url);
  const validUntil = Date.now() + validMs;
  const token = await issueSignedToken({ pathname, operations: ['get'], validUntil });
  let { presignedUrl } = await presignUrl(token, { operation: 'get', pathname, access: 'private', validUntil });
  // En pruebas, el depósito simulado está en otra dirección.
  const testPrefix = process.env.BLOB_TEST_URL_PREFIX;
  if (testPrefix) presignedUrl = presignedUrl.replace(/^https:\/\/[^/]+\//, testPrefix);
  if (!download) return presignedUrl;
  const u = new URL(presignedUrl);
  u.searchParams.set('download', '1');
  return u.toString();
}

/** Lo que el depósito sabe de un archivo subido, o null si no está. */
export async function uploadedFile(pathname: string): Promise<{ url: string; size: number; contentType: string } | null> {
  try {
    const info = await head(pathname);
    return info.pathname === pathname ? { url: info.url, size: info.size, contentType: info.contentType } : null;
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    throw e;
  }
}
