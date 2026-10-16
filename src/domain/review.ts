import { z } from 'zod';
import {
  CONTENT_FIELD_KIND,
  CONTENT_FIELD_LABEL,
  CONTENT_FIELDS,
  cleanText,
  isContentField,
  sameValue,
  type Compat,
  type ContentField,
  type VariantMeasure,
} from './content';
import { nameValueSchema, type NameValue } from './name-value';
import { productInputSchema } from './products';

// Revisión de una propuesta: lo que la persona edita campo por campo, y las
// reglas para poder aprobar. No usa la base: corre igual en la pantalla, para
// apagar el botón, y en el servidor, antes de escribir.

// Lo que se edita en pantalla: siempre textos, como en los formularios.
export type SpecRow = { name: string; value: string };
export type CompatRow = { vehicleBrand: string; model: string; engine: string; yearFrom: string; yearTo: string; note: string };
export type MeasureRow = { id: string; sku: string; measure: string };
export type EditorValue = string | SpecRow[] | CompatRow[] | MeasureRow[];

export type ReviewField = {
  field: ContentField;
  value: EditorValue;
  // "Usar este cambio": si no está marcado, el campo queda como está.
  included: boolean;
  // Si vino de la IA o lo sumó la persona.
  fromAi: boolean;
};

// Campos que se pueden revisar. Fotos y videos se cargan en la ficha.
export const REVIEWABLE_FIELDS = CONTENT_FIELDS.filter((f) => CONTENT_FIELD_KIND[f] !== 'links' && f !== 'notes');

const PLACEHOLDER = /\[\s*A CONFIRMAR\s*:?\s*([^\]]*)\]/gi;

/** Las marcas [A CONFIRMAR: …] dentro de un valor, en cualquier texto que tenga. */
export function findPlaceholders(value: unknown): string[] {
  const found: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(PLACEHOLDER)) found.push(m[1].trim() || 'dato');
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(value);
  return [...new Set(found)];
}

/** Del valor guardado (como en la ficha) a lo que se edita en pantalla. */
export function toEditorValue(field: ContentField, value: unknown): EditorValue {
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  switch (CONTENT_FIELD_KIND[field]) {
    case 'specs':
      return Array.isArray(value) ? (value as NameValue[]).map((r) => ({ name: s(r.name), value: s(r.value) })) : [];
    case 'compatibilities':
      return Array.isArray(value)
        ? (value as Compat[]).map((c) => ({
            vehicleBrand: s(c.vehicleBrand),
            model: s(c.model),
            engine: s(c.engine),
            yearFrom: s(c.yearFrom),
            yearTo: s(c.yearTo),
            note: s(c.note),
          }))
        : [];
    case 'measures':
      return Array.isArray(value)
        ? (value as VariantMeasure[]).map((m) => ({ id: s(m.id), sku: s(m.sku), measure: s(m.measure) }))
        : [];
    default:
      return typeof value === 'string' ? value : '';
  }
}

// Largos máximos, los mismos de la ficha y la publicación.
const MAX_LENGTH: Partial<Record<ContentField, number>> = {
  title: 300,
  description: 50000,
  warranty: 500,
  kitContents: 5000,
  notes: 5000,
};

export type ReviewProblem = { field: ContentField | null; message: string };

export type ValidatedField = ReviewField & {
  // El valor listo para escribir en la ficha o la publicación.
  normalized: unknown;
};

const compatSchema = productInputSchema.shape.compatibilities.element;

function normalize(field: ContentField, value: EditorValue): { value: unknown; problems: string[] } {
  const problems: string[] = [];
  const kind = CONTENT_FIELD_KIND[field];
  if (kind === 'short' || kind === 'long') {
    const text = cleanText(typeof value === 'string' ? value : '');
    if (!text) problems.push('está vacío. Completalo o destildá "Usar este cambio".');
    const max = MAX_LENGTH[field] ?? 200;
    if (text && text.length > max) problems.push(`supera los ${max} caracteres.`);
    if (kind === 'short' && text?.includes('\n')) problems.push('tiene que ir en una sola línea.');
    return { value: text, problems };
  }
  if (kind === 'specs') {
    const rows = (value as SpecRow[]).filter((r) => r.name.trim() || r.value.trim());
    const out: NameValue[] = [];
    rows.forEach((r, i) => {
      const parsed = nameValueSchema.safeParse(r);
      if (!parsed.success) problems.push(`la fila ${i + 1} es demasiado larga.`);
      else if (!parsed.data.name || !parsed.data.value) problems.push(`la fila ${i + 1} tiene el dato o el valor vacío.`);
      else out.push(parsed.data);
    });
    if (rows.length === 0) problems.push('está vacía. Completala o destildá "Usar este cambio".');
    return { value: out, problems };
  }
  if (kind === 'compatibilities') {
    const rows = (value as CompatRow[]).filter((r) => Object.values(r).some((v) => v.trim()));
    const out: Compat[] = [];
    rows.forEach((r, i) => {
      const parsed = compatSchema.safeParse(r);
      if (!parsed.success) problems.push(`fila ${i + 1}: ${parsed.error.issues[0]?.message ?? 'datos inválidos.'}`);
      else out.push(parsed.data);
    });
    if (rows.length === 0) problems.push('está vacía. Completala o destildá "Usar este cambio".');
    return { value: out, problems };
  }
  if (kind === 'measures') {
    const out: VariantMeasure[] = (value as MeasureRow[]).map((m) => ({
      id: m.id,
      sku: cleanText(m.sku),
      measure: cleanText(m.measure),
    }));
    if (out.some((m) => (m.measure?.length ?? 0) > 100)) problems.push('alguna medida supera los 100 caracteres.');
    return { value: out, problems };
  }
  return { value, problems };
}

/**
 * Revisa lo editado. Solo cuentan los campos marcados con "Usar este
 * cambio". Devuelve los problemas que impiden aprobar y los valores listos
 * para escribir.
 */
export function validateReview(
  fields: ReviewField[],
  opts: { titleMaxLength: number | null },
): { ok: boolean; problems: ReviewProblem[]; fields: ValidatedField[] } {
  const problems: ReviewProblem[] = [];
  const validated = fields.map((f): ValidatedField => {
    const { value, problems: own } = normalize(f.field, f.value);
    if (f.included) {
      const label = CONTENT_FIELD_LABEL[f.field];
      for (const p of own) problems.push({ field: f.field, message: `${label}: ${p}` });
      const marks = findPlaceholders(value);
      if (marks.length > 0) {
        problems.push({ field: f.field, message: `${label}: falta completar ${marks.map((m) => `«${m}»`).join(', ')}.` });
      }
      if (f.field === 'title' && opts.titleMaxLength && typeof value === 'string' && value.length > opts.titleMaxLength) {
        problems.push({
          field: f.field,
          message: `Título: tiene ${value.length} caracteres y el máximo del canal es ${opts.titleMaxLength}.`,
        });
      }
    }
    return { ...f, normalized: value };
  });
  if (!fields.some((f) => f.included)) problems.push({ field: null, message: 'No hay ningún cambio marcado para usar.' });
  return { ok: problems.length === 0, problems, fields: validated };
}

/** Si lo que quedó es distinto de lo que propuso la IA. */
export function wasEdited(field: ContentField, normalized: unknown, aiValue: unknown): boolean {
  if (aiValue === undefined) return true;
  return !sameValue(normalize(field, toEditorValue(field, aiValue)).value, normalized);
}

// Lo que llega de la pantalla, antes de confiar en su forma: cada campo con
// la forma de su tipo.
const text = z.string().max(60000);
const EDITOR_SCHEMA = {
  short: text,
  long: text,
  specs: z.array(z.object({ name: text, value: text })).max(300),
  compatibilities: z
    .array(z.object({ vehicleBrand: text, model: text, engine: text, yearFrom: text, yearTo: text, note: text }))
    .max(500),
  measures: z.array(z.object({ id: z.string().min(1).max(100), sku: text, measure: text })).max(100),
  links: z.array(text).max(100),
} as const;

export const reviewFieldsInputSchema = z
  .array(z.object({ field: z.string(), value: z.unknown(), included: z.boolean(), fromAi: z.boolean() }))
  .max(CONTENT_FIELDS.length)
  .transform((rows, ctx) => {
    const seen = new Set<string>();
    const out: ReviewField[] = [];
    for (const r of rows) {
      if (!isContentField(r.field) || seen.has(r.field)) {
        ctx.addIssue({ code: 'custom', message: 'Campo repetido o desconocido.' });
        return z.NEVER;
      }
      seen.add(r.field);
      const parsed = EDITOR_SCHEMA[CONTENT_FIELD_KIND[r.field]].safeParse(r.value);
      if (!parsed.success) {
        ctx.addIssue({ code: 'custom', message: `${CONTENT_FIELD_LABEL[r.field]} no tiene la forma esperada.` });
        return z.NEVER;
      }
      out.push({ field: r.field, value: parsed.data as EditorValue, included: r.included, fromAi: r.fromAi });
    }
    return out;
  });
