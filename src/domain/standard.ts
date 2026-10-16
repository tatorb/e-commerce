import type { Metrics } from './measurements';
import type { NameValue } from './name-value';

// Estándar de publicación: reglas configurables que definen qué tiene que
// tener una publicación correcta, y el puntaje que sale de aplicarlas.
//
// Las revisiones son genéricas (fotos, video, garantía) y no saben de ningún
// canal. Primero miran la ficha maestra y la publicación; si la app todavía
// no tiene ese dato, usan la última medición, y lo aclaran en el detalle.

export type CheckKey =
  | 'min_photos'
  | 'has_video'
  | 'compat_complete'
  | 'measures_unambiguous'
  | 'warranty'
  | 'kit_contents'
  | 'specs_complete'
  | 'title_length'
  | 'description_length'
  | 'part_number';

export type ParamDef = { key: string; label: string; default: number; min: number; max: number };

export type CheckDef = { key: CheckKey; label: string; help: string; params: ParamDef[] };

export const CHECKS: CheckDef[] = [
  {
    key: 'min_photos',
    label: 'Cantidad de fotos',
    help: 'Pide un mínimo de fotos.',
    params: [{ key: 'min', label: 'Mínimo de fotos', default: 6, min: 1, max: 30 }],
  },
  { key: 'has_video', label: 'Video', help: 'Pide al menos un video.', params: [] },
  {
    key: 'compat_complete',
    label: 'Compatibilidades completas',
    help: 'Pide al menos una compatibilidad, y que cada una tenga marca, modelo y motor.',
    params: [],
  },
  {
    key: 'measures_unambiguous',
    label: 'Medidas sin ambigüedad',
    help: 'Cada medida tiene que ser STD o llevar unidad, mm o pulgadas. Si el producto tiene varias variantes, todas tienen que tener medida.',
    params: [],
  },
  { key: 'warranty', label: 'Garantía declarada', help: 'Pide que la ficha diga la garantía.', params: [] },
  { key: 'kit_contents', label: 'Contenido del kit', help: 'Pide que la ficha diga qué trae.', params: [] },
  {
    key: 'specs_complete',
    label: 'Ficha técnica',
    help: 'Pide un mínimo de atributos técnicos.',
    params: [{ key: 'min', label: 'Mínimo de atributos', default: 10, min: 1, max: 100 }],
  },
  {
    key: 'title_length',
    label: 'Largo del título',
    help: 'Pide que el título tenga entre un mínimo y un máximo de caracteres.',
    params: [
      { key: 'min', label: 'Mínimo de caracteres', default: 45, min: 1, max: 500 },
      { key: 'max', label: 'Máximo de caracteres', default: 60, min: 1, max: 500 },
    ],
  },
  {
    key: 'description_length',
    label: 'Largo de la descripción',
    help: 'Pide un mínimo de caracteres propios del producto en la descripción.',
    params: [{ key: 'min', label: 'Mínimo de caracteres', default: 400, min: 1, max: 50000 }],
  },
  { key: 'part_number', label: 'Número de pieza', help: 'Pide que la ficha diga el número de pieza u OEM.', params: [] },
];

export const CHECK_BY_KEY = new Map(CHECKS.map((c) => [c.key, c]));

export function isCheckKey(key: string): key is CheckKey {
  return CHECK_BY_KEY.has(key as CheckKey);
}

export type RuleConfig = {
  id: string;
  name: string;
  description: string | null;
  check: string;
  params: unknown;
  weight: number;
  active: boolean;
};

/** Reglas que se cargan solas en una cuenta nueva. */
export const SUGGESTED_RULES: Omit<RuleConfig, 'id'>[] = [
  { name: 'Mínimo 6 fotos', description: 'Las publicaciones con 6 fotos o más convierten mejor.', check: 'min_photos', params: { min: 6 }, weight: 20, active: true },
  { name: 'Video presente', description: 'Un video o clip que muestre el producto.', check: 'has_video', params: {}, weight: 10, active: true },
  { name: 'Compatibilidades completas', description: 'Marca, modelo y motor de cada vehículo compatible.', check: 'compat_complete', params: {}, weight: 20, active: true },
  { name: 'Medidas sin ambigüedad', description: 'STD o con unidad, para que nadie dude entre 0.5, 050, mm o pulgadas.', check: 'measures_unambiguous', params: {}, weight: 15, active: true },
  { name: 'Garantía declarada', description: 'La garantía escrita en la ficha.', check: 'warranty', params: {}, weight: 10, active: true },
  { name: 'Contenido del kit declarado', description: 'Qué trae y qué no trae el kit.', check: 'kit_contents', params: {}, weight: 10, active: true },
  { name: 'Ficha técnica completa', description: 'Datos técnicos suficientes para elegir sin preguntar.', check: 'specs_complete', params: { min: 10 }, weight: 15, active: true },
];

/** Lee los valores de una regla con los de fábrica para lo que falte. */
export function readParams(check: CheckKey, raw: unknown): Record<string, number> {
  const def = CHECK_BY_KEY.get(check)!;
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Record<string, number> = {};
  for (const p of def.params) {
    const v = Number(src[p.key]);
    out[p.key] = Number.isFinite(v) ? Math.min(p.max, Math.max(p.min, Math.round(v))) : p.default;
  }
  return out;
}

/** Texto corto de lo que revisa una regla: "Cantidad de fotos · mínimo 6". */
export function describeCheck(check: string, params: unknown): string {
  if (!isCheckKey(check)) return 'Revisión desconocida';
  const def = CHECK_BY_KEY.get(check)!;
  const values = readParams(check, params);
  const parts = def.params.map((p) => `${p.label.toLowerCase()} ${values[p.key]}`);
  return [def.label, ...parts].join(' · ');
}

// ───────────────────────────── Datos de entrada ─────────────────────────────

export type ScoreInput = {
  product: {
    warranty: string | null;
    kitContents: string | null;
    partNumber: string | null;
    specs: NameValue[];
    variants: { measure: string | null }[];
    compatibilities: { vehicleBrand: string | null; model: string | null; engine: string | null }[];
    assets: { kind: 'PHOTO' | 'VIDEO' }[];
  };
  publication: { title: string | null; description: string | null; attributes: NameValue[] };
  measurement: { takenAt: Date; metrics: Metrics } | null;
};

export type RuleStatus = 'pass' | 'fail' | 'na';

export type RuleResult = {
  ruleId: string;
  name: string;
  weight: number;
  status: RuleStatus;
  // Qué falta, o de dónde salió el dato.
  detail: string | null;
  fromMeasurement: boolean;
};

export type ScoreResult = {
  // null si ninguna regla aplica.
  score: number | null;
  results: RuleResult[];
  // Las que no pasan, de mayor a menor peso.
  missing: RuleResult[];
};

// ───────────────────────────── Revisiones ─────────────────────────────

const filled = (v: string | null | undefined) => !!v && v.trim() !== '';

/** "a", "a y b", "a, b y c". */
function joinEs(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

function dateLabel(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/**
 * Una medida sin ambigüedad: STD, o un número con unidad. "0,50 mm",
 * "0.020 pulg", "1 mm" pasan; "0.5", "050" o "+1" no.
 */
export function isUnambiguousMeasure(raw: string): boolean {
  const m = raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/^(std|standard|estandar)$/.test(m)) return true;
  return /^\+?\d+([.,]\d+)?\s*(mm|milimetros?|pulg\.?|pulgadas?|plg\.?|in|")$/.test(m);
}

type Outcome = { status: RuleStatus; detail: string | null; fromMeasurement: boolean };

const pass = (detail: string | null = null, fromMeasurement = false): Outcome => ({ status: 'pass', detail, fromMeasurement });
const fail = (detail: string, fromMeasurement = false): Outcome => ({ status: 'fail', detail, fromMeasurement });
const na = (detail: string): Outcome => ({ status: 'na', detail, fromMeasurement: false });

function runCheck(check: CheckKey, params: Record<string, number>, input: ScoreInput): Outcome {
  const { product, publication, measurement } = input;
  const m = measurement?.metrics ?? {};
  const fromM = measurement ? `, según la medición del ${dateLabel(measurement.takenAt)}` : '';

  switch (check) {
    case 'min_photos': {
      const min = params.min;
      const appCount = product.assets.filter((a) => a.kind === 'PHOTO').length;
      if (appCount > 0) return appCount >= min ? pass() : fail(`Tiene ${appCount} de ${min} fotos.`);
      if (typeof m.photo_count === 'number') {
        return m.photo_count >= min
          ? pass(`Tiene ${m.photo_count} fotos${fromM}.`, true)
          : fail(`Tiene ${m.photo_count} de ${min} fotos${fromM}.`, true);
      }
      return fail('No tiene fotos cargadas.');
    }
    case 'has_video': {
      if (product.assets.some((a) => a.kind === 'VIDEO')) return pass();
      if (m.has_video === true) return pass(`Tiene video${fromM}.`, true);
      if (m.has_video === false) return fail(`No tiene video${fromM}.`, true);
      return fail('No tiene video cargado.');
    }
    case 'compat_complete': {
      const rows = product.compatibilities;
      if (rows.length === 0) {
        if (m.compatibility_loaded === true) return pass(`Tiene compatibilidades cargadas en el canal${fromM}.`, true);
        if (m.compatibility_loaded === false) return fail(`No tiene compatibilidades cargadas${fromM}.`, true);
        return fail('No tiene compatibilidades cargadas.');
      }
      const gaps: string[] = [];
      const count = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter(pred).length;
      const noBrand = count((r) => !filled(r.vehicleBrand));
      const noModel = count((r) => !filled(r.model));
      const noEngine = count((r) => !filled(r.engine));
      const of = (n: number) => (rows.length === 1 ? '' : ` en ${n} de ${rows.length}`);
      if (noBrand) gaps.push(`la marca${of(noBrand)}`);
      if (noModel) gaps.push(`el modelo${of(noModel)}`);
      if (noEngine) gaps.push(`el motor${of(noEngine)}`);
      if (gaps.length === 0) return pass();
      return fail(`Falta ${joinEs(gaps)} en las compatibilidades.`);
    }
    case 'measures_unambiguous': {
      const variants = product.variants;
      const measured = variants.filter((v) => filled(v.measure));
      if (measured.length === 0) {
        if (variants.length <= 1) return na('No tiene variantes por medida.');
        return fail(`Tiene ${variants.length} variantes y ninguna medida declarada.`);
      }
      const unmeasured = variants.length - measured.length;
      const ambiguous = measured.map((v) => v.measure!.trim()).filter((v) => !isUnambiguousMeasure(v));
      const problems: string[] = [];
      if (ambiguous.length) problems.push(`Medidas sin unidad: ${ambiguous.join(', ')}. Escribilas como STD, 0,50 mm o 0,020 pulgadas.`);
      if (unmeasured) problems.push(`${unmeasured === 1 ? 'Una variante no tiene' : `${unmeasured} variantes no tienen`} medida.`);
      return problems.length ? fail(problems.join(' ')) : pass();
    }
    case 'warranty':
      return filled(product.warranty) ? pass() : fail('La ficha no dice la garantía.');
    case 'kit_contents':
      return filled(product.kitContents) ? pass() : fail('La ficha no dice qué trae.');
    case 'specs_complete': {
      const min = params.min;
      const appCount = Math.max(product.specs.length, publication.attributes.length);
      if (appCount > 0) return appCount >= min ? pass() : fail(`Tiene ${appCount} de ${min} atributos técnicos.`);
      if (typeof m.attribute_count === 'number') {
        return m.attribute_count >= min
          ? pass(`Tiene ${m.attribute_count} atributos${fromM}.`, true)
          : fail(`Tiene ${m.attribute_count} de ${min} atributos técnicos${fromM}.`, true);
      }
      return fail('No tiene ficha técnica cargada.');
    }
    case 'title_length': {
      const { min, max } = params;
      const len = publication.title?.trim().length ?? 0;
      if (len === 0) return fail('No tiene título.');
      if (len < min || len > max) return fail(`El título tiene ${len} caracteres; el estándar pide entre ${min} y ${max}.`);
      return pass();
    }
    case 'description_length': {
      const min = params.min;
      const len = publication.description?.trim().length ?? 0;
      if (len > 0) return len >= min ? pass() : fail(`La descripción tiene ${len} de ${min} caracteres.`);
      if (typeof m.own_description_chars === 'number') {
        return m.own_description_chars >= min
          ? pass(`Tiene ${m.own_description_chars} caracteres propios${fromM}.`, true)
          : fail(`Tiene ${m.own_description_chars} de ${min} caracteres propios${fromM}.`, true);
      }
      return fail('No tiene descripción.');
    }
    case 'part_number':
      return filled(product.partNumber) ? pass() : fail('La ficha no dice el número de pieza.');
  }
}

/** Aplica las reglas activas y calcula el puntaje de 0 a 100. */
export function scorePublication(rules: RuleConfig[], input: ScoreInput): ScoreResult {
  const results: RuleResult[] = [];
  for (const rule of rules) {
    if (!rule.active || !isCheckKey(rule.check) || rule.weight <= 0) continue;
    const outcome = runCheck(rule.check, readParams(rule.check, rule.params), input);
    results.push({ ruleId: rule.id, name: rule.name, weight: rule.weight, ...outcome });
  }
  const applicable = results.filter((r) => r.status !== 'na');
  const total = applicable.reduce((s, r) => s + r.weight, 0);
  const passed = applicable.filter((r) => r.status === 'pass').reduce((s, r) => s + r.weight, 0);
  return {
    score: total > 0 ? Math.round((passed / total) * 100) : null,
    results,
    missing: results.filter((r) => r.status === 'fail').sort((a, b) => b.weight - a.weight),
  };
}

export type ScoreBand = 'low' | 'mid' | 'high' | 'none';

/** Rango de puntaje: menos de 50, de 50 a 79, 80 o más. */
export function scoreBand(score: number | null): ScoreBand {
  if (score === null) return 'none';
  if (score >= 80) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}
