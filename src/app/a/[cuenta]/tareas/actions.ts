'use server';

import { after } from 'next/server';
import { prisma } from '@/lib/db';
import { act } from '@/lib/auth/guard';
import { isTaskStatus, parseTaskInput, TASK_STATUS_LABEL, TaskError, type TaskInput } from '@/domain/tasks';
import type { TaskStatus } from '@/generated/prisma/enums';
import { createTask, deleteTask, rightsOn, searchTaskPublications, setTaskStatus, updateTask } from '@/lib/tasks';
import { notifyAssigned } from '@/lib/task-mail';

// Crear, editar, mover y borrar tareas. Cada persona mueve las suyas aunque no
// tenga el permiso de Tareas; lo demás lo pide.

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type Created = Result<{ id: string; title: string }>;
type Named = Result<{ title: string }>;

async function guarded<T extends object>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await run()) };
  } catch (e) {
    if (e instanceof TaskError) return { ok: false, error: e.message };
    throw e;
  }
}

// La publicación de la actividad, cuando la tarea es de una sola.
const onePublication = (input: TaskInput | undefined) =>
  Array.isArray(input?.publicationIds) && input.publicationIds.length === 1 ? String(input.publicationIds[0]) : null;

// Sobre qué, en la actividad: el título de la tarea.
const titleOf = (r: Named) => (r.ok ? r.title : null);

/** Después de responder, el mail a las personas nuevas. */
function mailLater(taskId: string) {
  after(() => notifyAssigned(prisma, taskId).catch(() => console.warn('[tareas] no salieron los mails de asignación')));
}

export async function createTaskAction(accountSlug: string, input: TaskInput) {
  const spec = { section: 'tareas', does: 'Creó una tarea', publicationId: onePublication(input), targetOf: titleOf } as const;
  return act<Created>(accountSlug, spec, async ({ user, account }) =>
    guarded(async () => {
      const task = await createTask(prisma, { accountId: account.id, actorId: user.id, input: parseTaskInput(input, account.timezone) });
      mailLater(task.id);
      return task;
    }),
  );
}

export async function updateTaskAction(accountSlug: string, taskId: string, input: TaskInput) {
  const spec = { section: 'tareas', does: 'Editó una tarea', publicationId: onePublication(input), targetOf: titleOf } as const;
  return act<Named>(accountSlug, spec, async ({ user, account }) =>
    guarded(async () => {
      const clean = parseTaskInput(input, account.timezone);
      const r = await updateTask(prisma, { accountId: account.id, taskId: String(taskId), actorId: user.id, input: clean });
      if (r.added.length > 0) mailLater(r.id);
      return { title: r.title };
    }),
  );
}

export async function setTaskStatusAction(accountSlug: string, taskId: string, status: TaskStatus) {
  const does = isTaskStatus(status) ? `Pasó una tarea a ${TASK_STATUS_LABEL[status].toLowerCase()}` : undefined;
  return act<Named>(accountSlug, { section: 'tareas', own: true, does, targetOf: titleOf }, async ({ user, account }) =>
    guarded(async () => {
      if (!isTaskStatus(status)) throw new TaskError('Ese estado no existe.');
      const { rights } = await rightsOn(prisma, { accountId: account.id, taskId: String(taskId), viewer: user });
      if (!rights.see) throw new TaskError('La tarea ya no existe.');
      if (!rights.move) throw new TaskError('Solo le cambian el estado sus personas o quien puede cambiar en Tareas.');
      const r = await setTaskStatus(prisma, { accountId: account.id, taskId: String(taskId), status });
      return { title: r.title };
    }),
  );
}

export async function deleteTaskAction(accountSlug: string, taskId: string) {
  return act<Named>(accountSlug, { section: 'tareas', does: 'Borró una tarea', targetOf: titleOf }, async ({ account }) =>
    guarded(() => deleteTask(prisma, { accountId: account.id, taskId: String(taskId) })),
  );
}

/** Publicaciones de la cuenta para sumar a una tarea. */
export async function searchTaskPublicationsAction(accountSlug: string, q: string) {
  const r = await act(accountSlug, { section: 'tareas', level: 'read' }, async ({ account }) =>
    searchTaskPublications(prisma, { accountId: account.id, q: String(q ?? '') }),
  );
  return Array.isArray(r) ? r : [];
}
