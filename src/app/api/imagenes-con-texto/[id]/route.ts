import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { canSeeProduct } from '@/lib/auth/product-access';
import { storageError } from '@/lib/stored-files';
import { textImagePng } from '@/lib/text-images/files';

// El PNG de una imagen con texto, solo para quien ve el producto.

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Entrá a la app para ver esta imagen.', { status: 401 });
  const { id } = await params;
  try {
    const png = await textImagePng(prisma, id);
    if (!png || !(await canSeeProduct(user, png.productId))) return new NextResponse('La imagen no existe.', { status: 404 });
    const download = new URL(req.url).searchParams.has('descargar');
    return new NextResponse(Buffer.from(png.data), {
      headers: {
        'Content-Type': png.type,
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${png.name}"`,
        'Cache-Control': 'private, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    const message = storageError(e);
    if (message) return new NextResponse(message, { status: 502 });
    throw e;
  }
}
