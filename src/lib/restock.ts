import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { CHANNEL_STATUS_LABEL, STOPPED_STATUSES } from '@/domain/channel-status';
import { quantityText, type QuantityLine } from '@/domain/quantities';
import { titleOrUntitled } from '@/domain/publication-title';
import { OPEN_STATUSES, TASK_TITLE_MAX } from '@/domain/tasks';
import { readOne } from '@/lib/channel-sync';
import { notifyAssigned } from '@/lib/task-mail';

// Cuando una publicación pausada o inactiva sin stock recibe stock: si el
// canal no la reactiva solo, una tarea para los administradores. La tarea se
// cierra sola cuando la publicación vuelve a estar activa. Recibe la base por
// parámetro para poder probarlo.

type Db = PrismaClient;

/** La clave de la tarea automática de reactivar una publicación. */
export const reactivationKey = (publicationId: string) => `reactivar:${publicationId}`;
const KEY_PREFIX = 'reactivar:';

/**
 * Después de subirle stock a una publicación que estaba frenada sin stock. La
 * vuelve a leer, porque el canal a veces la reactiva solo; si sigue frenada y
 * no hay una tarea abierta para eso, la crea. Devuelve el id de la tarea nueva.
 */
export async function afterRestock(
  db: Db,
  args: { publicationId: string; lines: QuantityLine[]; read?: boolean; now?: Date },
): Promise<string | null> {
  const now = args.now ?? new Date();
  const pub = await db.publication.findUnique({ where: { id: args.publicationId }, select: { product: { select: { accountId: true } } } });
  if (!pub) return null;
  const accountId = pub.product.accountId;
  // read false: ya se leyó recién.
  if (args.read !== false) {
    try {
      await readOne(db, { accountId, publicationId: args.publicationId, now });
    } catch (e) {
      // Sin poder leerla, queda el estado que se conocía.
      console.error('No se pudo leer la publicación después de reponer stock', e instanceof Error ? e.message : e);
    }
  }
  const p = await db.publication.findUniqueOrThrow({
    where: { id: args.publicationId },
    select: { title: true, externalId: true, channelStatus: true, store: { select: { channel: { select: { kind: true, name: true } } } } },
  });
  if (!STOPPED_STATUSES.includes(p.channelStatus)) {
    await settleReactivations(db, { publicationIds: [args.publicationId], now });
    return null;
  }
  const key = reactivationKey(args.publicationId);
  const open = await db.task.findFirst({ where: { accountId, autoKey: key, status: { in: [...OPEN_STATUSES] } }, select: { id: true } });
  if (open) return null;
  const admins = await db.user.findMany({ where: { isAdmin: true, disabledAt: null }, select: { id: true } });
  if (admins.length === 0) return null;
  const channelName = getChannelAdapter(p.store.channel.kind, p.store.channel.name).name;
  const title = `Reactivar en ${channelName}: ${titleOrUntitled(p.title)}`.slice(0, TASK_TITLE_MAX);
  const description = [
    `La publicación ${p.externalId ?? ''} estaba ${CHANNEL_STATUS_LABEL[p.channelStatus].toLowerCase()} sin stock y recibió stock: ${quantityText(args.lines)}.`,
    `${channelName} no la reactivó solo. Reactivala desde la publicación, en Estado en ${channelName}, o pedíselo a Claude.`,
    'Esta tarea se cierra sola cuando la publicación vuelve a estar activa.',
  ].join(' ');
  const task = await db.task.create({
    data: {
      accountId,
      title,
      description: description.replace(/\s+/g, ' '),
      // El aviso es ya: el mail sale ahora, como el de asignada, y no otra vez.
      remindAt: now,
      remindedAt: now,
      autoKey: key,
      assignees: { create: admins.map((a) => ({ userId: a.id })) },
      publications: { create: [{ publicationId: args.publicationId }] },
    },
    select: { id: true },
  });
  await notifyAssigned(db, task.id).catch((e) => console.error('No salió el mail de la tarea de reactivar', e instanceof Error ? e.message : e));
  return task.id;
}

/**
 * Cierra las tareas automáticas de reactivar cuyas publicaciones ya están
 * activas, de esas publicaciones o de todas. Devuelve cuántas cerró.
 */
export async function settleReactivations(db: Db, args: { publicationIds?: string[]; now?: Date } = {}): Promise<number> {
  const tasks = await db.task.findMany({
    where: {
      autoKey: { startsWith: KEY_PREFIX },
      status: { in: [...OPEN_STATUSES] },
      publications: { some: { publication: { channelStatus: 'ACTIVE', ...(args.publicationIds ? { id: { in: args.publicationIds } } : {}) } } },
    },
    select: { id: true },
  });
  if (tasks.length === 0) return 0;
  const r = await db.task.updateMany({ where: { id: { in: tasks.map((t) => t.id) } }, data: { status: 'DONE', doneAt: args.now ?? new Date() } });
  return r.count;
}
