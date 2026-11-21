import type { PrismaClient } from '@/generated/prisma/client';
import { matchSlot, skuText, StockError, stockSlots, type StockSlot } from '@/domain/stock';
import { MAX_QUANTITY } from '@/domain/quantities';
import { accountBranches, findBranch, type Branch } from '@/lib/branches';
import { affectedPublications, setProductStock, syncStock, type SyncResult } from '@/lib/stock';

// Cargar el stock de muchos productos de una vez, cada uno en su sucursal:
// lo que se trae del sistema de la tienda, depósito por depósito. Cada fila
// es un producto (por su número de pieza, o por el SKU de una medida), una
// sucursal, una medida si tiene y las unidades. Se guarda todo y al final se
// suben las cantidades y se revisa Flex una sola vez. Recibe la base por
// parámetro para poder probarlo.

type Db = PrismaClient;

export type BulkRow = { product: string; branch?: string | null; measure?: string | null; units: number };

export type BulkRowResult = {
  row: number;
  product: string;
  // Cómo quedó: guardada, igual (no cambiaba nada) o por qué no se pudo.
  result: 'guardada' | 'igual' | 'error';
  name?: string;
  branch?: string;
  measure?: string | null;
  before?: number;
  after?: number;
  message?: string;
};

export type BulkResult = { rows: BulkRowResult[]; saved: number; same: number; failed: number; products: number; sync: SyncResult | null };

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s._/-]+/g, '').toUpperCase();

type Candidate = { id: string; name: string; kind: string; partNumber: string | null; slots: StockSlot[]; published: number };

/** Cuánto tiene que sobrar del pedido para subir al canal al final; lo que no entra lo sube la pasada de cada hora. */
const SYNC_MS = 15_000;

/**
 * Carga las filas. preview: solo dice qué haría cada una. Un producto se busca
 * por su número de pieza o por el SKU de una de sus medidas, sin importar
 * espacios, guiones ni mayúsculas; si hay dos iguales, va el que está publicado.
 */
export async function setStockBulk(db: Db, args: { accountId: string; userId: string; rows: BulkRow[]; preview?: boolean; now?: Date }): Promise<BulkResult> {
  const branches = await accountBranches(db, args.accountId);
  const products = await db.product.findMany({
    where: { accountId: args.accountId },
    select: {
      id: true,
      name: true,
      kind: true,
      partNumber: true,
      variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } },
      _count: { select: { publications: { where: { externalId: { not: null } } } } },
    },
  });
  const all: Candidate[] = products.map((p) => ({ id: p.id, name: p.name, kind: p.kind, partNumber: p.partNumber, slots: stockSlots(p.variants), published: p._count.publications }));
  const byPart = new Map<string, Candidate[]>();
  const bySku = new Map<string, { c: Candidate; key: string }[]>();
  for (const c of all) {
    if (c.partNumber?.trim()) byPart.set(plain(c.partNumber), [...(byPart.get(plain(c.partNumber)) ?? []), c]);
    for (const s of c.slots) if (skuText(s.sku)) bySku.set(plain(s.sku!), [...(bySku.get(plain(s.sku!)) ?? []), { c, key: s.key }]);
  }
  // Con dos iguales, el que está publicado; si no se puede elegir, no se carga.
  const pick = <T extends { published: number }>(list: T[]): T | 'several' | null => {
    if (list.length <= 1) return list[0] ?? null;
    const live = list.filter((x) => x.published > 0);
    return live.length === 1 ? live[0] : 'several';
  };

  const out: BulkRowResult[] = [];
  // Lo de cada producto y sucursal junto: una sola carga por los dos.
  const loads = new Map<string, { c: Candidate; branch: Branch | null; stock: Record<string, number>; rows: number[] }>();
  args.rows.forEach((r, i) => {
    const row = i + 1;
    const fail = (message: string) => out.push({ row, product: r.product, result: 'error', message });
    if (!Number.isInteger(r.units) || r.units < 0 || r.units > MAX_QUANTITY) return fail(`Las unidades tienen que ser un número entero de 0 a ${MAX_QUANTITY}.`);
    let branch: Branch | null = null;
    if (branches.length > 0) {
      branch = r.branch ? findBranch(branches, r.branch) : branches.length === 1 ? branches[0] : null;
      if (!branch) return fail(`${r.branch ? `"${r.branch}" no es una sucursal.` : 'Falta la sucursal.'} Sucursales: ${branches.map((b) => b.name).join(', ')}.`);
    } else if (r.branch) return fail('La cuenta no tiene sucursales.');
    const code = plain(r.product);
    const part = pick(byPart.get(code) ?? []);
    const sku = part ? null : pick((bySku.get(code) ?? []).map((x) => ({ ...x, published: x.c.published })));
    if (part === 'several' || sku === 'several') return fail('Hay más de un producto con ese código y no se puede saber cuál es: cargalo por su publicación con set_product_stock.');
    const c = part ?? sku?.c ?? null;
    if (!c) return fail('No hay un producto con ese número de pieza ni con ese SKU.');
    if (c.kind === 'COMBO') return fail('Es un combo: su stock sale de sus piezas.');
    let key: string | null;
    if (c.slots.length === 1) key = c.slots[0].key;
    else if (r.measure?.trim()) key = matchSlot(c.slots, { sku: r.measure, measure: r.measure });
    else key = sku ? sku.key : null;
    if (key === null) {
      return fail(`${r.measure ? `"${r.measure}" no es una medida del producto.` : 'El producto tiene medidas: falta la medida.'} Medidas: ${c.slots.map((s) => s.label).join(', ')}.`);
    }
    const id = `${c.id}|${branch?.id ?? ''}`;
    const load = loads.get(id) ?? { c, branch, stock: {}, rows: [] };
    load.stock[key] = r.units;
    load.rows.push(out.length);
    loads.set(id, load);
    const slot = c.slots.find((s) => s.key === key)!;
    out.push({ row, product: r.product, result: 'igual', name: c.name, ...(branch ? { branch: branch.name } : {}), measure: c.slots.length > 1 ? slot.label : null, after: r.units, message: key });
  });

  const touched = new Set<string>();
  for (const load of loads.values()) {
    // Lo que tenía antes, de esa sucursal o del producto.
    const before = load.branch
      ? Object.fromEntries((await db.branchStock.findMany({ where: { productId: load.c.id, branchId: load.branch.id }, select: { key: true, quantity: true } })).map((x) => [x.key, x.quantity]))
      : Object.fromEntries((await db.productStock.findMany({ where: { productId: load.c.id }, select: { key: true, quantity: true } })).map((x) => [x.key, x.quantity]));
    const managed = (await db.product.findUniqueOrThrow({ where: { id: load.c.id }, select: { stockSince: true } })).stockSince !== null;
    for (const i of load.rows) {
      const key = out[i].message!;
      delete out[i].message;
      out[i].before = before[key] ?? 0;
      if (!managed || out[i].before !== out[i].after) out[i].result = 'guardada';
    }
    if (args.preview || load.rows.every((i) => out[i].result === 'igual')) continue;
    try {
      await setProductStock(db, { accountId: args.accountId, productId: load.c.id, userId: args.userId, stock: load.stock, branchId: load.branch?.id ?? null, sync: false, now: args.now });
      touched.add(load.c.id);
    } catch (e) {
      if (!(e instanceof StockError)) throw e;
      for (const i of load.rows) {
        out[i].result = 'error';
        out[i].message = e.message;
      }
    }
  }

  // Al final, una sola vez: las cantidades al canal y Flex según el stock de las sucursales.
  const sync = !args.preview && touched.size > 0
    ? await syncStock(db, { publicationIds: await affectedPublications(db, [...touched]), userId: args.userId, note: 'Por una carga de stock.', budgetMs: SYNC_MS })
    : null;
  return {
    rows: out.sort((a, b) => a.row - b.row),
    saved: out.filter((r) => r.result === 'guardada').length,
    same: out.filter((r) => r.result === 'igual').length,
    failed: out.filter((r) => r.result === 'error').length,
    products: touched.size,
    sync,
  };
}
