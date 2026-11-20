import { available, type StockSource } from './stock';
import type { VariantLike } from './media';

// Las sucursales de una cuenta, cada una con su depósito. Con sucursales, el
// stock de cada medida del producto es la suma del de cada una. Las ventas
// Flex salen de una sucursal con Flex; en las demás, una persona elige de cuál
// salieron (src/lib/sale-branch.ts). Envíos Flex se ofrece en una publicación solo si una
// sucursal con Flex tiene para vender todo lo que vende la publicación. Sin la
// base de datos, para poder probarlo solo.

export type BranchLike = { id: string; name: string; position: number; flex: boolean; main: boolean };

/** Las sucursales en su orden. */
export function branchOrder<T extends BranchLike>(branches: T[]): T[] {
  return [...branches].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

/**
 * De qué sucursal sale una venta Flex: la sucursal con Flex que más tiene de
 * esa medida, aunque quede en negativo, porque la entrega sale de ahí. Null si
 * no es Flex o ninguna sucursal tiene Flex: entonces la elige una persona.
 */
export function flexSaleBranch(branches: BranchLike[], stock: Record<string, number>, flex: boolean): BranchLike | null {
  if (!flex) return null;
  const has = (b: BranchLike) => stock[b.id] ?? 0;
  return [...branches.filter((b) => b.flex)].sort((a, b) => has(b) - has(a) || a.position - b.position)[0] ?? null;
}

/** El stock de cada producto en una sucursal, por medida. */
export type BranchStockMap = Map<string, Record<string, number>>;

/** Lo que vende la publicación con el stock de una sucursal en lugar del total. */
function inBranch(source: StockSource, stock: BranchStockMap): StockSource {
  const swap = <P extends { id: string; stock: Record<string, number> | null }>(p: P): P => ({ ...p, stock: p.stock === null ? null : (stock.get(p.id) ?? {}) });
  return source.kind === 'INDIVIDUAL'
    ? { kind: 'INDIVIDUAL', product: swap(source.product), units: source.units }
    : { kind: 'COMBO', parts: source.parts.map((p) => ({ ...p, product: swap(p.product) })), units: source.units };
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
