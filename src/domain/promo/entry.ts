import { campaignPrice, campaignRevenue, dealPrice, pctUpToPrice } from '@/domain/promotions';
import { finalPriceFor, installmentCostPct, marginOf, wholeUp, type InstallmentPlan, type PricingParams } from '@/domain/pricing';
import { formatPrice } from '@/domain/money';

// Si una forma de cobro entra a una oferta, a qué precio y con qué
// rentabilidad. El descuento se mide por la rentabilidad que deja, no por el
// % que muestra el canal: se busca el precio que deja la rentabilidad de la
// franja; si el canal pone un tope más bajo, entra al tope mientras deje el
// piso o más; si no, queda afuera con el motivo. Sin la base de datos.

/** Lo que hace falta de una forma de cobro para sacar su rentabilidad. */
export type OptionEconomics = {
  // El costo de reposición sin IVA de lo que vende. Null si no está cargado.
  cost: number | null;
  params: PricingParams;
  // Su forma de cobro. Null si la app no la conoce.
  plan: InstallmentPlan | null;
  // El precio publicado que tiene hoy en el canal.
  listPrice: number | null;
};

export const OUT_REASONS = ['NOT_INVITED', 'BELOW_FLOOR', 'FORBIDDEN', 'UNDER_REVIEW', 'LOW_STOCK', 'NO_COST', 'CHANNEL_ONLY', 'REJECTED', 'MANUAL', 'NOT_PUBLISHED'] as const;
export type OutReason = (typeof OUT_REASONS)[number];
export const OUT_REASON_LABEL: Record<OutReason, string> = {
  NOT_INVITED: 'No invitada',
  BELOW_FLOOR: 'Bajo el piso',
  FORBIDDEN: 'Prohibida',
  UNDER_REVIEW: 'En revisión',
  LOW_STOCK: 'Poco stock',
  NO_COST: 'Sin costo',
  CHANNEL_ONLY: 'Solo desde el canal',
  REJECTED: 'La rechazó el canal',
  MANUAL: 'Sacada a mano',
  NOT_PUBLISHED: 'Sin publicar',
};

export type Decision =
  | { in: true; capped: boolean; price: number; discountPct: number | null; marginPct: number; note: string | null }
  | { in: false; reason: OutReason; text: string; price: number | null; marginPct: number | null };

const round2 = (n: number) => Math.round(n * 100) / 100;
const pctText = (n: number) => `${round2(n).toLocaleString('es-AR')} %`;

/** La rentabilidad que deja ese precio para el comprador, con lo que pone el canal si pone algo. Null sin costo o sin forma de cobro. */
export function marginAt(eco: OptionEconomics, price: number, channelPct: number | null = null, listPrice: number | null = eco.listPrice): number | null {
  if (eco.cost === null || !(eco.cost > 0) || eco.plan === null || installmentCostPct(eco.params, eco.plan) === null) return null;
  const revenue = campaignRevenue({ price, channelPct, listPrice });
  return revenue === null ? null : marginOf(revenue, eco.cost, eco.params, eco.plan);
}

/** El precio para el comprador que deja esa rentabilidad, en pesos enteros para arriba, descontando lo que pone el canal. */
export function priceForMargin(eco: OptionEconomics, marginPct: number, channelPct: number | null = null, listPrice: number | null = eco.listPrice): number | null {
  if (eco.cost === null || !(eco.cost > 0) || eco.plan === null || installmentCostPct(eco.params, eco.plan) === null) return null;
  const revenue = finalPriceFor(eco.cost, marginPct, eco.params, eco.plan);
  if (revenue === null) return null;
  const fromChannel = channelPct && listPrice ? (listPrice * channelPct) / 100 : 0;
  return Math.max(1, wholeUp(revenue - fromChannel));
}

const noCost = (eco: OptionEconomics): Decision | null =>
  eco.cost === null || !(eco.cost > 0)
    ? { in: false, reason: 'NO_COST', text: 'No tiene el costo cargado: sin costo no se sabe la rentabilidad.', price: null, marginPct: null }
    : eco.plan === null || installmentCostPct(eco.params, eco.plan) === null
      ? { in: false, reason: 'NO_COST', text: 'Falta el costo de su forma de cobro en Ajustes, Precios.', price: null, marginPct: null }
      : null;

/** Lo que el canal informa de una campaña para una forma de cobro. */
export type Invite = {
  status: 'invited' | 'scheduled' | 'active';
  // price: se suma eligiendo el precio; accept: aceptando el del canal; null: solo desde el canal.
  join: 'price' | 'accept' | null;
  // El precio para el comprador que informa el canal.
  price: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  channelPct: number | null;
  listPrice: number | null;
};

/**
 * Una campaña del canal. target: la rentabilidad que busca la franja; floor:
 * el piso. La que ya está adentro o anotada sigue adentro, con lo que deja.
 */
export function decideCampaign(args: { eco: OptionEconomics; invite: Invite | null; targetMarginPct: number; floorMarginPct: number }): Decision {
  const { eco, invite } = args;
  if (!invite) return { in: false, reason: 'NOT_INVITED', text: 'El canal no la invita a esta campaña.', price: null, marginPct: null };
  const listPrice = invite.listPrice ?? eco.listPrice;
  const at = (price: number) => marginAt(eco, price, invite.channelPct, listPrice);
  if (invite.status !== 'invited') {
    const margin = invite.price !== null ? at(invite.price) : null;
    return {
      in: true,
      capped: false,
      price: invite.price ?? 0,
      discountPct: null,
      marginPct: margin ?? 0,
      note: margin !== null && margin < args.floorMarginPct ? `Ya está adentro y deja ${pctText(margin)}, menos que el piso de ${pctText(args.floorMarginPct)}.` : null,
    };
  }
  const missing = noCost(eco);
  if (missing) return missing;
  if (invite.join === null) return { in: false, reason: 'CHANNEL_ONLY', text: 'A esta campaña solo se suma desde el canal.', price: invite.price, marginPct: invite.price !== null ? at(invite.price) : null };
  if (invite.join === 'accept') {
    if (invite.price === null) return { in: false, reason: 'CHANNEL_ONLY', text: 'El canal todavía no informa el precio de esta campaña.', price: null, marginPct: null };
    const margin = at(invite.price)!;
    if (margin < args.floorMarginPct) {
      return { in: false, reason: 'BELOW_FLOOR', text: `Al precio del canal, ${formatPrice(invite.price)}, deja ${pctText(margin)}: menos que el piso de ${pctText(args.floorMarginPct)}.`, price: invite.price, marginPct: round2(margin) };
    }
    return { in: true, capped: margin < args.targetMarginPct, price: invite.price, discountPct: null, marginPct: round2(margin), note: null };
  }
  // Eligiendo el precio: el que deja la rentabilidad buscada, dentro de lo que acepta el canal.
  const wanted = priceForMargin(eco, args.targetMarginPct, invite.channelPct, listPrice)!;
  // Lo más alto que acepta: su tope, o un peso menos que el precio publicado.
  const top = Math.min(invite.maxPrice ?? Infinity, listPrice !== null ? listPrice - 1 : Infinity);
  if (wanted <= top) {
    const price = Math.max(wanted, invite.minPrice !== null ? Math.ceil(invite.minPrice) : 0);
    return { in: true, capped: false, price, discountPct: null, marginPct: round2(at(price)!), note: null };
  }
  if (!Number.isFinite(top)) return { in: false, reason: 'CHANNEL_ONLY', text: 'El canal no informa entre qué precios acepta.', price: null, marginPct: null };
  const price = campaignPrice(top);
  const margin = at(price)!;
  if (margin < args.floorMarginPct) {
    return { in: false, reason: 'BELOW_FLOOR', text: `Al tope del canal, ${formatPrice(price)}, deja ${pctText(margin)}: menos que el piso de ${pctText(args.floorMarginPct)}.`, price, marginPct: round2(margin) };
  }
  return { in: true, capped: true, price, discountPct: null, marginPct: round2(margin), note: `Entra al tope del canal: deja ${pctText(margin)}.` };
}

/** Entre qué % acepta el canal un descuento propio. */
export const OWN_DISCOUNT_RANGE = { min: 5, max: 79.99 };

/**
 * El descuento propio de la capa base: el % sobre el precio publicado que
 * deja la rentabilidad buscada. Si para eso hace falta menos del mínimo que
 * acepta el canal, va el mínimo mientras deje el piso o más.
 */
export function decideOwnDiscount(args: { eco: OptionEconomics; targetMarginPct: number; floorMarginPct: number }): Decision {
  const { eco } = args;
  const missing = noCost(eco);
  if (missing) return missing;
  const list = eco.listPrice;
  if (list === null || !(list > 0)) return { in: false, reason: 'NOT_PUBLISHED', text: 'No tiene precio publicado en el canal.', price: null, marginPct: null };
  const wanted = priceForMargin(eco, args.targetMarginPct, null, list)!;
  // El descuento más grande que no baja de ese precio: el redondeo queda a favor de la tienda.
  let pct = pctUpToPrice(list, wanted) ?? 0;
  // El precio publicado ya deja menos que lo buscado, o casi: va el descuento más chico que acepta el canal.
  const smallest = pct < OWN_DISCOUNT_RANGE.min;
  if (smallest) pct = OWN_DISCOUNT_RANGE.min;
  if (pct > OWN_DISCOUNT_RANGE.max) pct = OWN_DISCOUNT_RANGE.max;
  const price = dealPrice(list, pct);
  const margin = marginAt(eco, price, null, list)!;
  if (margin < args.floorMarginPct) {
    return {
      in: false,
      reason: 'BELOW_FLOOR',
      text: `Con el descuento más chico que acepta el canal, ${pctText(pct)}, deja ${pctText(margin)}: menos que el piso de ${pctText(args.floorMarginPct)}.`,
      price,
      marginPct: round2(margin),
    };
  }
  // No es un tope del canal: es el descuento mínimo. Entra, y lo dice.
  return { in: true, capped: false, price, discountPct: pct, marginPct: round2(margin), note: smallest ? `Va el descuento más chico que acepta el canal, ${pctText(pct)}: deja ${pctText(margin)}.` : null };
}

/**
 * Un descuento por cantidad: lo que deja cada unidad cuando el comprador
 * lleva la cantidad de la campaña. effectivePct: el descuento por unidad que
 * resulta ("llevá 3 y pagá 2" es 33,33 %).
 */
export function decideVolume(args: { eco: OptionEconomics; effectivePct: number; channelPct: number | null; floorMarginPct: number; targetMarginPct: number }): Decision {
  const { eco } = args;
  const missing = noCost(eco);
  if (missing) return missing;
  const list = eco.listPrice;
  if (list === null || !(list > 0)) return { in: false, reason: 'NOT_PUBLISHED', text: 'No tiene precio publicado en el canal.', price: null, marginPct: null };
  const price = Math.round(list * (1 - args.effectivePct / 100));
  const margin = marginAt(eco, price, args.channelPct, list)!;
  if (margin < args.floorMarginPct) {
    return { in: false, reason: 'BELOW_FLOOR', text: `Llevando la cantidad, cada unidad deja ${pctText(margin)}: menos que el piso de ${pctText(args.floorMarginPct)}.`, price, marginPct: round2(margin) };
  }
  return { in: true, capped: margin < args.targetMarginPct, price, discountPct: round2(args.effectivePct), marginPct: round2(margin), note: null };
}

/** El descuento por unidad de una campaña por cantidad, en %. Null si no se puede saber. */
export function volumeEffectivePct(c: { kind: 'lleva_paga' | 'descuento_llevando' | 'descuento_en_la_unidad' | null; buyQuantity: number | null; payQuantity: number | null; discountPct: number | null }): number | null {
  if (!c.kind || !c.buyQuantity || c.buyQuantity < 1) return null;
  if (c.kind === 'lleva_paga') return c.payQuantity && c.payQuantity < c.buyQuantity ? ((c.buyQuantity - c.payQuantity) / c.buyQuantity) * 100 : null;
  if (c.discountPct === null) return null;
  return c.kind === 'descuento_llevando' ? c.discountPct : c.discountPct / c.buyQuantity;
}
