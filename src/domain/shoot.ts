import { z } from 'zod';

// Registro de productos: el operario saca las fotos y los videos de un
// producto con el celular, por medida, siguiendo un protocolo o sin ninguno.
// Este módulo no usa la base: las reglas de los protocolos, la calidad mínima,
// qué pasos ya se hicieron y a qué publicaciones va cada foto.

// Un paso es de una foto, de un video, o sin registro: algo que se hace y se
// marca Listo, como preparar o limpiar el lugar.
export type ShootKind = 'PHOTO' | 'VIDEO' | 'CHECK';
export type MediaKind = Exclude<ShootKind, 'CHECK'>;

export const SHOOT_KIND_LABEL: Record<ShootKind, string> = { PHOTO: 'Foto', VIDEO: 'Video', CHECK: 'Sin registro' };

/** Cómo se dice de qué es un paso: "Ese paso es de una foto". */
export const SHOOT_KIND_TEXT: Record<ShootKind, string> = { PHOTO: 'de una foto', VIDEO: 'de un video', CHECK: 'sin registro' };

export const protocolInput = z.object({
  name: z.string().trim().min(1, 'Poné un nombre.').max(120, 'El nombre es muy largo.'),
  description: z.string().trim().max(1000, 'La descripción es muy larga.').default(''),
});

export const stepInput = z.object({
  title: z.string().trim().min(1, 'Poné un título.').max(120, 'El título es muy largo.'),
  kind: z.enum(['PHOTO', 'VIDEO', 'CHECK']),
  explanation: z.string().trim().max(4000, 'La explicación es muy larga.').default(''),
  // Para Claude, en el trabajador de imágenes: qué tener en cuenta al corregir las fotos de este paso.
  editorNotes: z.string().trim().max(2000, 'Las indicaciones para el editor son muy largas.').default(''),
});

// ───────────────────────────── Producto nuevo y medidas ─────────────────────────────

const optText = (max: number, tooLong: string) => z.string().trim().max(max, tooLong).default('');

/** Una medida cargada desde el registro: su nombre y, si tiene, su SKU. */
export const measureRowInput = z.object({
  measure: optText(100, 'La medida es muy larga.'),
  sku: optText(200, 'El SKU es muy largo.'),
});

export type MeasureRow = z.infer<typeof measureRowInput>;

/** Lo básico de un producto que entra por primera vez desde el registro. El resto de la ficha se completa en Productos. */
export const newProductInput = z.object({
  name: z.string().trim().min(1, 'Poné el nombre del producto.').max(300, 'El nombre es muy largo.'),
  partNumber: optText(200, 'El código es muy largo.'),
  brand: optText(200, 'La marca es muy larga.'),
  productType: optText(200, 'El tipo de producto es muy largo.'),
  measures: z.array(measureRowInput).max(100, 'Son demasiadas medidas.').default([]),
});

export const newMeasuresInput = z.array(measureRowInput).max(100, 'Son demasiadas medidas.');

/**
 * Las medidas cargadas sin las líneas vacías, o el motivo por el que no
 * sirven: cada una necesita su nombre, y no se repiten ni entre ellas ni con
 * las que ya tiene el producto. El SKU repetido en otro producto se mira con la base.
 */
export function measureRows(rows: MeasureRow[], existing: { measure: string | null; sku: string | null }[] = []): { ok: true; rows: MeasureRow[] } | { ok: false; error: string } {
  const filled = rows.filter((r) => r.measure || r.sku);
  if (filled.some((r) => !r.measure)) return { ok: false, error: 'Cada medida necesita su nombre, por ejemplo STD o 0.50.' };
  const seen = new Set(existing.map((e) => e.measure?.trim().toUpperCase()).filter(Boolean));
  const skus = new Set(existing.map((e) => e.sku?.trim().toUpperCase()).filter(Boolean));
  for (const r of filled) {
    const m = r.measure.toUpperCase();
    if (seen.has(m)) return { ok: false, error: `La medida ${r.measure} ya está.` };
    seen.add(m);
    const sku = r.sku.toUpperCase();
    if (sku && skus.has(sku)) return { ok: false, error: `El SKU ${r.sku} ya está en otra medida.` };
    if (sku) skus.add(sku);
  }
  return { ok: true, rows: filled };
}

/** El primer motivo por el que no sirve lo que se cargó. */
export function inputProblem(r: { success: boolean; error?: z.ZodError }): string | null {
  return r.success ? null : (r.error?.issues[0]?.message ?? 'Revisá los datos.');
}

// Las ilustraciones de los pasos: imágenes comunes, que el navegador muestra.
export const ILLUSTRATION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};
export const ILLUSTRATION_MAX_BYTES = 15 * 1024 * 1024;

/** El tipo de una ilustración por su nombre, o el motivo por el que no sirve. */
export function illustrationType(file: { name: string; size: number }): { ok: true; type: string } | { ok: false; error: string } {
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  const type = ILLUSTRATION_TYPES[ext];
  if (!type) return { ok: false, error: 'La ilustración tiene que ser una imagen JPG, PNG, WEBP o GIF.' };
  if (!(file.size > 0) || file.size > ILLUSTRATION_MAX_BYTES) return { ok: false, error: 'La ilustración pesa más de 15 MB.' };
  return { ok: true, type };
}

// ───────────────────────────── Calidad ─────────────────────────────

// Lo mínimo es HD: 1280 × 720, con el teléfono parado o acostado.
export const MIN_SHORT_SIDE = 720;
export const MIN_LONG_SIDE = 1280;

export type Quality = {
  // Lo que se le muestra al operario, por ejemplo "4K, 3840 × 2160" o "12 MP, 4032 × 3024".
  text: string;
  // Por debajo de HD no se sube.
  enough: boolean;
};

const size = (w: number, h: number) => `${w} × ${h}`;

/** La calidad de una foto o un video por su ancho y alto. Null si no se pudo medir. */
export function qualityOf(kind: MediaKind, dims: { width: number; height: number } | null): Quality | null {
  if (!dims || !(dims.width > 0) || !(dims.height > 0)) return null;
  const short = Math.min(dims.width, dims.height);
  const long = Math.max(dims.width, dims.height);
  const enough = short >= MIN_SHORT_SIDE && long >= MIN_LONG_SIDE;
  if (kind === 'PHOTO') {
    const mp = (dims.width * dims.height) / 1_000_000;
    const label = mp >= 10 ? `${Math.round(mp)} MP` : `${mp.toFixed(1).replace('.', ',')} MP`;
    return { text: `${label}, ${size(dims.width, dims.height)}`, enough };
  }
  const label = short >= 2160 || long >= 3840 ? '4K' : short >= 1080 ? 'Full HD' : enough ? 'HD' : 'Menos que HD';
  return { text: `${label}, ${size(dims.width, dims.height)}`, enough };
}

export const LOW_QUALITY_HELP =
  'Está por debajo de HD, que es lo mínimo. Revisá la calidad de la cámara: en iPhone, Ajustes, Cámara, y elegí 4K en Grabar video; en Android, en la cámara, tocá el engranaje y elegí la resolución más alta.';

// ───────────────────────────── Pasos hechos ─────────────────────────────

/** Lo que ya se sacó del producto en Registro de productos, o un paso sin registro marcado Listo. */
export type Shot = { stepId: string | null; variantKey: string | null };

/** Si lo registrado para una medida, o para todas (null), vale para la medida elegida. */
export const shotCounts = (shot: Shot, variantKey: string | null) => shot.variantKey === null || shot.variantKey === variantKey;

/**
 * Cuántas fotos, videos o Listo tiene cada paso para la medida elegida. Lo que
 * se sacó para todas las medidas cuenta para cada una; lo de una medida, solo para esa.
 */
export function shotsPerStep(shots: Shot[], variantKey: string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of shots) {
    if (!s.stepId || !shotCounts(s, variantKey)) continue;
    out[s.stepId] = (out[s.stepId] ?? 0) + 1;
  }
  return out;
}

// ───────────────────────────── Adónde va ─────────────────────────────

/**
 * Cómo ve las medidas una publicación del producto: las que se pueden marcar
 * (dos o más, si en el canal tiene variantes) y la medida que vende sola, si
 * cada medida se publica aparte. Lo arma lib/media.ts.
 */
export type PublicationMeasures = { measures: string[]; sole: string | null };

/**
 * Si una foto sacada para una medida (o para todas, null) va a una
 * publicación, y con qué medidas marcada. Sin marcas es de todas.
 */
export function photoPlacement(pub: PublicationMeasures, variantKey: string | null): { add: false } | { add: true; variants: string[] } {
  if (pub.sole !== null) return variantKey === null || variantKey === pub.sole ? { add: true, variants: [] } : { add: false };
  if (variantKey === null || pub.measures.length < 2) return { add: true, variants: [] };
  // Una medida que la publicación no tiene: no se suma, para que no aparezca en las otras.
  return pub.measures.includes(variantKey) ? { add: true, variants: [variantKey] } : { add: false };
}

/** Las medidas con que queda marcado un video en una publicación. Vacío: ninguna marca. */
export function videoMarks(pub: PublicationMeasures, variantKey: string | null): string[] {
  if (pub.sole !== null || variantKey === null || pub.measures.length < 2) return [];
  return pub.measures.includes(variantKey) ? [variantKey] : [];
}

/** Cómo se dice en los pasos Imágenes y Videos lo que se sacó en Registro de productos: "Registro: medida 0.50, Frente". */
export function shotText(variantLabel: string | null, stepTitle: string | null): string {
  return `Registro: ${[variantLabel ? `medida ${variantLabel}` : 'todas las medidas', stepTitle].filter(Boolean).join(', ')}`;
}
