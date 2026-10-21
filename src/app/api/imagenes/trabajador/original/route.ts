import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyWorkerRequest } from '@/lib/image-worker';
import { fail } from '@/lib/photo-worker-api';
import { readStored, storageError } from '@/lib/stored-files';

// El original, a través de la app: la app lo lee del Drive y se lo pasa al
// trabajador, así la llave del Drive no sale de la app.

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!(await verifyWorkerRequest(prisma, req.headers.get('authorization')))) return fail(401, 'La llave del trabajador no vale.');
  const id = new URL(req.url).searchParams.get('foto') ?? '';
  const edit = await prisma.photoEdit.findUnique({ where: { id }, select: { originalUrl: true, originalType: true } });
  if (!edit) return fail(404, 'La foto no existe.');
  try {
    const res = await readStored(prisma, edit.originalUrl);
    if (!res) return fail(404, 'El original ya no está guardado: se borró del Drive.');
    return new NextResponse(res.body, { headers: { 'Content-Type': edit.originalType, 'Cache-Control': 'no-store' } });
  } catch (e) {
    const message = storageError(e);
    if (message) return fail(502, message);
    throw e;
  }
}
