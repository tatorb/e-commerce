import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { parseNameValueList } from '@/domain/name-value';
import { factoryPackageOf, loadedPackage, packageTooSmall, type Package } from '@/domain/package';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * El paquete cargado de la publicación y el empaque que calcula el canal para
 * su producto: el de ella o, si todavía no está publicada, el de otra
 * publicación del producto en la misma tienda. warning si el cargado es más chico.
 */
export async function packageState(db: Db, publicationId: string): Promise<{ loaded: Package | null; factory: Package | null; from: string | null; warning: string | null }> {
  const p = await db.publication.findUnique({
    where: { id: publicationId },
    select: { productId: true, storeId: true, externalId: true, attributes: true, channelCopy: { select: { details: true } } },
  });
  if (!p) return { loaded: null, factory: null, from: null, warning: null };
  let factory = factoryPackageOf(p.channelCopy?.details);
  let from = factory ? p.externalId : null;
  if (!factory) {
    const others = await db.publication.findMany({
      where: { productId: p.productId, storeId: p.storeId, id: { not: publicationId }, externalId: { not: null }, channelCopy: { isNot: null } },
      orderBy: { updatedAt: 'desc' },
      select: { externalId: true, channelCopy: { select: { details: true } } },
    });
    const hit = others.find((o) => factoryPackageOf(o.channelCopy?.details));
    factory = hit ? factoryPackageOf(hit.channelCopy?.details) : null;
    from = hit?.externalId ?? null;
  }
  const loaded = loadedPackage(parseNameValueList(p.attributes));
  return { loaded, factory, from, warning: loaded && factory ? packageTooSmall(loaded, factory) : null };
}
