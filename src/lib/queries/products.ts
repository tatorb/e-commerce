import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';

export async function listProducts(accountId: string, q?: string) {
  const term = q?.trim();
  const where: Prisma.ProductWhereInput = { accountId };
  if (term) {
    const contains = { contains: term, mode: 'insensitive' as const };
    where.OR = [
      { name: contains },
      { brand: contains },
      { partNumber: contains },
      { variants: { some: { sku: contains } } },
      { publications: { some: { externalId: contains } } },
    ];
  }
  return prisma.product.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      brand: true,
      productType: true,
      partNumber: true,
      updatedAt: true,
      _count: { select: { variants: true } },
      publications: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, stage: true, externalId: true, store: { select: { name: true } } },
      },
    },
  });
}

export type ProductListItem = Awaited<ReturnType<typeof listProducts>>[number];

export async function getProduct(accountId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, accountId },
    include: {
      variants: { orderBy: { position: 'asc' } },
      compatibilities: { orderBy: { position: 'asc' } },
      assets: { orderBy: { position: 'asc' } },
      publications: {
        orderBy: { createdAt: 'asc' },
        include: {
          store: { include: { channel: true } },
          stageMovements: {
            orderBy: { enteredAt: 'desc' },
            include: { user: { select: { name: true } } },
          },
          measurements: { orderBy: { takenAt: 'desc' } },
          proposals: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { createdBy: { select: { name: true } } },
          },
          _count: { select: { proposals: true } },
        },
      },
    },
  });
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

export async function listStores(accountId: string) {
  return prisma.store.findMany({
    where: { accountId },
    orderBy: { name: 'asc' },
    include: { channel: true },
  });
}
