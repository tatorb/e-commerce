import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { costOf } from '@/domain/costs';
import { parsePrice } from '@/domain/money';
import { stockSlots } from '@/domain/stock';

// El costo de reposición sin IVA del producto, uno por medida, que se carga en
// la pestaña Costo y Stock y heredan sus publicaciones en el paso Precio.
// Hasta que se guarda por medida, vale el costo general que se cargaba antes en
// el paso Precio. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient | Prisma.TransactionClient;

export class CostError extends Error {}

export type ProductCostLine = { key: string; label: string; cost: number | null };

/** Los costos guardados por medida, por su clave. */
export const costMap = (rows: { key: string; cost: Prisma.Decimal | number }[]) => new Map(rows.map((r) => [r.key, Number(r.cost)]));

export const COST_SELECT = {
  replacementCost: true,
  variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } },
  costs: { select: { key: true, cost: true } },
} as const;

/** El costo de cada medida, en el orden de la ficha, con su clave de stock. */
export function costLines(p: { replacementCost: Prisma.Decimal | null; variants: { sku: string | null; measure: string | null }[]; costs: { key: string; cost: Prisma.Decimal }[] }) {
  const costs = costMap(p.costs);
  const general = p.replacementCost === null ? null : Number(p.replacementCost);
  const lines: ProductCostLine[] = stockSlots(p.variants).map((s) => ({ key: s.key, label: s.label, cost: costOf(costs, general, s.key) }));
  // Si alguna medida todavía usa el costo general, el de antes para todo el producto.
  return { lines, fromGeneral: general !== null && lines.some((l) => !costs.has(l.key)) };
}

/** El costo como lo ve Claude: el monto si el producto no tiene medidas, o el de cada medida. Null es sin cargar. */
export function costsForClaude(lines: ProductCostLine[]): number | null | { medida: string; costo: number | null }[] {
  return lines.length === 1 ? lines[0].cost : lines.map((l) => ({ medida: l.label, costo: l.cost }));
}

/** Lo que muestra la pestaña Costo y Stock. Null si el producto no es de la cuenta. */
export async function loadProductCosts(db: Db, args: { accountId: string; productId: string }) {
  const p = await db.product.findFirst({ where: { id: args.productId, accountId: args.accountId }, select: COST_SELECT });
  return p ? costLines(p) : null;
}

/** Un costo como llega: escrito como "99.627,50" desde la pantalla, o un monto desde Claude. Vacío o null lo borra. */
export type CostInput = string | number | null;

function parseCost(value: CostInput): number | null | 'invalid' {
  if (value === null) return null;
  const n = typeof value === 'number' ? value : parsePrice(String(value).trim());
  if (n === null) return null;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 'invalid';
}

/**
 * Guarda el costo de cada medida, por la clave de la medida. Una medida vacía
 * queda sin costo; con keepMissing, las que no vienen quedan como estaban.
 * Desde acá el costo general de antes deja de usarse. Devuelve cuántas
 * medidas cambiaron.
 */
export async function setProductCosts(
  db: PrismaClient,
  args: { accountId: string; productId: string; costs: Record<string, CostInput>; keepMissing?: boolean },
): Promise<{ changed: number }> {
  return db.$transaction(async (tx) => {
    const p = await tx.product.findFirst({ where: { id: args.productId, accountId: args.accountId }, select: { id: true, ...COST_SELECT } });
    if (!p) throw new CostError('El producto no existe en esta cuenta.');
    const { lines } = costLines(p);
    const single = lines.length === 1;
    const next = lines.map((l) => {
      const sent = Object.prototype.hasOwnProperty.call(args.costs ?? {}, l.key);
      if (!sent && args.keepMissing) return { key: l.key, cost: l.cost };
      const cost = parseCost(sent ? args.costs[l.key] : null);
      if (cost === 'invalid') throw new CostError(`${single ? 'El costo' : `El costo de ${l.label || 'la medida'}`} tiene que ser un monto, por ejemplo 99.627,50.`);
      return { key: l.key, cost };
    });
    const changed = next.filter((n, i) => n.cost !== lines[i].cost).length;
    await tx.productCost.deleteMany({ where: { productId: p.id, key: { in: lines.map((l) => l.key) } } });
    const rows = next.filter((n): n is { key: string; cost: number } => n.cost !== null);
    if (rows.length > 0) await tx.productCost.createMany({ data: rows.map((r) => ({ productId: p.id, ...r })) });
    if (p.replacementCost !== null) await tx.product.update({ where: { id: p.id }, data: { replacementCost: null } });
    return { changed };
  });
}
