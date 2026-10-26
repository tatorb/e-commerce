// Las ventas de una tienda en su canal, con la cuenta conectada, para llevar
// el stock de los productos. Cada canal lo resuelve en src/channels/<canal>/.
// Solo corre en el servidor.

/** Una línea de la venta: qué publicación, qué medida y cuántas. */
export type ChannelOrderLine = {
  listingId: string;
  // La variante, si la publicación tiene medidas: su código en el canal.
  variationId: string | null;
  sku: string | null;
  quantity: number;
};

/** Una venta tal como la informa el canal, sin el formato del canal. */
export type ChannelOrder = {
  orderId: string;
  // La cuenta que vende, para comprobar que es de la tienda.
  sellerId: string | null;
  orderedAt: string;
  // El canal ya descontó las unidades de la publicación: la venta se confirmó.
  counts: boolean;
  cancelled: boolean;
  delivered: boolean;
  lines: ChannelOrderLine[];
};

/** El canal no deja leer las ventas, por ejemplo porque falta el permiso. */
export class SalesAccessError extends Error {}

/** Lo que trae un aviso del canal sobre una venta. */
export type SalesNotice = { userId: string; appId: string | null; orderId: string };

export interface ChannelSales {
  /** Una venta, o null si el canal no la tiene. */
  readOrder(accessToken: string, orderId: string): Promise<ChannelOrder | null>;
  /** Las ventas que cambiaron desde ese momento, las más viejas primero, hasta max. */
  recentOrders(accessToken: string, sellerId: string, since: Date, max: number): Promise<ChannelOrder[]>;
  /** El aviso que manda el canal, o null si no es de una venta. */
  parseNotice(body: unknown): SalesNotice | null;
}
