import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { titleOrUntitled } from '@/domain/publication-title';
import { StockError, stockSlots } from '@/domain/stock';
import { OPEN_STATUSES, TASK_TITLE_MAX } from '@/domain/tasks';
import { accountBranches, addBranchStock } from '@/lib/branches';
import { syncFlex, type FlexSyncResult } from '@/lib/branch-flex';
import { notifyAssigned } from '@/lib/task-mail';
import { stockTaskRecipients } from '@/lib/stock-task-recipients';

// Las ventas que no son Flex en una cuenta con sucursales: bajan el total del
// stock enseguida, pero de qué sucursal salieron lo dice una persona. Mientras
// tanto queda una tarea abierta, que se cierra sola al elegirla o si la venta
// se cancela antes. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

/** La clave de la tarea automática de una venta sin sucursal. */
export const saleBranchKey = (saleId: string) => `sucursal:${saleId}`;

export type PendingPart = {
  moveId: number;
  productId: string;
  product: string;
  key: string;
  // La medida, si el producto tiene varias.
  measure: string | null;
  units: number;
  publication: { id: string; title: string; externalId: string | null } | null;
};

/** Lo que falta asignar a una sucursal de una venta. */
export async function pendingSaleParts(db: Db, saleId: string): Promise<PendingPart[]> {
  const moves = await db.stockMovement.findMany({
    where: { saleId, branchPending: true },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      productId: true,
      key: true,
      delta: true,
      product: { select: { name: true, variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } },
      publication: { select: { id: true, title: true, externalId: true } },
    },
  });
  return moves.map((m) => {
    const slots = stockSlots(m.product.variants);
    return {
      moveId: m.id,
      productId: m.productId,
      product: m.product.name,
      key: m.key,
      measure: slots.length > 1 ? (slots.find((s) => s.key === m.key)?.label ?? null) : null,
      units: -m.delta,
      publication: m.publication ? { id: m.publication.id, title: titleOrUntitled(m.publication.title), externalId: m.publication.externalId } : null,
    };
  });
}

const partText = (p: PendingPart) => `${p.units === 1 ? '1 unidad' : `${p.units} unidades`} de ${p.product}${p.measure ? ` (${p.measure})` : ''}`;

/**
 * Después de anotar una venta: si algo quedó sin sucursal, una tarea para
 * elegirla, una sola por venta. Devuelve el id de la tarea nueva.
 */
export async function openSaleBranchTask(db: Db, args: { storeId: string; orderId: string; now?: Date }): Promise<string | null> {
  const now = args.now ?? new Date();
  const sale = await db.channelSale.findUnique({
    where: { storeId_orderId: { storeId: args.storeId, orderId: args.orderId } },
    select: { id: true, orderId: true, store: { select: { accountId: true, channel: { select: { kind: true, name: true } } } } },
  });
  if (!sale) return null;
  const parts = await pendingSaleParts(db, sale.id);
  if (parts.length === 0) return null;
  const accountId = sale.store.accountId;
  const key = saleBranchKey(sale.id);
  if (await db.task.findFirst({ where: { accountId, autoKey: key, status: { in: [...OPEN_STATUSES] } }, select: { id: true } })) return null;
  const recipients = await stockTaskRecipients(db, accountId);
  const channelName = getChannelAdapter(sale.store.channel.kind, sale.store.channel.name).name;
  const branches = await accountBranches(db, accountId);
  const description = [
    `Entró la venta ${sale.orderId} en ${channelName}, que no es Flex: ${parts.map(partText).join('; ')}.`,
    `Ya se descontó del stock total. Elegí de qué sucursal sale (${branches.map((b) => b.name).join(' o ')}) en esta tarea, o pedíselo a Claude.`,
    'La tarea se cierra sola al elegirla, o si la venta se cancela antes.',
  ].join(' ');
  const publicationIds = [...new Set(parts.flatMap((p) => (p.publication ? [p.publication.id] : [])))];
  const task = await db.task.create({
    data: {
      accountId,
      title: `Elegir de qué sucursal sale la venta ${sale.orderId}`.slice(0, TASK_TITLE_MAX),
      description,
      remindAt: now,
      remindedAt: now,
      autoKey: key,
      assignees: { create: recipients.map((userId) => ({ userId })) },
      publications: { create: publicationIds.map((publicationId) => ({ publicationId })) },
    },
    select: { id: true },
  });
  await notifyAssigned(db, task.id).catch((e) => console.error('No salió el mail de la tarea de la sucursal', e instanceof Error ? e.message : e));
  return task.id;
}

/** Si ya no queda nada sin sucursal en la venta, su tarea se cierra. */
export async function settleSaleBranchTask(db: Db, args: { saleId: string; now?: Date }): Promise<void> {
  if ((await db.stockMovement.count({ where: { saleId: args.saleId, branchPending: true } })) > 0) return;
  await db.task.updateMany({ where: { autoKey: saleBranchKey(args.saleId), status: { in: [...OPEN_STATUSES] } }, data: { status: 'DONE', doneAt: args.now ?? new Date() } });
}

export type SaleWithoutBranch = { saleId: string; orderId: string; orderedAt: Date; parts: PendingPart[]; taskId: string | null };

/** Las ventas de la cuenta que esperan que se elija la sucursal, las más viejas primero. */
export async function salesWithoutBranch(db: Db, accountId: string): Promise<SaleWithoutBranch[]> {
  const sales = await db.channelSale.findMany({
    where: { store: { accountId }, moves: { some: { branchPending: true } } },
    orderBy: { orderedAt: 'asc' },
    select: { id: true, orderId: true, orderedAt: true },
  });
  const tasks = await db.task.findMany({
    where: { accountId, autoKey: { in: sales.map((s) => saleBranchKey(s.id)) }, status: { in: [...OPEN_STATUSES] } },
    select: { id: true, autoKey: true },
  });
  const out: SaleWithoutBranch[] = [];
  for (const s of sales) {
    out.push({ saleId: s.id, orderId: s.orderId, orderedAt: s.orderedAt, parts: await pendingSaleParts(db, s.id), taskId: tasks.find((t) => t.autoKey === saleBranchKey(s.id))?.id ?? null });
  }
  return out;
}

/**
 * Dice de qué sucursal salió lo que quedó sin sucursal de una venta: una
 * sucursal para todo, o una por cada línea (moveId). La sucursal baja; el
 * total ya había bajado. Cierra la tarea y deja Flex al día.
 */
export async function assignSaleBranch(
  db: Db,
  args: { accountId: string; saleId: string; branchId?: string; byPart?: Record<number, string>; userId: string | null; now?: Date },
): Promise<{ assigned: { part: PendingPart; branch: string }[]; left: number; flex: FlexSyncResult }> {
  const now = args.now ?? new Date();
  const sale = await db.channelSale.findFirst({ where: { id: args.saleId, store: { accountId: args.accountId } }, select: { id: true, orderId: true } });
  if (!sale) throw new StockError('La venta no está en la cuenta.');
  const branches = await accountBranches(db, args.accountId);
  const parts = await pendingSaleParts(db, sale.id);
  if (parts.length === 0) throw new StockError(`La venta ${sale.orderId} no tiene nada para elegir: ya se eligió la sucursal o se canceló.`);
  const assigned: { part: PendingPart; branch: string }[] = [];
  await db.$transaction(async (tx) => {
    for (const part of parts) {
      const branchId = args.byPart?.[part.moveId] ?? args.branchId;
      if (!branchId) continue;
      const branch = branches.find((b) => b.id === branchId);
      if (!branch) throw new StockError('La sucursal no está en la cuenta.');
      // Solo una vez, aunque dos personas elijan a la vez.
      const claimed = await tx.stockMovement.updateMany({
        where: { id: part.moveId, branchPending: true },
        data: { branchPending: false, branches: { [branch.id]: -part.units }, note: `Venta ${sale.orderId}, salió de ${branch.name}` },
      });
      if (claimed.count === 0) continue;
      await addBranchStock(tx, part.productId, part.key, { [branch.id]: -part.units });
      assigned.push({ part, branch: branch.name });
    }
  });
  await settleSaleBranchTask(db, { saleId: sale.id, now });
  // Flex de las publicaciones de esos productos y de los combos en que están.
  const productIds = [...new Set(assigned.map((a) => a.part.productId))];
  const pubs = productIds.length
    ? await db.publication.findMany({
        where: { OR: [{ productId: { in: productIds } }, { product: { comboItems: { some: { productId: { in: productIds } } } } }] },
        select: { id: true },
      })
    : [];
  const flex = await syncFlex(db, { publicationIds: pubs.map((p) => p.id), userId: args.userId });
  return { assigned, left: parts.length - assigned.length, flex };
}
