import { prisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
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

/** La primera foto de una lista de fotos leída del canal, si tiene. */
export function firstPhoto(photos: unknown): string | null {
  const first = Array.isArray(photos) ? photos.find((p) => typeof p === 'string' && p.trim()) : null;
  return typeof first === 'string' ? first : null;
}

/**
 * La foto de portada de cada producto, para mostrarlo en las listas: la
 * primera foto en el canal de su publicación más vieja que tenga fotos y, si
 * no hay, la primera foto de la ficha.
 */
export async function productCovers(productIds: string[], db: Pick<typeof prisma, '$queryRaw'> = prisma): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();
  const rows = await db.$queryRaw<{ productId: string; url: string }[]>(Prisma.sql`
    SELECT DISTINCT ON (pid) pid AS "productId", url FROM (
      SELECT p."productId" AS pid, c.photos->>0 AS url, 0 AS pri, 0 AS pos, p."createdAt" AS at
      FROM publications p JOIN channel_copies c ON c."publicationId" = p.id
      WHERE p."productId" = ANY(${productIds}) AND jsonb_typeof(c.photos) = 'array' AND coalesce(c.photos->>0, '') <> ''
      UNION ALL
      SELECT a."productId", a.url, 1, a.position, a."createdAt"
      FROM assets a
      WHERE a."productId" = ANY(${productIds}) AND a.kind = 'PHOTO'
    ) x
    ORDER BY pid, pri, pos, at`);
  return new Map(rows.map((r) => [r.productId, r.url]));
}

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
          // La familia de medidas, para mostrar sus publicaciones juntas.
          family: { select: { id: true, leadId: true, _count: { select: { members: true } } } },
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
              photos: true,
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
