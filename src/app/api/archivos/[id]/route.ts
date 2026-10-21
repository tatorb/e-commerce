import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { readStored, storageError } from '@/lib/stored-files';

// Muestra un archivo del fabricante, del Drive del estudio, solo con sesión
// iniciada.

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new NextResponse('Entrá a la app para ver este archivo.', { status: 401 });
  const { id } = await params;
  const file = await prisma.productFile.findUnique({ where: { id } });
  if (!file) return new NextResponse('El archivo no existe.', { status: 404 });
  try {
    const res = await readStored(prisma, file.url);
    if (!res) return new NextResponse('El archivo ya no está guardado: se borró del Drive.', { status: 404 });
    const download = new URL(req.url).searchParams.has('descargar');
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    const message = storageError(e);
    if (message) return new NextResponse(message, { status: 502 });
    throw e;
  }
}
