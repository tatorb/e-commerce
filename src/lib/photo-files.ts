import { BlobNotFoundError, head, issueSignedToken, parseStoreIdFromDelegationToken, presignUrl } from '@vercel/blob';
import type { Transfer, UploadKind } from '@/domain/photo-contract';
import { photoPrefix } from './photo-rules';

export { signedDownloadUrl } from './files';

export { CHANNEL_PHOTO_MAX_BYTES, ORIGINAL_MAX_BYTES, ORIGINAL_TYPES, originalPathname, originalTypeFor, photoPrefix } from './photo-rules';

// Las fotos de la línea de imágenes en el depósito de Vercel. El trabajador
// baja y sube directo, sin pasar por la app, con links firmados de un solo
// archivo que vencen solos. Así no hay límite de peso de Vercel.

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

// La versión del pedido al depósito que usa @vercel/blob 2.8.
const BLOB_API_VERSION = '12';

/**
 * Permiso para que el trabajador suba un archivo: un link firmado para ese
 * nombre, ese tipo y hasta ese peso, que vence solo.
 */
export async function uploadTransfer(kind: UploadKind, pathname: string, validMs: number): Promise<Transfer> {
  const { contentType, maxBytes } = OUTPUTS[kind];
  const validUntil = Date.now() + validMs;
  const limits = { allowedContentTypes: [contentType], maximumSizeInBytes: maxBytes, validUntil };
  const token = await issueSignedToken({ pathname, operations: ['put'], ...limits });
  const { presignedUrl } = await presignUrl(token, {
    operation: 'put',
    pathname,
    access: 'private',
    ...limits,
    addRandomSuffix: false,
    // Si una subida se corta, el trabajador la repite con el mismo nombre.
    allowOverwrite: true,
  });
  return {
    url: presignedUrl,
    metodo: 'PUT',
    encabezados: {
      'x-api-version': BLOB_API_VERSION,
      'x-vercel-blob-store-id': parseStoreIdFromDelegationToken(token.delegationToken),
      'x-vercel-blob-access': 'private',
      'x-content-type': contentType,
    },
  };
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
