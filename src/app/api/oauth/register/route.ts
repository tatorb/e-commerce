import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { registerClient } from '@/lib/mcp/oauth';
import { CORS, corsPreflight } from '@/lib/mcp/http';

// Registro dinámico (RFC 7591): Claude se presenta antes de pedir permiso.

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflight('POST, OPTIONS');
}

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // Sin cuerpo: igual se registra.
  }
  const client = await registerClient(prisma, body);
  return NextResponse.json(client, { status: 201, headers: CORS });
}
