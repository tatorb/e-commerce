import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import type { ProductKind } from '@/generated/prisma/enums';
import { productSearchWhere } from './product-search';

export async function listProducts(accountId: string, q?: string, kinds: ProductKind[] = []) {
  const where: Prisma.ProductWhereInput = {
    accountId,
    ...productSearchWhere(q),
    ...(kinds.length > 0 ? { kind: { in: kinds } } : {}),
  };
  return prisma.product.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      kind: true,
      brand: true,
      productType: true,
      partNumber: true,
      updatedAt: true,
      _count: { select: { variants: true } },
      publications: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          pipelineStatus: true,
          pipelineStep: true,
          pipelineRemoval: true,
          externalId: true,
          store: { select: { name: true } },
        },
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
          pipelineMovements: {
            orderBy: { enteredAt: 'desc' },
            include: { exitedBy: { select: { name: true } } },
          },
          measurements: { orderBy: { takenAt: 'desc' } },
          // La vigente, o la última que se decidió.
          proposals: {
            where: { status: { not: 'SUPERSEDED' } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { createdBy: { select: { name: true } }, decidedBy: { select: { name: true } } },
          },
          _count: { select: { proposals: true } },
          applications: {
            orderBy: { appliedAt: 'desc' },
            take: 1,
            include: { createdBy: { select: { name: true } } },
          },
          // Para saber si tiene cambios sin subir o datos para elegir, y su precio y su cantidad en el canal.
          channelCopy: {
            select: {
              fingerprints: true,
              agreed: true,
              rejections: true,
              missingSince: true,
              price: true,
              installments: true,
              discount: true,
              quantity: true,
              variations: true,
              details: true,
              stockInChannel: true,
            },
          },
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
