import type { PrismaClient } from '@/generated/prisma/client';
import { dueDate, dayIn, OPEN_STATUSES, TASK_TITLE_MAX } from '@/domain/tasks';
import { formatDateTime } from '@/lib/format';
import { notifyAssigned } from '@/lib/task-mail';
import { parseLines } from './read';

// Las tareas que crea la sección Ventas sola, para los administradores: un
// envío que hay que despachar antes de que venza la hora límite, y un reclamo
// del comprador. No se repite una abierta, y se cierran solas cuando el envío
// salió o el reclamo terminó. Solo de las ventas recientes: las que vienen del
// historial no avisan. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

// Se avisa cuando falta esto o menos para la hora límite de despacho.
export const DISPATCH_WARNING_MS = 24 * 3600_000;
// Solo de las ventas de estos últimos días.
const RECENT_MS = 30 * 86_400_000;

export const dispatchKey = (saleId: string) => `despachar:${saleId}`;
export const claimKey = (saleId: string) => `reclamo:${saleId}`;

const SELECT = {
  id: true,
  orderId: true,
  state: true,
  claim: true,
  shipState: true,
  shipKind: true,
  dispatchBy: true,
  orderedAt: true,
  lines: true,
  buyerNickname: true,
  store: { select: { accountId: true, account: { select: { timezone: true } } } },
} as const;

/** Lo que se vendió, en pocas palabras: "Subconjunto SP-900 y 1 más". */
function what(lines: unknown): string {
  const l = parseLines(lines);
  const first = l[0]?.title ?? 'la venta';
  return l.length > 1 ? `${first} y ${l.length - 1} más` : first;
}

async function openTask(
  db: Db,
  args: { accountId: string; autoKey: string; title: string; description: string; dueOn: Date | null; publicationIds: string[]; now: Date },
): Promise<string | null> {
  const open = await db.task.findFirst({ where: { accountId: args.accountId, autoKey: args.autoKey, status: { in: [...OPEN_STATUSES] } }, select: { id: true } });
  if (open) return null;
  // Ya se avisó y alguien la cerró: no se vuelve a abrir.
  const done = await db.task.findFirst({ where: { accountId: args.accountId, autoKey: args.autoKey }, select: { id: true } });
  if (done) return null;
  const admins = await db.user.findMany({ where: { isAdmin: true, disabledAt: null }, select: { id: true } });
  if (admins.length === 0) return null;
  const pubs = await db.publication.findMany({ where: { id: { in: args.publicationIds } }, select: { id: true } });
  const task = await db.task.create({
    data: {
      accountId: args.accountId,
      title: args.title.slice(0, TASK_TITLE_MAX),
      description: args.description,
      dueOn: args.dueOn,
      remindAt: args.now,
      remindedAt: args.now,
      autoKey: args.autoKey,
      assignees: { create: admins.map((a) => ({ userId: a.id })) },
      publications: { create: pubs.map((p) => ({ publicationId: p.id })) },
    },
    select: { id: true },
  });
  await notifyAssigned(db, task.id).catch((e) => console.error('No salió el mail de la tarea de la venta', e instanceof Error ? e.message : e));
  return task.id;
}

/**
 * En la tarea de cada hora: abre las tareas de despachar y de reclamos que
 * hacen falta, y cierra las que ya no. Devuelve cuántas abrió y cerró.
 */
export async function saleAlarmPass(db: Db, opts: { now?: Date; accountId?: string } = {}): Promise<{ opened: number; closed: number }> {
  const now = opts.now ?? new Date();
  const scope = opts.accountId ? { store: { accountId: opts.accountId } } : {};
  let opened = 0;
  // Las que hay que despachar pronto o ya vencieron.
  const due = await db.sale.findMany({
    where: {
      ...scope,
      state: 'PAID',
      shipState: 'TO_SHIP',
      NOT: { shipKind: 'channel' },
      orderedAt: { gte: new Date(now.getTime() - RECENT_MS) },
      dispatchBy: { not: null, lte: new Date(now.getTime() + DISPATCH_WARNING_MS) },
    },
    select: SELECT,
  });
  for (const s of due) {
    const tz = s.store.account.timezone;
    const id = await openTask(db, {
      accountId: s.store.accountId,
      autoKey: dispatchKey(s.id),
      title: `Despachar la venta ${s.orderId}: ${what(s.lines)}`,
      description: `Hay que despacharla antes del ${formatDateTime(s.dispatchBy!, tz)}${s.buyerNickname ? `. Comprador: ${s.buyerNickname}` : ''}. La tarea se cierra sola cuando el envío sale.`,
      dueOn: dueDate(dayIn(s.dispatchBy!, tz)),
      publicationIds: parseLines(s.lines).flatMap((l) => (l.publicationId ? [l.publicationId] : [])),
      now,
    });
    if (id) opened++;
  }
  // Los reclamos abiertos de las ventas recientes.
  const claims = await db.sale.findMany({ where: { ...scope, claim: true, orderedAt: { gte: new Date(now.getTime() - RECENT_MS) } }, select: SELECT });
  for (const s of claims) {
    const id = await openTask(db, {
      accountId: s.store.accountId,
      autoKey: claimKey(s.id),
      title: `Reclamo en la venta ${s.orderId}: ${what(s.lines)}`,
      description: `El comprador${s.buyerNickname ? ` ${s.buyerNickname}` : ''} abrió un reclamo. Respondelo desde el canal: mientras siga abierto, la plata de la venta queda retenida. La tarea se cierra sola cuando el reclamo termina.`,
      dueOn: null,
      publicationIds: parseLines(s.lines).flatMap((l) => (l.publicationId ? [l.publicationId] : [])),
      now,
    });
    if (id) opened++;
  }
  // Las que ya no hacen falta: el envío salió o se canceló, o el reclamo terminó.
  const open = await db.task.findMany({
    where: { ...(opts.accountId ? { accountId: opts.accountId } : {}), status: { in: [...OPEN_STATUSES] }, OR: [{ autoKey: { startsWith: 'despachar:' } }, { autoKey: { startsWith: 'reclamo:' } }] },
    select: { id: true, autoKey: true },
  });
  const ids = open.map((t) => t.autoKey!.split(':')[1]);
  const sales = new Map((await db.sale.findMany({ where: { id: { in: ids } }, select: { id: true, state: true, shipState: true, claim: true } })).map((s) => [s.id, s]));
  const settled = open.filter((t) => {
    const [kind, id] = t.autoKey!.split(':');
    const s = sales.get(id);
    if (!s) return true;
    return kind === 'despachar' ? s.state === 'CANCELLED' || s.shipState !== 'TO_SHIP' : !s.claim;
  });
  if (settled.length > 0) await db.task.updateMany({ where: { id: { in: settled.map((t) => t.id) } }, data: { status: 'DONE', doneAt: now } });
  return { opened, closed: settled.length };
}
