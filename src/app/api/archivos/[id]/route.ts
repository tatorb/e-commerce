import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { FileError, readBlob } from '@/lib/files';

// Muestra un archivo del fabricante. El depósito es privado: solo se ve a
// través de la app y con sesión iniciada.

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new NextResponse('Entrá a la app para ver este archivo.', { status: 401 });
  const { id } = await params;
  const file = await prisma.productFile.findUnique({ where: { id } });
  if (!file) return new NextResponse('El archivo no existe.', { status: 404 });
  try {
    const res = await readBlob(file.url);
    if (!res) return new NextResponse('El archivo ya no está en el depósito.', { status: 404 });
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
    if (e instanceof FileError) return new NextResponse(e.message, { status: 502 });
    throw e;
  }
}
