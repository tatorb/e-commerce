import { NextResponse } from 'next/server';
import { videoPieceRange } from '@/domain/videos';
import { prisma } from '@/lib/db';
import { DriveError, fileMedia, withDriveToken } from '@/lib/drive';
import { verifyWorkerRequest } from '@/lib/image-worker';
import { fail } from '@/lib/video-worker-api';

// El video original o su copia liviana, a través de la app y de a pedazos: la
// Mac los pide cuando no encuentra el archivo en su carpeta de Google Drive.
// Así la llave del Drive no sale de la app.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await verifyWorkerRequest(prisma, req.headers.get('authorization')))) return fail(401, 'La llave del trabajador no vale.');
  const params = new URL(req.url).searchParams;
  const video = await prisma.productVideo.findUnique({
    where: { id: params.get('video') ?? '' },
    select: { driveFileId: true, lightFileId: true, edits: { where: { status: 'PROCESSING' }, select: { id: true }, take: 1 } },
  });
  // Solo se baja un video que la Mac está editando.
  if (!video || video.edits.length === 0) return fail(404, 'Ese video no se está editando.');
  const fileId = params.get('cual') === 'liviana' ? video.lightFileId : video.driveFileId;
  if (!fileId) return fail(404, 'El video no tiene copia liviana.');
  try {
    const res = await withDriveToken(prisma, (token) => fileMedia(token, fileId, videoPieceRange(req.headers.get('range'))));
    const headers = new Headers({ 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
    for (const h of ['content-range', 'content-length']) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new NextResponse(res.body, { status: res.status === 200 ? 200 : 206, headers });
  } catch (e) {
    if (e instanceof DriveError) return fail(e.status === 404 || e.status === 416 ? e.status : 502, e.status === 404 ? 'El video ya no está en el Drive.' : 'El Drive no respondió.');
    throw e;
  }
}
