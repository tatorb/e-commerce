// Cambiar una publicación en el canal con la cuenta conectada. Cada canal lo
// resuelve en src/channels/<canal>/; el resto de la app usa esta interfaz y
// nunca conoce el formato del canal. Solo corre en el servidor.

import type { ChannelVariation, VariantLike } from '@/domain/media';

/** Los datos que hoy se pueden subir. */
export type PublishField = 'title' | 'description' | 'attributes' | 'photos' | 'price' | 'installments' | 'discount' | 'quantity';
export const PUBLISH_FIELDS: PublishField[] = ['title', 'description', 'attributes', 'photos', 'price', 'installments', 'discount', 'quantity'];

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
  // Las medidas como quedaron en el canal, con el código de sus fotos. Vacío sin
  // medidas. Si el canal guarda cada medida como una publicación aparte, cada
  // una trae su código; la primera es externalId.
  variations: ChannelVariation[];
  // Lo que se creó pero quedó a medias, como la descripción.
  warnings: string[];
};

/** Los cambios de estado que se le piden al canal. Republicar va aparte, porque crea otra publicación. */
export type ChannelStatusChange = 'pause' | 'activate' | 'close' | 'delete';

/** Lo que pide el canal para republicar una finalizada: precio, cantidad y tipo, y la cantidad de cada medida si tiene. */
export type ChannelRelist = {
  price: number;
  quantity: number;
  listingType: string;
  variants: (VariantLike & { quantity: number })[];
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
  /**
   * Para las medidas que el canal guarda como publicaciones aparte: deja en
   * cada una sus fotos, por su posición en la lista y en ese orden. Una foto
   * que va en varias se sube una sola vez. Devuelve el código de las fotos de
   * cada una, si el canal lo informa.
   */
  updateSeparatePictures(accessToken: string, listings: { externalId: string; pictures: number[] }[], pictures: ChannelPicture[]): Promise<(string[] | null)[]>;
  /**
   * Cambia el título o la descripción de una publicación propia. Con family,
   * la publicación es una medida de una familia y el título es el nombre que
   * comparten todas. Lanza PublishError si el canal no lo acepta.
   */
  update(accessToken: string, externalId: string, field: 'title' | 'description', value: string, opts?: { family?: boolean }): Promise<void>;
  /** Cambia el precio publicado; con medidas, el de todas. Lanza PublishError si el canal no lo acepta. */
  updatePrice(accessToken: string, externalId: string, price: number): Promise<void>;
  /**
   * Deja las cuotas: 0 sin cuotas, 1 la cuota promocionada, o 3, 6, 9 o 12 sin
   * interés. Lanza PublishError si el canal no lo acepta.
   */
  setInstallments(accessToken: string, externalId: string, plan: number): Promise<void>;
  /** El descuento que acepta el canal, en %. */
  discountRange: { min: number; max: number };
  /**
   * Pone ese descuento sobre el precio publicado, en %, o lo saca con 0. El que
   * había se reemplaza. Devuelve hasta cuándo dura, si el canal le pone fin.
   * Lanza PublishError si el canal no lo acepta.
   */
  setDiscount(accessToken: string, externalId: string, discount: { pct: number; listPrice: number }, now: Date): Promise<{ until: Date | null }>;
  /**
   * Deja la cantidad disponible. Sin medidas, una sola con la clave vacía; con
   * medidas en la misma publicación, la de cada una por su clave (quantityKey).
   * Las medidas que no vienen quedan como están. Lanza PublishError si el canal
   * no lo acepta, por ejemplo si el stock lo maneja el canal.
   */
  setQuantity(accessToken: string, externalId: string, lines: { key: string; quantity: number }[]): Promise<void>;
  /** Cambia esos datos de catálogo; los demás quedan como están. Lanza PublishError si el canal no lo acepta. */
  updateAttributes(accessToken: string, externalId: string, attributes: ChannelAttributeUpdate[]): Promise<void>;
  /** Pausa, reactiva, finaliza o elimina. Lanza PublishError si el canal no lo acepta. */
  setStatus(accessToken: string, externalId: string, change: ChannelStatusChange): Promise<void>;
  /** Republica una finalizada: el canal crea otra con los mismos datos. Devuelve su código. */
  relist(accessToken: string, externalId: string, relist: ChannelRelist): Promise<{ externalId: string; url: string | null }>;
}
