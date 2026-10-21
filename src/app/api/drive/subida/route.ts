import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { isUploadSessionUrl } from '@/lib/drive';

// Plan B de la subida de videos: si el navegador no puede mandarle las partes
// directo a Google, las manda acá y la app las reenvía. Cada parte es más chica
// que el tope de lo que acepta Vercel por pedido. Solo con sesión y solo a una
// subida abierta del Drive.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Las partes que manda el navegador por la app son de 4 MB.
const MAX_PART = 4 * 1024 * 1024;
const RANGE = /^bytes (\d+-\d+|\*)\/\d+$/;

export async function PUT(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  const url = req.headers.get('x-upload-url') ?? '';
  const range = req.headers.get('x-content-range') ?? '';
  if (!isUploadSessionUrl(url) || !RANGE.test(range)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  const body = await req.arrayBuffer();
  if (body.byteLength > MAX_PART) return NextResponse.json({ error: 'La parte es muy grande.' }, { status: 413 });
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Range': range },
      body: body.byteLength > 0 ? body : null,
      redirect: 'manual',
      signal: AbortSignal.timeout(50_000),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo conectar con Google.' }, { status: 502 });
  }
  // 308: Google guardó hasta donde dice Range. 200 o 201: terminó y manda el archivo.
  const file = res.status === 200 || res.status === 201 ? await res.json().catch(() => null) : null;
  return NextResponse.json({ status: res.status, range: res.headers.get('range'), file });
}
