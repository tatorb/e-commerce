import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import type { ProductKind } from '@/generated/prisma/enums';

// Individuales y combos. Un combo es un producto armado con productos
// individuales, cada uno con su cantidad. En el canal, combos e individuales
// son publicaciones del mismo nivel; la diferencia es solo de la app.

type Tx = Prisma.TransactionClient;

export class ComboError extends Error {}

export const PRODUCT_KINDS: ProductKind[] = ['INDIVIDUAL', 'COMBO'];
export const PRODUCT_KIND_LABEL: Record<ProductKind, string> = { INDIVIDUAL: 'Individual', COMBO: 'Combo' };
export const MAX_COMBO_ITEMS = 50;
export const MAX_COMBO_QUANTITY = 99;

export const comboItemsSchema = z
  .array(
    z.object({
      productId: z.string().min(1),
      quantity: z.coerce
        .number({ message: 'La cantidad tiene que ser un número.' })
        .int('La cantidad tiene que ser un número entero.')
        .min(1, 'La cantidad mínima es 1.')
        .max(MAX_COMBO_QUANTITY, `La cantidad máxima es ${MAX_COMBO_QUANTITY}.`),
    }),
  )
  .max(MAX_COMBO_ITEMS, `Hasta ${MAX_COMBO_ITEMS} productos por combo.`);

export type ComboItemInput = z.input<typeof comboItemsSchema>[number];

const names = (list: { name: string }[]) => list.map((p) => `«${p.name}»`).join(', ');

// De a un cambio por combo a la vez, así la lista no se mezcla.
async function lockCombo(tx: Tx, comboId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`combo:${comboId}`}))`;
}

/** Los combos de los que forma parte un producto. */
export async function combosOf(tx: Tx, productId: string) {
  const rows = await tx.comboItem.findMany({
    where: { productId },
    orderBy: { combo: { name: 'asc' } },
    select: { quantity: true, combo: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({ id: r.combo.id, name: r.combo.name, quantity: r.quantity }));
}

/**
 * Cambia el producto a individual o combo. Un producto que está dentro de un
 * combo no puede ser combo; al pasar un combo a individual se borra su lista.
 */
export async function setProductKind(tx: Tx, args: { accountId: string; productId: string; kind: ProductKind }) {
  const product = await tx.product.findFirst({ where: { id: args.productId, accountId: args.accountId }, select: { id: true, kind: true } });
  if (!product) throw new ComboError('El producto no existe en esta cuenta.');
  if (product.kind === args.kind) return;
  if (args.kind === 'COMBO') {
    const combos = await combosOf(tx, product.id);
    if (combos.length > 0) {
      throw new ComboError(`Forma parte de ${names(combos)}: un producto que está dentro de un combo no puede ser combo.`);
    }
  } else {
    await lockCombo(tx, product.id);
    await tx.comboItem.deleteMany({ where: { comboId: product.id } });
  }
  await tx.product.update({ where: { id: product.id }, data: { kind: args.kind } });
}

/** Reemplaza la lista de productos de un combo, en el orden en que llega. */
export async function setComboItems(tx: Tx, args: { accountId: string; comboId: string; items: ComboItemInput[] }) {
  const parsed = comboItemsSchema.safeParse(args.items);
  if (!parsed.success) throw new ComboError(parsed.error.issues[0]?.message ?? 'Revisá los productos del combo.');
  const items = parsed.data;
  await lockCombo(tx, args.comboId);
  const combo = await tx.product.findFirst({ where: { id: args.comboId, accountId: args.accountId }, select: { id: true, kind: true } });
  if (!combo) throw new ComboError('El combo no existe en esta cuenta.');
  if (combo.kind !== 'COMBO') throw new ComboError('El producto no es un combo: cambialo a Combo primero.');

  const ids = items.map((i) => i.productId);
  if (ids.includes(combo.id)) throw new ComboError('Un combo no puede incluirse a sí mismo.');
  const products = await tx.product.findMany({ where: { id: { in: ids }, accountId: args.accountId }, select: { id: true, name: true, kind: true } });
  const byId = new Map(products.map((p) => [p.id, p]));
  if (ids.some((id) => !byId.has(id))) throw new ComboError('Uno de los productos ya no existe en esta cuenta.');
  const repeated = products.filter((p) => ids.indexOf(p.id) !== ids.lastIndexOf(p.id));
  if (repeated.length > 0) throw new ComboError(`${names(repeated)} está más de una vez: sumá las cantidades en una sola fila.`);
  const combos = products.filter((p) => p.kind === 'COMBO');
  if (combos.length > 0) throw new ComboError(`${names(combos)} es un combo: un combo se arma solo con productos individuales.`);

  await tx.comboItem.deleteMany({ where: { comboId: combo.id } });
  if (items.length > 0) {
    await tx.comboItem.createMany({
      data: items.map((i, position) => ({ comboId: combo.id, productId: i.productId, quantity: i.quantity, position })),
    });
  }
}

/** Avisa si el producto no se puede borrar porque está dentro de algún combo. */
export async function assertNotInCombos(tx: Tx, productId: string) {
  const combos = await combosOf(tx, productId);
  if (combos.length > 0) {
    throw new ComboError(`No se puede borrar: forma parte de ${names(combos)}. Sacalo de ${combos.length === 1 ? 'ese combo' : 'esos combos'} primero.`);
  }
}
