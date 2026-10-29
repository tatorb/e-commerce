import type { ChannelCampaign, ChannelPromotions } from '../publish-types';

// Lo que Mercado Libre informa de las promociones de una publicación
// (/seller-promotions/items), en el formato neutro. Una publicación que puede
// llevar descuento propio figura con un PRICE_DISCOUNT "candidate", con el
// rango de precio con descuento que acepta; el que está puesto o programado,
// con "started" o "pending". Lo demás son campañas: las que la invitan
// ("candidate") y en las que está. Para sumarse a una, lo que falta (el rango
// de precio o el código de la oferta) sale de los ítems de la campaña.

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
// Un precio o un %: Mercado Libre manda 0 cuando todavía no hay.
const positive = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const pct = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

function date(v: unknown): Date | null {
  const text = str(v);
  if (!text) return null;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Los tipos de campaña, como los llama Mercado Libre para el vendedor.
const KIND: Record<string, string> = {
  DEAL: 'Campaña tradicional',
  MARKETPLACE_CAMPAIGN: 'Co-fondeada',
  SMART: 'Co-fondeada automática',
  PRICE_MATCHING: 'Precios competitivos',
  PRICE_MATCHING_MELI_ALL: 'Precios competitivos, a cargo de Mercado Libre',
  VOLUME: 'Descuento por volumen',
  DOD: 'Oferta del día',
  LIGHTNING: 'Oferta relámpago',
  SMART_LIGHTNING: 'Oferta relámpago co-fondeada',
  PRE_NEGOTIATED: 'Descuento pre-acordado',
  SELLER_CAMPAIGN: 'Campaña propia',
  UNHEALTHY_STOCK: 'Liquidación de stock en Full',
  SELLER_COUPON_CAMPAIGN: 'Cupones de la tienda',
};

// El descuento propio puesto, por empezar o activándose.
const ON = new Set(['started', 'pending', 'sync_requested']);
const CAMPAIGN_STATUS: Record<string, ChannelCampaign['status']> = { candidate: 'invited', pending: 'scheduled', started: 'active' };

// Desde la app: a estas se suma eligiendo el precio, a estas aceptando el que
// propone Mercado Libre, y de estas se sale. Las demás piden stock reservado
// o las maneja Mercado Libre: quedan para hacer allá.
export const JOIN_WITH_PRICE = new Set(['DEAL', 'SELLER_CAMPAIGN']);
const JOIN_ACCEPTING = new Set(['MARKETPLACE_CAMPAIGN', 'SMART', 'PRICE_MATCHING']);
const LEAVE = new Set(['DEAL', 'SELLER_CAMPAIGN', 'MARKETPLACE_CAMPAIGN', 'SMART', 'PRICE_MATCHING', 'PRICE_MATCHING_MELI_ALL']);
// Las que piden el código de la oferta para sumarse o salir.
export const NEEDS_OFFER = new Set(['MARKETPLACE_CAMPAIGN', 'SMART', 'PRICE_MATCHING', 'PRICE_MATCHING_MELI_ALL']);
const NEEDS_OFFER_TO_JOIN = new Set(['SMART', 'PRICE_MATCHING']);

/** Lo que guarda la app de una campaña para sumarse o salir: el tipo, la campaña y la oferta. */
export type CampaignRef = { type: string; promotion: string; offer: string | null };

export const writeRef = (r: CampaignRef) => JSON.stringify([r.type, r.promotion, r.offer]);

export function readRef(ref: string): CampaignRef | null {
  try {
    const [type, promotion, offer] = JSON.parse(ref) as unknown[];
    return typeof type === 'string' && typeof promotion === 'string' ? { type, promotion, offer: typeof offer === 'string' ? offer : null } : null;
  } catch {
    return null;
  }
}

/** Cómo se suma y si se puede salir, con lo que se sabe de la campaña. */
function ways(ref: CampaignRef | null, status: ChannelCampaign['status']): Pick<ChannelCampaign, 'join' | 'canLeave'> {
  if (!ref) return { join: null, canLeave: false };
  const offerOk = (set: Set<string>) => !set.has(ref.type) || ref.offer !== null;
  if (status === 'invited') {
    const join = JOIN_WITH_PRICE.has(ref.type) ? 'price' : JOIN_ACCEPTING.has(ref.type) && offerOk(NEEDS_OFFER_TO_JOIN) ? 'accept' : null;
    return { join, canLeave: false };
  }
  return { join: null, canLeave: LEAVE.has(ref.type) && offerOk(NEEDS_OFFER) };
}

export function parsePromotions(raw: unknown): ChannelPromotions {
  const out: ChannelPromotions = { listPrice: null, discount: null, current: null, campaigns: [] };
  for (const e of Array.isArray(raw) ? raw.filter(isObj) : []) {
    const type = str(e.type);
    const status = str(e.status);
    if (!type || !status) continue;
    out.listPrice ??= positive(e.original_price);
    // Con un descuento extra de Mercado Libre, el comprador paga este.
    const price = positive(e.total_price_for_boosted_offer) ?? positive(e.price);
    if (type === 'PRICE_DISCOUNT') {
      if (status === 'candidate') {
        out.discount = {
          minPrice: positive(e.min_discounted_price),
          maxPrice: positive(e.max_discounted_price),
          suggestedPrice: positive(e.suggested_discounted_price),
        };
      } else if (ON.has(status)) {
        out.current = { price, scheduled: status !== 'started' };
      }
      continue;
    }
    const campaign = CAMPAIGN_STATUS[status];
    if (!campaign) continue;
    const promotion = str(e.id);
    const ref = promotion ? { type, promotion, offer: str(e.ref_id) ?? str(e.offer_id) } : null;
    out.campaigns.push({
      ref: ref ? writeRef(ref) : null,
      name: str(e.name),
      kind: KIND[type] ?? 'Otra promoción',
      status: campaign,
      price,
      channelPct: pct(e.meli_percentage),
      sellerPct: pct(e.seller_percentage),
      start: date(e.start_date),
      finish: date(e.finish_date) ?? date(e.end_date),
      ...ways(ref, campaign),
      // Con una campaña tradicional, el descuento propio espera a que termine.
      pausesOwnDiscount: type === 'DEAL',
      range: null,
      listPrice: positive(e.original_price),
    });
  }
  // Primero en las que está, después las programadas y las invitaciones.
  const order = { active: 0, scheduled: 1, invited: 2 };
  out.campaigns.sort((a, b) => order[a.status] - order[b.status]);
  return out;
}

/** Las invitaciones que necesitan algo de la campaña para poder sumarse: el rango de precio o el código de la oferta. */
export function needsDetail(c: ChannelCampaign): CampaignRef | null {
  const ref = c.ref ? readRef(c.ref) : null;
  if (!ref || c.status !== 'invited') return null;
  return JOIN_WITH_PRICE.has(ref.type) || JOIN_ACCEPTING.has(ref.type) ? ref : null;
}

/**
 * Completa una invitación con lo que dice la campaña de esta publicación
 * (/seller-promotions/promotions/{id}/items con item_id): el rango de precio,
 * el código de la oferta y lo que pone cada uno. Sin eso, no se puede sumar
 * desde la app.
 */
export function withDetail(c: ChannelCampaign, ref: CampaignRef, raw: unknown): ChannelCampaign {
  const results = isObj(raw) && Array.isArray(raw.results) ? raw.results.filter(isObj) : [];
  const e = results[0];
  if (!e) return { ...c, join: null };
  const full: CampaignRef = { ...ref, offer: ref.offer ?? str(e.offer_id) ?? str(e.ref_id) };
  const range = JOIN_WITH_PRICE.has(ref.type)
    ? { minPrice: positive(e.min_discounted_price), maxPrice: positive(e.max_discounted_price), suggestedPrice: positive(e.suggested_discounted_price) }
    : null;
  return {
    ...c,
    ref: writeRef(full),
    ...ways(full, c.status),
    range,
    price: c.price ?? positive(e.total_price_for_boosted_offer) ?? positive(e.price),
    channelPct: c.channelPct ?? pct(e.meli_percentage),
    sellerPct: c.sellerPct ?? pct(e.seller_percentage),
    start: c.start ?? date(e.start_date),
    finish: c.finish ?? date(e.finish_date) ?? date(e.end_date),
    listPrice: c.listPrice ?? positive(e.original_price),
  };
}
