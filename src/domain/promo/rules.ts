import { z } from 'zod';
import { LIFECYCLES, type Lifecycle } from './tags';

// Las reglas de promociones de la cuenta: las recetas del almanaque para cada
// ciclo de vida, los números con los que una regla propone las etiquetas y
// los tiempos. Todo se puede editar; lo que falta toma el valor de partida.
// Las rentabilidades son sobre el costo, en %. null en una rentabilidad: la
// saludable de la cuenta.

const pct = z.number().min(0).max(500);
const margin = pct.nullable();

/** La receta de un ciclo de vida: qué capas lleva y con qué rentabilidad. */
const recipeSchema = z.object({
  // La capa base, con el descuento propio.
  base: z.boolean(),
  baseMarginPct: margin,
  // La base se hace más fuerte al acercarse el próximo evento: a tantos días o menos, esta rentabilidad.
  baseSteps: z.array(z.object({ daysBefore: z.number().int().min(1).max(365), marginPct: pct })).max(6),
  // Los eventos del canal: siempre, solo si ya tiene ventas, o nunca.
  events: z.enum(['always', 'with_sales', 'never']),
  eventMarginPct: margin,
  // Los picos: oferta relámpago y oferta del día.
  peaks: z.boolean(),
  peakMarginPct: margin,
  // El descuento por cantidad.
  volume: z.boolean(),
});
export type Recipe = z.infer<typeof recipeSchema>;

const RECIPES: Record<Lifecycle, Recipe> = {
  // Base chica desde el primer día, todos los picos, eventos si ya tiene ventas.
  NEW: { base: true, baseMarginPct: 25, baseSteps: [], events: 'with_sales', eventMarginPct: null, peaks: true, peakMarginPct: null, volume: false },
  // Base escalonada hacia el próximo evento, evento al máximo saludable, todos los picos.
  GROWING: {
    base: true,
    baseMarginPct: 25,
    baseSteps: [
      { daysBefore: 60, marginPct: 22 },
      { daysBefore: 30, marginPct: 18 },
    ],
    events: 'always',
    eventMarginPct: null,
    peaks: true,
    peakMarginPct: null,
    volume: false,
  },
  // Base apagada, eventos sí.
  MATURE: { base: false, baseMarginPct: null, baseSteps: [], events: 'always', eventMarginPct: null, peaks: false, peakMarginPct: null, volume: false },
  // Picos y descuento por cantidad.
  CLEARANCE: { base: false, baseMarginPct: null, baseSteps: [], events: 'never', eventMarginPct: null, peaks: true, peakMarginPct: null, volume: true },
};

/** Los números con los que la regla propone el ciclo de vida y la competencia. */
const classifySchema = z.object({
  // Publicada hace menos de tantos días: nueva a posicionar.
  newDays: z.number().int().min(1).max(730),
  // Con tantas unidades o más en 90 días y ventas parejas: madurada.
  matureUnits90: z.number().int().min(1).max(100_000),
  // Parejas: las de los últimos 30 días no son más de este % arriba de un tercio de las de 90.
  matureGrowthPct: z.number().min(0).max(1000),
  // Con menos unidades que estas en 90 días, la regla no le pone ciclo de vida: queda sin almanaque hasta ponérselo a mano. 0: todos llevan.
  growingMinUnits90: z.number().int().min(0).max(100_000),
  // Si la regla propone "a liquidar". Apagado, se pone solo a mano.
  clearanceAuto: z.boolean(),
  // Sin ventas en tantos días y con stock: a liquidar.
  clearanceDays: z.number().int().min(7).max(730),
  // Un competidor a este % o menos por encima del precio sin cuotas: pelea por precio.
  priceFightPct: z.number().min(0).max(100),
  // Cada cuántos días hay que volver a relevar los precios de la competencia.
  competitorDays: z.number().int().min(1).max(365),
});
export type ClassifyRules = z.infer<typeof classifySchema>;

// Calibrado con las ventas de una tienda de repuestos, donde vender pocas unidades es lo normal: madurada desde 3 en 90 días,
// "a liquidar" solo a mano, y lo que no vendió nada queda sin ciclo de vida hasta elegirlo.
const CLASSIFY: ClassifyRules = { newDays: 60, matureUnits90: 3, matureGrowthPct: 30, growingMinUnits90: 1, clearanceAuto: false, clearanceDays: 120, priceFightPct: 10, competitorDays: 14 };

const timingSchema = z.object({
  // Hasta cuántos días adelante se arma el almanaque.
  horizonDays: z.number().int().min(14).max(365),
  // Cuánto dura cada tramo de la capa base: no se mueve antes.
  baseDays: z.number().int().min(7).max(14),
  // Cuántos puntos de rentabilidad baja "Empujar", sin pasar el piso.
  pushStepPct: z.number().min(0).max(50),
  // Cuánto más de rentabilidad tiene que dejar la base que el evento al que lleva.
  baseOverEventPct: z.number().min(0).max(50),
  // Con control de stock: con estas unidades o menos no se abren ofertas nuevas.
  stockMin: z.number().int().min(0).max(100_000),
  // Cuántos días antes de que empiece una campaña se pide entrar.
  joinLeadDays: z.number().int().min(0).max(60),
  // Cuántos días después de prender se mide el resultado.
  measureDays: z.number().int().min(1).max(60),
  // Cada cuántos días se reclasifica y se rearma el almanaque.
  reclassifyDays: z.number().int().min(1).max(60),
});
export type Timing = z.infer<typeof timingSchema>;

const TIMING: Timing = { horizonDays: 90, baseDays: 14, pushStepPct: 2.5, baseOverEventPct: 2, stockMin: 3, joinLeadDays: 3, measureDays: 7, reclassifyDays: 7 };

export type PromoRules = { recipes: Record<Lifecycle, Recipe>; classify: ClassifyRules; timing: Timing };

export const DEFAULT_RULES: PromoRules = { recipes: RECIPES, classify: CLASSIFY, timing: TIMING };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Las reglas guardadas, con lo que falta o no vale tomado del valor de partida. */
export function readRules(raw: unknown): PromoRules {
  const r = isObj(raw) ? raw : {};
  const recipes = isObj(r.recipes) ? r.recipes : {};
  const part = <T>(schema: z.ZodType<T>, base: T, value: unknown): T => {
    const merged = schema.safeParse({ ...(base as object), ...(isObj(value) ? value : {}) });
    return merged.success ? merged.data : base;
  };
  return {
    recipes: Object.fromEntries(LIFECYCLES.map((l) => [l, part(recipeSchema, RECIPES[l], recipes[l])])) as Record<Lifecycle, Recipe>,
    classify: part(classifySchema, CLASSIFY, r.classify),
    timing: part(timingSchema, TIMING, r.timing),
  };
}

/** Lo que se quiere cambiar de las reglas, revisado. Lanza ZodError si algo no vale. */
export const rulesPatchSchema = z.object({
  recipes: z.partialRecord(z.enum(LIFECYCLES), recipeSchema.partial()).optional(),
  classify: classifySchema.partial().optional(),
  timing: timingSchema.partial().optional(),
});
export type RulesPatch = z.infer<typeof rulesPatchSchema>;

/** Las reglas con esos cambios encima. */
export function patchRules(current: PromoRules, patch: RulesPatch): PromoRules {
  return readRules({
    recipes: Object.fromEntries(LIFECYCLES.map((l) => [l, { ...current.recipes[l], ...(patch.recipes?.[l] ?? {}) }])),
    classify: { ...current.classify, ...(patch.classify ?? {}) },
    timing: { ...current.timing, ...(patch.timing ?? {}) },
  });
}

/** La rentabilidad saludable y el piso de la cuenta. */
export type Thresholds = { healthyMarginPct: number; floorMarginPct: number };
export const DEFAULT_THRESHOLDS: Thresholds = { healthyMarginPct: 15, floorMarginPct: 10 };

/** Si los dos números valen: el piso no puede pasar a lo saludable. */
export function thresholdsProblem(t: Thresholds): string | null {
  if (!(t.floorMarginPct >= 0) || !(t.healthyMarginPct >= 0)) return 'La rentabilidad no puede ser negativa.';
  if (t.floorMarginPct > t.healthyMarginPct) return 'El piso no puede ser más alto que la rentabilidad saludable.';
  if (t.healthyMarginPct > 500) return 'Revisá la rentabilidad saludable: es demasiado alta.';
  return null;
}
