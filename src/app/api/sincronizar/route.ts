import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { syncAllStores } from '@/lib/channel-sync';
import { renewDiscounts } from '@/lib/channel-push';
import { readAllQuestions } from '@/lib/buyer-questions';
import { answerAlone } from '@/lib/answers';
import { isAiConfigured } from '@/ai/claude';
import { sendTaskMail } from '@/lib/task-mail';
import { affectedPublications, readSales, reconcileStock, startStock, syncStock } from '@/lib/stock';
import { stockAlarmPass } from '@/lib/stock-alarms';
import { settleReactivations } from '@/lib/restock';
import { placeAllShotPhotos } from '@/lib/shoot';

// La tarea programada: lee las preguntas de los compradores y las
// publicaciones de las tiendas conectadas, responde las preguntas de las
// publicaciones en que Claude responde solo, manda los mails de las tareas,
// descuenta las ventas del stock de los productos y sube la cantidad nueva, y
// renueva los descuentos que subió la app antes de que venzan, avisa otra vez
// de las alarmas de stock sin reponer y pausa las de dos días, y suma a sus
// publicaciones las fotos de Registro de productos que quedaron listas. La llaman Vercel una vez por día
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
// Los mails de las tareas: cada uno es un pedido corto.
const MAIL_BUDGET_MS = 5_000;
// Las ventas, con la cantidad nueva de las publicaciones, y lo que quedó distinto del stock.
const SALES_BUDGET_MS = 8_000;
const STOCK_BUDGET_MS = 4_000;
// Después, los descuentos por vencer: cada uno son unos pocos pedidos.
const RENEW_BUDGET_MS = 6_000;
// Las alarmas de stock: el aviso del primer día y la pausa a los dos días.
const ALARMS_BUDGET_MS = 3_000;
// Las fotos de Registro de productos que quedaron listas sin sumarse a sus publicaciones.
const SHOTS_BUDGET_MS = 3_000;

const digest = (s: string) => createHash('sha256').update(s).digest();

function authorized(request: Request, secret: string): boolean {
  return timingSafeEqual(digest(request.headers.get('authorization') ?? ''), digest(`Bearer ${secret}`));
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Falta configurar CRON_SECRET.' }, { status: 503 });
  if (!authorized(request, secret)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const begun = Date.now();
  const questions = await readAllQuestions(prisma, { budgetMs: QUESTIONS_BUDGET_MS });
  // Las que llegaron sin el aviso del canal: una por pedido.
  const alone = await answerAlone(prisma, { aiReady: isAiConfigured() });
  const mails = await sendTaskMail(prisma, { budgetMs: MAIL_BUDGET_MS });
  const sales = await readSales(prisma, { budgetMs: SALES_BUDGET_MS });
  // Con las ventas al día: las alarmas de stock sin reponer. Las pausadas reciben ya su cantidad.
  const alarms = await stockAlarmPass(prisma, { budgetMs: ALARMS_BUDGET_MS });
  const paused = await syncStock(prisma, { publicationIds: await affectedPublications(prisma, alarms.cut), note: 'Pasaron dos días sin reponer: se pausó.' });
  const renewals = await renewDiscounts(prisma, { budgetMs: RENEW_BUDGET_MS });
  const result = await syncAllStores(prisma, { budgetMs: BUDGET_MS - (Date.now() - begun) });
  // Con lo recién leído: el stock de partida de los productos nuevos y lo que quedó distinto del stock.
  const started = await startStock(prisma, { budgetMs: STOCK_BUDGET_MS });
  const stock = await reconcileStock(prisma, { budgetMs: STOCK_BUDGET_MS });
  // Con lo recién leído: las tareas de reactivar de las que ya están activas se cierran.
  const reactivated = await settleReactivations(prisma);
  const shots = await placeAllShotPhotos(prisma, { budgetMs: SHOTS_BUDGET_MS });
  return NextResponse.json({
    pending:
      result.pending ||
      questions.pending ||
      alone.pending ||
      renewals.pending ||
      mails.pending ||
      sales.pending ||
      alarms.pending ||
      started.pending ||
      stock.pending ||
      shots.pending,
    stores: result.stores.map((s) => ({ status: s.status, read: s.position, total: s.total })),
    renewed: renewals.renewed,
    answered: alone.sent,
    mails: mails.sent,
    sales: sales.orders,
    stockStarted: started.started,
    stockSent: sales.sent + stock.sent + paused.sent,
    stockReminded: alarms.reminded,
    stockPaused: alarms.cut.length,
    reactivated,
    shotPhotosPlaced: shots.placed,
  });
}
