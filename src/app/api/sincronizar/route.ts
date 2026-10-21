import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { syncAllStores } from '@/lib/channel-sync';
import { readAllQuestions } from '@/lib/buyer-questions';

// La tarea programada: lee las preguntas de los compradores y las
// publicaciones de las tiendas conectadas. La llaman Vercel una vez por día
// (vercel.json) y GitHub cada hora (.github/workflows/leer-canales.yml), con
// la clave CRON_SECRET. Cada pedido lee lo que alcanza en su tiempo; pending
// dice si conviene llamar otra vez.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Lo que lee cada pedido. Una tanda que empieza justo antes del final puede
// tardar unos 20 segundos más: el margen es para que termine antes del tope de 60.
const BUDGET_MS = 35_000;
// Primero las preguntas, que esperan respuesta. La primera vez traen las anteriores por tandas.
const QUESTIONS_BUDGET_MS = 10_000;

const digest = (s: string) => createHash('sha256').update(s).digest();

function authorized(request: Request, secret: string): boolean {
  return timingSafeEqual(digest(request.headers.get('authorization') ?? ''), digest(`Bearer ${secret}`));
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Falta configurar CRON_SECRET.' }, { status: 503 });
  if (!authorized(request, secret)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const started = Date.now();
  const questions = await readAllQuestions(prisma, { budgetMs: QUESTIONS_BUDGET_MS });
  const result = await syncAllStores(prisma, { budgetMs: BUDGET_MS - (Date.now() - started) });
  return NextResponse.json({
    pending: result.pending || questions.pending,
    stores: result.stores.map((s) => ({ status: s.status, read: s.position, total: s.total })),
  });
}
