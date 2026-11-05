import type { PrismaClient } from '@/generated/prisma/client';
import type { ChannelStatus } from '@/generated/prisma/enums';

// El buscador del simulador de precio: cualquier publicación de la cuenta, por
// su código en el canal, el SKU, su título o el nombre del producto.

export type SimulatorPick = {
  id: string;
  title: string | null;
  externalId: string | null;
  channelStatus: ChannelStatus;
  product: string;
  store: string;
  skus: string[];
};

export async function searchForSimulator(db: PrismaClient, accountId: string, q: string): Promise<SimulatorPick[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const contains = { contains: term, mode: 'insensitive' as const };
  const rows = await db.publication.findMany({
    where: {
      product: { accountId },
      channelStatus: { not: 'DELETED' },
      OR: [
        { externalId: contains },
        // El código como lo escriben a veces, con guion: MLA-123.
        { externalId: { contains: term.replace(/[\s-]/g, ''), mode: 'insensitive' } },
        { title: contains },
        { product: { name: contains } },
        { product: { variants: { some: { sku: contains } } } },
      ],
    },
    orderBy: [{ product: { name: 'asc' } }, { title: 'asc' }],
    take: 30,
    select: {
      id: true,
      title: true,
      externalId: true,
      channelStatus: true,
      store: { select: { name: true } },
      product: { select: { name: true, variants: { orderBy: { position: 'asc' }, select: { sku: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    externalId: r.externalId,
    channelStatus: r.channelStatus,
    product: r.product.name,
    store: r.store.name,
    skus: r.product.variants.map((v) => v.sku?.trim()).filter((s): s is string => Boolean(s)),
  }));
}
