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

// ───────────────────────────── Para la sección Ventas ─────────────────────────────

/** El estado de la venta: sin pagar, pagada o cancelada. */
export type ChannelSaleState = 'pending' | 'paid' | 'cancelled';

/** Una línea con sus importes: lo que pagó el comprador por unidad y lo que cobra el canal por la línea. */
export type ChannelSaleLine = ChannelOrderLine & {
  title: string | null;
  unitPrice: number;
  // El precio por unidad antes de los descuentos. Null si el canal no lo informa.
  listPrice: number | null;
  // La comisión del canal por toda la línea. Null si no la informa.
  fee: number | null;
};

/** Un pago, como lo informa la venta. */
export type ChannelPayment = {
  id: string;
  state: 'approved' | 'pending' | 'rejected' | 'refunded' | 'cancelled' | 'other';
  amount: number;
  installments: number | null;
  method: string | null;
  approvedAt: string | null;
  refunded: number;
};

/** La venta con sus importes, el comprador, los pagos y el código del envío. */
export type ChannelSaleRecord = {
  order: ChannelOrder;
  packId: string | null;
  state: ChannelSaleState;
  closedAt: string | null;
  currency: string;
  // Lo que pagó el comprador por los productos, y lo que pagó en total con su parte del envío.
  itemsAmount: number;
  paidAmount: number | null;
  buyer: { id: string | null; nickname: string | null; name: string | null };
  lines: ChannelSaleLine[];
  payments: ChannelPayment[];
  shipmentId: string | null;
  claim: boolean;
  cancel: { by: 'buyer' | 'seller' | 'channel' | null; reason: string | null } | null;
};

/** El envío en palabras de la app. */
export type ChannelShipState = 'none' | 'pending' | 'to_ship' | 'shipped' | 'delivered' | 'not_delivered' | 'returned' | 'cancelled';

/** Quién lo lleva: el depósito del canal (como Full), lo retira el correo, se lleva a un punto, entrega propia rápida, envío del vendedor o a acordar. */
export type ChannelShipKind = 'channel' | 'pickup' | 'drop_off' | 'flex' | 'seller' | 'none';

export type ChannelShipment = {
  shipmentId: string;
  state: ChannelShipState;
  // El detalle del estado, en castellano. Null si no hay nada que agregar.
  detail: string | null;
  kind: ChannelShipKind;
  kindLabel: string;
  tracking: string | null;
  dispatchBy: string | null;
  estimatedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  delayed: boolean;
  // Lo que paga el vendedor y lo que pagó el comprador. Null sin el dato.
  sellerCost: number | null;
  buyerCost: number | null;
};

/** Lo que informa el medio de pago: lo que deposita, cuándo lo libera y lo devuelto. */
export type ChannelPaymentMoney = {
  id: string;
  net: number | null;
  releaseAt: string | null;
  released: boolean | null;
  refunded: number;
};

/** Una tanda del buscador de ventas. */
export type ChannelSalesPage = { sales: ChannelSaleRecord[]; total: number; end: boolean };

/** Lo que trae un aviso del canal sobre una venta, un envío o un pago. */
export type SaleNotice = { userId: string; appId: string | null; kind: 'order' | 'shipment' | 'payment'; id: string };

export interface ChannelSalesLedger {
  /** Una venta con sus importes, o null si el canal no la tiene. */
  readSale(accessToken: string, orderId: string): Promise<ChannelSaleRecord | null>;
  /**
   * Una tanda de ventas: las creadas entre from y to, o las que cambiaron desde
   * changedSince. Las más viejas primero.
   */
  searchSales(
    accessToken: string,
    sellerId: string,
    q: { createdFrom?: Date; createdTo?: Date; changedSince?: Date; offset: number; limit: number },
  ): Promise<ChannelSalesPage>;
  /** El envío con su costo. Null si el canal no lo tiene. */
  readShipment(accessToken: string, shipmentId: string): Promise<ChannelShipment | null>;
  /** Solo lo que pagan el vendedor y el comprador por el envío, para las ventas viejas. Null si no se sabe. */
  readShippingCost(accessToken: string, shipmentId: string): Promise<{ sellerCost: number | null; buyerCost: number | null } | null>;
  /** Lo que informa el medio de pago. Null si no deja leerlo: la venta queda sin ese dato. */
  readPayment(accessToken: string, paymentId: string): Promise<ChannelPaymentMoney | null>;
  /** El aviso que manda el canal, o null si no es de una venta, un envío o un pago. */
  parseSaleNotice(body: unknown): SaleNotice | null;
  /** La venta en la página del canal, para abrirla. */
  saleUrl(orderId: string): string | null;
}
