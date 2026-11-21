import type { ClassifyRules } from './rules';
import type { Competition, Lifecycle } from './tags';

// Las reglas que proponen etiquetas: el ciclo de vida, por la antigüedad y las
// ventas, y la competencia, por el precio del competidor más barato contra el
// sin cuotas. Proponen y explican por qué; lo puesto a mano no se pisa. Sin la
// base de datos.

export type ProductFacts = {
  // Hace cuántos días que se tiene noticia de la publicación más vieja. Null si no se sabe.
  ageDays: number | null;
  // Unidades vendidas. Null si la tienda todavía no trajo todas sus ventas.
  units90: number | null;
  units30: number | null;
  // Las vendidas en el plazo de liquidación.
  unitsClearance: number | null;
  // El stock total, si la app lo lleva.
  stock: number | null;
  // El precio para el comprador sin cuotas de hoy, y el del competidor más barato.
  flatPrice: number | null;
  competitorPrice: number | null;
};

export type Proposal<T> = { value: T | null; why: string } | null;

/** El ciclo de vida que propone la regla. Null si no hay con qué decidir. */
export function proposeLifecycle(f: ProductFacts, rules: ClassifyRules): Proposal<Lifecycle> {
  if (f.ageDays !== null && f.ageDays < rules.newDays) return { value: 'NEW', why: `Se publicó hace ${f.ageDays} días, menos de ${rules.newDays}.` };
  if (f.units90 === null) return null;
  if (f.unitsClearance === 0 && (f.stock === null || f.stock > 0) && f.ageDays !== null && f.ageDays >= rules.clearanceDays) {
    return { value: 'CLEARANCE', why: `No vendió en ${rules.clearanceDays} días${f.stock !== null ? ` y quedan ${f.stock} en stock` : ''}.` };
  }
  if (f.units90 >= rules.matureUnits90 && f.units30 !== null) {
    // Parejas: lo del último mes no pasa por mucho al promedio de los tres.
    const steady = (f.units90 / 3) * (1 + rules.matureGrowthPct / 100);
    if (f.units30 <= steady) return { value: 'MATURE', why: `Vendió ${f.units90} en 90 días y ${f.units30} en los últimos 30: se vende parejo.` };
    return { value: 'GROWING', why: `Vendió ${f.units90} en 90 días y ${f.units30} en los últimos 30: viene creciendo.` };
  }
  return { value: 'GROWING', why: `Vendió ${f.units90} en 90 días, menos de las ${rules.matureUnits90} de una madurada.` };
}

/** La competencia que propone la regla. Sin competidores cargados no propone nada: "sin competencia" se pone a mano. */
export function proposeCompetition(f: ProductFacts, rules: ClassifyRules): Proposal<Competition> {
  if (f.competitorPrice === null || f.flatPrice === null) return null;
  const limit = f.flatPrice * (1 + rules.priceFightPct / 100);
  const gap = Math.round((f.competitorPrice / f.flatPrice - 1) * 1000) / 10;
  if (f.competitorPrice <= limit) {
    return { value: 'PRICE_FIGHT', why: gap <= 0 ? `El competidor más barato está ${Math.abs(gap).toLocaleString('es-AR')} % por debajo del sin cuotas.` : `El competidor más barato está solo ${gap.toLocaleString('es-AR')} % por encima del sin cuotas.` };
  }
  return { value: null, why: `El competidor más barato está ${gap.toLocaleString('es-AR')} % por encima del sin cuotas: no pelea por precio.` };
}
