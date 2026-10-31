import { MercadoLibreRequestError, mlGet, mpGet } from './http';
import { salesPageUrl } from './urls';
import {
  SalesAccessError,
  type ChannelOrder,
  type ChannelPayment,
  type ChannelPaymentMoney,
  type ChannelSaleLine,
  type ChannelSaleRecord,
  type ChannelSales,
  type ChannelSalesLedger,
  type ChannelShipKind,
  type ChannelShipment,
  type ChannelShipState,
  type SaleNotice,
  type SalesNotice,
} from '../sales-types';

// Las ventas de Mercado Libre (sus "órdenes"). Mercado Libre descuenta el
// stock de la publicación cuando la venta se confirma: ahí date_closed deja de
// estar vacío. Su buscador no devuelve las canceladas: para enterarse, la app
// vuelve a pedir cada venta.

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const id = (v: unknown): string | null => (typeof v === 'number' && Number.isFinite(v) ? String(v) : str(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// De a cuántas devuelve el buscador.
const PAGE = 50;

const NO_ACCESS = 'Mercado Libre no deja leer las ventas: en la aplicación de la tienda falta el permiso de Ventas. Después de darlo, volvé a conectar la tienda.';

/** Una venta de Mercado Libre en el formato neutro. Null si no se entiende. */
export function parseOrder(o: unknown): ChannelOrder | null {
  if (!isObj(o)) return null;
  const orderId = id(o.id);
  const orderedAt = str(o.date_created);
  if (!orderId || !orderedAt) return null;
  const status = str(o.status);
  const cancelled = status === 'cancelled' || status === 'invalid';
  const tags = arr(o.tags).filter((t): t is string => typeof t === 'string');
  const lines = arr(o.order_items).flatMap((line) => {
    if (!isObj(line) || !isObj(line.item)) return [];
    const listingId = id(line.item.id);
    const quantity = typeof line.quantity === 'number' && Number.isInteger(line.quantity) && line.quantity > 0 ? line.quantity : null;
    if (!listingId || quantity === null) return [];
    return [{ listingId, variationId: id(line.item.variation_id), sku: str(line.item.seller_sku), quantity }];
  });
  return {
    orderId,
    sellerId: isObj(o.seller) ? id(o.seller.id) : null,
    orderedAt,
    counts: !cancelled && str(o.date_closed) !== null,
    cancelled,
    delivered: tags.includes('delivered'),
    lines,
  };
}

/** Sin permiso para leer ventas, el motivo; lo demás sigue como error de conexión. */
async function read(path: string, accessToken: string): Promise<unknown> {
  try {
    return await mlGet(path, accessToken);
  } catch (e) {
    if (e instanceof MercadoLibreRequestError && e.status === 403) throw new SalesAccessError(NO_ACCESS);
    throw e;
  }
}

export const mercadolibreSales: ChannelSales = {
  async readOrder(accessToken, orderId) {
    if (!/^\d{1,20}$/.test(orderId)) return null;
    try {
      return parseOrder(await read(`/orders/${orderId}`, accessToken));
    } catch (e) {
      if (e instanceof MercadoLibreRequestError && e.status === 404) return null;
      throw e;
    }
  },

  async recentOrders(accessToken, sellerId, since, max) {
    const out: ChannelOrder[] = [];
    // El buscador mira la hora, sin los minutos.
    const from = `${since.toISOString().slice(0, 13)}:00:00.000-00:00`;
    for (let offset = 0; out.length < max; offset += PAGE) {
      const q = new URLSearchParams({
        seller: sellerId,
        'order.date_last_updated.from': from,
        sort: 'date_asc',
        offset: String(offset),
        limit: String(PAGE),
      });
      const body = await read(`/orders/search?${q.toString()}`, accessToken);
      const results = isObj(body) ? arr(body.results) : [];
      for (const r of results) {
        const order = parseOrder(r);
        if (order) out.push(order);
      }
      const total = isObj(body) && isObj(body.paging) && typeof body.paging.total === 'number' ? body.paging.total : 0;
      if (results.length < PAGE || offset + PAGE >= total) break;
    }
    return out.slice(0, max);
  },

  parseNotice(body): SalesNotice | null {
    if (!isObj(body)) return null;
    if (body.topic !== 'orders_v2' && body.topic !== 'orders') return null;
    const match = str(body.resource)?.match(/\/orders\/(\d{1,20})$/);
    const userId = id(body.user_id);
    if (!match || !userId) return null;
    return { userId, appId: id(body.application_id), orderId: match[1] };
  },
};

// ───────────────────────────── Para la sección Ventas ─────────────────────────────

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const round2 = (n: number) => Math.round(n * 100) / 100;
const at = (o: unknown, ...path: string[]): unknown => path.reduce<unknown>((v, k) => (isObj(v) ? v[k] : undefined), o);

const PAYMENT_TYPE: Record<string, string> = {
  credit_card: 'Tarjeta de crédito',
  debit_card: 'Tarjeta de débito',
  prepaid_card: 'Tarjeta prepaga',
  account_money: 'Dinero en cuenta de Mercado Pago',
  ticket: 'Efectivo',
  atm: 'Cajero',
  bank_transfer: 'Transferencia',
  digital_currency: 'Cuotas sin tarjeta',
  consumer_credits: 'Cuotas sin tarjeta',
};

function paymentState(status: string | null): ChannelPayment['state'] {
  switch (status) {
    case 'approved':
      return 'approved';
    case 'pending':
    case 'in_process':
    case 'in_mediation':
    case 'authorized':
      return 'pending';
    case 'rejected':
      return 'rejected';
    case 'refunded':
    case 'charged_back':
      return 'refunded';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'other';
  }
}

function parsePayment(p: unknown): ChannelPayment | null {
  if (!isObj(p)) return null;
  const pid = id(p.id);
  if (!pid) return null;
  const type = str(p.payment_type) ?? str(p.payment_type_id);
  return {
    id: pid,
    state: paymentState(str(p.status)),
    amount: num(p.transaction_amount) ?? num(p.total_paid_amount) ?? 0,
    installments: num(p.installments),
    method: type ? (PAYMENT_TYPE[type] ?? type) : str(p.payment_method_id),
    approvedAt: str(p.date_approved),
    refunded: num(p.transaction_amount_refunded) ?? 0,
  };
}

const CANCEL_BY: Record<string, 'buyer' | 'seller' | 'channel'> = { buyer: 'buyer', seller: 'seller', mediator: 'channel', mercadolibre: 'channel', meli: 'channel', system: 'channel' };

/** Una venta de Mercado Libre con sus importes, en el formato neutro. Null si no se entiende. */
export function parseSaleRecord(o: unknown): ChannelSaleRecord | null {
  const order = parseOrder(o);
  if (!order || !isObj(o)) return null;
  const status = str(o.status);
  const state = order.cancelled ? 'cancelled' : status === 'paid' || status === 'partially_refunded' ? 'paid' : 'pending';
  const lines: ChannelSaleLine[] = [];
  for (const raw of arr(o.order_items)) {
    if (!isObj(raw) || !isObj(raw.item)) continue;
    const listingId = id(raw.item.id);
    const quantity = typeof raw.quantity === 'number' && Number.isInteger(raw.quantity) && raw.quantity > 0 ? raw.quantity : null;
    if (!listingId || quantity === null) continue;
    const base = { listingId, variationId: id(raw.item.variation_id), sku: str(raw.item.seller_sku), quantity };
    const unitPrice = num(raw.unit_price) ?? 0;
    const gross = num(raw.gross_price);
    // La comisión que informa Mercado Libre es por unidad.
    const fee = num(raw.sale_fee);
    lines.push({
      ...base,
      title: str(raw.item.title),
      unitPrice,
      listPrice: num(raw.full_unit_price) ?? (gross !== null && base.quantity > 0 ? round2(gross / base.quantity) : null),
      fee: fee === null ? null : round2(fee * base.quantity),
    });
  }
  const payments = arr(o.payments).flatMap((p) => parsePayment(p) ?? []);
  const itemsAmount = lines.length > 0 ? round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)) : (num(o.total_amount) ?? 0);
  const buyer = isObj(o.buyer) ? o.buyer : {};
  const name = [str(buyer.first_name), str(buyer.last_name)].filter(Boolean).join(' ');
  const detail = isObj(o.cancel_detail) ? o.cancel_detail : null;
  return {
    order,
    packId: id(o.pack_id),
    state,
    closedAt: str(o.date_closed),
    currency: str(o.currency_id) ?? 'ARS',
    itemsAmount,
    paidAmount: num(o.paid_amount),
    buyer: { id: id(buyer.id), nickname: str(buyer.nickname), name: name || null },
    lines,
    payments,
    shipmentId: isObj(o.shipping) ? id(o.shipping.id) : null,
    claim: arr(o.mediations).length > 0,
    cancel:
      state === 'cancelled'
        ? { by: CANCEL_BY[str(detail?.requested_by)?.toLowerCase() ?? ''] ?? null, reason: str(detail?.description) ?? str(detail?.code) ?? null }
        : null,
  };
}

const SUBSTATUS: Record<string, string> = {
  ready_to_print: 'Falta imprimir la etiqueta',
  printed: 'Etiqueta impresa',
  in_packing_list: 'En la lista de despacho',
  in_warehouse: 'En el depósito',
  ready_for_pickup: 'Listo para que lo retire el correo',
  ready_for_dropoff: 'Listo para llevarlo al punto de despacho',
  picked_up: 'Lo retiró el correo',
  dropped_off: 'Se dejó en el punto de despacho',
  authorized_by_carrier: 'Lo recibió el correo',
  in_hub: 'En el centro de distribución',
  out_for_delivery: 'En reparto',
  waiting_for_withdrawal: 'Espera que lo retire el comprador',
  delayed: 'Demorado',
  receiver_absent: 'El comprador no estaba',
  buyer_rescheduled: 'El comprador cambió la fecha de entrega',
  returning_to_sender: 'Volviendo al vendedor',
  returning_to_hub: 'Volviendo al centro de distribución',
  returned: 'Volvió al vendedor',
  lost: 'Se perdió',
  damaged: 'Se dañó en el camino',
  stolen: 'Lo robaron',
  claimed_me: 'Con reclamo',
};

// Ya salió aunque Mercado Libre todavía diga "listo para despachar".
const LEFT = new Set(['picked_up', 'dropped_off', 'authorized_by_carrier', 'in_hub']);
const BACK = new Set(['returning_to_sender', 'returning_to_hub', 'returned']);

function shipState(status: string | null, substatus: string | null): ChannelShipState {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'handling':
      return 'to_ship';
    case 'ready_to_ship':
      return substatus && LEFT.has(substatus) ? 'shipped' : 'to_ship';
    case 'shipped':
      return substatus && BACK.has(substatus) ? 'returned' : 'shipped';
    case 'delivered':
      return 'delivered';
    case 'not_delivered':
      return substatus && BACK.has(substatus) ? 'returned' : 'not_delivered';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'none';
  }
}

const KIND: Record<string, { kind: ChannelShipKind; label: string }> = {
  fulfillment: { kind: 'channel', label: 'Full' },
  cross_docking: { kind: 'pickup', label: 'Colecta' },
  xd_drop_off: { kind: 'drop_off', label: 'Mercado Envíos Places' },
  drop_off: { kind: 'drop_off', label: 'Correo o punto de despacho' },
  self_service: { kind: 'flex', label: 'Flex' },
  turbo: { kind: 'flex', label: 'Turbo' },
};

function shipKind(mode: string | null, type: string | null): { kind: ChannelShipKind; label: string } {
  if (type && KIND[type]) return KIND[type];
  if (mode === 'me1') return { kind: 'seller', label: 'Mercado Envíos 1' };
  if (mode === 'custom') return { kind: 'seller', label: 'Envío propio' };
  if (mode === 'me2') return { kind: 'drop_off', label: 'Mercado Envíos' };
  return { kind: 'none', label: 'A acordar con el comprador' };
}

/** Un envío de Mercado Libre, con lo que pagan el vendedor y el comprador, en el formato neutro. */
export function parseShipment(s: unknown, costs: unknown): ChannelShipment | null {
  if (!isObj(s)) return null;
  const shipmentId = id(s.id);
  if (!shipmentId) return null;
  const status = str(s.status);
  const substatus = str(s.substatus);
  const option = isObj(s.shipping_option) ? s.shipping_option : isObj(s.lead_time) ? s.lead_time : {};
  const history = isObj(s.status_history) ? s.status_history : {};
  const kind = shipKind(str(s.mode) ?? str(at(s, 'logistic', 'mode')), str(s.logistic_type) ?? str(at(s, 'logistic', 'type')));
  const senders = arr(at(costs, 'senders'));
  const sellerCost = senders.length > 0 ? senders.reduce<number | null>((sum, x) => (num(at(x, 'cost')) === null ? sum : (sum ?? 0) + num(at(x, 'cost'))!), null) : null;
  return {
    shipmentId,
    state: shipState(status, substatus),
    detail: substatus ? (SUBSTATUS[substatus] ?? null) : null,
    kind: kind.kind,
    kindLabel: kind.label,
    tracking: str(s.tracking_number),
    dispatchBy: str(at(option, 'estimated_handling_limit', 'date')),
    estimatedAt: str(at(option, 'estimated_delivery_time', 'date')) ?? str(at(option, 'estimated_delivery_final', 'date')),
    shippedAt: str(history.date_shipped),
    deliveredAt: str(history.date_delivered),
    delayed: arr(s.delay).length > 0 || arr(at(option, 'delay')).length > 0 || substatus === 'delayed',
    sellerCost: sellerCost === null ? null : round2(sellerCost),
    buyerCost: num(at(costs, 'receiver', 'cost')) ?? num(option.cost),
  };
}

/** Lo que informa Mercado Pago de un pago. */
export function parsePaymentMoney(p: unknown): ChannelPaymentMoney | null {
  if (!isObj(p)) return null;
  const pid = id(p.id);
  if (!pid) return null;
  const release = str(p.money_release_status);
  return {
    id: pid,
    net: num(at(p, 'transaction_details', 'net_received_amount')),
    releaseAt: str(p.money_release_date),
    released: release === 'released' ? true : release ? false : null,
    refunded: num(p.transaction_amount_refunded) ?? 0,
  };
}

/** Una fecha como la entiende el buscador de Mercado Libre: mira la hora, sin los minutos. */
const searchDate = (d: Date) => `${d.toISOString().slice(0, 13)}:00:00.000-00:00`;

/** Un pedido que puede no estar: 404 es null. */
async function maybe(path: string, accessToken: string): Promise<unknown | null> {
  try {
    return await read(path, accessToken);
  } catch (e) {
    if (e instanceof MercadoLibreRequestError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}

export const mercadolibreSalesLedger: ChannelSalesLedger = {
  async readSale(accessToken, orderId) {
    if (!/^\d{1,20}$/.test(orderId)) return null;
    return parseSaleRecord(await maybe(`/orders/${orderId}`, accessToken));
  },

  async searchSales(accessToken, sellerId, q) {
    const params = new URLSearchParams({ seller: sellerId, sort: 'date_asc', offset: String(q.offset), limit: String(Math.min(q.limit, PAGE)) });
    if (q.createdFrom) params.set('order.date_created.from', searchDate(q.createdFrom));
    if (q.createdTo) params.set('order.date_created.to', searchDate(q.createdTo));
    if (q.changedSince) params.set('order.date_last_updated.from', searchDate(q.changedSince));
    const body = await read(`/orders/search?${params.toString()}`, accessToken);
    const results = isObj(body) ? arr(body.results) : [];
    const total = isObj(body) && isObj(body.paging) && typeof body.paging.total === 'number' ? body.paging.total : results.length;
    return {
      sales: results.flatMap((r) => parseSaleRecord(r) ?? []),
      total,
      end: results.length < Math.min(q.limit, PAGE) || q.offset + results.length >= total,
    };
  },

  async readShipment(accessToken, shipmentId) {
    if (!/^\d{1,20}$/.test(shipmentId)) return null;
    const shipment = await maybe(`/shipments/${shipmentId}`, accessToken);
    if (!shipment) return null;
    // El costo es aparte; si no se puede leer, el envío queda sin costo.
    let costs: unknown = null;
    try {
      costs = await maybe(`/shipments/${shipmentId}/costs`, accessToken);
    } catch (e) {
      if (!(e instanceof MercadoLibreRequestError) || e.status === 401) throw e;
    }
    return parseShipment(shipment, costs);
  },

  async readShippingCost(accessToken, shipmentId) {
    if (!/^\d{1,20}$/.test(shipmentId)) return null;
    const costs = await maybe(`/shipments/${shipmentId}/costs`, accessToken).catch((e) => {
      if (e instanceof MercadoLibreRequestError && e.status !== 401) return null;
      throw e;
    });
    if (!costs) return null;
    const shipment = parseShipment({ id: shipmentId }, costs);
    return shipment ? { sellerCost: shipment.sellerCost, buyerCost: shipment.buyerCost } : null;
  },

  async readPayment(accessToken, paymentId) {
    if (!/^\d{1,20}$/.test(paymentId)) return null;
    // Mercado Pago es otro servicio: si no deja leer el pago, la venta queda sin
    // ese dato y nada más. Nunca marca la conexión de la tienda.
    try {
      return parsePaymentMoney(await mpGet(`/v1/payments/${paymentId}`, accessToken));
    } catch {
      return null;
    }
  },

  parseSaleNotice(body): SaleNotice | null {
    if (!isObj(body)) return null;
    const userId = id(body.user_id);
    const resource = str(body.resource);
    if (!userId || !resource) return null;
    const last = resource.match(/\/(\d{1,20})$/)?.[1];
    if (!last) return null;
    const appId = id(body.application_id);
    if (body.topic === 'orders_v2' || body.topic === 'orders') return /\/orders\/\d+$/.test(resource) ? { userId, appId, kind: 'order', id: last } : null;
    if (body.topic === 'shipments') return { userId, appId, kind: 'shipment', id: last };
    if (body.topic === 'payments') return { userId, appId, kind: 'payment', id: last };
    return null;
  },

  saleUrl: (orderId) => (/^\d{1,20}$/.test(orderId) ? `${salesPageUrl()}/${orderId}/detalle` : null),
};
