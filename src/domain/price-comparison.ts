import { offerPrices, type CompetitorOffer } from './competitors';
import { formatPercent, formatPrice } from './money';
import { finalPriceOf, isInstallmentPlan, installmentCostPct, marginOf, type InstallmentPlan, type PricingParams } from './pricing';

// Mi precio frente al de la competencia que se cargó en el paso Información.
// Se compara el precio efectivo, lo que paga el comprador en total: el mío va
// con envío gratis, porque el envío ya está en mis costos; el de un competidor
// sin envío gratis suma el envío.

export type CompetitorPrice = {
  title: string;
  sellerName: string | null;
  url: string | null;
  // El día del relevamiento, como 2026-10-23.
  surveyedAt: string | null;
  offer: CompetitorOffer;
};

export type ComparedRow = {
  mine: boolean;
  name: string;
  title: string | null;
  url: string | null;
  surveyedAt: string | null;
  listPrice: number;
  discountPct: number;
  installments: number;
  freeShipping: boolean;
  finalPrice: number;
  effectivePrice: number;
  installmentValue: number | null;
  // Cuánto más caro (positivo) o más barato (negativo) estoy yo, en %. Null en mi fila.
  diffPct: number | null;
};

export type Comparison = {
  rows: ComparedRow[];
  // Mi lugar por precio efectivo, del más barato al más caro; con un empate quedo adelante.
  rank: number;
  total: number;
  cheapest: ComparedRow | null;
  // El descuento para igualar al más barato, y el margen que me queda así. Null si ya soy el más barato.
  match: { discountPct: number; marginPct: number | null; reachesMin: boolean } | null;
  withInstallments: number;
  withDiscount: number;
  summary: string[];
};

export const sellerOf = (c: { sellerName: string | null; title: string }) => c.sellerName?.trim() || c.title;

export function compare(args: {
  mine: { listPrice: number; discountPct: number; plan: InstallmentPlan };
  competitors: CompetitorPrice[];
  cost: number;
  params: PricingParams;
}): Comparison {
  const { mine, cost, params } = args;
  const myFinal = finalPriceOf(mine.listPrice, mine.discountPct);
  const me: ComparedRow = {
    mine: true,
    name: 'Mi publicación',
    title: null,
    url: null,
    surveyedAt: null,
    listPrice: mine.listPrice,
    discountPct: mine.discountPct,
    installments: mine.plan,
    freeShipping: true,
    finalPrice: myFinal,
    effectivePrice: myFinal,
    installmentValue: mine.plan > 0 ? myFinal / mine.plan : null,
    diffPct: null,
  };
  const others: ComparedRow[] = args.competitors.map((c) => {
    const prices = offerPrices(c.offer, params.shipping);
    return {
      mine: false,
      name: sellerOf(c),
      title: c.title,
      url: c.url,
      surveyedAt: c.surveyedAt,
      listPrice: c.offer.listPrice,
      discountPct: c.offer.discountPct,
      installments: c.offer.installments,
      freeShipping: c.offer.freeShipping,
      finalPrice: prices.finalPrice,
      effectivePrice: prices.effectivePrice,
      installmentValue: prices.installmentValue,
      diffPct: prices.effectivePrice > 0 ? (myFinal / prices.effectivePrice - 1) * 100 : null,
    };
  });

  const cheapest = others.reduce<ComparedRow | null>((best, r) => (best === null || r.effectivePrice < best.effectivePrice ? r : best), null);
  const rank = others.filter((r) => r.effectivePrice < myFinal - 0.005).length + 1;
  const withInstallments = others.filter((r) => r.installments > 0).length;
  const withDiscount = others.filter((r) => r.discountPct > 0).length;

  let match: Comparison['match'] = null;
  if (cheapest && cheapest.effectivePrice < myFinal - 0.005 && mine.listPrice > 0) {
    const marginPct = marginOf(cheapest.effectivePrice, cost, params, mine.plan);
    match = {
      discountPct: (1 - cheapest.effectivePrice / mine.listPrice) * 100,
      marginPct,
      reachesMin: marginPct !== null && marginPct >= params.minMarginPct - 1e-9,
    };
  }

  const summary: string[] = [];
  if (others.length > 0) {
    summary.push(
      withInstallments === 0
        ? 'Ningún competidor ofrece cuotas sin interés.'
        : `${withInstallments} de ${others.length} ${others.length === 1 ? 'competidor ofrece' : 'competidores ofrecen'} cuotas sin interés.`,
    );
    summary.push(withDiscount === 0 ? 'Ninguno tiene descuento.' : `${withDiscount} ${withDiscount === 1 ? 'tiene' : 'tienen'} descuento.`);
    if (cheapest) {
      summary.push(`El más barato es ${cheapest.name}, a ${formatPrice(Math.round(cheapest.effectivePrice))}${cheapest.freeShipping ? ' con envío gratis' : ' con el envío'}.`);
      if (!match) summary.push('Estás igual o más barato que todos.');
      else if (match.marginPct === null) summary.push('Cargá el costo para saber si podés igualarlo.');
      else if (match.reachesMin)
        summary.push(`Podés igualarlo con ${formatPercent(match.discountPct)} de descuento y te queda un margen de ${formatPercent(match.marginPct)}, arriba del mínimo.`);
      else summary.push(`Igualarlo te deja un margen de ${formatPercent(match.marginPct)}, debajo del mínimo de ${formatPercent(params.minMarginPct)}.`);
    }
    if (mine.plan === 0 && withInstallments > 0) summary.push('Tenés las cuotas apagadas y hay competencia que las ofrece.');
  }

  return { rows: [me, ...others], rank, total: others.length + 1, cheapest, match, withInstallments, withDiscount, summary };
}

/** Las cuotas del más barato, si se pueden usar: null si no ofrece o si ese plan no tiene el costo cargado. */
export function copyablePlan(row: ComparedRow | null, params: PricingParams): { plan: InstallmentPlan; available: boolean } | null {
  if (!row || row.installments === 0 || !isInstallmentPlan(row.installments)) return null;
  return { plan: row.installments, available: installmentCostPct(params, row.installments) !== null };
}
