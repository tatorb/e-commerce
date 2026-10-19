import type { ChannelKind } from '@/generated/prisma/enums';
import { mercadolibreListings } from './mercadolibre/listings';
import type { ChannelListings } from './listings-types';

// De qué canales se pueden traer las publicaciones con la cuenta conectada.
// Los tipos están en listings-types.ts, así cada canal los usa sin depender de
// esta lista.

export { LISTING_STATUSES, LISTINGS_BATCH, type ChannelListing, type ChannelListings, type ListingStatus } from './listings-types';

const LISTINGS: Partial<Record<ChannelKind, ChannelListings>> = {
  MERCADOLIBRE: mercadolibreListings,
};

export function getChannelListings(kind: ChannelKind): ChannelListings | null {
  return LISTINGS[kind] ?? null;
}
