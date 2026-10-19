import type { Prisma } from '@/generated/prisma/client';

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
