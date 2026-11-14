import { after, NextResponse } from 'next/server';
import { getChannelConnector } from '@/channels/connect';
import type { ChannelKind } from '@/generated/prisma/enums';
import { isAiConfigured } from '@/ai/claude';
import { prisma } from '@/lib/db';
import { handleNotice } from '@/lib/answers';
import { handleSalesNotice } from '@/lib/stock';
import { handleSaleNotice } from '@/lib/sales/read';
import { notifyNewSales, notifyPendingQuestions } from '@/lib/notification-events';

// Avisos del canal. Mercado Libre pide esta dirección al crear la aplicación.
// La app usa los de las preguntas de los compradores, los de las ventas y los
// de sus envíos y pagos; los
// demás llegan y no se guardan. Se confirma enseguida y se procesa después: si tarda, el
// canal vuelve a mandar el aviso. Lo que trae el aviso no se registra ni se
// cree: la pregunta o la venta se le pide al canal con la conexión de la
// tienda. Si la pregunta es nueva, Claude propone la respuesta en ese momento;
// si es una venta, se descuenta del stock y se sube la cantidad nueva. Al
// final, las notificaciones de la pregunta que espera a una persona y de la
// venta nueva.

export const dynamic = 'force-dynamic';
// Antes de mandar sola una respuesta se espera lo que pide la cuenta, hasta 4 minutos.
export const maxDuration = 300;

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
      await handleNotice(prisma, kind, body, { aiReady: isAiConfigured() });
      await handleSalesNotice(prisma, kind, body);
      await handleSaleNotice(prisma, kind, body);
    } catch (e) {
      console.error('No se pudo procesar el aviso', e instanceof Error ? e.message : e);
    }
    // Al celular: la pregunta que espera a una persona y la venta nueva.
    await notifyPendingQuestions(prisma).catch(() => 0);
    await notifyNewSales(prisma).catch(() => 0);
  });
  return new NextResponse(null, { status: 200 });
}

/** Para comprobar desde el navegador que la dirección existe. */
export async function GET(_request: Request, { params }: { params: Promise<{ canal: string }> }) {
  const { canal } = await params;
  return new NextResponse(null, { status: channelOf(canal) ? 200 : 404 });
}
