import {
  VolumeError,
  type ChannelVolume,
  type VolumeCampaign,
  type VolumeCampaignInput,
  type VolumeItem,
  type VolumeKind,
} from '../volume-types';
import { MercadoLibreRequestError, mlGet, mlSend } from './http';

// Campañas de descuento por cantidad en Mercado Libre
// (developers.mercadolibre.com.ar/es_ar/campanas-con-descuento-por-cantidad):
//   POST|PUT|DELETE /seller-promotions/promotions → la campaña, tipo VOLUME,
//   con su subtipo: BNGM (llevá N y pagá M), BNSP (P % llevando N) o SPONTH
//   (P % en la unidad N).
//   GET /seller-promotions/promotions/{id}/items → candidatas y participantes.
//   POST|DELETE /seller-promotions/items/{item} → sumar o sacar una publicación.
// Si a una publicación que participa se le sube el precio, sale sola de la
// oferta y no se puede volver a sumar.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const TYPE = 'VOLUME';
const SUB: Record<VolumeKind, string> = { lleva_paga: 'BNGM', descuento_llevando: 'BNSP', descuento_en_la_unidad: 'SPONTH' };
const KIND = Object.fromEntries(Object.entries(SUB).map(([k, v]) => [v, k])) as Record<string, VolumeKind>;

/** Lo que dijo Mercado Libre al rechazar, entero: de estas campañas todavía no se conocen los motivos. */
function rejected(what: string, e: unknown): unknown {
  if (!(e instanceof MercadoLibreRequestError) || e.status === 401 || e.status === 429) return e;
  if (e.changeUnknown) return new VolumeError(e.message);
  const said = e.body === null || e.body === undefined ? '' : ` Mercado Libre respondió: ${JSON.stringify(e.body).slice(0, 700)}`;
  return new VolumeError(`Mercado Libre no aceptó ${what} (código ${e.status}).${said}`);
}

/** El cuerpo para crear la campaña, como lo pide Mercado Libre. */
export function campaignBody(input: VolumeCampaignInput): Obj {
  const name = input.name.trim();
  if (!name) throw new VolumeError('Falta el nombre de la campaña.');
  if (!Number.isInteger(input.buyQuantity) || input.buyQuantity < 2) throw new VolumeError('La cantidad a llevar tiene que ser un número entero de 2 o más.');
  const stamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
  if (!stamp.test(input.start) || !stamp.test(input.finish)) throw new VolumeError('Las fechas van como 2026-11-25T00:00:00.');
  if (input.finish <= input.start) throw new VolumeError('La campaña tiene que terminar después de empezar.');
  const base = {
    promotion_type: TYPE,
    sub_type: SUB[input.kind],
    buy_quantity: input.buyQuantity,
    allow_combination: input.combine,
    name,
    start_date: input.start,
    finish_date: input.finish,
  };
  if (input.kind === 'lleva_paga') {
    const pay = input.payQuantity;
    if (pay === undefined || !Number.isInteger(pay) || pay < 1 || pay >= input.buyQuantity) {
      throw new VolumeError('En "llevá N y pagá M", la cantidad que se paga tiene que ser un entero menor que la que se lleva.');
    }
    return { ...base, pay_quantity: pay };
  }
  const pct = input.discountPct;
  if (pct === undefined || !(pct > 0 && pct < 100)) throw new VolumeError('El descuento tiene que ser mayor que 0 y menor que 100.');
  return { ...base, discount_percentage: pct };
}

export function parseCampaign(raw: unknown): VolumeCampaign | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  // En la lista de la cuenta, las cantidades vienen dentro de benefits.
  const b = isObj(raw.benefits) ? raw.benefits : {};
  const sub = str(raw.sub_type);
  return {
    id,
    name: str(raw.name),
    kind: sub ? (KIND[sub] ?? null) : null,
    status: str(raw.status),
    buyQuantity: num(raw.buy_quantity) ?? num(b.buy_quantity),
    payQuantity: num(raw.pay_quantity) ?? num(b.pay_quantity),
    discountPct: num(raw.discount_percentage) ?? num(b.item_discount_percent),
    combine: typeof raw.allow_combination === 'boolean' ? raw.allow_combination : null,
    start: str(raw.start_date),
    finish: str(raw.finish_date),
    raw,
  };
}

export function parseItem(raw: unknown): VolumeItem | null {
  if (!isObj(raw)) return null;
  const externalId = str(raw.id);
  if (!externalId) return null;
  return {
    externalId,
    status: str(raw.status),
    // Mercado Libre manda 0 cuando todavía no hay precio.
    price: num(raw.price) || null,
    originalPrice: num(raw.original_price) || null,
    offerId: str(raw.offer_id) ?? str(raw.ref_id),
    raw,
  };
}

const path = (id: string, rest = '') => `/seller-promotions/promotions/${encodeURIComponent(id)}${rest}`;

async function itemsOf(token: string, campaignId: string, opts: { externalId?: string; limit?: number } = {}) {
  const query = new URLSearchParams({ promotion_type: TYPE, app_version: 'v2' });
  if (opts.externalId) query.set('item_id', opts.externalId);
  if (opts.limit) query.set('limit', String(Math.min(50, Math.max(1, opts.limit))));
  const body = await mlGet(path(campaignId, `/items?${query}`), token);
  const results = isObj(body) ? arr(body.results) : [];
  const paging = isObj(body) && isObj(body.paging) ? body.paging : {};
  return { items: results.map(parseItem).filter((i): i is VolumeItem => i !== null), total: num(paging.total) };
}

export const mercadolibreVolume: ChannelVolume = {
  async list(accessToken, userId) {
    const body = await mlGet(`/seller-promotions/users/${encodeURIComponent(userId)}?app_version=v2`, accessToken);
    return (isObj(body) ? arr(body.results) : [])
      .filter((r) => isObj(r) && r.type === TYPE)
      .map(parseCampaign)
      .filter((c): c is VolumeCampaign => c !== null);
  },

  async create(accessToken, input) {
    const body = campaignBody(input);
    let res: unknown;
    try {
      res = await mlSend('POST', '/seller-promotions/promotions?app_version=v2', accessToken, body);
    } catch (e) {
      throw rejected('la campaña', e);
    }
    const campaign = parseCampaign(res);
    if (!campaign) throw new VolumeError(`Mercado Libre no devolvió el código de la campaña. Respondió: ${JSON.stringify(res).slice(0, 400)}`);
    return campaign;
  },

  async get(accessToken, campaignId) {
    let res: unknown;
    try {
      res = await mlGet(path(campaignId, `?promotion_type=${TYPE}&app_version=v2`), accessToken);
    } catch (e) {
      if (e instanceof MercadoLibreRequestError && e.status === 404) throw new VolumeError('Mercado Libre no encontró esa campaña.');
      throw rejected('la consulta de la campaña', e);
    }
    const campaign = parseCampaign(res);
    if (!campaign) throw new VolumeError('Mercado Libre no devolvió la campaña.');
    return campaign;
  },

  async items(accessToken, campaignId, opts) {
    try {
      return await itemsOf(accessToken, campaignId, opts);
    } catch (e) {
      throw rejected('la consulta de las publicaciones de la campaña', e);
    }
  },

  async join(accessToken, campaignId, externalId) {
    let res: unknown;
    try {
      res = await mlSend('POST', `/seller-promotions/items/${encodeURIComponent(externalId)}?app_version=v2`, accessToken, {
        promotion_id: campaignId,
        promotion_type: TYPE,
      });
    } catch (e) {
      throw rejected('sumar la publicación a la campaña', e);
    }
    const r = isObj(res) ? res : {};
    return { offerId: str(r.offer_id), price: num(r.price) || null, originalPrice: num(r.original_price) || null, raw: res };
  },

  async leave(accessToken, campaignId, externalId) {
    // Para sacarla hace falta el código de su oferta en la campaña.
    let offer: string | null = null;
    try {
      offer = (await itemsOf(accessToken, campaignId, { externalId })).items.find((i) => i.externalId === externalId)?.offerId ?? null;
    } catch (e) {
      throw rejected('la consulta de la publicación en la campaña', e);
    }
    if (!offer) return;
    const query = new URLSearchParams({ promotion_type: TYPE, promotion_id: campaignId, offer_id: offer, app_version: 'v2' });
    try {
      await mlSend('DELETE', `/seller-promotions/items/${encodeURIComponent(externalId)}?${query}`, accessToken);
    } catch (e) {
      if (e instanceof MercadoLibreRequestError && e.status === 404) return;
      throw rejected('sacar la publicación de la campaña', e);
    }
  },

  async remove(accessToken, campaignId) {
    try {
      await mlSend('DELETE', path(campaignId, `?promotion_type=${TYPE}&app_version=v2`), accessToken);
    } catch (e) {
      if (e instanceof MercadoLibreRequestError && e.status === 404) return;
      throw rejected('borrar la campaña', e);
    }
  },

  async promotionsOf(accessToken, externalId) {
    try {
      return await mlGet(`/seller-promotions/items/${encodeURIComponent(externalId)}?app_version=v2`, accessToken);
    } catch (e) {
      if (e instanceof MercadoLibreRequestError && e.status === 404) return [];
      throw rejected('la consulta de las promociones de la publicación', e);
    }
  },
};
