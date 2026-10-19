import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { FileError, readBlob } from '@/lib/files';
import { signedDownloadUrl } from '@/lib/photo-files';

// Muestra o baja un archivo de la línea de imágenes. El depósito es privado:
// solo se ve con sesión. Las vistas livianas pasan por la app; las fotos
// grandes se bajan directo del depósito con un link que vence en minutos.

export const dynamic = 'force-dynamic';

const KINDS = ['antes', 'original', 'vista', 'mascara', 'png', 'jpg'] as const;
type Kind = (typeof KINDS)[number];
const LIGHT: Kind[] = ['antes', 'vista'];

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return new NextResponse('Entrá a la app para ver este archivo.', { status: 401 });
  const params = new URL(req.url).searchParams;
  const kind = params.get('tipo') as Kind;
  if (!KINDS.includes(kind)) return new NextResponse('Archivo desconocido.', { status: 400 });
  const download = params.has('descargar');
  let url: string | null = null;
  let name = 'foto';
  let contentType = 'image/jpeg';
  if (kind === 'antes' || kind === 'original') {
    const edit = await prisma.photoEdit.findUnique({ where: { id: params.get('foto') ?? '' } });
    url = kind === 'antes' ? (edit?.previewUrl ?? null) : (edit?.originalUrl ?? null);
    name = edit ? (kind === 'original' ? edit.originalName : `${edit.originalName.replace(/\.[^.]+$/, '')}-vista.jpg`) : name;
    contentType = kind === 'original' && edit ? edit.originalType : contentType;
  } else {
    const run = await prisma.photoStepRun.findUnique({ where: { id: params.get('paso') ?? '' }, include: { edit: true } });
    const field = { vista: 'previewUrl', mascara: 'maskUrl', png: 'pngUrl', jpg: 'jpgUrl' } as const;
    url = run ? run[field[kind]] : null;
    const base = run ? run.edit.originalName.replace(/\.[^.]+$/, '') : 'foto';
    name = { vista: `${base}-vista.jpg`, mascara: `${base}-silueta.png`, png: `${base}.png`, jpg: `${base}.jpg` }[kind];
    contentType = kind === 'mascara' || kind === 'png' ? 'image/png' : 'image/jpeg';
  }
  if (!url) return new NextResponse('El archivo no existe.', { status: 404 });

  if (!LIGHT.includes(kind)) {
    try {
      return NextResponse.redirect(await signedDownloadUrl(url, 10 * 60 * 1000, download), 302);
    } catch (e) {
      console.error('No se pudo firmar el link; se muestra a través de la app.', e);
    }
  }
  try {
    const res = await readBlob(url);
    if (!res) return new NextResponse('El archivo ya no está en el depósito.', { status: 404 });
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}`,
        // Cada archivo tiene su propia dirección y no cambia: se puede guardar.
        'Cache-Control': 'private, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    if (e instanceof FileError) return new NextResponse(e.message, { status: 502 });
    throw e;
  }
}
