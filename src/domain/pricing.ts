import { z } from 'zod';
import { parsePercent, parsePrice } from './money';

// El precio de una publicación: los parámetros (cargos, impuestos, cuotas,
// envío y márgenes) y las cuentas para pasar del costo al precio y del precio
// al margen. No sabe de ningún canal: el cargo es el del canal donde se vende.
//
// Supuestos: el costo es sin IVA y el precio publicado incluye IVA. Los
// porcentajes de los parámetros van como número, por ejemplo 14.3 para 14,3 %;
// las cuentas de adentro usan fracciones (0,143).

export const INSTALLMENT_PLANS = [0, 3, 6, 9, 12] as const;
export type InstallmentPlan = (typeof INSTALLMENT_PLANS)[number];

export type PricingParams = {
  // Cargo del canal por vender, en % del precio.
  channelFeePct: number;
  // Ingresos brutos, débitos y créditos, y retenciones, en % del precio.
  taxesPct: number;
  // La tasa del IVA, por ejemplo 21.
  vatRatePct: number;
  // Lo que cuesta ofrecer cada plan de cuotas sin interés, en % del precio. Null si no está cargado.
  installments3Pct: number | null;
  installments6Pct: number | null;
  installments9Pct: number | null;
  installments12Pct: number | null;
  adsPct: number;
  returnsPct: number;
  // Montos fijos por venta, en pesos.
  shipping: number;
  packaging: number;
  // Márgenes sobre el costo, en %.
  minMarginPct: number;
  targetMarginPct: number;
};

export type PricingKey = keyof PricingParams;

// Las cuotas, como las cobra Mercado Libre por ofrecerlas al mismo precio publicado.
export const PRICING_DEFAULTS: PricingParams = {
  channelFeePct: 14.3,
  taxesPct: 4.9,
  vatRatePct: 21,
  installments3Pct: 8.5,
  installments6Pct: 12.9,
  installments9Pct: 17.3,
  installments12Pct: 20.8,
  adsPct: 0,
  returnsPct: 0,
  shipping: 10_890,
  packaging: 0,
  minMarginPct: 15,
  targetMarginPct: 30,
};

export const PRICING_KEYS = Object.keys(PRICING_DEFAULTS) as PricingKey[];

// Los que son montos en pesos; el resto son porcentajes.
export const AMOUNT_KEYS: PricingKey[] = ['shipping', 'packaging'];
// Los que pueden quedar sin cargar.
const OPTIONAL_KEYS: PricingKey[] = ['installments3Pct', 'installments6Pct', 'installments9Pct', 'installments12Pct'];

export const PRICING_LABEL: Record<PricingKey, string> = {
  channelFeePct: 'Cargo del canal',
  taxesPct: 'Impuestos (IIBB, débitos y créditos, SIRTAC)',
  vatRatePct: 'IVA',
  installments3Pct: 'Costo de 3 cuotas sin interés',
  installments6Pct: 'Costo de 6 cuotas sin interés',
  installments9Pct: 'Costo de 9 cuotas sin interés',
  installments12Pct: 'Costo de 12 cuotas sin interés',
  adsPct: 'Publicidad',
  returnsPct: 'Devoluciones y garantías',
  shipping: 'Envío',
  packaging: 'Embalaje y preparación',
  minMarginPct: 'Margen mínimo',
  targetMarginPct: 'Margen objetivo',
};

const PLAN_KEY: Record<Exclude<InstallmentPlan, 0>, PricingKey> = {
  3: 'installments3Pct',
  6: 'installments6Pct',
  9: 'installments9Pct',
  12: 'installments12Pct',
};

export function isInstallmentPlan(n: number): n is InstallmentPlan {
  return (INSTALLMENT_PLANS as readonly number[]).includes(n);
}

/** El costo del plan de cuotas en %: 0 sin cuotas; null si ese plan no tiene el costo cargado. */
export function installmentCostPct(params: PricingParams, plan: InstallmentPlan): number | null {
  return plan === 0 ? 0 : (params[PLAN_KEY[plan]] as number | null);
}

/** Los planes que se pueden usar: sin cuotas y los que tienen el costo cargado. */
export function availablePlans(params: PricingParams): InstallmentPlan[] {
  return INSTALLMENT_PLANS.filter((p) => installmentCostPct(params, p) !== null);
}

// ───────────────────────────── Leer y guardar ─────────────────────────────

/**
 * Lee los parámetros guardados, descartando lo que no se reconoce. Lo que
 * falta toma el valor de abajo: el de partida, o el de la cuenta para un producto.
 */
export function parsePricingValues(raw: unknown): Partial<PricingParams> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Partial<Record<PricingKey, number | null>> = {};
  for (const key of PRICING_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[key] = value;
    else if (value === null && OPTIONAL_KEYS.includes(key)) out[key] = null;
  }
  return out as Partial<PricingParams>;
}

/** Los parámetros de la cuenta, y encima los propios del producto. */
export function resolvePricing(account: unknown, product?: unknown): PricingParams {
  return { ...PRICING_DEFAULTS, ...parsePricingValues(account), ...parsePricingValues(product) };
}

/** Un parámetro como se escribe: "14,3" o "10.890". Vacío si no está cargado. */
export function pricingText(key: PricingKey, value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: AMOUNT_KEYS.includes(key) ? 0 : 3 }).format(value);
}

/** Un parámetro escrito a mano: el número, vacío (null) o "invalid". */
export function parsePricingText(key: PricingKey, text: string): number | null | 'invalid' {
  return AMOUNT_KEYS.includes(key) ? parsePrice(text) : parsePercent(text);
}

const MAX: Partial<Record<PricingKey, number>> = { shipping: 100_000_000, packaging: 100_000_000, minMarginPct: 1000, targetMarginPct: 1000 };

/**
 * Lo que se carga a mano, como texto: "14,3", "10.890" o vacío. En la cuenta,
 * vacío vuelve al de partida; en un producto, vuelve al de la cuenta. Los
 * costos de cuotas pueden quedar sin cargar.
 */
export const pricingInputSchema = z.record(z.string(), z.string().max(30)).transform((raw, ctx) => {
  const out: Partial<Record<PricingKey, number | null>> = {};
  for (const key of PRICING_KEYS) {
    const text = raw[key];
    if (text === undefined) continue;
    if (text.trim() === '') continue;
    if (text.trim().toLowerCase() === 'sin cargar' && OPTIONAL_KEYS.includes(key)) {
      out[key] = null;
      continue;
    }
    const n = parsePricingText(key, text);
    const max = MAX[key] ?? 99;
    if (n === 'invalid' || n === null || n < 0 || n > max) {
      ctx.addIssue({ code: 'custom', message: `${PRICING_LABEL[key]}: ${AMOUNT_KEYS.includes(key) ? 'tiene que ser un monto, por ejemplo 10.890' : 'tiene que ser un porcentaje, por ejemplo 14,3'}.` });
      return z.NEVER;
    }
    out[key] = n;
  }
  if (out.minMarginPct !== undefined && out.targetMarginPct !== undefined && out.targetMarginPct! < out.minMarginPct!) {
    ctx.addIssue({ code: 'custom', message: 'El margen objetivo no puede ser menor que el mínimo.' });
    return z.NEVER;
  }
  return out as Partial<PricingParams>;
});

// ───────────────────────────── Cuentas ─────────────────────────────

const frac = (pct: number) => pct / 100;

/** El IVA como parte del precio: con 21 % es 17,355 %. En fracción. */
export function vatShare(params: PricingParams): number {
  return frac(params.vatRatePct) / (1 + frac(params.vatRatePct));
}

/** Lo que se lleva cada venta, como parte del precio final y en pesos fijos. */
export function shares(params: PricingParams, plan: InstallmentPlan): { pct: number; installments: number; fixed: number } {
  return {
    pct: frac(params.channelFeePct + params.taxesPct + params.adsPct + params.returnsPct) + vatShare(params),
    installments: frac(installmentCostPct(params, plan) ?? 0),
    fixed: params.shipping + params.packaging,
  };
}

/**
 * El precio final que hace falta para ganar ese margen sobre el costo:
 * (costo × (1 + margen) + fijos) / (1 − porcentajes − cuotas). Null si los
 * porcentajes se comen todo el precio.
 */
export function finalPriceFor(cost: number, marginPct: number, params: PricingParams, plan: InstallmentPlan): number | null {
  const s = shares(params, plan);
  const keep = 1 - s.pct - s.installments;
  if (keep <= 0) return null;
  return (cost * (1 + frac(marginPct)) + s.fixed) / keep;
}

/** Lo que queda de un precio final después de pagar todo, el costo incluido. */
export function profitOf(finalPrice: number, cost: number, params: PricingParams, plan: InstallmentPlan): number {
  const s = shares(params, plan);
  return finalPrice * (1 - s.pct - s.installments) - s.fixed - cost;
}

/** El margen sobre el costo, en %. Null sin costo. */
export function marginOf(finalPrice: number, cost: number, params: PricingParams, plan: InstallmentPlan): number | null {
  return cost > 0 ? (profitOf(finalPrice, cost, params, plan) / cost) * 100 : null;
}

/** El precio final al comprador: el publicado menos el descuento. */
export function finalPriceOf(listPrice: number, discountPct: number): number {
  return listPrice * (1 - frac(discountPct));
}

/** El precio publicado para que, con ese descuento, el comprador pague ese precio final. */
export function listPriceFor(finalPrice: number, discountPct: number): number {
  return finalPrice / (1 - frac(discountPct));
}

/**
 * El descuento más grande que aguanta ese precio publicado sin bajar del margen
 * mínimo, en %. Null si ni sin descuento llega: "No entra".
 */
export function maxDiscount(listPrice: number, cost: number, params: PricingParams, plan: InstallmentPlan): number | null {
  const s = shares(params, plan);
  const keep = 1 - s.pct - s.installments;
  if (keep <= 0 || listPrice <= 0) return null;
  const d = 1 - (cost * (1 + frac(params.minMarginPct)) + s.fixed) / (listPrice * keep);
  return d < 0 ? null : d * 100;
}

export type References = {
  // Sin cuotas ni descuento, con el margen mínimo y con el objetivo.
  floor: number | null;
  target: number | null;
  // Cuánto se puede bajar desde el precio publicado hasta el piso, en %.
  promoBudgetPct: number | null;
};

export function references(listPrice: number, cost: number, params: PricingParams): References {
  const floor = finalPriceFor(cost, params.minMarginPct, params, 0);
  const target = finalPriceFor(cost, params.targetMarginPct, params, 0);
  return { floor, target, promoBudgetPct: floor !== null && listPrice > 0 ? (1 - floor / listPrice) * 100 : null };
}

/** Un precio en pesos enteros, para arriba: así redondear no baja el margen. */
export const wholeUp = (n: number) => Math.ceil(n - 1e-6);

/** El precio publicado para llegar al margen objetivo con estas cuotas y este descuento. */
export function targetListPrice(cost: number, params: PricingParams, plan: InstallmentPlan, discountPct: number): number | null {
  const final = finalPriceFor(cost, params.targetMarginPct, params, plan);
  return final === null ? null : wholeUp(listPriceFor(final, discountPct));
}

// El colchón: lo que tiene que aguantar el precio publicado con el margen mínimo.
export const CUSHION = { plan: 6 as InstallmentPlan, discountPct: 10 };

/**
 * El precio publicado que aguanta 6 cuotas y 10 % de descuento sin bajar del
 * margen mínimo, sin bajar del objetivo sin cuotas ni descuento. Null si el
 * plan de 6 cuotas no tiene el costo cargado.
 */
export function cushionListPrice(cost: number, params: PricingParams): number | null {
  if (installmentCostPct(params, CUSHION.plan) === null) return null;
  const final = finalPriceFor(cost, params.minMarginPct, params, CUSHION.plan);
  const target = finalPriceFor(cost, params.targetMarginPct, params, 0);
  if (final === null || target === null) return null;
  return wholeUp(Math.max(listPriceFor(final, CUSHION.discountPct), target));
}

export type MarginLevel = 'target' | 'between' | 'below';

/** El semáforo: en el objetivo o arriba, entre el mínimo y el objetivo, o debajo del mínimo. */
export function marginLevel(marginPct: number, params: PricingParams): MarginLevel {
  if (marginPct >= params.targetMarginPct - 1e-9) return 'target';
  if (marginPct >= params.minMarginPct - 1e-9) return 'between';
  return 'below';
}

export const BREAKDOWN_PARTS = ['cost', 'vat', 'channelFee', 'installments', 'taxes', 'adsReturns', 'shippingPackaging', 'profit'] as const;
export type BreakdownPart = (typeof BREAKDOWN_PARTS)[number];

/** De qué se compone el precio final, en pesos: suma justo el precio final. */
export function breakdown(finalPrice: number, cost: number, params: PricingParams, plan: InstallmentPlan): Record<BreakdownPart, number> {
  const s = shares(params, plan);
  return {
    cost,
    vat: finalPrice * vatShare(params),
    channelFee: finalPrice * frac(params.channelFeePct),
    installments: finalPrice * s.installments,
    taxes: finalPrice * frac(params.taxesPct),
    adsReturns: finalPrice * frac(params.adsPct + params.returnsPct),
    shippingPackaging: s.fixed,
    profit: profitOf(finalPrice, cost, params, plan),
  };
}

export type Simulation = {
  listPrice: number;
  discountPct: number;
  plan: InstallmentPlan;
  finalPrice: number;
  profit: number;
  // Sobre el costo y como parte del precio final, en %.
  marginPct: number;
  profitShareOfPrice: number;
  level: MarginLevel;
};

/** Cómo queda un precio publicado con ese descuento y esas cuotas. */
export function simulate(args: { listPrice: number; discountPct: number; plan: InstallmentPlan; cost: number; params: PricingParams }): Simulation {
  const finalPrice = finalPriceOf(args.listPrice, args.discountPct);
  const profit = profitOf(finalPrice, args.cost, args.params, args.plan);
  const marginPct = args.cost > 0 ? (profit / args.cost) * 100 : 0;
  return {
    listPrice: args.listPrice,
    discountPct: args.discountPct,
    plan: args.plan,
    finalPrice,
    profit,
    marginPct,
    profitShareOfPrice: finalPrice > 0 ? (profit / finalPrice) * 100 : 0,
    level: marginLevel(marginPct, args.params),
  };
}

/** El precio publicado que deja ese margen con este descuento y estas cuotas, en pesos enteros. */
export function listPriceForMargin(args: { marginPct: number; discountPct: number; plan: InstallmentPlan; cost: number; params: PricingParams }): number | null {
  const final = finalPriceFor(args.cost, args.marginPct, args.params, args.plan);
  return final === null ? null : Math.round(listPriceFor(final, args.discountPct));
}
