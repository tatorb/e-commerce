import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { TaskStatus } from '@/generated/prisma/enums';
import { can, type Access } from '@/domain/access';
import { titleOrUntitled } from '@/domain/publication-title';
import {
  compareTasks,
  dayIn,
  dueDate,
  OPEN_STATUSES,
  TASK_VIEWS,
  TaskError,
  taskRights,
  type CleanTask,
  type TaskFilters,
  type TaskView,
} from '@/domain/tasks';

// Las tareas de una cuenta: crearlas, editarlas, moverlas y leerlas para cada
// persona. Los mails salen de src/lib/task-mail.ts. Recibe la base por
// parámetro para poder probarlo.

type Db = PrismaClient;

/** Quién mira: cada uno ve lo que le dejan sus permisos y sus tareas. */
export type Viewer = { id: string; access: Pick<Access, 'isAdmin' | 'permissions'> };

// Lo más que trae una lista de una vez.
const LIST_MAX = 300;

const TASK_SELECT = {
  id: true,
  accountId: true,
  title: true,
  description: true,
  status: true,
  remindAt: true,
  dueOn: true,
  doneAt: true,
  createdAt: true,
  createdBy: { select: { name: true } },
  assignees: { orderBy: { createdAt: 'asc' }, select: { user: { select: { id: true, name: true, email: true, disabledAt: true } } } },
  publications: { select: { publication: { select: { id: true, title: true, externalId: true } } } },
} satisfies Prisma.TaskSelect;

type TaskRecord = Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>;

function shape(t: TaskRecord, viewer: Viewer) {
  const people = t.assignees.map((a) => ({ id: a.user.id, name: a.user.name, email: a.user.email, disabled: a.user.disabledAt !== null }));
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    remindAt: t.remindAt,
    dueOn: t.dueOn,
    doneAt: t.doneAt,
    createdAt: t.createdAt,
    createdBy: t.createdBy?.name ?? null,
    people,
    publications: t.publications
      .map((p) => ({ id: p.publication.id, title: titleOrUntitled(p.publication.title), externalId: p.publication.externalId }))
      .sort((a, b) => a.title.localeCompare(b.title, 'es')),
    rights: taskRights(viewer.access, viewer.id, people.map((p) => p.id)),
  };
}

export type TaskItem = ReturnType<typeof shape>;

/** Las que ve: todas con el permiso de Tareas, si no las suyas. */
function visible(viewer: Viewer): Prisma.TaskWhereInput {
  return can(viewer.access, 'tareas', 'read') ? {} : { assignees: { some: { userId: viewer.id } } };
}

/** "Kit de embrague · MLA123", para avisos y mails. */
export const publicationLabel = (p: { title: string; externalId: string | null }) => `${p.title}${p.externalId ? ` · ${p.externalId}` : ''}`;

// ───────────────────────────── Leer ─────────────────────────────

/** Las tareas de la pantalla Tareas, con cuántas hay en cada vista. */
export async function listTasks(db: Db, args: { accountId: string; viewer: Viewer; filters: TaskFilters; timeZone: string; now?: Date }) {
  const { filters: f, viewer } = args;
  const now = args.now ?? new Date();
  const q = f.q
    ? {
        OR: [
          { title: { contains: f.q, mode: 'insensitive' as const } },
          { description: { contains: f.q, mode: 'insensitive' as const } },
          {
            publications: {
              some: {
                publication: {
                  OR: [{ title: { contains: f.q, mode: 'insensitive' as const } }, { externalId: { contains: f.q, mode: 'insensitive' as const } }],
                },
              },
            },
          },
        ],
      }
    : {};
  const base: Prisma.TaskWhereInput = {
    AND: [
      { accountId: args.accountId },
      visible(viewer),
      f.mine ? { assignees: { some: { userId: viewer.id } } } : {},
      f.people.length ? { assignees: { some: { userId: { in: f.people } } } } : {},
      q,
    ],
  };
  const [rows, byStatus] = await Promise.all([
    db.task.findMany({ where: { AND: [base, { status: { in: f.statuses } }] }, take: LIST_MAX + 1, orderBy: { createdAt: 'desc' }, select: TASK_SELECT }),
    db.task.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
  ]);
  const count = (statuses: readonly TaskStatus[]) =>
    byStatus.filter((s) => statuses.includes(s.status)).reduce((sum, s) => sum + s._count._all, 0);
  const counts = Object.fromEntries(TASK_VIEWS.map((v) => [v.value, count(v.statuses)])) as Record<TaskView, number>;
  const tasks = rows.slice(0, LIST_MAX).map((t) => shape(t, viewer)).sort(compareTasks(now, args.timeZone));
  return { tasks, counts, truncated: rows.length > LIST_MAX };
}

/** Las tareas de una publicación que ve la persona: las abiertas primero. */
export async function tasksOfPublication(db: Db, args: { publicationId: string; viewer: Viewer; timeZone: string; now?: Date }) {
  const rows = await db.task.findMany({
    where: { AND: [{ publications: { some: { publicationId: args.publicationId } } }, visible(args.viewer)] },
    take: LIST_MAX,
    orderBy: { createdAt: 'desc' },
    select: TASK_SELECT,
  });
  return rows.map((t) => shape(t, args.viewer)).sort(compareTasks(args.now ?? new Date(), args.timeZone));
}

/** Una tarea, si la persona la ve. */
export async function getTask(db: Db, args: { accountId: string; taskId: string; viewer: Viewer }): Promise<TaskItem | null> {
  const t = await db.task.findFirst({ where: { AND: [{ id: args.taskId, accountId: args.accountId }, visible(args.viewer)] }, select: TASK_SELECT });
  return t ? shape(t, args.viewer) : null;
}

/** Cuántas tareas abiertas suyas ya llegaron al aviso o vencieron: el número del menú. */
export async function attentionCount(db: Db, args: { accountId: string; userId: string; timeZone: string; now?: Date }): Promise<number> {
  const now = args.now ?? new Date();
  return db.task.count({
    where: {
      accountId: args.accountId,
      status: { in: [...OPEN_STATUSES] },
      assignees: { some: { userId: args.userId } },
      OR: [{ remindAt: { lte: now } }, { dueOn: { lt: dueDate(dayIn(now, args.timeZone))! } }],
    },
  });
}

/** Cuántas tareas abiertas que ve la persona tiene cada publicación, para el tablero. */
export async function openTasksByPublication(db: Db, args: { publicationIds: string[]; viewer: Viewer }): Promise<Map<string, number>> {
  if (args.publicationIds.length === 0) return new Map();
  const rows = await db.taskPublication.findMany({
    where: { publicationId: { in: args.publicationIds }, task: { AND: [{ status: { in: [...OPEN_STATUSES] } }, visible(args.viewer)] } },
    select: { publicationId: true },
  });
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.publicationId, (out.get(r.publicationId) ?? 0) + 1);
  return out;
}

/** Las personas que se pueden asignar en la cuenta: las activas que la ven. */
export async function assignablePeople(db: Db, accountId: string) {
  return db.user.findMany({
    where: { disabledAt: null, OR: [{ isAdmin: true }, { accounts: { some: { accountId } } }] },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true },
  });
}

/** Publicaciones de la cuenta por título, código o producto, para sumarlas a una tarea. */
export async function searchTaskPublications(db: Db, args: { accountId: string; q: string }) {
  const q = args.q.trim().slice(0, 100);
  if (q.length < 2) return [];
  const rows = await db.publication.findMany({
    where: {
      product: { accountId: args.accountId },
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { externalId: { contains: q, mode: 'insensitive' } },
        { product: { name: { contains: q, mode: 'insensitive' } } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: { id: true, title: true, externalId: true },
  });
  return rows.map((p) => ({ id: p.id, title: titleOrUntitled(p.title), externalId: p.externalId }));
}

// ───────────────────────────── Cambiar ─────────────────────────────

/** Que las personas vean la cuenta y estén activas, y que las publicaciones sean de la cuenta. */
async function checkLinks(db: Db, accountId: string, input: Pick<CleanTask, 'assigneeIds' | 'publicationIds'>) {
  const [people, pubs] = await Promise.all([
    db.user.count({ where: { id: { in: input.assigneeIds }, disabledAt: null, OR: [{ isAdmin: true }, { accounts: { some: { accountId } } }] } }),
    db.publication.count({ where: { id: { in: input.publicationIds }, product: { accountId } } }),
  ]);
  if (people !== input.assigneeIds.length) throw new TaskError('Alguna de las personas no está activa o no ve esta cuenta.');
  if (pubs !== input.publicationIds.length) throw new TaskError('Alguna de las publicaciones no es de esta cuenta.');
}

/** Crea la tarea. Quien se la asigna a sí mismo no recibe el mail de que se la asignaron. */
export async function createTask(db: Db, args: { accountId: string; actorId: string; input: CleanTask; now?: Date }) {
  const { input } = args;
  await checkLinks(db, args.accountId, input);
  const now = args.now ?? new Date();
  return db.task.create({
    data: {
      accountId: args.accountId,
      title: input.title,
      description: input.description,
      remindAt: input.remindAt,
      dueOn: input.dueOn,
      createdById: args.actorId,
      assignees: { create: input.assigneeIds.map((userId) => ({ userId, notifiedAt: userId === args.actorId ? now : null })) },
      publications: { create: input.publicationIds.map((publicationId) => ({ publicationId })) },
    },
    select: { id: true, title: true },
  });
}

async function findTask(db: Db | Prisma.TransactionClient, accountId: string, taskId: string) {
  const t = await db.task.findFirst({
    where: { id: taskId, accountId },
    select: { id: true, title: true, status: true, remindAt: true, dueOn: true, doneAt: true, assignees: { select: { userId: true } } },
  });
  if (!t) throw new TaskError('La tarea ya no existe.');
  return t;
}

/** Lo que puede la persona con una tarea de la cuenta. */
export async function rightsOn(db: Db, args: { accountId: string; taskId: string; viewer: Viewer }) {
  const t = await findTask(db, args.accountId, args.taskId);
  return { task: t, rights: taskRights(args.viewer.access, args.viewer.id, t.assignees.map((a) => a.userId)) };
}

const sameTime = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

/**
 * Cambia todo lo de la tarea. Si cambia la fecha de aviso o la de
 * finalización, su mail vuelve a salir; las personas nuevas reciben el de que
 * se la asignaron.
 */
export async function updateTask(db: Db, args: { accountId: string; taskId: string; actorId: string; input: CleanTask; now?: Date }) {
  const { input } = args;
  const before = await findTask(db, args.accountId, args.taskId);
  await checkLinks(db, args.accountId, input);
  const now = args.now ?? new Date();
  const had = new Set(before.assignees.map((a) => a.userId));
  const added = input.assigneeIds.filter((id) => !had.has(id));
  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: before.id },
      data: {
        title: input.title,
        description: input.description,
        remindAt: input.remindAt,
        dueOn: input.dueOn,
        ...(sameTime(before.remindAt, input.remindAt) ? {} : { remindedAt: null }),
        ...(sameTime(before.dueOn, input.dueOn) ? {} : { overdueNotifiedAt: null }),
      },
    });
    await tx.taskAssignee.deleteMany({ where: { taskId: before.id, userId: { notIn: input.assigneeIds } } });
    await tx.taskAssignee.createMany({ data: added.map((userId) => ({ taskId: before.id, userId, notifiedAt: userId === args.actorId ? now : null })) });
    await tx.taskPublication.deleteMany({ where: { taskId: before.id, publicationId: { notIn: input.publicationIds } } });
    await tx.taskPublication.createMany({ data: input.publicationIds.map((publicationId) => ({ taskId: before.id, publicationId })), skipDuplicates: true });
  });
  return { id: before.id, title: input.title, added };
}

/** Pasa la tarea a otro estado. */
export async function setTaskStatus(db: Db, args: { accountId: string; taskId: string; status: TaskStatus; now?: Date }) {
  const before = await findTask(db, args.accountId, args.taskId);
  if (before.status === args.status) return { id: before.id, title: before.title, changed: false };
  await db.task.update({
    where: { id: before.id },
    data: { status: args.status, doneAt: args.status === 'DONE' ? (args.now ?? new Date()) : null },
  });
  return { id: before.id, title: before.title, changed: true };
}

export async function deleteTask(db: Db, args: { accountId: string; taskId: string }) {
  const before = await findTask(db, args.accountId, args.taskId);
  await db.task.delete({ where: { id: before.id } });
  return { title: before.title };
}
