import type { Prisma } from '@/generated/prisma/client';
import type { ChannelStatus } from '@/generated/prisma/enums';
import { sameValue, type UpdateMode } from '@/domain/content';
import { parseNameValueList, type NameValue } from '@/domain/name-value';

// Datos de la publicación que no son contenido: el estado, el link y el precio
// en el canal, y los datos de catálogo. Una importación los cambia y deshacer
// los devuelve, igual que el contenido.

export const LISTING_FIELDS = ['channelStatus', 'url', 'price', 'attributes'] as const;
export type ListingField = (typeof LISTING_FIELDS)[number];

// Los que una lectura del canal actualiza siempre, aunque se elija solo completar.
export const SYNC_FIELDS = ['channelStatus', 'url', 'price'] as const satisfies readonly ListingField[];

export const LISTING_FIELD_LABEL: Record<ListingField, string> = {
  channelStatus: 'Estado en el canal',
  url: 'Link',
  price: 'Precio',
  attributes: 'Datos de catálogo',
};

export function isListingField(value: string): value is ListingField {
  return (LISTING_FIELDS as readonly string[]).includes(value);
}

export type ListingSnapshot = { channelStatus: ChannelStatus; url: string | null; price: number | null; attributes: NameValue[] };

type Tx = Prisma.TransactionClient;

export async function loadListing(tx: Tx, publicationId: string): Promise<ListingSnapshot> {
  const p = await tx.publication.findUniqueOrThrow({
    where: { id: publicationId },
    select: { channelStatus: true, url: true, price: true, attributes: true },
  });
  return {
    channelStatus: p.channelStatus,
    url: p.url,
    price: p.price === null ? null : Number(p.price),
    attributes: parseNameValueList(p.attributes),
  };
}

export async function writeListingField(tx: Tx, publicationId: string, field: ListingField, value: unknown): Promise<void> {
  const data: Prisma.PublicationUpdateInput =
    field === 'attributes'
      ? { attributes: parseNameValueList(value) }
      : field === 'price'
        ? { price: typeof value === 'number' ? value : null }
        : field === 'url'
          ? { url: typeof value === 'string' ? value : null }
          : { channelStatus: value as ChannelStatus };
  await tx.publication.update({ where: { id: publicationId }, data });
}

export type ListingChange = { field: ListingField; kind: 'fill' | 'replace' | 'sync'; before: unknown; after: unknown };

/**
 * Qué cambia en la publicación. Los datos de catálogo se cargan si no tenía y
 * se reemplazan solo si se eligió reemplazar. Con sync, el estado, el link y
 * el precio toman lo que dice el canal; lo que el canal no informa no se toca.
 */
export function planListingUpdate(
  current: ListingSnapshot,
  incoming: { channelStatus: ChannelStatus; url: string | null; price: number | null; attributes: NameValue[] },
  mode: UpdateMode,
  opts: { sync: boolean },
): ListingChange[] {
  const changes: ListingChange[] = [];
  if (opts.sync) {
    for (const field of SYNC_FIELDS) {
      const after = incoming[field];
      if (after === null || sameValue(current[field], after)) continue;
      changes.push({ field, kind: 'sync', before: current[field], after });
    }
  }
  if (incoming.attributes.length > 0 && !sameValue(current.attributes, incoming.attributes)) {
    if (current.attributes.length === 0) changes.push({ field: 'attributes', kind: 'fill', before: [], after: incoming.attributes });
    else if (mode === 'REPLACE') changes.push({ field: 'attributes', kind: 'replace', before: current.attributes, after: incoming.attributes });
  }
  return changes;
}
