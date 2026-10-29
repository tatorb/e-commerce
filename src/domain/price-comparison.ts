import { offerPrices, type CompetitorOffer } from './competitors';
import { formatPercent, formatPrice } from './money';
import { finalPriceOf, fixedInstallments, isInstallmentPlan, installmentCostPct, marginLevel, marginOf, type InstallmentPlan, type MarginLevel, type PricingParams } from './pricing';

// Mi precio frente al de la competencia que se cargó en el paso Información.
// Se compara el precio efectivo, lo que paga el comprador en total: el mío va
// con envío gratis, porque el envío ya está en mis costos; el de un competidor
// sin envío gratis suma el envío.

export type CompetitorPrice = {
  title: string;
  sellerName: string | null;
  brand: string | null;
  url: string | null;
  // El día del relevamiento, como 2026-10-23.
  surveyedAt: string | null;
  offer: CompetitorOffer;
};

export type ComparedRow = {
  mine: boolean;
  name: string;
  // La marca del producto que vende; null si no se cargó.
  brand: string | null;
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
  // El margen sobre el costo que me quedaría vendiendo a su precio y en sus
  // condiciones, con mi costo y mis costos. En mi fila, el mío. Null si no se puede estimar.
  estimate: Estimate;
};

/** La rentabilidad estimada: el margen sobre el costo y su semáforo, o por qué no se puede estimar. */
export type Estimate = { marginPct: number; level: MarginLevel } | { marginPct: null; why: 'cost' | 'plan' };

/**
 * El margen que me quedaría vendiendo a ese precio final con esas cuotas, con
 * mi costo y mis costos. El envío lo paga el vendedor solo si es gratis; si
 * no, lo paga el comprador. Sin costo, o con un plan de cuotas sin su costo
 * cargado, no se puede estimar.
 */
export function estimateAt(args: { finalPrice: number; plan: number; freeShipping: boolean; cost: number; params: PricingParams }): Estimate {
  if (!(args.cost > 0)) return { marginPct: null, why: 'cost' };
  if (!isInstallmentPlan(args.plan) || installmentCostPct(args.params, args.plan) === null) return { marginPct: null, why: 'plan' };
  const params = args.freeShipping ? args.params : { ...args.params, shipping: 0 };
  const marginPct = marginOf(args.finalPrice, args.cost, params, args.plan)!;
  return { marginPct, level: marginLevel(marginPct, args.params) };
}

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
  mine: { listPrice: number; discountPct: number; plan: InstallmentPlan; brand?: string | null };
  competitors: CompetitorPrice[];
  cost: number;
  params: PricingParams;
}): Comparison {
  const { mine, cost, params } = args;
  const myFinal = finalPriceOf(mine.listPrice, mine.discountPct);
  const me: ComparedRow = {
    mine: true,
    name: 'Mi publicación',
    brand: mine.brand?.trim() || null,
    title: null,
    url: null,
    surveyedAt: null,
    listPrice: mine.listPrice,
    discountPct: mine.discountPct,
    installments: mine.plan,
    freeShipping: true,
    finalPrice: myFinal,
    effectivePrice: myFinal,
    installmentValue: fixedInstallments(mine.plan) ? myFinal / mine.plan : null,
    diffPct: null,
    estimate: estimateAt({ finalPrice: myFinal, plan: mine.plan, freeShipping: true, cost, params }),
  };
  const others: ComparedRow[] = args.competitors.map((c) => {
    const prices = offerPrices(c.offer, params.shipping);
    return {
      mine: false,
      name: sellerOf(c),
      brand: c.brand?.trim() || null,
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
      estimate: estimateAt({ finalPrice: prices.finalPrice, plan: c.offer.installments, freeShipping: c.offer.freeShipping, cost, params }),
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

// ── Filtrar por marca ──

/** La marca de una fila para filtrar, sin importar mayúsculas: vacía si no se cargó. */
export const brandKey = (r: { brand: string | null }) => r.brand?.trim().toLocaleLowerCase('es') ?? '';

export type BrandOption = { key: string; label: string; count: number };

/** Las marcas de la competencia, por nombre, con cuántos competidores tiene cada una. Sin marca va al final. */
export function brandOptions(rows: ComparedRow[]): BrandOption[] {
  const byKey = new Map<string, BrandOption>();
  for (const r of rows) {
    if (r.mine) continue;
    const key = brandKey(r);
    const found = byKey.get(key);
    if (found) found.count++;
    else byKey.set(key, { key, label: r.brand?.trim() || 'Sin marca', count: 1 });
  }
  return [...byKey.values()].sort((a, b) => (a.key === '' ? 1 : b.key === '' ? -1 : a.label.localeCompare(b.label, 'es')));
}

/**
 * El promedio de los competidores de la lista: el precio de lista y el
 * efectivo, cuánto más caro (positivo) o más barato estoy yo frente al
 * efectivo, como en cada fila, y su rentabilidad estimada, de los que se puede
 * estimar. Null sin competidores.
 */
export function competitorAverage(
  rows: ComparedRow[],
  params: PricingParams,
): { count: number; listPrice: number; effectivePrice: number; diffPct: number | null; estimate: Estimate | null } | null {
  const others = rows.filter((r) => !r.mine);
  if (others.length === 0) return null;
  const avg = (of: (r: ComparedRow) => number) => others.reduce((sum, r) => sum + of(r), 0) / others.length;
  const effectivePrice = avg((r) => r.effectivePrice);
  const mine = rows.find((r) => r.mine);
  const margins = others.flatMap((r) => (r.estimate.marginPct === null ? [] : [r.estimate.marginPct]));
  const marginPct = margins.length > 0 ? margins.reduce((sum, m) => sum + m, 0) / margins.length : null;
  return {
    count: others.length,
    listPrice: avg((r) => r.listPrice),
    effectivePrice,
    diffPct: mine && effectivePrice > 0 ? (mine.effectivePrice / effectivePrice - 1) * 100 : null,
    // Si ninguno se puede estimar, por lo mismo que el primero.
    estimate: marginPct !== null ? { marginPct, level: marginLevel(marginPct, params) } : (others[0]?.estimate ?? null),
  };
}

/** Las cuotas del más barato, si se pueden usar: null si no ofrece o si ese plan no tiene el costo cargado. */
export function copyablePlan(row: ComparedRow | null, params: PricingParams): { plan: InstallmentPlan; available: boolean } | null {
  if (!row || row.installments === 0 || !isInstallmentPlan(row.installments)) return null;
  return { plan: row.installments, available: installmentCostPct(params, row.installments) !== null };
}
