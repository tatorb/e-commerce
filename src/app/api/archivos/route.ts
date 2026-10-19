import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { BLOB_NOT_CONFIGURED, extensionOf, FILE_TYPES, filesPrefix, isBlobConfigured } from '@/lib/files';

// Da el permiso para subir un archivo del fabricante directo al depósito de
// Vercel, sin pasar por la app: así no hay límite de peso de Vercel. Solo con
// sesión, solo en la carpeta del producto y solo los tipos permitidos.

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isBlobConfigured()) return NextResponse.json({ error: BLOB_NOT_CONFIGURED }, { status: 503 });
  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  }
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUser();
        if (!user) throw new Error('Tu sesión venció. Volvé a entrar.');
        const productId = pathname.split('/')[1] ?? '';
        const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
        if (!product || !pathname.startsWith(filesPrefix(product.id)) || pathname.split('/').length !== 3) {
          throw new Error('El producto no existe.');
        }
        const type = FILE_TYPES[extensionOf(pathname)];
        if (!type) throw new Error('Solo se aceptan imágenes JPG, PNG, WEBP o GIF, y PDF.');
        return {
          allowedContentTypes: [type.contentType],
          maximumSizeInBytes: type.maxBytes,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo subir.' }, { status: 400 });
  }
}
