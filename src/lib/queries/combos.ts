import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { productSearchWhere } from './product-search';

// Lo que muestran las tarjetas de combos: los productos de un combo, o los
// combos de los que forma parte un individual. Recibe la base por parámetro
// para poder probarlo.

type Db = PrismaClient | Prisma.TransactionClient;

const PRODUCT_SUMMARY = { id: true, name: true, brand: true, partNumber: true, productType: true } as const;

export async function loadCombo(db: Db, productId: string) {
  const p = await db.product.findUnique({
    where: { id: productId },
    select: {
      kind: true,
      comboItems: { orderBy: { position: 'asc' }, select: { quantity: true, product: { select: PRODUCT_SUMMARY } } },
      inCombos: { orderBy: { combo: { name: 'asc' } }, select: { quantity: true, combo: { select: { id: true, name: true } } } },
    },
  });
  if (!p) return null;
  return {
    kind: p.kind,
    items: p.comboItems.map((i) => ({ ...i.product, quantity: i.quantity })),
    inCombos: p.inCombos.map((c) => ({ ...c.combo, quantity: c.quantity })),
  };
}

export type ComboData = NonNullable<Awaited<ReturnType<typeof loadCombo>>>;
export type ComboProduct = ComboData['items'][number];

/** Los individuales que se pueden sumar a un combo, con el mismo buscador de Productos. */
export async function searchComboCandidates(db: Db, accountId: string, comboId: string, q: string) {
  if (q.trim().length < 2) return [];
  return db.product.findMany({
    where: { accountId, kind: 'INDIVIDUAL', id: { not: comboId }, ...productSearchWhere(q) },
    orderBy: { name: 'asc' },
    take: 10,
    select: PRODUCT_SUMMARY,
  });
}
