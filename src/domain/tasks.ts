import { z } from 'zod';
import type { TaskStatus } from '@/generated/prisma/enums';
import { can, type Access } from './access';
import { offsetMs } from './sync-log';

// Las tareas del equipo: estados, fechas, quién puede qué y los filtros de la
// pantalla. Sin la base de datos, para poder probarlo solo.

export class TaskError extends Error {}

export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE', 'SUSPENDED'] as const satisfies readonly TaskStatus[];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En proceso',
  DONE: 'Finalizada',
  SUSPENDED: 'Suspendida',
};

// Las que todavía hay que hacer: avisan y vencen.
export const OPEN_STATUSES: readonly TaskStatus[] = ['PENDING', 'IN_PROGRESS'];

export const isOpen = (status: TaskStatus) => OPEN_STATUSES.includes(status);

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

export const TASK_TITLE_MAX = 200;
export const TASK_DESCRIPTION_MAX = 5000;
export const TASK_MAX_PEOPLE = 20;
export const TASK_MAX_PUBLICATIONS = 50;

// ───────────────────────────── Quién puede qué ─────────────────────────────

export type TaskRights = {
  // Verla.
  see: boolean;
  // Cambiar el título, las fechas, las personas y las publicaciones, o borrarla.
  edit: boolean;
  // Cambiarle el estado.
  move: boolean;
};

/**
 * Cada persona ve y mueve las tareas que tiene asignadas, aunque no tenga el
 * permiso de Tareas. Con el permiso de ver, ve todas; con el de cambiar, además
 * las crea y las edita.
 */
export function taskRights(access: Pick<Access, 'isAdmin' | 'permissions'>, userId: string, assigneeIds: readonly string[]): TaskRights {
  const mine = assigneeIds.includes(userId);
  const edit = can(access, 'tareas', 'write');
  return { see: mine || can(access, 'tareas', 'read'), edit, move: edit || mine };
}

// ───────────────────────────── Fechas ─────────────────────────────

function partsIn(date: Date, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** El día de ese momento en la zona horaria: "2026-10-27". */
export function dayIn(date: Date, timeZone: string): string {
  return partsIn(date, timeZone).day;
}

/** Para el campo de fecha y hora: "2026-10-27T09:00", en la zona horaria. */
export function toLocalInput(date: Date | null, timeZone: string): string {
  if (!date) return '';
  const p = partsIn(date, timeZone);
  return `${p.day}T${p.time}`;
}

/** Una fecha y hora escrita en la zona horaria, como "2026-10-27T09:00". Null si no es válida. */
export function localTimeIn(local: string, timeZone: string): Date | null {
  const m = local.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(guess);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
  // Dos vueltas por si ese día cambia la hora.
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** La fecha de finalización como se guarda: el día, sin hora. Null si no es válida. */
export function dueDate(day: string): Date | null {
  const m = day.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return date.getUTCMonth() === +m[2] - 1 && date.getUTCDate() === +m[3] ? date : null;
}

/** El día de la fecha de finalización: "2026-10-27". */
export const dueDay = (dueOn: Date) => dueOn.toISOString().slice(0, 10);

/** "27/10/2026". */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

type Dated = { status: TaskStatus; remindAt: Date | null; dueOn: Date | null };

export type TaskFlags = {
  // Pasó el día de finalización y sigue abierta.
  overdue: boolean;
  // Vence hoy.
  dueToday: boolean;
  // Llegó la fecha de aviso y sigue abierta.
  reminding: boolean;
};

export function taskFlags(t: Dated, now: Date, timeZone: string): TaskFlags {
  if (!isOpen(t.status)) return { overdue: false, dueToday: false, reminding: false };
  const today = dayIn(now, timeZone);
  const due = t.dueOn ? dueDay(t.dueOn) : null;
  return {
    overdue: due !== null && due < today,
    dueToday: due === today,
    reminding: t.remindAt !== null && t.remindAt.getTime() <= now.getTime(),
  };
}

/** Si pide atención: ya llegó su aviso o está vencida. Es lo que cuenta el menú. */
export const needsAttention = (f: TaskFlags) => f.overdue || f.reminding;

/** "Venció hace 3 días", "Vence hoy", "Vence mañana", "Vence el 12/11/2026". */
export function dueText(t: Dated, now: Date, timeZone: string): string | null {
  if (!t.dueOn) return null;
  const due = dueDay(t.dueOn);
  if (!isOpen(t.status)) return `Finalización ${formatDay(due)}`;
  const today = dayIn(now, timeZone);
  if (due === today) return 'Vence hoy';
  if (due === addDays(today, 1)) return 'Vence mañana';
  if (due === addDays(today, -1)) return 'Venció ayer';
  if (due < today) {
    const days = Math.round((Date.parse(today) - Date.parse(due)) / 86_400_000);
    return `Venció hace ${days} días`;
  }
  return `Vence el ${formatDay(due)}`;
}

/** "Aviso 27/10/2026 09:00". */
export function remindText(remindAt: Date | null, timeZone: string): string | null {
  if (!remindAt) return null;
  const p = partsIn(remindAt, timeZone);
  return `Aviso ${formatDay(p.day)} ${p.time}`;
}

/** Primero las que piden atención, después las que vencen antes, y las nuevas arriba. */
export function compareTasks<T extends Dated & { createdAt: Date }>(now: Date, timeZone: string) {
  const rank = (t: T) => {
    const f = taskFlags(t, now, timeZone);
    return f.overdue ? 0 : f.reminding ? 1 : f.dueToday ? 2 : isOpen(t.status) ? 3 : 4;
  };
  return (a: T, b: T) =>
    rank(a) - rank(b) ||
    (a.dueOn?.getTime() ?? Infinity) - (b.dueOn?.getTime() ?? Infinity) ||
    b.createdAt.getTime() - a.createdAt.getTime();
}

// ───────────────────────────── Lo que se escribe ─────────────────────────────

const ids = (max: number, tooMany: string) =>
  z
    .array(z.string().trim().min(1).max(40))
    .max(max, tooMany)
    .transform((list) => [...new Set(list)]);

const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Poné qué hay que hacer.')
    .max(TASK_TITLE_MAX, `El título puede tener hasta ${TASK_TITLE_MAX} caracteres.`),
  description: z
    .string()
    .max(TASK_DESCRIPTION_MAX, `La descripción puede tener hasta ${TASK_DESCRIPTION_MAX.toLocaleString('es-AR')} caracteres.`)
    .transform((v) => v.trim()),
  // "2026-10-27T09:00" en la zona horaria de la cuenta, o vacío.
  remindAt: z.string().max(40),
  // "2026-10-27", o vacío.
  dueOn: z.string().max(20),
  assigneeIds: ids(TASK_MAX_PEOPLE, `Puede tener hasta ${TASK_MAX_PEOPLE} personas.`).refine((l) => l.length > 0, 'Elegí al menos una persona.'),
  publicationIds: ids(TASK_MAX_PUBLICATIONS, `Puede tener hasta ${TASK_MAX_PUBLICATIONS} publicaciones.`),
});

export type TaskInput = z.input<typeof taskSchema>;

export type CleanTask = {
  title: string;
  description: string;
  remindAt: Date | null;
  dueOn: Date | null;
  assigneeIds: string[];
  publicationIds: string[];
};

/** Lo que llega del formulario o de Claude, limpio. Si algo está mal, TaskError con el motivo. */
export function parseTaskInput(raw: unknown, timeZone: string): CleanTask {
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) throw new TaskError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
  const { remindAt: remindRaw, dueOn: dueRaw, ...rest } = parsed.data;
  const remindAt = remindRaw.trim() ? localTimeIn(remindRaw, timeZone) : null;
  if (remindRaw.trim() && !remindAt) throw new TaskError('La fecha de aviso no es válida.');
  const dueOn = dueRaw.trim() ? dueDate(dueRaw) : null;
  if (dueRaw.trim() && !dueOn) throw new TaskError('La fecha de finalización no es válida.');
  return { ...rest, remindAt, dueOn };
}

// ───────────────────────────── Filtros de la pantalla ─────────────────────────────

export const TASK_VIEWS = [
  { value: 'abiertas', label: 'Abiertas', statuses: OPEN_STATUSES },
  { value: 'finalizadas', label: 'Finalizadas', statuses: ['DONE'] },
  { value: 'suspendidas', label: 'Suspendidas', statuses: ['SUSPENDED'] },
  { value: 'todas', label: 'Todas', statuses: TASK_STATUSES },
] as const satisfies readonly { value: string; label: string; statuses: readonly TaskStatus[] }[];

export type TaskView = (typeof TASK_VIEWS)[number]['value'];

export type TaskSearch = { ver?: string; persona?: string; mias?: string; q?: string };

const list = (raw: string | undefined) => (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export function parseTaskSearch(search: TaskSearch) {
  const view = TASK_VIEWS.find((v) => v.value === search.ver) ?? TASK_VIEWS[0];
  return {
    view: view.value as TaskView,
    statuses: [...view.statuses] as TaskStatus[],
    people: list(search.persona).filter((s) => /^[\w-]{1,40}$/.test(s)).slice(0, 50),
    mine: search.mias === '1',
    q: (search.q ?? '').trim().slice(0, 100),
  };
}

export type TaskFilters = ReturnType<typeof parseTaskSearch>;
