import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { titleOrUntitled } from '@/domain/publication-title';
import { dayIn, dueDate, dueDay, OPEN_STATUSES } from '@/domain/tasks';
import { taskMail, type TaskMailKind } from '@/domain/task-mail';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { publicAppUrl } from '@/lib/public-url';
import { publicationLabel } from '@/lib/tasks';

// Cuándo sale cada mail de las tareas: al asignarla, al llegar la fecha de
// aviso y al vencer sin terminar. Cada uno sale una vez; lo que no pudo salir
// se vuelve a probar en la próxima pasada. Recibe la base por parámetro para
// poder probarlo.

type Db = PrismaClient;

// Lo que pasó hace más de esto ya no se manda: un aviso viejo no sirve, y así
// al conectar Resend no llegan de golpe los de antes.
const LATE_MS = 2 * 24 * 3600_000;
// Lo más que mira cada pasada de cada tipo.
const BATCH = 50;

const MAIL_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  remindAt: true,
  dueOn: true,
  account: { select: { slug: true, name: true, timezone: true } },
  assignees: { orderBy: { createdAt: 'asc' }, select: { userId: true, user: { select: { name: true, email: true, disabledAt: true } } } },
  publications: { select: { publication: { select: { title: true, externalId: true } } } },
} satisfies Prisma.TaskSelect;

type MailTask = Prisma.TaskGetPayload<{ select: typeof MAIL_SELECT }>;

function mailFor(kind: TaskMailKind, t: MailTask, person: { name: string; email: string }, baseUrl: string) {
  return taskMail({
    kind,
    person: person.name,
    account: t.account.name,
    title: t.title,
    description: t.description,
    status: t.status,
    remindAt: t.remindAt,
    dueOn: t.dueOn,
    people: t.assignees.map((a) => a.user.name),
    publications: t.publications.map((p) => publicationLabel({ title: titleOrUntitled(p.publication.title), externalId: p.publication.externalId })),
    link: `${baseUrl}/a/${t.account.slug}/tareas/${t.id}`,
    timeZone: t.account.timezone,
  });
}

/** A las personas activas de la tarea. True si salió a todas. */
async function sendToAll(kind: TaskMailKind, t: MailTask, stamp: string, baseUrl: string): Promise<{ all: boolean; sent: number }> {
  let sent = 0;
  let all = true;
  for (const a of t.assignees) {
    if (a.user.disabledAt) continue;
    const r = await sendEmail({ to: a.user.email, ...mailFor(kind, t, a.user, baseUrl), key: `tarea-${t.id}-${kind}-${a.userId}-${stamp}` });
    if (r.ok) sent++;
    else {
      all = false;
      console.warn(`[tareas] no salió un mail: ${r.error}`);
    }
  }
  return { all, sent };
}

/**
 * Vuelve a avisar ya a las personas de una tarea abierta, por ejemplo cuando
 * cambió una alarma de stock. stamp: qué cambió, para no mandar dos veces lo mismo.
 */
export async function notifyTaskAgain(db: Db, taskId: string, stamp: string, baseUrl: string = publicAppUrl()): Promise<number> {
  if (!isEmailConfigured()) return 0;
  const t = await db.task.findUnique({ where: { id: taskId }, select: MAIL_SELECT });
  if (!t || !OPEN_STATUSES.includes(t.status)) return 0;
  return (await sendToAll('REMINDER', t, stamp, baseUrl)).sent;
}

export type TaskMailResult = { configured: boolean; sent: number; pending: boolean };

/** El mail de que se la asignaron, a las personas de una tarea que todavía no lo recibieron. */
export async function notifyAssigned(db: Db, taskId: string, baseUrl: string = publicAppUrl()): Promise<number> {
  if (!isEmailConfigured()) return 0;
  const rows = await db.taskAssignee.findMany({
    where: { taskId, notifiedAt: null, user: { disabledAt: null }, task: { status: { in: [...OPEN_STATUSES] } } },
    select: { userId: true, createdAt: true, user: { select: { name: true, email: true } }, task: { select: MAIL_SELECT } },
  });
  let sent = 0;
  for (const r of rows) {
    const out = await sendEmail({
      to: r.user.email,
      ...mailFor('ASSIGNED', r.task, r.user, baseUrl),
      key: `tarea-${taskId}-ASSIGNED-${r.userId}-${r.createdAt.getTime()}`,
    });
    if (!out.ok) {
      console.warn(`[tareas] no salió un mail: ${out.error}`);
      continue;
    }
    await db.taskAssignee.updateMany({ where: { taskId, userId: r.userId }, data: { notifiedAt: new Date() } });
    sent++;
  }
  return sent;
}

/**
 * La pasada de la tarea programada: los mails de asignación que no salieron,
 * los avisos que llegaron y las tareas que vencieron. Corta cuando se le acaba
 * el tiempo; pending dice si quedó algo.
 */
export async function sendTaskMail(db: Db, opts: { budgetMs: number; now?: Date; baseUrl?: string }): Promise<TaskMailResult> {
  if (!isEmailConfigured()) return { configured: false, sent: 0, pending: false };
  const started = Date.now();
  const now = opts.now ?? new Date();
  const baseUrl = opts.baseUrl ?? publicAppUrl();
  const late = new Date(now.getTime() - LATE_MS);
  const outOfTime = () => Date.now() - started > opts.budgetMs;
  const open = { status: { in: [...OPEN_STATUSES] } };
  let sent = 0;
  let pending = false;

  // Las asignaciones que no salieron al crear o editar la tarea.
  const assigned = await db.taskAssignee.findMany({
    where: { notifiedAt: null, createdAt: { gte: late }, user: { disabledAt: null }, task: open },
    orderBy: { createdAt: 'asc' },
    take: BATCH + 1,
    select: { taskId: true },
  });
  for (const taskId of new Set(assigned.slice(0, BATCH).map((a) => a.taskId))) {
    if (outOfTime()) return { configured: true, sent, pending: true };
    sent += await notifyAssigned(db, taskId, baseUrl);
  }
  pending ||= assigned.length > BATCH;

  // Los avisos que llegaron.
  const reminders = await db.task.findMany({
    where: { ...open, remindedAt: null, remindAt: { lte: now, gte: late } },
    orderBy: { remindAt: 'asc' },
    take: BATCH + 1,
    select: MAIL_SELECT,
  });
  for (const t of reminders.slice(0, BATCH)) {
    if (outOfTime()) return { configured: true, sent, pending: true };
    const r = await sendToAll('REMINDER', t, String(t.remindAt!.getTime()), baseUrl);
    sent += r.sent;
    if (r.all) await db.task.update({ where: { id: t.id }, data: { remindedAt: new Date() } });
  }
  pending ||= reminders.length > BATCH;

  // Las que vencieron: pasó su día en la zona horaria de la cuenta. La base no
  // sabe la zona de cada cuenta: trae las de hasta hoy en UTC y se mira acá.
  const overdue = await db.task.findMany({
    where: { ...open, overdueNotifiedAt: null, dueOn: { lte: dueDate(dayIn(now, 'UTC'))!, gte: dueDate(dayIn(late, 'UTC'))! } },
    orderBy: { dueOn: 'asc' },
    take: BATCH + 1,
    select: MAIL_SELECT,
  });
  for (const t of overdue.slice(0, BATCH)) {
    if (dueDay(t.dueOn!) >= dayIn(now, t.account.timezone)) continue;
    if (outOfTime()) return { configured: true, sent, pending: true };
    const r = await sendToAll('OVERDUE', t, dueDay(t.dueOn!), baseUrl);
    sent += r.sent;
    if (r.all) await db.task.update({ where: { id: t.id }, data: { overdueNotifiedAt: new Date() } });
  }
  pending ||= overdue.length > BATCH;

  return { configured: true, sent, pending };
}
