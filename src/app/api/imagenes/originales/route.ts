import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { BLOB_NOT_CONFIGURED, extensionOf, isBlobConfigured } from '@/lib/files';
import { ORIGINAL_MAX_BYTES, ORIGINAL_TYPES, photoPrefix } from '@/lib/photo-files';

// Da el permiso para subir un original directo al depósito, sin pasar por la
// app: así no hay límite de peso de Vercel. Solo con sesión, solo en la
// carpeta de originales del producto y solo fotos JPG, PNG, HEIC o TIFF.

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
        const folder = product ? `${photoPrefix(product.id)}originales/` : null;
        if (!folder || !pathname.startsWith(folder) || pathname.split('/').length !== 4) throw new Error('El producto no existe.');
        const type = ORIGINAL_TYPES[extensionOf(pathname)];
        if (!type) throw new Error('Solo se aceptan fotos JPG, PNG, HEIC o TIFF.');
        return {
          allowedContentTypes: [type],
          maximumSizeInBytes: ORIGINAL_MAX_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 30 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo subir.' }, { status: 400 });
  }
}
