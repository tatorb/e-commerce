import {
  finalPriceFor,
  fixedInstallments,
  installmentCostPct,
  INSTALLMENT_PLANS,
  isInstallmentPlan,
  listPriceFor,
  marginLevel,
  marginOf,
  planLabel,
  profitOf,
  shares,
  wholeUp,
  type InstallmentPlan,
  type MarginLevel,
  type PricingParams,
} from './pricing';

// La tabla de precios por modo de compra: se parte del precio sin cuotas y
// cada modo lleva el precio que deja la misma ganancia en pesos, sumando lo que
// cuesta ofrecer sus cuotas. Como el costo de reposición es el mismo, todos
// dejan también el mismo margen. Sin la base de datos, para poder probarlo solo.

// Los modos de compra, en el orden de la tabla: sin cuotas, interés bajo y las cuotas sin interés.
export const MODES: readonly InstallmentPlan[] = INSTALLMENT_PLANS;

export type ModeCalc = {
  plan: InstallmentPlan;
  label: string;
  // El precio publicado que le toca. Null si el costo de sus cuotas no está cargado.
  price: number | null;
  // Lo que paga el comprador en cada cuota, en los modos con una cantidad fija de cuotas.
  installmentValue: number | null;
  profit: number | null;
  marginPct: number | null;
  level: MarginLevel | null;
  // Por qué no tiene precio.
  missing: string | null;
};

/** La ganancia en pesos que deja un precio sin cuotas, después de pagar todo, el costo incluido. */
export function flatProfit(flatPrice: number, cost: number, params: PricingParams): number {
  return profitOf(flatPrice, cost, params, 0);
}

/** El precio de un modo que deja esa ganancia, en pesos enteros para arriba. Null si el costo de sus cuotas no está cargado. */
export function priceForProfit(profit: number, cost: number, params: PricingParams, plan: InstallmentPlan): number | null {
  if (installmentCostPct(params, plan) === null) return null;
  const s = shares(params, plan);
  const keep = 1 - s.pct - s.installments;
  if (keep <= 0) return null;
  return wholeUp((cost + s.fixed + profit) / keep);
}

/**
 * El precio publicado de una opción de venta que deja esa ganancia, con su
 * forma de cobro y su descuento propio: el comprador paga el precio del modo y
 * el publicado sube lo que se lleva el descuento. Null si su forma de cobro no
 * tiene el costo cargado.
 */
export function optionPriceForProfit(args: { profit: number; cost: number; params: PricingParams; plan: number; discountPct: number }): number | null {
  if (!isInstallmentPlan(args.plan)) return null;
  const final = priceForProfit(args.profit, args.cost, args.params, args.plan);
  if (final === null) return null;
  return args.discountPct > 0 ? wholeUp(listPriceFor(final, args.discountPct)) : final;
}

/** El precio sin cuotas que llega a ese margen sobre el costo, en pesos enteros para arriba. */
export function flatForMargin(cost: number, params: PricingParams, marginPct: number): number | null {
  const p = finalPriceFor(cost, marginPct, params, 0);
  return p === null ? null : wholeUp(p);
}

/**
 * El precio para el comprador en una campaña que deja ese margen en ese modo,
 * en pesos enteros para arriba: con lo que pone el canal, la tienda recibe un
 * poco más. Null si el costo de sus cuotas no está cargado.
 */
export function campaignPriceForMargin(cost: number, params: PricingParams, plan: InstallmentPlan, marginPct: number): number | null {
  if (installmentCostPct(params, plan) === null) return null;
  const p = finalPriceFor(cost, marginPct, params, plan);
  return p === null ? null : wholeUp(p);
}

/** Lo que deja vender a ese precio en ese modo: la ganancia, el margen y su color. */
export function resultAt(price: number, cost: number, params: PricingParams, plan: InstallmentPlan) {
  const marginPct = marginOf(price, cost, params, plan);
  return {
    profit: profitOf(price, cost, params, plan),
    marginPct,
    level: marginPct === null ? null : marginLevel(marginPct, params),
  };
}

/** Una fila por modo de compra, con el precio que deja la misma ganancia que el sin cuotas. */
export function modeRows(args: { flatPrice: number; cost: number; params: PricingParams }): ModeCalc[] {
  const profit = flatProfit(args.flatPrice, args.cost, args.params);
  return MODES.map((plan): ModeCalc => {
    const label = planLabel(plan);
    const price = plan === 0 ? Math.round(args.flatPrice) : priceForProfit(profit, args.cost, args.params, plan);
    if (price === null) {
      return {
        plan,
        label,
        price: null,
        installmentValue: null,
        profit: null,
        marginPct: null,
        level: null,
        missing: `Falta cargar el costo de ${label.toLowerCase()} en Ajustes > Precios.`,
      };
    }
    const n = fixedInstallments(plan);
    return { plan, label, price, installmentValue: n ? Math.round((price / n) * 100) / 100 : null, ...resultAt(price, args.cost, args.params, plan), missing: null };
  });
}
