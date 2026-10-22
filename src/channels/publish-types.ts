// Cambiar una publicación en el canal con la cuenta conectada. Cada canal lo
// resuelve en src/channels/<canal>/; el resto de la app usa esta interfaz y
// nunca conoce el formato del canal. Solo corre en el servidor.

import type { ChannelVariation, VariantLike } from '@/domain/media';

/** Los datos que hoy se pueden subir. */
export type PublishField = 'title' | 'description' | 'attributes' | 'photos';
export const PUBLISH_FIELDS: PublishField[] = ['title', 'description', 'attributes', 'photos'];

/** Un dato de catálogo para subir: el código del campo en el canal y su valor; con multiple, varios separados por coma. */
export type ChannelAttributeUpdate = { id: string; value: string; multiple: boolean };

/** El canal no aceptó el cambio. El mensaje explica por qué, en castellano. */
export class PublishError extends Error {}

/** Una foto para la publicación: una que ya está en el canal, un link público o un archivo. */
export type ChannelPicture =
  | { kind: 'existing'; id: string }
  | { kind: 'link'; url: string }
  | { kind: 'file'; data: Uint8Array; type: string; name: string };

/**
 * Qué fotos ve el comprador en cada medida, por su posición en la lista de
 * fotos y en el orden en que las ve. general: las de todas las medidas, para
 * las medidas del canal que la ficha no tiene.
 */
export type ChannelPictureLayout = {
  variants: (VariantLike & { pictures: number[] })[];
  general: number[];
};

/**
 * Una medida de la publicación nueva: lo que elige el comprador, su SKU, su
 * cantidad y sus fotos, por su posición en la lista y en el orden en que las ve.
 */
export type ChannelNewVariant = VariantLike & { measure: string; quantity: number; pictures: number[] };

/** Lo que hace falta para crear una publicación en el canal. */
export type ChannelNewListing = {
  title: string;
  categoryId: string;
  price: number;
  currency: string;
  // Sin medidas: la cantidad y el SKU de la publicación.
  quantity: number;
  listingType: string;
  description: string | null;
  attributes: ChannelAttributeUpdate[];
  pictures: ChannelPicture[];
  sku: string | null;
  // Por ejemplo "6 meses".
  warranty: string | null;
  // Con dos o más, la publicación se crea con esas medidas, todas al mismo precio.
  variants: ChannelNewVariant[];
};

export type ChannelCreated = {
  externalId: string;
  url: string | null;
  // El código de cada foto en el canal, en orden, si lo informa.
  pictureIds: string[] | null;
  // Las medidas como quedaron en el canal, con el código de sus fotos. Vacío sin medidas.
  variations: ChannelVariation[];
  // Lo que se creó pero quedó a medias, como la descripción.
  warnings: string[];
};

export interface ChannelPublisher {
  /** Los tipos de publicación que ofrece el canal, el primero es el de siempre. */
  listingTypes: { value: string; label: string }[];
  /** Crea la publicación. Lanza PublishError si el canal no la acepta. */
  create(accessToken: string, listing: ChannelNewListing): Promise<ChannelCreated>;
  /**
   * Deja las fotos de la publicación en ese orden y, si tiene medidas, las de
   * cada una. Devuelve el código de cada foto, si lo informa.
   */
  updatePictures(accessToken: string, externalId: string, pictures: ChannelPicture[], layout: ChannelPictureLayout): Promise<string[] | null>;
  /** Cambia el título o la descripción de una publicación propia. Lanza PublishError si el canal no lo acepta. */
  update(accessToken: string, externalId: string, field: 'title' | 'description', value: string): Promise<void>;
  /** Cambia esos datos de catálogo; los demás quedan como están. Lanza PublishError si el canal no lo acepta. */
  updateAttributes(accessToken: string, externalId: string, attributes: ChannelAttributeUpdate[]): Promise<void>;
}
