import type { Prisma } from '@/generated/prisma/client';
import { measureText, variantKey, type VariantLike } from './media';
import { stockSlots } from './stock';

// La app reconoce cada medida por su SKU y su medida juntos (variantKey), y
// así la nombran el stock y su historial, el costo, las fotos y los videos marcados
// para una medida, el orden de las fotos de cada medida, la medida que vende
// cada publicación de una familia y lo que se registró en Registro de
// productos. Si la ficha le cambia el nombre o el SKU a una medida, todo eso
// se muda a la clave nueva, para que no quede atado a una medida que ya no está.

export type MeasureRow = VariantLike & { id?: string | null };

const skuText = (sku: string | null | undefined) => sku?.trim().toUpperCase() || null;

/**
 * Qué medida de antes es cuál de ahora, por su lugar en cada lista. Primero
 * por su id, que es la misma fila; después la misma clave, el mismo SKU o la
 * misma medida, si hay una sola de cada lado. Con `byPosition`, las que
 * quedan se aparean por su orden si quedaron tantas de un lado como del otro:
 * sirve cuando la lista nueva llega sin ids, como desde el formulario de la ficha.
 */
export function pairMeasures(before: MeasureRow[], after: MeasureRow[], opts: { byPosition?: boolean } = {}): [number, number][] {
  const pairs: [number, number][] = [];
  const freeBefore = new Set(before.keys());
  const freeAfter = new Set(after.keys());
  const take = (i: number, j: number) => {
    pairs.push([i, j]);
    freeBefore.delete(i);
    freeAfter.delete(j);
  };
  for (const j of [...freeAfter]) {
    const id = after[j].id;
    const i = id ? [...freeBefore].find((k) => before[k].id === id) : undefined;
    if (i !== undefined) take(i, j);
  }
  // La misma, por algo que tienen igual y no comparten con otra.
  const match = (of: (v: VariantLike) => string | null) => {
    for (const j of [...freeAfter]) {
      const value = of(after[j]);
      if (!value) continue;
      const mine = [...freeBefore].filter((i) => of(before[i]) === value);
      const theirs = [...freeAfter].filter((k) => of(after[k]) === value);
      if (mine.length === 1 && theirs.length === 1) take(mine[0], j);
    }
  };
  match(variantKey);
  match((v) => skuText(v.sku));
  match((v) => measureText(v.measure));
  if (opts.byPosition && freeBefore.size === freeAfter.size) {
    const rest = [...freeAfter];
    [...freeBefore].forEach((i, n) => take(i, rest[n]));
  }
  return pairs.sort((a, b) => a[1] - b[1]);
}

export type MeasureMoves = {
  // La clave de antes y la de ahora, de las medidas que cambiaron de clave.
  keys: Map<string, string>;
  // Lo mismo para el stock: con menos de dos medidas, el stock lleva una sola clave vacía.
  stock: Map<string, string>;
};

/** Las claves que cambian cuando la ficha pasa de unas medidas a otras. */
export function measureMoves(before: MeasureRow[], after: MeasureRow[], opts: { byPosition?: boolean } = {}): MeasureMoves {
  const keys = new Map<string, string>();
  const stock = new Map<string, string>();
  const oldSlots = stockSlots(before);
  const newSlots = stockSlots(after);
  const slotKey = (slots: { key: string }[], list: MeasureRow[], i: number) => (list.length < 2 ? slots[0].key : slots[i].key);
  for (const [i, j] of pairMeasures(before, after, opts)) {
    const from = variantKey(before[i]);
    const to = variantKey(after[j]);
    if (from && to && from !== to) keys.set(from, to);
    const s = slotKey(oldSlots, before, i);
    const t = slotKey(newSlots, after, j);
    if (s !== t) stock.set(s, t);
  }
  return { keys, stock };
}

const moved = (keys: Map<string, string>, key: string) => keys.get(key) ?? key;

/**
 * Las fotos de una publicación (Publication.media) con las marcas de medida
 * mudadas: las medidas de cada foto y su lugar en cada medida. Null si no cambió nada.
 */
export function movedMedia(raw: unknown, keys: Map<string, string>): unknown[] | null {
  if (!Array.isArray(raw) || keys.size === 0) return null;
  let changed = false;
  const out = raw.map((ref) => {
    if (!ref || typeof ref !== 'object') return ref;
    const o = { ...(ref as Record<string, unknown>) };
    if (Array.isArray(o.variants) && o.variants.some((k) => typeof k === 'string' && keys.has(k))) {
      o.variants = [...new Set(o.variants.map((k) => (typeof k === 'string' ? moved(keys, k) : k)))];
      changed = true;
    }
    if (o.positions && typeof o.positions === 'object' && Object.keys(o.positions).some((k) => keys.has(k))) {
      o.positions = Object.fromEntries(Object.entries(o.positions as Record<string, unknown>).map(([k, v]) => [moved(keys, k), v]));
      changed = true;
    }
    return o;
  });
  return changed ? out : null;
}

/** Las medidas de cada video (Publication.videoVariants), mudadas. Null si no cambió nada. */
export function movedVideoVariants(raw: unknown, keys: Map<string, string>): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || keys.size === 0) return null;
  let changed = false;
  const out = Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([video, list]) => {
      if (!Array.isArray(list) || !list.some((k) => typeof k === 'string' && keys.has(k))) return [video, list];
      changed = true;
      return [video, [...new Set(list.map((k) => (typeof k === 'string' ? moved(keys, k) : k)))]];
    }),
  );
  return changed ? out : null;
}

type Tx = Prisma.TransactionClient;

/** Cómo se llama una medida en las marcas de fotos y videos: su medida o, si no tiene, su SKU. */
const markLabel = (v: VariantLike) => v.measure?.trim() || v.sku?.trim() || '';

/**
 * Muda al nombre nuevo todo lo que apunta a las medidas de un producto que
 * cambiaron, dentro de la misma transacción en que se guardó la ficha.
 * `before` son las medidas como estaban y `after` como quedaron, en orden.
 */
export async function moveMeasureRefs(tx: Tx, productId: string, before: MeasureRow[], after: MeasureRow[], opts: { byPosition?: boolean } = {}): Promise<void> {
  const { keys, stock } = measureMoves(before, after, opts);
  await moveStock(tx, productId, stock, after);
  await moveCosts(tx, productId, stock);
  if (keys.size === 0) return;
  const from = [...keys.keys()];
  const label = new Map(after.flatMap((v) => (variantKey(v) ? [[variantKey(v)!, markLabel(v)] as const] : [])));

  // La medida que vende cada publicación de una familia.
  const sells = await tx.publication.findMany({ where: { productId, variantKey: { in: from } }, select: { id: true, variantKey: true } });
  for (const p of sells) await tx.publication.update({ where: { id: p.id }, data: { variantKey: moved(keys, p.variantKey!) } });

  // Las fotos y los videos marcados para una medida, y el orden de cada medida.
  const pubs = await tx.publication.findMany({ where: { productId }, select: { id: true, media: true, videoVariants: true } });
  for (const p of pubs) {
    const media = movedMedia(p.media, keys);
    const videos = movedVideoVariants(p.videoVariants, keys);
    if (!media && !videos) continue;
    await tx.publication.update({
      where: { id: p.id },
      data: { ...(media ? { media: media as Prisma.InputJsonValue } : {}), ...(videos ? { videoVariants: videos as Prisma.InputJsonValue } : {}) },
    });
  }

  // Lo de Registro de productos.
  for (const [old, now] of keys) {
    const data = { variantKey: now, variantLabel: label.get(now) ?? null };
    await tx.photoEdit.updateMany({ where: { productId, variantKey: old }, data });
    await tx.productVideo.updateMany({ where: { productId, variantKey: old }, data });
    await tx.shootCheck.updateMany({ where: { productId, variantKey: old }, data });
  }
}

/**
 * El stock y su historial pasan a la clave nueva, con el nombre nuevo. Si en
 * la clave nueva quedaba stock de una medida que ya no estaba en la ficha, lo
 * reemplaza el de la medida mudada.
 */
async function moveStock(tx: Tx, productId: string, keys: Map<string, string>, after: MeasureRow[]): Promise<void> {
  const slots = stockSlots(after);
  const labelOf = new Map(slots.map((s) => [s.key, s.label]));
  const rows = await tx.productStock.findMany({
    where: { productId },
    select: { key: true, label: true, quantity: true, lowAt: true, outSince: true, remindedAt: true, cutAt: true },
  });
  const moving = rows.filter((r) => keys.has(r.key));
  if (moving.length > 0) {
    const gone = new Set([...moving.map((r) => r.key), ...moving.map((r) => keys.get(r.key)!)]);
    await tx.productStock.deleteMany({ where: { productId, key: { in: [...gone] } } });
    await tx.productStock.createMany({
      data: moving.map((r) => {
        const key = keys.get(r.key)!;
        // Con sus alarmas de stock, que siguen corriendo.
        return { ...r, productId, key, label: labelOf.get(key) ?? r.label };
      }),
    });
    // El historial, de una vez por medida: así dos medidas que se cambian el nombre no se mezclan.
    const history = await tx.stockMovement.findMany({ where: { productId, key: { in: moving.map((r) => r.key) } }, select: { id: true, key: true } });
    for (const [old, now] of keys) {
      const ids = history.filter((h) => h.key === old).map((h) => h.id);
      if (ids.length > 0) await tx.stockMovement.updateMany({ where: { id: { in: ids } }, data: { key: now } });
    }
  }
  // El nombre al día, también si cambió sin cambiar la clave, como una sola medida que pasa a llamarse STD.
  for (const r of rows.filter((x) => !keys.has(x.key))) {
    const name = labelOf.get(r.key);
    if (name !== undefined && name !== r.label) await tx.productStock.update({ where: { productId_key: { productId, key: r.key } }, data: { label: name } });
  }
}

/** El costo de cada medida pasa a su clave nueva, como el stock. */
async function moveCosts(tx: Tx, productId: string, keys: Map<string, string>): Promise<void> {
  if (keys.size === 0) return;
  const moving = await tx.productCost.findMany({ where: { productId, key: { in: [...keys.keys()] } }, select: { key: true, cost: true } });
  if (moving.length === 0) return;
  const gone = new Set([...moving.map((r) => r.key), ...moving.map((r) => keys.get(r.key)!)]);
  await tx.productCost.deleteMany({ where: { productId, key: { in: [...gone] } } });
  await tx.productCost.createMany({ data: moving.map((r) => ({ productId, key: keys.get(r.key)!, cost: r.cost })) });
}
