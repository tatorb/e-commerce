import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { OPEN_STATUSES } from '@/domain/tasks';
import { notifyAssigned } from '@/lib/task-mail';

// A quién le llegan las tareas automáticas de stock de una cuenta: las de
// reponer una medida ("stock:") y las de reactivar una publicación que
// recibió stock ("reactivar:"). Se eligen en la pantalla Alarmas de stock.
// Sin elegir a nadie, a todos los administradores.

type Db = PrismaClient | Prisma.TransactionClient;

/** Las claves de las tareas automáticas de stock. */
export const STOCK_TASK_PREFIXES = ['stock:', 'reactivar:'] as const;

/** Las personas que se pueden elegir: las activas que entran a la cuenta (los administradores entran a todas). */
async function candidatesOf(db: Db, accountId: string) {
  return db.user.findMany({
    where: { disabledAt: null, OR: [{ isAdmin: true }, { accounts: { some: { accountId } } }] },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, isAdmin: true },
  });
}

/** Los ids de las personas que reciben las tareas de stock de la cuenta. */
export async function stockTaskRecipients(db: Db, accountId: string): Promise<string[]> {
  const account = await db.account.findUnique({ where: { id: accountId }, select: { stockTaskUserIds: true } });
  const chosen = new Set(account?.stockTaskUserIds ?? []);
  const candidates = await candidatesOf(db, accountId);
  const picked = candidates.filter((u) => chosen.has(u.id));
  // Si las elegidas ya no están (dadas de baja o sin la cuenta), vuelve a los administradores.
  return (picked.length > 0 ? picked : candidates.filter((u) => u.isAdmin)).map((u) => u.id);
}

export type StockTaskCandidate = { id: string; name: string; email: string; isAdmin: boolean; chosen: boolean };

/** Para la pantalla: las personas que se pueden elegir y quiénes están elegidas. */
export async function stockTaskSettings(db: Db, accountId: string): Promise<{ candidates: StockTaskCandidate[]; everyAdmin: boolean }> {
  const account = await db.account.findUnique({ where: { id: accountId }, select: { stockTaskUserIds: true } });
  const chosen = new Set(account?.stockTaskUserIds ?? []);
  const candidates = await candidatesOf(db, accountId);
  const any = candidates.some((u) => chosen.has(u.id));
  return { candidates: candidates.map((u) => ({ ...u, chosen: any ? chosen.has(u.id) : u.isAdmin })), everyAdmin: !any };
}

export class StockRecipientsError extends Error {}

/**
 * Guarda a quién le llegan y cambia las tareas de stock abiertas: suma a las
 * personas nuevas (con su mail de asignada) y saca a las que dejaron de estar.
 * Las que alguien sumó a mano a una tarea quedan.
 */
export async function saveStockTaskRecipients(db: PrismaClient, accountId: string, userIds: string[]): Promise<{ added: number; removed: number }> {
  const candidates = await candidatesOf(db, accountId);
  const valid = new Set(candidates.map((u) => u.id));
  const ids = [...new Set(userIds)];
  if (ids.some((id) => !valid.has(id))) throw new StockRecipientsError('Alguna de las personas elegidas no entra a esta cuenta.');
  if (ids.length === 0) throw new StockRecipientsError('Elegí al menos una persona.');

  const tasks = await db.$transaction(async (tx) => {
    const before = await stockTaskRecipients(tx, accountId);
    await tx.account.update({ where: { id: accountId }, data: { stockTaskUserIds: ids } });
    const after = await stockTaskRecipients(tx, accountId);
    const gone = before.filter((id) => !after.includes(id));
    const open = await tx.task.findMany({
      where: { accountId, status: { in: [...OPEN_STATUSES] }, OR: STOCK_TASK_PREFIXES.map((p) => ({ autoKey: { startsWith: p } })) },
      select: { id: true },
    });
    const taskIds = open.map((t) => t.id);
    if (taskIds.length === 0) return { taskIds, added: 0, removed: 0 };
    const removed = gone.length > 0 ? (await tx.taskAssignee.deleteMany({ where: { taskId: { in: taskIds }, userId: { in: gone } } })).count : 0;
    const added = (await tx.taskAssignee.createMany({ data: taskIds.flatMap((taskId) => after.map((userId) => ({ taskId, userId }))), skipDuplicates: true })).count;
    return { taskIds, added, removed };
  });
  // Los mails de asignada solo salen a quienes todavía no lo recibieron.
  for (const id of tasks.taskIds) {
    await notifyAssigned(db, id).catch((e) => console.error('No salió el mail de la tarea de stock', e instanceof Error ? e.message : e));
  }
  return { added: tasks.added, removed: tasks.removed };
}
