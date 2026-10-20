import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { syncAllStores } from '@/lib/channel-sync';

// La tarea programada: lee las publicaciones de las tiendas conectadas. La
// llaman Vercel una vez por día (vercel.json) y GitHub cada hora
// (.github/workflows/leer-canales.yml), con la clave CRON_SECRET. Cada pedido
// lee lo que alcanza en su tiempo; pending dice si conviene llamar otra vez.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Lo que lee cada pedido, con margen para terminar antes del tope.
const BUDGET_MS = 45_000;

const digest = (s: string) => createHash('sha256').update(s).digest();

function authorized(request: Request, secret: string): boolean {
  return timingSafeEqual(digest(request.headers.get('authorization') ?? ''), digest(`Bearer ${secret}`));
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Falta configurar CRON_SECRET.' }, { status: 503 });
  if (!authorized(request, secret)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const result = await syncAllStores(prisma, { budgetMs: BUDGET_MS });
  return NextResponse.json({
    pending: result.pending,
    stores: result.stores.map((s) => ({ status: s.status, read: s.position, total: s.total })),
  });
}
