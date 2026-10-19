import { NextResponse } from 'next/server';
import { getChannelConnector } from '@/channels/connect';
import type { ChannelKind } from '@/generated/prisma/enums';

// Avisos del canal, por ejemplo cuando cambia una publicación. Mercado Libre
// pide esta dirección al crear la aplicación. Por ahora la app no los usa:
// responde que llegaron y no guarda nada, ni registra lo que traen.

export const dynamic = 'force-dynamic';

async function received(_request: Request, { params }: { params: Promise<{ canal: string }> }) {
  const { canal } = await params;
  if (!getChannelConnector(canal.toUpperCase() as ChannelKind)) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, { status: 200 });
}

export const POST = received;
export const GET = received;
