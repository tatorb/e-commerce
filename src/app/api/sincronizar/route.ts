import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { syncAllStores } from '@/lib/channel-sync';
import { renewDiscounts } from '@/lib/channel-push';
import { readAllQuestions } from '@/lib/buyer-questions';
import { answerAlone } from '@/lib/answers';
import { isAiConfigured } from '@/ai/claude';
import { sendTaskMail } from '@/lib/task-mail';
import { readSales, reconcileStock, startStock } from '@/lib/stock';
import { stockAlarmPass } from '@/lib/stock-alarms';
import { settleReactivations } from '@/lib/restock';
import { placeAllShotPhotos } from '@/lib/shoot';
import { findTextImagesInChannel } from '@/lib/text-images/channel-codes';
import { readAllSales } from '@/lib/sales/read';
import { saleAlarmPass } from '@/lib/sales/alarms';
import { readAllVisits } from '@/lib/visits';
import { importSoldListings } from '@/lib/sold-listings';
import { dailySummaryPass, notifyNewSales, notifyPendingQuestions } from '@/lib/notification-events';
import { pruneNotifications } from '@/lib/notifications';
import { taskNoticePass } from '@/lib/task-mail';

// La tarea programada: lee las preguntas de los compradores y las
// publicaciones de las tiendas conectadas, responde las preguntas de las
// publicaciones en que Claude responde solo, manda los mails de las tareas,
// descuenta las ventas del stock de los productos y sube la cantidad nueva, y
// renueva los descuentos que subió la app antes de que venzan, avisa otra vez
// de las alarmas de stock sin reponer, y suma a sus
// publicaciones las fotos de Registro de productos que quedaron listas, y al
// final trae las ventas para la sección Ventas, con su envío y su pago, abre
// las tareas de despachar y de reclamos, trae las publicaciones vendidas que
// no están en la app, y manda las notificaciones. Las visitas de cada día se leen temprano, después de las preguntas. La llaman Vercel una vez por día
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
// Las alarmas de stock: el aviso del primer día sin reponer. La app nunca pausa por eso.
const ALARMS_BUDGET_MS = 3_000;
// Las fotos de Registro de productos que quedaron listas sin sumarse a sus publicaciones.
const SHOTS_BUDGET_MS = 3_000;
// Las ventas de la sección Ventas: las nuevas, un tramo de las viejas y su envío y su pago.
const LEDGER_BUDGET_MS = 6_000;
// Las visitas de cada día de las publicaciones que no se leyeron hoy. Van temprano: al final del
// pedido nunca les quedaba tiempo y Rendimiento se quedaba sin visitas.
const VISITS_BUDGET_MS = 6_000;
// Todo el pedido: lo que queda se lo reparten las partes, para no pasarse del tope de 60 segundos.
const TOTAL_MS = 45_000;
// Las publicaciones vendidas que no están en la app: se traen del canal.
const SOLD_BUDGET_MS = 5_000;
const TEXT_CODES_BUDGET_MS = 10_000;
// Las notificaciones: las de las tareas, las que no salieron al instante y el resumen del día.
const NOTICES_BUDGET_MS = 4_000;

const digest = (s: string) => createHash('sha256').update(s).digest();

function authorized(request: Request, secret: string): boolean {
  return timingSafeEqual(digest(request.headers.get('authorization') ?? ''), digest(`Bearer ${secret}`));
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Falta configurar CRON_SECRET.' }, { status: 503 });
  if (!authorized(request, secret)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const begun = Date.now();
  // Cada parte usa su tiempo, pero nunca más de lo que le queda al pedido.
  const budget = (ms: number) => Math.max(0, Math.min(ms, TOTAL_MS - (Date.now() - begun)));
  const questions = await readAllQuestions(prisma, { budgetMs: QUESTIONS_BUDGET_MS });
  // Las que llegaron sin el aviso del canal: una por pedido.
  const alone = await answerAlone(prisma, { aiReady: isAiConfigured() });
  const visits = await readAllVisits(prisma, { budgetMs: budget(VISITS_BUDGET_MS) });
  const mails = await sendTaskMail(prisma, { budgetMs: budget(MAIL_BUDGET_MS) });
  const sales = await readSales(prisma, { budgetMs: budget(SALES_BUDGET_MS) });
  // Con las ventas al día: el aviso de las alarmas de stock sin reponer.
  const alarms = await stockAlarmPass(prisma, { budgetMs: budget(ALARMS_BUDGET_MS) });
  const renewals = await renewDiscounts(prisma, { budgetMs: budget(RENEW_BUDGET_MS) });
  const result = await syncAllStores(prisma, { budgetMs: Math.max(0, BUDGET_MS - (Date.now() - begun)) });
  // Con lo recién leído: el stock de partida de los productos nuevos y lo que quedó distinto del stock.
  const started = await startStock(prisma, { budgetMs: budget(STOCK_BUDGET_MS) });
  const stock = await reconcileStock(prisma, { budgetMs: budget(STOCK_BUDGET_MS) });
  // Con lo recién leído: las tareas de reactivar de las que ya están activas se cierran.
  const reactivated = await settleReactivations(prisma);
  const shots = await placeAllShotPhotos(prisma, { budgetMs: budget(SHOTS_BUDGET_MS) });
  // Con las fotos del canal recién leídas: cuál es cada imagen con texto que ya estaba subida.
  const texts = await findTextImagesInChannel(prisma, { budgetMs: budget(TEXT_CODES_BUDGET_MS) }).catch((e) => {
    console.error('No se pudieron buscar las imágenes con texto en el canal.', e);
    return { pending: false };
  });
  const ledger = await readAllSales(prisma, { budgetMs: budget(LEDGER_BUDGET_MS) });
  const saleTasks = await saleAlarmPass(prisma);
  const sold = await importSoldListings(prisma, { budgetMs: budget(SOLD_BUDGET_MS) });
  // Las notificaciones que no salieron al instante, las de las tareas y el resumen del día.
  const notices = await notificationPass(budget(NOTICES_BUDGET_MS));
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
      shots.pending ||
      texts.pending ||
      ledger.pending ||
      visits.pending ||
      sold.pending,
    stores: result.stores.map((s) => ({ status: s.status, read: s.position, total: s.total })),
    renewed: renewals.renewed,
    answered: alone.sent,
    mails: mails.sent,
    sales: sales.orders,
    stockStarted: started.started,
    stockSent: sales.sent + stock.sent,
    stockReminded: alarms.reminded,
    reactivated,
    shotPhotosPlaced: shots.placed,
    ledgerRead: ledger.read,
    ledgerCompleted: ledger.completed,
    saleTasksOpened: saleTasks.opened,
    visitsRead: visits.read,
    soldListingsImported: sold.imported.length,
    notifications: notices,
  });
}

/** Ninguna notificación frena la tarea: lo que falla se prueba en la próxima. */
async function notificationPass(budgetMs: number): Promise<number> {
  try {
    let n = 0;
    n += await taskNoticePass(prisma);
    n += await notifyPendingQuestions(prisma);
    n += await notifyNewSales(prisma);
    n += await dailySummaryPass(prisma, { budgetMs });
    await pruneNotifications(prisma);
    return n;
  } catch (e) {
    console.error('No salieron las notificaciones.', e instanceof Error ? e.message : e);
    return 0;
  }
}
