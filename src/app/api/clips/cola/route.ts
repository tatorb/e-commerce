import { NextResponse } from 'next/server';
import { can } from '@/domain/access';
import { getCurrentUser } from '@/lib/auth/session';
import { claimQueuedUpload, finishQueuedUpload, UPLOAD_PAUSE_S, uploaderSeen } from '@/lib/clip-uploads';
import { prisma } from '@/lib/db';
import { visibleAccounts } from '@/lib/queries/accounts';

// La cola de subida de clips, para la extensión de Chrome. La extensión
// pregunta con la sesión de la persona: GET toma el próximo clip pedido, de
// las cuentas que ve, y POST cuenta cómo salió. Quien no puede mandar cambios
// al canal no atiende la cola.

export const dynamic = 'force-dynamic';

const none = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

async function uploader() {
  const user = await getCurrentUser();
  if (!user) return null;
  return can(user.access, ['subir', 'pipeline'], 'write') ? user : null;
}

export async function GET(req: Request) {
  const user = await uploader();
  if (!user) return none(401, 'Hace falta la sesión de la app, con permiso para subir.');
  const params = new URL(req.url).searchParams;
  const auto = params.get('sola') === '1';
  await uploaderSeen(prisma, { userId: user.id, version: params.get('version'), auto });
  // Con la cola apagada solo avisa que está: no toma nada.
  if (!auto) return NextResponse.json({ trabajo: null, pausa_segundos: UPLOAD_PAUSE_S }, { headers: { 'Cache-Control': 'no-store' } });
  const accounts = await visibleAccounts(user.access);
  const job = await claimQueuedUpload(prisma, accounts.map((a) => ({ id: a.id, slug: a.slug })));
  return NextResponse.json(
    {
      trabajo: job ? { publicacion: job.publicationId, video: job.videoId, codigo: job.externalId, nombre: job.fileName, tipoDeArchivo: job.mimeType, todasLasVariantes: job.allMeasures } : null,
      pausa_segundos: UPLOAD_PAUSE_S,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: Request) {
  const user = await uploader();
  if (!user) return none(401, 'Hace falta la sesión de la app, con permiso para subir.');
  let body: { publicacion?: unknown; video?: unknown; ok?: unknown; error?: unknown; todasLasVariantes?: unknown };
  try {
    body = await req.json();
  } catch {
    return none(400, 'Pedido inválido.');
  }
  if (typeof body.publicacion !== 'string' || typeof body.video !== 'string') return none(400, 'Pedido inválido.');
  const pub = await prisma.publication.findUnique({ where: { id: body.publicacion }, select: { product: { select: { accountId: true } } } });
  const accounts = await visibleAccounts(user.access);
  if (!pub || !accounts.some((a) => a.id === pub.product.accountId)) return none(404, 'Esa publicación no es de una cuenta que veas.');
  await finishQueuedUpload(prisma, {
    accountId: pub.product.accountId,
    publicationId: body.publicacion,
    videoId: body.video,
    allMeasures: body.todasLasVariantes !== false,
    ok: body.ok === true,
    error: typeof body.error === 'string' ? body.error : null,
    userId: user.id,
  });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
