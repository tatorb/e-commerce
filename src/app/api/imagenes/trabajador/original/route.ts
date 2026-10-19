import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { FileError, readBlob } from '@/lib/files';
import { verifyWorkerRequest } from '@/lib/image-worker';
import { fail } from '@/lib/photo-worker-api';

// El original, a través de la app. Solo se usa si el depósito no da links
// firmados: lo normal es que el trabajador lo baje directo.

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!(await verifyWorkerRequest(prisma, req.headers.get('authorization')))) return fail(401, 'La llave del trabajador no vale.');
  const id = new URL(req.url).searchParams.get('foto') ?? '';
  const edit = await prisma.photoEdit.findUnique({ where: { id }, select: { originalUrl: true, originalType: true } });
  if (!edit) return fail(404, 'La foto no existe.');
  try {
    const res = await readBlob(edit.originalUrl);
    if (!res) return fail(404, 'El original ya no está en el depósito.');
    return new NextResponse(res.body, { headers: { 'Content-Type': edit.originalType, 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof FileError) return fail(502, e.message);
    throw e;
  }
}
