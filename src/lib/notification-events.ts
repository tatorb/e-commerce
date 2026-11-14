import type { PrismaClient } from '@/generated/prisma/client';
import { titleOrUntitled } from '@/domain/publication-title';
import { dayIn } from '@/domain/tasks';
import { minutesIn, shortText } from '@/domain/notifications';
import { can, parsePermissions, type Section } from '@/domain/access';
import { plural } from '@/lib/format';
import { accountPeople, notify } from '@/lib/notifications';
import { outOfStockCount } from '@/lib/stock-alarms';
import { syncBadgeCount } from '@/lib/channel-sync';
import { parseLines } from '@/lib/sales/read';

// Lo que avisa la app sola: ventas nuevas, envíos por despachar, reclamos,
// preguntas sin responder, una conexión cortada, fotos corregidas y el
// resumen del día. Cada una mira lo que pasó y avisa lo que todavía no avisó,
// así se puede llamar al instante y también en la tarea de cada hora sin
// repetir nada. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

// Solo lo de estas últimas horas: lo viejo ya no sirve como aviso, y así no
// llegan de golpe las de antes al estrenar las notificaciones.
const RECENT_MS = 12 * 3600_000;

/** Las claves que ya se avisaron a alguien, de esa lista. */
async function alreadySent(db: Db, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await db.notification.findMany({ where: { key: { in: keys } }, distinct: ['key'], select: { key: true } });
  return new Set(rows.map((r) => r.key));
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

/** Lo que se vendió, en pocas palabras: "Subconjunto SP-900 y 1 más". */
function what(lines: unknown): string {
  const l = parseLines(lines);
  const first = l[0]?.title ?? 'la venta';
  return l.length > 1 ? `${first} y ${l.length - 1} más` : first;
}

// ───────────────────────────── Ventas ─────────────────────────────

export const saleKey = (saleId: string) => `venta:${saleId}`;

/** Las ventas pagadas de los últimos días que todavía no se avisaron. */
export async function notifyNewSales(db: Db, opts: { now?: Date; accountId?: string } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const sales = await db.sale.findMany({
    where: {
      state: 'PAID',
      orderedAt: { gte: new Date(now.getTime() - RECENT_MS) },
      ...(opts.accountId ? { store: { accountId: opts.accountId } } : {}),
    },
    orderBy: { orderedAt: 'asc' },
    take: 200,
    select: {
      id: true,
      orderId: true,
      lines: true,
      itemsAmount: true,
      currency: true,
      buyerNickname: true,
      store: { select: { accountId: true, account: { select: { slug: true } } } },
    },
  });
  const sent = await alreadySent(db, sales.map((s) => saleKey(s.id)));
  const people = new Map<string, string[]>();
  let n = 0;
  for (const s of sales) {
    if (sent.has(saleKey(s.id))) continue;
    const accountId = s.store.accountId;
    if (!people.has(accountId)) people.set(accountId, await accountPeople(db, accountId, 'ventas'));
    n += await notify(db, {
      userIds: people.get(accountId)!,
      accountId,
      kind: 'venta',
      title: `Venta nueva: ${what(s.lines)}`,
      body: [money(Number(s.itemsAmount), s.currency), s.buyerNickname ? `Comprador: ${s.buyerNickname}` : null, `Venta ${s.orderId}`].filter(Boolean).join(' · '),
      link: `/a/${s.store.account.slug}/ventas/${s.id}`,
      key: saleKey(s.id),
      now,
    });
  }
  return n;
}

/** El envío por despachar o el reclamo de una venta, a quienes ven Ventas. */
export async function notifySaleAlarm(
  db: Db,
  args: { kind: 'despachar' | 'reclamo'; saleId: string; accountId: string; title: string; body: string; key: string; now?: Date },
): Promise<number> {
  const account = await db.account.findUnique({ where: { id: args.accountId }, select: { slug: true } });
  if (!account) return 0;
  return notify(db, {
    userIds: await accountPeople(db, args.accountId, 'ventas'),
    accountId: args.accountId,
    kind: args.kind,
    title: args.title,
    body: args.body,
    link: `/a/${account.slug}/ventas/${args.saleId}`,
    key: args.key,
    now: args.now,
  });
}

// ───────────────────────────── Preguntas ─────────────────────────────

export const questionKey = (questionId: string) => `pregunta:${questionId}`;

/**
 * Las preguntas que esperan a una persona: las de las publicaciones en que el
 * bot no responde solo, y las que el bot dejó para una persona. Las que el bot
 * todavía va a responder no avisan.
 */
export async function notifyPendingQuestions(db: Db, opts: { now?: Date; externalId?: string } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const qs = await db.buyerQuestion.findMany({
    where: {
      status: 'UNANSWERED',
      text: { not: '' },
      askedAt: { gte: new Date(now.getTime() - RECENT_MS) },
      ...(opts.externalId ? { externalId: opts.externalId } : {}),
      OR: [
        { publication: { is: null } },
        { publication: { is: { autoAnswer: false } } },
        { draft: { is: { needsPerson: true } } },
      ],
    },
    orderBy: { askedAt: 'asc' },
    take: 100,
    select: {
      id: true,
      text: true,
      store: { select: { accountId: true, account: { select: { slug: true } } } },
      publication: { select: { title: true, externalId: true } },
    },
  });
  const sent = await alreadySent(db, qs.map((q) => questionKey(q.id)));
  const people = new Map<string, string[]>();
  let n = 0;
  for (const q of qs) {
    if (sent.has(questionKey(q.id))) continue;
    const accountId = q.store.accountId;
    if (!people.has(accountId)) people.set(accountId, await accountPeople(db, accountId, 'preguntas'));
    const where = q.publication ? titleOrUntitled(q.publication.title) : 'una publicación';
    n += await notify(db, {
      userIds: people.get(accountId)!,
      accountId,
      kind: 'pregunta',
      title: `Pregunta en ${where}`,
      body: q.text,
      link: `/a/${q.store.account.slug}/preguntas`,
      key: questionKey(q.id),
      now,
    });
  }
  return n;
}

// ───────────────────────────── Conexión ─────────────────────────────

/** El canal no aceptó la conexión de una tienda. Una vez por día por tienda. */
export async function notifyConnectionCut(db: Db, storeId: string, now = new Date()): Promise<number> {
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { name: true, accountId: true, account: { select: { slug: true, timezone: true } }, channel: { select: { name: true } } },
  });
  if (!store) return 0;
  return notify(db, {
    userIds: await accountPeople(db, store.accountId, 'conexion'),
    accountId: store.accountId,
    kind: 'conexion',
    title: `Se cortó la conexión de ${store.name} con ${store.channel.name}`,
    body: 'Hasta que se vuelva a conectar, la app no lee ventas ni preguntas de esa tienda, ni sube cambios.',
    link: `/a/${store.account.slug}/conexion`,
    key: `conexion:${storeId}:${dayIn(now, store.account.timezone)}`,
    now,
  });
}

// ───────────────────────────── Fotos ─────────────────────────────

/** La Mac terminó con las fotos de un producto: no le queda ninguna en cola. */
export async function notifyPhotosDone(db: Db, args: { productId: string; runId: string; now?: Date }): Promise<number> {
  const busy = await db.photoStepRun.count({ where: { edit: { productId: args.productId }, status: { in: ['QUEUED', 'PROCESSING'] } } });
  if (busy > 0) return 0;
  const product = await db.product.findUnique({
    where: { id: args.productId },
    select: { name: true, accountId: true, account: { select: { slug: true } }, publications: { take: 1, orderBy: { createdAt: 'asc' }, select: { id: true } } },
  });
  if (!product) return 0;
  const review = await db.photoStepRun.count({ where: { edit: { productId: args.productId }, status: 'REVIEW' } });
  const pub = product.publications[0];
  return notify(db, {
    userIds: await accountPeople(db, product.accountId, 'pipeline'),
    accountId: product.accountId,
    kind: 'fotos',
    title: `Fotos corregidas: ${product.name}`,
    body: review > 0 ? `${plural(review, 'foto')} para revisar.` : 'Están listas.',
    link: pub ? `/a/${product.account.slug}/pipeline/${pub.id}` : `/a/${product.account.slug}/productos/${args.productId}`,
    key: `fotos:${args.productId}:${args.runId}`,
    now: args.now,
  });
}

// ───────────────────────────── Resumen del día ─────────────────────────────

// A esta hora de la cuenta sale el resumen.
const SUMMARY_MINUTE = 9 * 60;

type SummaryLine = { section: Section; text: string };

/** Lo que va en el resumen de una cuenta. Vacío si no hay nada. */
export async function summaryLines(db: Db, accountId: string): Promise<SummaryLine[]> {
  // Se importa acá: ese módulo abre la base de la app al cargarse.
  const { listToPush } = await import('@/lib/queries/sync');
  const [stock, paused, sync, toPush] = await Promise.all([
    outOfStockCount(db, accountId),
    db.publication.count({ where: { product: { accountId }, channelStatus: 'PAUSED' } }),
    syncBadgeCount(db, accountId),
    listToPush(accountId, db).then((r) => r.length),
  ]);
  const lines: SummaryLine[] = [];
  if (stock > 0) lines.push({ section: 'alarmas', text: `${plural(stock, 'medida')} sin stock para reponer` });
  if (paused > 0) lines.push({ section: 'publicaciones', text: `${plural(paused, 'publicación pausada', 'publicaciones pausadas')}` });
  if (toPush > 0) lines.push({ section: 'subir', text: `${plural(toPush, 'publicación', 'publicaciones')} con cambios en Por subir` });
  if (sync > 0) lines.push({ section: 'sincronizacion', text: `${plural(sync, 'dato')} para elegir en Sincronización` });
  return lines;
}

/**
 * En la tarea de cada hora: a partir de las 9 de cada cuenta, el resumen del
 * día a cada persona, con lo que ella puede ver. Sale una vez por día.
 */
export async function dailySummaryPass(db: Db, opts: { now?: Date; budgetMs?: number } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const started = Date.now();
  const accounts = await db.account.findMany({ select: { id: true, slug: true, name: true, timezone: true } });
  let n = 0;
  for (const a of accounts) {
    if (opts.budgetMs !== undefined && Date.now() - started > opts.budgetMs) break;
    if (minutesIn(now, a.timezone) < SUMMARY_MINUTE) continue;
    const key = `resumen:${a.id}:${dayIn(now, a.timezone)}`;
    if ((await alreadySent(db, [key])).size > 0) continue;
    const lines = await summaryLines(db, a.id);
    if (lines.length === 0) continue;
    const users = await db.user.findMany({
      where: { disabledAt: null, OR: [{ isAdmin: true }, { accounts: { some: { accountId: a.id } } }] },
      select: { id: true, isAdmin: true, permissions: true },
    });
    for (const u of users) {
      const access = { isAdmin: u.isAdmin, permissions: parsePermissions(u.permissions) };
      const mine = lines.filter((l) => can(access, l.section, 'read'));
      if (mine.length === 0) continue;
      n += await notify(db, {
        userIds: [u.id],
        accountId: a.id,
        kind: 'resumen',
        title: `Resumen de ${a.name}`,
        body: shortText(mine.map((l) => l.text).join(' · '), 400),
        link: `/a/${a.slug}`,
        key,
        now,
      });
    }
  }
  return n;
}
