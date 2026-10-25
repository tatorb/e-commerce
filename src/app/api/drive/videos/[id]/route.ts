import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { canSeeProduct } from '@/lib/auth/product-access';
import { DriveError, fileMedia, withDriveToken } from '@/lib/drive';
import { videoPieceRange } from '@/domain/videos';

// El video, para verlo en la app aunque la persona no tenga el Drive. Se manda
// de a pedazos: el reproductor del navegador pide el que necesita, y cada
// pedazo entra en lo que Vercel deja mandar por pedido.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const video = await prisma.productVideo.findUnique({ where: { id }, select: { driveFileId: true, mimeType: true, productId: true } });
  if (!video || !(await canSeeProduct(user, video.productId))) return new NextResponse(null, { status: 404 });
  try {
    const res = await withDriveToken(prisma, (token) => fileMedia(token, video.driveFileId, videoPieceRange(req.headers.get('range'))));
    const headers = new Headers({
      'Content-Type': video.mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=600',
    });
    for (const h of ['content-range', 'content-length']) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new NextResponse(res.body, { status: res.status === 200 ? 200 : 206, headers });
  } catch (e) {
    if (e instanceof DriveError) return new NextResponse(null, { status: e.status === 404 || e.status === 416 ? e.status : 502 });
    throw e;
  }
}
