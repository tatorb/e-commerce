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
  // El PNG del paso Imágenes con texto, por el id de la pieza: sigue siendo la misma aunque se vuelva a generar.
  z.object({ kind: z.literal('text'), id: z.string().min(1).max(40), ...variants }),
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
  // El lado más chico que acepta, en px: una foto menor la rechaza y no la agranda. null: no lo informa.
  minSide: number | null;
  // El lado que recomienda, por ejemplo para que el comprador pueda hacer zoom.
  recommendedSide: number | null;
};

export type PhotoSize = { width: number; height: number };

/**
 * Por qué una foto de ese tamaño no sirve para el canal, o null si sirve. La
 * edición no agranda la foto: si el original es chico, la final sale chica.
 */
export function photoSizeProblem(size: PhotoSize | null | undefined, rules: ChannelPhotoRules | null, channelName: string): string | null {
  if (!size || !rules?.minSide) return null;
  if (Math.min(size.width, size.height) >= rules.minSide) return null;
  return `Es chica para ${channelName}: tiene ${size.width} × ${size.height} px y ${channelName} pide al menos ${rules.minSide} × ${rules.minSide}. La edición no la agranda: hace falta una foto más grande.`;
}

/** El aviso cuando la foto sirve pero queda por debajo de lo que recomienda el canal, o null. */
export function photoSizeWarning(size: PhotoSize | null | undefined, rules: ChannelPhotoRules | null, channelName: string): string | null {
  if (!size || !rules?.recommendedSide || photoSizeProblem(size, rules, channelName)) return null;
  if (Math.min(size.width, size.height) >= rules.recommendedSide) return null;
  return `Tiene ${size.width} × ${size.height} px: ${channelName} recomienda ${rules.recommendedSide} × ${rules.recommendedSide} para que el comprador pueda hacer zoom.`;
}

/**
 * Por qué una foto no puede ir al canal tal como está, o null si puede. Una
 * foto que se usa tal cual no se convierte ni se achica.
 */
export function asIsProblem(
  file: { type: string; size: number; width?: number | null; height?: number | null },
  rules: ChannelPhotoRules | null,
  channelName: string,
): string | null {
  if (!rules) return null;
  if (!rules.types.includes(file.type)) return `${channelName} solo acepta fotos ${rules.typesLabel}: exportala así desde la Mac para usarla tal cual.`;
  if (file.size > rules.maxBytes) return `${channelName} acepta fotos de hasta ${Math.round(rules.maxBytes / 1024 / 1024)} MB y esta pesa ${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB.`;
  return file.width && file.height ? photoSizeProblem({ width: file.width, height: file.height }, rules, channelName) : null;
}

/** Lo que identifica a una foto, sin importar el link con que se la ve. */
export function photoKey(ref: PhotoRef): string {
  if (ref.kind === 'channel') return `canal:${ref.id}`;
  if (ref.kind === 'edit') return `corregida:${ref.editId}`;
  if (ref.kind === 'text') return `texto:${ref.id}`;
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
 * Una medida de la publicación en el canal, con el código de sus fotos y su
 * cantidad disponible. Si el canal la guarda como una publicación aparte,
 * también el código de esa; si no, el código de la variante, para reconocerla
 * en las ventas.
 */
export type ChannelVariation = VariantLike & { photoIds: string[]; externalId?: string; variationId?: string; quantity?: number | null };

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);

/** Lee las medidas guardadas de lo que se leyó del canal. */
export function parseVariations(raw: unknown): ChannelVariation[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((v) => {
    if (!v || typeof v !== 'object') return [];
    const o = v as Record<string, unknown>;
    const photoIds = Array.isArray(o.photoIds) ? o.photoIds.filter((id): id is string => typeof id === 'string' && id !== '') : [];
    const externalId = text(o.externalId);
    const variationId = text(o.variationId);
    const quantity = typeof o.quantity === 'number' && Number.isFinite(o.quantity) ? o.quantity : null;
    return [
      {
        sku: text(o.sku),
        measure: text(o.measure),
        photoIds,
        ...(externalId ? { externalId } : {}),
        ...(variationId ? { variationId } : {}),
        ...(quantity !== null ? { quantity } : {}),
      },
    ];
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

// ───────────────────────────── Orden del protocolo ─────────────────────────────

/**
 * Dónde va una foto sacada para una medida, al armar las fotos en el orden
 * del protocolo: vacío en todas; con la clave, solo en esa; null no va, porque
 * es de una medida que la publicación no vende. sells son las medidas que vende
 * la publicación y known todas las de la ficha. Una medida que ya no está en la
 * ficha tampoco va: no se sabe de cuál es, y pasarla a todas mezclaría las
 * fotos de una medida con las de otra. Primero hay que elegirle la medida.
 */
export function protocolUse(measure: string | null, sells: string[], known: string[]): string[] | null {
  if (!measure) return [];
  if (!known.includes(measure)) return known.length >= 2 ? null : [];
  if (sells.length === 0) return [];
  if (!sells.includes(measure)) return null;
  return sells.length >= 2 ? [measure] : [];
}

/**
 * Las fotos ya en orden, con sus medidas y su lugar en cada medida. Cada
 * medida las ve en el orden de la lista: las suyas y las de todas, mezcladas.
 */
export function arrangedMedia<T extends PhotoRef>(items: { ref: T; use: string[] }[], measures: string[]): T[] {
  if (measures.length < 2) return items.map(({ ref }) => withMarks(ref, { ...ref, variants: [], positions: {} }));
  const next: Record<string, number> = Object.fromEntries(measures.map((m) => [m, 0]));
  return items.map(({ ref, use }) => {
    const own = use.filter((k) => measures.includes(k));
    const windows = own.length === 0 ? measures : own;
    const positions = Object.fromEntries(windows.map((w) => [w, next[w]++]));
    return withMarks(ref, { ...ref, variants: own, positions });
  });
}

/** Dónde va una foto en un orden: se comparan los números de a uno, el primero manda. */
export type OrderPlace = number[];

const comparePlaces = (a: OrderPlace, b: OrderPlace) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
};

/** El lugar para una foto: después de la última con lugar que va antes que ella; sin ninguna, antes de la primera que va después; si no hay, al final. */
function slotFor(list: PhotoRef[], place: OrderPlace, placeOf: (ref: PhotoRef) => OrderPlace | null): number {
  let after = -1;
  let before = -1;
  list.forEach((r, i) => {
    const p = placeOf(r);
    if (!p) return;
    if (comparePlaces(p, place) <= 0) after = i;
    else if (before < 0) before = i;
  });
  return after >= 0 ? after + 1 : before >= 0 ? before : list.length;
}

/**
 * Suma fotos a las que ya tiene la publicación, cada una en su lugar entre
 * las que tienen lugar (las de un protocolo), sin mover las demás: en la lista
 * y en el orden de cada medida. Las que no tienen lugar quedan donde estaban.
 * measures son las medidas que se pueden marcar; con menos de dos, solo la lista.
 */
export function addInOrder(
  current: PhotoRef[],
  added: { ref: PhotoRef; place: OrderPlace }[],
  placeOf: (ref: PhotoRef) => OrderPlace | null,
  measures: string[],
): PhotoRef[] {
  let list = [...current];
  const places = new Map(added.map((a) => [photoKey(a.ref), a.place]));
  const place = (r: PhotoRef) => places.get(photoKey(r)) ?? placeOf(r);
  for (const a of [...added].sort((x, y) => comparePlaces(x.place, y.place))) {
    let ref = a.ref;
    if (measures.length >= 2) {
      const own = photoVariants(ref).filter((k) => measures.includes(k));
      for (const w of own.length > 0 ? own : measures) {
        // Lo que ve esa medida, con la foto nueva en su lugar, y todas numeradas así.
        const shown = variantPhotos(list, w);
        const next = [...shown];
        next.splice(slotFor(shown, a.place, place), 0, ref);
        const at = new Map(next.map((r, i) => [photoKey(r), i]));
        list = list.map((r) => (at.has(photoKey(r)) ? { ...r, positions: { ...r.positions, [w]: at.get(photoKey(r))! } } : r));
        ref = { ...ref, positions: { ...ref.positions, [w]: at.get(photoKey(ref))! } };
      }
    }
    list.splice(slotFor(list, a.place, place), 0, ref);
  }
  return list;
}
