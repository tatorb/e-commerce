// Cambiar una publicación en el canal con la cuenta conectada. Cada canal lo
// resuelve en src/channels/<canal>/; el resto de la app usa esta interfaz y
// nunca conoce el formato del canal. Solo corre en el servidor.

import type { VariantLike } from '@/domain/media';

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
 * Una publicación nueva: la única, o la de una medida de la familia. Cada una
 * lleva su SKU, lo que elige el comprador, su precio, su cantidad y sus fotos,
 * por su posición en la lista y en el orden en que las ve.
 */
export type ChannelNewMember = VariantLike & { price: number; quantity: number; pictures: number[] };

/** Lo que hace falta para crear publicaciones en el canal. */
export type ChannelNewListing = {
  // Con varias, el nombre de la familia que comparten.
  title: string;
  categoryId: string;
  currency: string;
  listingType: string;
  description: string | null;
  attributes: ChannelAttributeUpdate[];
  // Las fotos de todas: una foto que va en varias se sube una sola vez.
  pictures: ChannelPicture[];
  // Por ejemplo "6 meses".
  warranty: string | null;
  // Una sola, o una por medida, todas en la misma familia.
  members: ChannelNewMember[];
};

/** Una publicación que se creó: su código, su link y el código de cada foto en el canal, si lo informa. */
export type ChannelCreatedMember = { externalId: string; url: string | null; pictureIds: string[] | null };

export type ChannelCreated = {
  // Una por cada una que se pidió, en el mismo orden: null si esa no se creó, con el motivo en warnings.
  members: (ChannelCreatedMember | null)[];
  // Lo que se creó pero quedó a medias, como la descripción, y las que no se crearon.
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

/** Entre qué precios con descuento acepta el canal, y el que sugiere. null en un lado: no pone límite ahí. */
export type ChannelPriceRange = { minPrice: number | null; maxPrice: number | null; suggestedPrice: number | null };

/** Una campaña del canal en la que está la publicación o a la que la invitan. */
export type ChannelCampaign = {
  // Cómo la identifica el canal para sumarse o salir: la app lo guarda y lo devuelve sin interpretarlo.
  ref: string | null;
  name: string | null;
  // Qué tipo de campaña es, en castellano: "Campaña tradicional", "Co-fondeada".
  kind: string;
  // invited: la invitan; scheduled: está anotada y todavía no empezó; active: está adentro.
  status: 'invited' | 'scheduled' | 'active';
  // El precio para el comprador en la campaña, si el canal lo informa.
  price: number | null;
  // La parte del descuento que pone el canal y la que pone la tienda, en %.
  channelPct: number | null;
  sellerPct: number | null;
  start: Date | null;
  finish: Date | null;
  // Cómo se suma desde la app: price, eligiendo el precio dentro de range; accept,
  // aceptando el que propone el canal. null: solo desde el canal.
  join: 'price' | 'accept' | null;
  range: ChannelPriceRange | null;
  // Si se puede salir desde la app.
  canLeave: boolean;
  // Si mientras está en la campaña el canal frena el descuento propio.
  pausesOwnDiscount: boolean;
  // El precio publicado sobre el que se calcula la campaña.
  listPrice: number | null;
};

/**
 * Lo que el canal deja hacer hoy con los descuentos de una publicación, como
 * lo informa: el rango de precio con descuento que acepta, el descuento propio
 * que tiene y las campañas. Los precios son para el comprador, con IVA.
 */
export type ChannelPromotions = {
  // El precio publicado que tiene hoy en el canal, sobre el que informa el rango.
  listPrice: number | null;
  // null: hoy el canal no deja ponerle un descuento propio, o no lo informa.
  discount: ChannelPriceRange | null;
  // El descuento propio puesto, o programado para empezar.
  current: { price: number | null; scheduled: boolean } | null;
  campaigns: ChannelCampaign[];
};

export interface ChannelPublisher {
  /** Los tipos de publicación que ofrece el canal, el primero es el de siempre. */
  listingTypes: { value: string; label: string }[];
  /**
   * Crea las publicaciones, en orden. Lanza PublishError si el canal no acepta
   * la primera; si ya se creó alguna, sigue con las demás y avisa cuál faltó.
   */
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
   * Lo que el canal deja hacer hoy con los descuentos de la publicación. Sin
   * details, solo el estado de cada campaña, sin lo que hace falta para
   * sumarse: más rápido, para confirmar después de subir. Lanza PublishError
   * si no lo puede leer.
   */
  readPromotions?(accessToken: string, externalId: string, opts?: { details?: boolean }): Promise<ChannelPromotions>;
  /**
   * Suma la publicación a una campaña, por su ref. Con price, el precio para el
   * comprador, en las que lo elige la tienda. Lanza PublishError si el canal no lo acepta.
   */
  joinCampaign?(accessToken: string, externalId: string, ref: string, price: number | null): Promise<void>;
  /** Saca la publicación de una campaña. Si ya no estaba, no hace nada. Lanza PublishError si el canal no lo acepta. */
  leaveCampaign?(accessToken: string, externalId: string, ref: string): Promise<void>;
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
