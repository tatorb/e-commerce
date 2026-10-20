import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { presignedUpload } from '@/lib/blob-uploads';
import { extensionOf, FILE_TYPES, filesPrefix } from '@/lib/files';

// Da el permiso para subir un archivo del fabricante directo al depósito de
// Vercel, sin pasar por la app. Solo con sesión, solo en la carpeta del
// producto y solo los tipos permitidos.

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return presignedUpload(req, async (pathname) => {
    const user = await getCurrentUser();
    if (!user) throw new Error('Tu sesión venció. Volvé a entrar.');
    const productId = pathname.split('/')[1] ?? '';
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product || !pathname.startsWith(filesPrefix(product.id)) || pathname.split('/').length !== 3) {
      throw new Error('El producto no existe.');
    }
    const type = FILE_TYPES[extensionOf(pathname)];
    if (!type) throw new Error('Solo se aceptan imágenes JPG, PNG, WEBP o GIF, y PDF.');
    return { contentType: type.contentType, maxBytes: type.maxBytes };
  }, 10 * 60 * 1000);
}
