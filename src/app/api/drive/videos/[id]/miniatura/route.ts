import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { canSeeProduct } from '@/lib/auth/product-access';
import { DriveError, fileThumbnail, withDriveToken } from '@/lib/drive';

// La miniatura que arma Google para cada video. Recién subido, Google tarda un
// rato en tenerla.

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const video = await prisma.productVideo.findUnique({ where: { id }, select: { driveFileId: true, productId: true } });
  if (!video || !(await canSeeProduct(user, video.productId))) return new NextResponse(null, { status: 404 });
  try {
    const res = await withDriveToken(prisma, (token) => fileThumbnail(token, video.driveFileId, 480));
    if (!res) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new NextResponse(res.body, {
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
    });
  } catch (e) {
    if (e instanceof DriveError) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    throw e;
  }
}
