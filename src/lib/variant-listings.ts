import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { ChannelListing, ChannelListings } from '@/channels/listings';
import { LISTINGS_BATCH } from '@/channels/listings';
import type { VariantListing } from '@/domain/media';

// Las medidas que el canal guarda como publicaciones aparte, agrupadas en una
// familia. En la app son una sola publicación: se leen juntas y la cara del
// canal es la de la primera, con las fotos de todas. Este módulo no sabe nada
// de canales.

type Db = PrismaClient | Prisma.TransactionClient;

/** A qué publicación de la app pertenece la publicación aparte de cada medida, por su código. */
export async function variantListingOwners(db: Db, storeId: string): Promise<Map<string, string>> {
  const rows = await db.$queryRaw<{ id: string; externalId: string }[]>`
    SELECT p.id, m->>'externalId' AS "externalId"
    FROM publications p, jsonb_array_elements(p."variantListings") m
    WHERE p."storeId" = ${storeId} AND jsonb_typeof(p."variantListings") = 'array' AND m->>'externalId' IS NOT NULL`;
  return new Map(rows.map((r) => [r.externalId, r.id]));
}

/** Lee las publicaciones aparte de las medidas, sin la descripción: la cara usa la de la primera. */
export async function readVariantListings(
  listings: ChannelListings,
  token: string,
  userId: string,
  ids: string[],
): Promise<Map<string, ChannelListing>> {
  const out = new Map<string, ChannelListing>();
  const wanted = [...new Set(ids)];
  for (let i = 0; i < wanted.length; i += LISTINGS_BATCH) {
    const read = await listings.readListings(token, userId, wanted.slice(i, i + LISTINGS_BATCH), { description: () => false });
    for (const l of read.listings) out.set(l.externalId, l);
  }
  return out;
}

/**
 * La cara del canal de una familia: la de la primera publicación, con las
 * fotos de todas sin repetir y lo que ve el comprador en cada medida. Los
 * vendidos y las visitas son la suma.
 */
export function familyListing(head: ChannelListing, family: VariantListing[], read: Map<string, ChannelListing>): ChannelListing {
  const photos = [...head.photos];
  const photoIds = [...(head.photoIds ?? [])];
  const members = family.map((v) => ({ v, l: v.externalId === head.externalId ? head : (read.get(v.externalId) ?? null) }));
  for (const { l } of members) {
    (l?.photoIds ?? []).forEach((id, i) => {
      if (photoIds.includes(id)) return;
      photoIds.push(id);
      photos.push(l!.photos[i] ?? '');
    });
  }
  const found = members.flatMap((m) => (m.l ? [m.l] : []));
  const sum = (of: (l: ChannelListing) => number | null) => (found.some((l) => of(l) !== null) ? found.reduce((a, l) => a + (of(l) ?? 0), 0) : null);
  return {
    ...head,
    photos,
    photoIds,
    hasVideo: found.some((l) => l.hasVideo),
    sold: sum((l) => l.sold),
    visits90d: sum((l) => l.visits90d),
    skus: [...new Set(found.flatMap((l) => l.skus))],
    variations: members.map(({ v, l }) => ({ externalId: v.externalId, sku: v.sku, measure: v.measure, photoIds: [...(l?.photoIds ?? [])] })),
  };
}
