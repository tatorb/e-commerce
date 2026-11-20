import { available, type StockSource } from './stock';
import type { VariantLike } from './media';

// Las sucursales de una cuenta, cada una con su depósito. Con sucursales, el
// stock de cada medida del producto es la suma del de cada una. Las ventas
// Flex salen de una sucursal con Flex; las demás, de la principal y, si no
// alcanza, de las otras. Envíos Flex se ofrece en una publicación solo si una
// sucursal con Flex tiene para vender todo lo que vende la publicación. Sin la
// base de datos, para poder probarlo solo.

export type BranchLike = { id: string; name: string; position: number; flex: boolean; main: boolean };

/** Las sucursales en orden: la principal primero y después por su orden. */
export function branchOrder<T extends BranchLike>(branches: T[]): T[] {
  return [...branches].sort((a, b) => Number(b.main) - Number(a.main) || a.position - b.position || a.name.localeCompare(b.name));
}

/** La principal: la marcada o, si no hay, la primera. */
export function mainBranch<T extends BranchLike>(branches: T[]): T | null {
  return branchOrder(branches)[0] ?? null;
}

/**
 * De qué sucursales salen las unidades de una venta: cuánto baja cada una (en
 * negativo). stock: lo que tiene cada sucursal de esa medida. Una venta Flex
 * sale toda de la sucursal con Flex que más tiene, aunque quede en negativo:
 * la entrega sale de ahí. Las demás, de la principal y, si no alcanza, de las
 * otras en orden; lo que falte queda en negativo en la principal.
 */
export function saleSplit(branches: BranchLike[], stock: Record<string, number>, quantity: number, flex: boolean): Record<string, number> {
  const out: Record<string, number> = {};
  if (branches.length === 0 || quantity <= 0) return out;
  const has = (b: BranchLike) => stock[b.id] ?? 0;
  const flexOnes = branches.filter((b) => b.flex);
  if (flex && flexOnes.length > 0) {
    const from = [...flexOnes].sort((a, b) => has(b) - has(a) || a.position - b.position)[0];
    out[from.id] = -quantity;
    return out;
  }
  const ordered = branchOrder(branches);
  let left = quantity;
  for (const b of ordered) {
    const take = Math.min(left, Math.max(has(b), 0));
    if (take > 0) out[b.id] = (out[b.id] ?? 0) - take;
    left -= take;
    if (left === 0) break;
  }
  if (left > 0) out[ordered[0].id] = (out[ordered[0].id] ?? 0) - left;
  return out;
}

/** El stock de cada producto en una sucursal, por medida. */
export type BranchStockMap = Map<string, Record<string, number>>;

/** Lo que vende la publicación con el stock de una sucursal en lugar del total. */
function inBranch(source: StockSource, stock: BranchStockMap): StockSource {
  const swap = <P extends { id: string; stock: Record<string, number> | null }>(p: P): P => ({ ...p, stock: p.stock === null ? null : (stock.get(p.id) ?? {}) });
  return source.kind === 'INDIVIDUAL' ? { kind: 'INDIVIDUAL', product: swap(source.product) } : { kind: 'COMBO', parts: source.parts.map((p) => ({ ...p, product: swap(p.product) })) };
}

export type FlexWanted = { on: boolean; branch: string | null; reason: string };

/**
 * Si la publicación tiene que ofrecer Flex: una sucursal con Flex tiene al
 * menos una unidad de cada medida que vende (en un combo, para armar uno).
 * measures: las medidas que vende la publicación; [null] si no tiene. byBranch:
 * el stock de cada sucursal con Flex. Null si no se puede saber.
 */
export function flexWanted(source: StockSource, measures: (VariantLike | null)[], flexBranches: { branch: BranchLike; stock: BranchStockMap }[]): FlexWanted | null {
  if (flexBranches.length === 0) return { on: false, branch: null, reason: 'Ninguna sucursal tiene Flex prendido.' };
  const counts: { name: string; least: number | null }[] = flexBranches.map(({ branch, stock }) => {
    const local = inBranch(source, stock);
    const each = measures.map((m) => available(local, m));
    return { name: branch.name, least: each.some((n) => n === null) ? null : Math.min(...(each as number[])) };
  });
  if (counts.every((c) => c.least === null)) return null;
  const best = counts.filter((c) => c.least !== null).sort((a, b) => b.least! - a.least!)[0];
  const names = flexBranches.map((f) => f.branch.name).join(' ni en ');
  if (best.least! >= 1) return { on: true, branch: best.name, reason: `Hay stock en ${best.name}.` };
  return { on: false, branch: null, reason: measures.length > 1 ? `No hay stock de todas sus medidas en ${names}.` : `No hay stock en ${names}.` };
}

/** El stock por sucursal en texto: "Córdoba 3 · Santa Fe 2". */
export function branchText(branches: { name: string }[], quantities: number[]): string {
  return branches.map((b, i) => `${b.name} ${quantities[i] ?? 0}`).join(' · ');
}
