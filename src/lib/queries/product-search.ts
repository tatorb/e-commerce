import type { Prisma, PrismaClient } from '@/generated/prisma/client';

// Sin la base: lo usan consultas que reciben la base por parámetro.

/** Lo que busca el buscador de productos: nombre, marca, número de pieza, SKU o código de publicación. */
export function productSearchWhere(q: string | undefined): Prisma.ProductWhereInput {
  const term = q?.trim();
  if (!term) return {};
  const contains = { contains: term, mode: 'insensitive' as const };
  return {
    OR: [
      { name: contains },
      { brand: contains },
      { partNumber: contains },
      { variants: { some: { sku: contains } } },
      { publications: { some: { externalId: contains } } },
    ],
  };
}

type Db = PrismaClient | Prisma.TransactionClient;

const PRODUCT_PICK = { id: true, name: true, brand: true, partNumber: true, productType: true, kind: true } as const;

/** Hasta 10 productos de la cuenta para elegir, con el mismo buscador de Productos. */
export async function searchProducts(db: Db, accountId: string, q: string, where: Prisma.ProductWhereInput = {}) {
  if (q.trim().length < 2) return [];
  return db.product.findMany({
    where: { accountId, ...where, ...productSearchWhere(q) },
    orderBy: { name: 'asc' },
    take: 10,
    select: PRODUCT_PICK,
  });
}

export type ProductPick = Awaited<ReturnType<typeof searchProducts>>[number];
