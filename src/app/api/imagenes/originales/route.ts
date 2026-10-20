import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { presignedUpload } from '@/lib/blob-uploads';
import { extensionOf } from '@/lib/files';
import { ORIGINAL_MAX_BYTES, ORIGINAL_TYPES, photoPrefix } from '@/lib/photo-rules';

// Da el permiso para subir un original directo al depósito, sin pasar por la
// app. Solo con sesión, solo en la carpeta de originales del producto y solo
// fotos JPG, PNG, HEIC o TIFF.

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return presignedUpload(req, async (pathname) => {
    const user = await getCurrentUser();
    if (!user) throw new Error('Tu sesión venció. Volvé a entrar.');
    const productId = pathname.split('/')[1] ?? '';
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    const folder = product ? `${photoPrefix(product.id)}originales/` : null;
    if (!folder || !pathname.startsWith(folder) || pathname.split('/').length !== 4) throw new Error('El producto no existe.');
    const type = ORIGINAL_TYPES[extensionOf(pathname)];
    if (!type) throw new Error('Solo se aceptan fotos JPG, PNG, HEIC o TIFF.');
    return { contentType: type, maxBytes: ORIGINAL_MAX_BYTES };
  });
}
