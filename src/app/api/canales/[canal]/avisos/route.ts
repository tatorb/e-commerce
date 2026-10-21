import { after, NextResponse } from 'next/server';
import { getChannelConnector } from '@/channels/connect';
import type { ChannelKind } from '@/generated/prisma/enums';
import { prisma } from '@/lib/db';
import { receiveNotice } from '@/lib/buyer-questions';

// Avisos del canal. Mercado Libre pide esta dirección al crear la aplicación.
// Hoy la app usa los de las preguntas de los compradores; los demás llegan y
// no se guardan. Se confirma enseguida y se procesa después: si tarda, el
// canal vuelve a mandar el aviso. Lo que trae el aviso no se registra ni se
// cree: la pregunta se le pide al canal con la conexión de la tienda.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Un aviso es chico: lo que pase de esto no es un aviso.
const MAX_CHARS = 16_000;

function channelOf(canal: string): ChannelKind | null {
  const kind = canal.toUpperCase() as ChannelKind;
  return getChannelConnector(kind) ? kind : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ canal: string }> }) {
  const { canal } = await params;
  const kind = channelOf(canal);
  if (!kind) return new NextResponse(null, { status: 404 });
  const raw = await request.text();
  if (raw.length > MAX_CHARS) return new NextResponse(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  after(async () => {
    try {
      await receiveNotice(prisma, kind, body);
    } catch (e) {
      console.error('No se pudo procesar el aviso', e instanceof Error ? e.message : e);
    }
  });
  return new NextResponse(null, { status: 200 });
}

/** Para comprobar desde el navegador que la dirección existe. */
export async function GET(_request: Request, { params }: { params: Promise<{ canal: string }> }) {
  const { canal } = await params;
  return new NextResponse(null, { status: channelOf(canal) ? 200 : 404 });
}
