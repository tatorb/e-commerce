import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { signedDownloadUrl } from '@/lib/files';
import { inVercel, readStored, storageError } from '@/lib/stored-files';

// Muestra o baja un archivo de la línea de imágenes, solo con sesión. Lo que
// está en el Drive pasa por la app. Lo que todavía está en el depósito de
// Vercel: las vistas livianas pasan por la app y las fotos grandes se bajan
// directo con un link que vence en minutos.

export const dynamic = 'force-dynamic';

const KINDS = ['antes', 'original', 'vista', 'mascara', 'png', 'jpg', 'vivo'] as const;
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
    const field = { vista: 'previewUrl', mascara: 'maskUrl', png: 'pngUrl', jpg: 'jpgUrl', vivo: 'liveUrl' } as const;
    url = run ? run[field[kind]] : null;
    const base = run ? run.edit.originalName.replace(/\.[^.]+$/, '') : 'foto';
    name = { vista: `${base}-vista.jpg`, mascara: `${base}-silueta.png`, png: `${base}.png`, jpg: `${base}.jpg`, vivo: `${base}-en-vivo.bin` }[kind];
    contentType = kind === 'vivo' ? 'application/octet-stream' : kind === 'mascara' || kind === 'png' ? 'image/png' : 'image/jpeg';
  }
  if (!url) return new NextResponse('El archivo no existe.', { status: 404 });

  if (inVercel(url) && !LIGHT.includes(kind)) {
    try {
      return NextResponse.redirect(await signedDownloadUrl(url, 10 * 60 * 1000, download), 302);
    } catch (e) {
      console.error('No se pudo firmar el link; se muestra a través de la app.', e);
    }
  }
  try {
    const res = await readStored(prisma, url);
    if (!res) return new NextResponse('El archivo ya no está guardado: se borró del Drive.', { status: 404 });
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}`,
        // Las vistas no cambian: se pueden guardar. Las finales se pueden
        // retocar desde la Mac, así que se piden de nuevo cada tanto.
        'Cache-Control': kind === 'jpg' || kind === 'png' ? 'private, max-age=300' : 'private, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    const message = storageError(e);
    if (message) return new NextResponse(message, { status: 502 });
    throw e;
  }
}
