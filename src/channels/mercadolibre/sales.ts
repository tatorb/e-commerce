import { MercadoLibreRequestError, mlGet } from './http';
import { SalesAccessError, type ChannelOrder, type ChannelSales, type SalesNotice } from '../sales-types';

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
