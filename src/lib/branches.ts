import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { branchOrder, branchText, mainBranch, saleSplit, type BranchLike } from '@/domain/branches';
import { StockError } from '@/domain/stock';

// Las sucursales de la cuenta y el stock de cada una. Con sucursales, el stock
// del producto (product_stock) es siempre la suma del de cada sucursal: lo que
// se sube a los canales y las alarmas siguen saliendo de ahí. Recibe la base
// por parámetro para poder probarlo.

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export const BRANCH_SELECT = { id: true, name: true, position: true, flex: true, main: true } as const;
export type Branch = BranchLike;

/** Las sucursales de la cuenta, la principal primero. */
export async function accountBranches(db: Db | Tx, accountId: string): Promise<Branch[]> {
  return branchOrder(await db.branch.findMany({ where: { accountId }, select: BRANCH_SELECT }));
}

/** Las sucursales de la cuenta del producto. */
export async function productBranches(db: Db | Tx, productId: string): Promise<Branch[]> {
  return branchOrder(await db.branch.findMany({ where: { account: { products: { some: { id: productId } } } }, select: BRANCH_SELECT }));
}

/** Lo que tiene cada sucursal de una medida, por id de sucursal. */
export async function branchQuantities(db: Db | Tx, productId: string, key: string): Promise<Record<string, number>> {
  const rows = await db.branchStock.findMany({ where: { productId, key }, select: { branchId: true, quantity: true } });
  return Object.fromEntries(rows.map((r) => [r.branchId, r.quantity]));
}

/** Suma (o resta) en cada sucursal, de una sola vez aunque lleguen dos ventas juntas. */
export async function addBranchStock(tx: Tx, productId: string, key: string, deltas: Record<string, number>): Promise<void> {
  for (const [branchId, delta] of Object.entries(deltas)) {
    if (delta === 0) continue;
    await tx.$executeRaw`
      INSERT INTO branch_stock ("productId", key, "branchId", quantity, "updatedAt")
      VALUES (${productId}, ${key}, ${branchId}, ${delta}, now())
      ON CONFLICT ("productId", key, "branchId") DO UPDATE SET quantity = branch_stock.quantity + ${delta}, "updatedAt" = now()`;
  }
}

/** De qué sucursales sale una venta. Null si la cuenta no tiene sucursales. */
export async function saleDeltas(tx: Tx, productId: string, key: string, quantity: number, flex: boolean): Promise<Record<string, number> | null> {
  const branches = await productBranches(tx, productId);
  if (branches.length === 0) return null;
  return saleSplit(branches, await branchQuantities(tx, productId, key), quantity, flex);
}

/** El stock que se carga a mano en una sucursal, por medida: cuánto cambia en cada una. */
export async function branchChange(
  tx: Tx,
  args: { productId: string; branchId: string; wanted: Record<string, number> },
): Promise<{ key: string; before: number; after: number; total: number }[]> {
  const rows = await tx.branchStock.findMany({ where: { productId: args.productId }, select: { key: true, branchId: true, quantity: true } });
  const out: { key: string; before: number; after: number; total: number }[] = [];
  for (const [key, after] of Object.entries(args.wanted)) {
    const here = rows.filter((r) => r.key === key);
    const before = here.find((r) => r.branchId === args.branchId)?.quantity ?? 0;
    const others = here.filter((r) => r.branchId !== args.branchId).reduce((sum, r) => sum + r.quantity, 0);
    out.push({ key, before, after, total: others + after });
  }
  return out;
}

export type BranchInput = { id?: string; name?: string; flex?: boolean; main?: boolean; position?: number };

/**
 * Crea o cambia una sucursal. La primera de la cuenta se queda con todo el
 * stock que ya estaba cargado y es la principal; las que se suman después
 * empiezan en 0. Devuelve si cambió el Flex de alguna, para revisar las
 * publicaciones.
 */
export async function saveBranch(db: Db, args: { accountId: string; branch: BranchInput }): Promise<{ branch: Branch; created: boolean; flexChanged: boolean; tookStock: number }> {
  const { branch } = args;
  const name = branch.name?.trim();
  if (branch.name !== undefined && !name) throw new StockError('La sucursal necesita un nombre.');
  return db.$transaction(async (tx) => {
    const existing = await tx.branch.findMany({ where: { accountId: args.accountId }, select: BRANCH_SELECT });
    if (name && existing.some((b) => b.name.toLowerCase() === name.toLowerCase() && b.id !== branch.id)) throw new StockError(`Ya hay una sucursal ${name}.`);
    let saved: Branch;
    let created = false;
    let flexChanged = false;
    let tookStock = 0;
    if (branch.id) {
      const before = existing.find((b) => b.id === branch.id);
      if (!before) throw new StockError('La sucursal no está en la cuenta.');
      if (branch.main === false && before.main) throw new StockError('Tiene que haber una principal: marcá otra como principal.');
      flexChanged = branch.flex !== undefined && branch.flex !== before.flex;
      saved = await tx.branch.update({
        where: { id: branch.id },
        data: { ...(name ? { name } : {}), ...(branch.flex !== undefined ? { flex: branch.flex } : {}), ...(branch.main ? { main: true } : {}), ...(branch.position !== undefined ? { position: branch.position } : {}) },
        select: BRANCH_SELECT,
      });
    } else {
      if (!name) throw new StockError('La sucursal necesita un nombre.');
      const first = existing.length === 0;
      saved = await tx.branch.create({
        data: {
          accountId: args.accountId,
          name,
          flex: branch.flex ?? false,
          main: first || branch.main === true,
          position: branch.position ?? existing.reduce((max, b) => Math.max(max, b.position + 1), 0),
        },
        select: BRANCH_SELECT,
      });
      created = true;
      flexChanged = saved.flex;
      if (first) {
        // Todo el stock cargado hasta ahora queda en la primera sucursal.
        const rows = await tx.productStock.findMany({ where: { product: { accountId: args.accountId } }, select: { productId: true, key: true, quantity: true } });
        if (rows.length > 0) await tx.branchStock.createMany({ data: rows.map((r) => ({ productId: r.productId, key: r.key, branchId: saved.id, quantity: r.quantity })) });
        tookStock = rows.length;
      }
    }
    if (saved.main) await tx.branch.updateMany({ where: { accountId: args.accountId, id: { not: saved.id } }, data: { main: false } });
    return { branch: saved, created, flexChanged, tookStock };
  });
}

/** La sucursal por su id o su nombre, sin importar mayúsculas ni acentos. */
export function findBranch(branches: Branch[], ref: string): Branch | null {
  const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  return branches.find((b) => b.id === ref) ?? branches.find((b) => plain(b.name) === plain(ref)) ?? null;
}

/** La sucursal en que entra el stock de partida de un producto nuevo: la primera. */
export function startingBranch(branches: Branch[]): Branch | null {
  return [...branches].sort((a, b) => a.position - b.position)[0] ?? mainBranch(branches);
}

/**
 * El stock de cada sucursal en texto: "Córdoba 3 · Santa Fe 2", o por medida
 * "STD: Córdoba 3 · Santa Fe 2; 0.50: Córdoba 0 · Santa Fe 1". Null si la
 * cuenta no tiene sucursales.
 */
export async function branchStockText(db: Db | Tx, productId: string, slots: { key: string; label: string }[]): Promise<string | null> {
  const branches = await productBranches(db, productId);
  if (branches.length === 0) return null;
  const rows = await db.branchStock.findMany({ where: { productId }, select: { key: true, branchId: true, quantity: true } });
  const line = (key: string) => branchText(branches, branches.map((b) => rows.find((r) => r.key === key && r.branchId === b.id)?.quantity ?? 0));
  if (slots.length === 1) return line(slots[0].key);
  return slots.map((s) => `${s.label || 'Sin medida'}: ${line(s.key)}`).join('; ');
}
