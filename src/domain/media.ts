import { z } from 'zod';

// Las fotos de una publicación, en orden. Cada una sale de un lugar: una foto
// que ya está en el canal (con su código allá), una foto corregida en el paso
// Imágenes, o una foto del producto por su link. Sin elegir (null), la
// publicación usa las que tiene en el canal. Este módulo no sabe nada de canales.
//
// Si el producto tiene varias medidas, cada foto puede ser de algunas, y cada
// medida tiene su propio orden. Sin medidas marcadas, la foto es de todas; sin
// orden propio, el comprador ve primero las de su medida y después las de todas.

// Sin tope de fotos: si el canal no acepta tantas, lo dice al subir.

// Las medidas de la foto, por su clave (variantKey). Vacío: todas. Y su lugar
// en cada medida: { "<clave>": 0 } es la portada de esa medida.
const variants = {
  variants: z.array(z.string().min(1).max(200)).max(100).optional(),
  positions: z.record(z.string().min(1).max(200), z.number().int().min(0).max(100000)).optional(),
};

export const photoRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('channel'), id: z.string().min(1).max(100), url: z.string().max(2000).default(''), ...variants }),
  z.object({ kind: z.literal('edit'), editId: z.string().min(1).max(40), ...variants }),
  z.object({ kind: z.literal('asset'), url: z.string().url().max(2000), ...variants }),
]);

export type PhotoRef = z.infer<typeof photoRefSchema>;

/** Una medida, como la tiene la ficha o como la informa el canal. */
export type VariantLike = { sku: string | null; measure: string | null };

/** La medida como se compara: "0,50 mm", "+0.50" y "0.50" son la misma. */
export function measureText(measure: string | null | undefined): string | null {
  const m = (measure ?? '').toLowerCase().replace(/\s+/g, '').replace(/,/g, '.').replace(/^\+/, '').replace(/mm$/, '');
  return m || null;
}

/**
 * Lo que identifica a una medida: su SKU y su medida juntos, porque hay
 * fábricas que usan el mismo código para todas las medidas. Sirve igual para la
 * ficha y para lo que lee el canal. Null si no tiene ninguno de los dos.
 */
export function variantKey(v: VariantLike): string | null {
  const sku = v.sku?.trim().toUpperCase();
  const measure = measureText(v.measure);
  const key = [sku ? `sku:${sku}` : null, measure ? `medida:${measure}` : null].filter(Boolean).join(' ');
  return key || null;
}

/** Las medidas marcadas de la foto. Vacío: es de todas. */
export function photoVariants(ref: PhotoRef): string[] {
  return ref.variants ?? [];
}

/** La foto con esas medidas, sin repetir. Sin ninguna, queda de todas. */
export function withVariants<T extends PhotoRef>(ref: T, keys: string[]): T {
  const out: T = { ...ref };
  delete out.variants;
  const unique = [...new Set(keys)].sort();
  return unique.length > 0 ? { ...out, variants: unique } : out;
}

/** La foto con las medidas y el orden de otra: para llevar lo marcado de una lista a otra. */
export function withMarks<T extends PhotoRef>(ref: T, from: PhotoRef): T {
  const out = withVariants(ref, photoVariants(from));
  delete out.positions;
  return from.positions && Object.keys(from.positions).length > 0 ? { ...out, positions: { ...from.positions } } : out;
}

/**
 * Las fotos que ve el comprador en esa medida. Con orden propio de la medida,
 * en ese orden; sin, primero las suyas y después las de todas, en el orden de la lista.
 */
export function variantPhotos<T extends PhotoRef>(refs: T[], key: string): T[] {
  const shown = [...refs.filter((r) => photoVariants(r).includes(key)), ...refs.filter((r) => photoVariants(r).length === 0)];
  if (!shown.some((r) => r.positions?.[key] !== undefined)) return shown;
  // Las que no tienen lugar en la medida van al final, como estaban.
  const at = (r: T, i: number) => r.positions?.[key] ?? Number.MAX_SAFE_INTEGER - shown.length + i;
  return shown.map((r, i) => ({ r, p: at(r, i) })).sort((a, b) => a.p - b.p).map((x) => x.r);
}

/** Las medidas que tienen orden propio en alguna foto. */
export function orderedMeasures(refs: PhotoRef[]): string[] {
  return [...new Set(refs.flatMap((r) => Object.keys(r.positions ?? {})))].sort();
}

/** Lo que conviene avisar de las medidas: las que se quedan sin fotos. */
export function mediaWarnings(refs: PhotoRef[], measures: { key: string; label: string }[]): string[] {
  if (measures.length < 2 || refs.length === 0) return [];
  return measures.filter((m) => variantPhotos(refs, m.key).length === 0).map((m) => `La medida ${m.label} se queda sin fotos.`);
}

/** Las fotos que acepta un canal tal como vienen: los formatos y el peso máximo. */
export type ChannelPhotoRules = {
  // Los tipos que acepta, por ejemplo image/jpeg.
  types: string[];
  // Cómo se dicen, por ejemplo "JPG o PNG".
  typesLabel: string;
  maxBytes: number;
};

/**
 * Por qué una foto no puede ir al canal tal como está, o null si puede. Una
 * foto que se usa tal cual no se convierte ni se achica.
 */
export function asIsProblem(file: { type: string; size: number }, rules: ChannelPhotoRules | null, channelName: string): string | null {
  if (!rules) return null;
  if (!rules.types.includes(file.type)) return `${channelName} solo acepta fotos ${rules.typesLabel}: exportala así desde la Mac para usarla tal cual.`;
  if (file.size > rules.maxBytes) return `${channelName} acepta fotos de hasta ${Math.round(rules.maxBytes / 1024 / 1024)} MB y esta pesa ${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB.`;
  return null;
}

/** Lo que identifica a una foto, sin importar el link con que se la ve. */
export function photoKey(ref: PhotoRef): string {
  if (ref.kind === 'channel') return `canal:${ref.id}`;
  if (ref.kind === 'edit') return `corregida:${ref.editId}`;
  return `link:${ref.url}`;
}

/** Lee las fotos guardadas. Null: no se eligieron, siguen a las del canal. */
export function parseMedia(raw: unknown): PhotoRef[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((item) => {
    const parsed = photoRefSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/**
 * Una medida de la publicación en el canal, con el código de sus fotos. Si el
 * canal la guarda como una publicación aparte, también el código de esa.
 */
export type ChannelVariation = VariantLike & { photoIds: string[]; externalId?: string };

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);

/** Lee las medidas guardadas de lo que se leyó del canal. */
export function parseVariations(raw: unknown): ChannelVariation[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((v) => {
    if (!v || typeof v !== 'object') return [];
    const o = v as Record<string, unknown>;
    const photoIds = Array.isArray(o.photoIds) ? o.photoIds.filter((id): id is string => typeof id === 'string' && id !== '') : [];
    const externalId = text(o.externalId);
    return [{ sku: text(o.sku), measure: text(o.measure), photoIds, ...(externalId ? { externalId } : {}) }];
  });
}

/** Una medida que el canal guarda como una publicación aparte: su código, su SKU y su medida. */
export type VariantListing = VariantLike & { externalId: string };

/** Lee las publicaciones aparte de cada medida, sin repetir códigos. */
export function parseVariantListings(raw: unknown): VariantListing[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((v) => {
    if (!v || typeof v !== 'object') return [];
    const o = v as Record<string, unknown>;
    const externalId = text(o.externalId);
    if (!externalId || seen.has(externalId)) return [];
    seen.add(externalId);
    return [{ externalId, sku: text(o.sku), measure: text(o.measure) }];
  });
}

/**
 * Las fotos que tiene la publicación en el canal, como se leyeron. Con las
 * medidas del canal, cada foto queda marcada con las suyas, y con su lugar en
 * cada una; la que está en todas, o en ninguna, es de todas.
 */
export function channelPhotos(photos: unknown, photoIds: unknown, variations: unknown = []): PhotoRef[] {
  const urls = Array.isArray(photos) ? photos : [];
  const ids = Array.isArray(photoIds) ? photoIds : [];
  const measures = parseVariations(variations);
  return ids.flatMap((id, i) => {
    if (typeof id !== 'string' || !id) return [];
    let ref: PhotoRef = { kind: 'channel', id, url: typeof urls[i] === 'string' ? urls[i] : '' };
    const own = measures.filter((m) => m.photoIds.includes(id));
    if (own.length > 0 && own.length < measures.length) ref = withVariants(ref, own.flatMap((m) => variantKey(m) ?? []));
    // Con varias medidas, su lugar en cada una, como lo tiene el canal.
    if (measures.length < 2) return [ref];
    const positions = Object.fromEntries(own.flatMap((m) => (variantKey(m) ? [[variantKey(m)!, m.photoIds.indexOf(id)]] : [])));
    return [Object.keys(positions).length > 0 ? { ...ref, positions } : ref];
  });
}

/** Las medidas de cada video de la publicación, por el id del video. Sin marcar, el video es de todas. */
export function parseVideoVariants(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).flatMap(([id, keys]) => {
      const list = Array.isArray(keys) ? [...new Set(keys.filter((k): k is string => typeof k === 'string' && k !== ''))].sort() : [];
      return list.length > 0 ? [[id, list]] : [];
    }),
  );
}

/** Sin repetir: lo que se guarda al elegir. */
export function cleanMedia(refs: PhotoRef[]): PhotoRef[] {
  const seen = new Set<string>();
  const out: PhotoRef[] = [];
  for (const r of refs) {
    const key = photoKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(withMarks(r, r));
  }
  return out;
}
