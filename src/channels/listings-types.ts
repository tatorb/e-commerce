import type { ChannelStatus } from '@/generated/prisma/enums';
import type { ChannelVariation } from '@/domain/media';

// Leer las publicaciones de una tienda desde su canal, con la cuenta
// conectada. Cada canal lo resuelve en src/channels/<canal>/; el importador
// convierte lo leído en filas, como las de una planilla. Solo corre en el
// servidor.

export type ListingStatus = 'active' | 'paused' | 'closed';
export const LISTING_STATUSES: ListingStatus[] = ['active', 'paused', 'closed'];

// De a cuántas se leen por pedido desde la pantalla.
export const LISTINGS_BATCH = 20;

/** Una publicación tal como la informa el canal, sin el formato del canal. */
export type ChannelListing = {
  externalId: string;
  url: string | null;
  title: string | null;
  description: string | null;
  // Precio público, sin el descuento.
  price: number | null;
  // Las cuotas: 0 sin cuotas, 1 la cuota promocionada, o la cantidad sin interés. Null si el canal no lo informa.
  installments: number | null;
  // El descuento sobre el precio público, en %. 0 sin descuento; null si no se sabe.
  discount: number | null;
  status: ChannelStatus;
  // Vendidos desde que se publicó.
  sold: number | null;
  visits90d: number | null;
  photos: string[];
  // El código de cada foto en el canal, en el mismo orden, si lo informa.
  photoIds?: string[];
  hasVideo: boolean;
  // Calidad según el canal, de 0 a 100.
  quality: number | null;
  categoryId: string | null;
  categoryName: string | null;
  brand: string | null;
  partNumber: string | null;
  origin: string | null;
  skus: string[];
  // La medida de cada variante, cuando el canal las tiene.
  measures: { sku: string; measure: string }[];
  // Cada variante con el código de sus fotos, aunque no tenga SKU o medida.
  variations: ChannelVariation[];
  // Los demás datos de la ficha del canal. multiple: vino con varios valores.
  attributes: { id: string; name: string; value: string; multiple?: boolean }[];
  // Cuántos datos de la ficha del canal tiene cargados, contando marca y SKU.
  attributeCount: number;
  // Cuándo cambió por última vez en el canal, si lo informa.
  updatedAt: string | null;
};

export interface ChannelListings {
  /** Cuántas hay de cada estado. */
  countByStatus(accessToken: string, userId: string): Promise<Record<ListingStatus, number>>;
  /** Los códigos de las publicaciones con esos estados. */
  listIds(accessToken: string, userId: string, statuses: ListingStatus[]): Promise<string[]>;
  /**
   * Hasta LISTINGS_BATCH publicaciones propias; las que no vinieron o son de
   * otra cuenta, en missing. Con description, la descripción se pide solo para
   * las que dice que sí.
   */
  readListings(
    accessToken: string,
    userId: string,
    ids: string[],
    opts?: { description?: (listing: ChannelListing) => boolean },
  ): Promise<{ listings: ChannelListing[]; missing: string[] }>;
}
