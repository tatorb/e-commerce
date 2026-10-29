import type { ChannelCampaign, ChannelPromotions } from '../publish-types';

// Lo que Mercado Libre informa de las promociones de una publicación
// (/seller-promotions/items), en el formato neutro. Una publicación que puede
// llevar descuento propio figura con un PRICE_DISCOUNT "candidate", con el
// rango de precio con descuento que acepta; el que está puesto o programado,
// con "started" o "pending". Lo demás son campañas: las que la invitan
// ("candidate") y en las que está.

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
    out.campaigns.push({
      name: str(e.name),
      kind: KIND[type] ?? 'Otra promoción',
      status: campaign,
      price,
      channelPct: pct(e.meli_percentage),
      sellerPct: pct(e.seller_percentage),
      start: date(e.start_date),
      finish: date(e.finish_date) ?? date(e.end_date),
    });
  }
  // Primero en las que está, después las programadas y las invitaciones.
  const order = { active: 0, scheduled: 1, invited: 2 };
  out.campaigns.sort((a, b) => order[a.status] - order[b.status]);
  return out;
}
