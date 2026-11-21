import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { closeRun, failRun, InsurError, openRun, parseArticles, receiveArticles, receiveUnmatched } from '@/lib/insur';
import { insurCaller } from '@/lib/insur-access';

// Recibe la corrida de la extensión "Insur → E-commerce", con la sesión de la
// persona. La extensión primero lee todo Insur y recién después manda, en
// varios pedidos: abrir, artículos (de a tandas), sin_producto, cerrar. Si
// algo falla antes, manda fallo y no manda nada más. Los costos van solo al
// costo de cada producto: no quedan en la corrida ni en ningún registro.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const headers = { 'Cache-Control': 'no-store' };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers });

export async function POST(req: Request) {
  const who = await insurCaller();
  if ('error' in who) return fail(who.status, who.error);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Pedido inválido.');
  }
  if (!body || typeof body !== 'object') return fail(400, 'Pedido inválido.');
  const accountId = who.account.id;
  const userId = who.user.id;
  const runId = typeof body.corrida === 'string' ? body.corrida : '';
  const number = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  try {
    switch (body.accion) {
      case 'abrir': {
        const r = await openRun(prisma, { accountId, userId, origin: String(body.origen ?? ''), preview: body.solo_mostrar === true, read: number(body.leidos) ?? 0 });
        return NextResponse.json({ corrida: r.runId, solo_mostrar: r.preview, modo_prueba: r.testMode }, { headers });
      }
      case 'articulos': {
        const r = await receiveArticles(prisma, { accountId, runId, userId, articles: parseArticles(body.articulos) });
        return NextResponse.json({ ok: true, recibidos: r.received, cruzados: r.linked }, { headers });
      }
      case 'sin_producto': {
        await receiveUnmatched(prisma, { accountId, runId, total: number(body.total) ?? 0, articles: parseArticles(body.articulos) });
        return NextResponse.json({ ok: true }, { headers });
      }
      case 'cerrar': {
        const r = await closeRun(prisma, { accountId, runId, userId, durationMs: number(body.duracion_ms), pendingFichas: number(body.fichas_pendientes), fichaFields: body.campos_de_la_ficha, listFields: body.campos_del_listado, errors: body.errores });
        return NextResponse.json(
          {
            ok: true,
            solo_mostrar: r.preview,
            recibidos: r.received,
            cruzados: r.linked,
            cambios_de_stock: r.stockChanges,
            cambios_de_costo: r.costChanges,
            costos_sospechosos: r.suspicious,
            no_aparecieron: r.summary.missing.length,
            errores: r.errors.length,
          },
          { headers },
        );
      }
      case 'fallo': {
        await failRun(prisma, { accountId, userId, runId: runId || null, origin: String(body.origen ?? ''), error: String(body.error ?? 'La corrida se cortó.'), durationMs: number(body.duracion_ms) });
        return NextResponse.json({ ok: true }, { headers });
      }
      default:
        return fail(400, 'Pedido inválido.');
    }
  } catch (e) {
    if (e instanceof InsurError) return fail(409, e.message);
    throw e;
  }
}
