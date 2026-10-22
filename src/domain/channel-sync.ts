import { cleanText } from './content';
import { channelPhotos, orderedMeasures, parseMedia, photoKey, photoVariants, variantPhotos, type PhotoRef } from './media';
import { parseNameValueList, type NameValue } from './name-value';

// Las caras de una publicación: lo que tiene la app y lo que está en el canal.
// Para saber de qué lado cambió cada dato se guarda, además, la huella de lo
// último en que las dos coincidieron. Este módulo no sabe nada de canales.

export const FACE_FIELDS = ['title', 'description', 'attributes', 'photos'] as const;
export type FaceField = (typeof FACE_FIELDS)[number];

export const FACE_FIELD_LABEL: Record<FaceField, string> = {
  title: 'Título',
  description: 'Descripción',
  attributes: 'Datos de catálogo',
  photos: 'Fotos',
};

// Cómo se cuenta cada cambio en el historial.
export const SYNC_CHANGE_LABEL = {
  TAKEN: 'llegó del canal',
  CHOSE_CHANNEL: 'se eligió lo del canal',
  CHOSE_APP: 'se eligió lo de la app',
  SENT: 'se subió al canal',
  DISCARDED: 'se descartó el cambio de la app',
  CREATED: 'se creó en el canal',
  REJECTED: 'no se pudo subir',
  CREATE_FAILED: 'no se pudo crear en el canal',
  ANSWERED: 'se respondió desde la app',
  ANSWER_FAILED: 'no se pudo responder',
} as const;

export function isFaceField(value: string): value is FaceField {
  return (FACE_FIELDS as readonly string[]).includes(value);
}

// photos null: la app no eligió fotos, sigue a las del canal.
export type FaceValues = { title: string | null; description: string | null; attributes: NameValue[]; photos: PhotoRef[] | null };
export type Fingerprints = Partial<Record<FaceField, string>>;

/** Los datos de la cara de la app, como los guarda la publicación. */
export function faceValues(p: { title: string | null; description: string | null; attributes: unknown; media?: unknown }): FaceValues {
  return { title: p.title, description: p.description, attributes: parseNameValueList(p.attributes), photos: parseMedia(p.media) };
}

/** Los datos de la cara del canal, como los guarda la copia de lo que se leyó. */
export function channelFaceValues(c: {
  title: string | null;
  description: string | null;
  attributes: unknown;
  photos: unknown;
  photoIds: unknown;
  variations: unknown;
}): FaceValues {
  return { title: c.title, description: c.description, attributes: parseNameValueList(c.attributes), photos: channelPhotos(c.photos, c.photoIds, c.variations) };
}

const oneSpace = (s: string) => s.replace(/\s+/g, ' ').trim();

/** El dato como se compara: sin diferencias de espacios, saltos de línea ni orden de los datos de catálogo. */
function normalized(field: FaceField, value: FaceValues[FaceField]): string {
  if (field === 'photos') {
    // Las medidas y el orden de cada una cuentan solo si hay: las fotos sin medidas comparan como siempre.
    const refs = (value as PhotoRef[] | null) ?? [];
    const lines = refs.map((r) => {
      const marks = photoVariants(r);
      return marks.length > 0 ? `${photoKey(r)} @ ${[...marks].sort().join(',')}` : photoKey(r);
    });
    const orders = orderedMeasures(refs).map((key) => `${key}: ${variantPhotos(refs, key).map(photoKey).join(' ')}`);
    return [...lines, ...orders].join('\n');
  }
  if (field === 'attributes') {
    return (value as NameValue[])
      .map((a) => `${oneSpace(a.name).toLowerCase()}=${oneSpace(a.value)}`)
      .filter((line) => !line.endsWith('='))
      .sort()
      .join('\n');
  }
  const text = cleanText(value as string | null);
  if (!text) return '';
  if (field === 'title') return oneSpace(text);
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

// Un dato vacío tiene huella vacía.
const EMPTY = '';
// Las fotos que la app no eligió: siguen a las del canal, así que siempre son iguales.
const FOLLOW = 'sigue-al-canal';

/** Huella corta del texto, para comparar sin guardar dos veces lo mismo. */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}.${text.length.toString(36)}`;
}

export function fingerprint(field: FaceField, value: FaceValues[FaceField]): string {
  if (field === 'photos' && value === null) return FOLLOW;
  const text = normalized(field, value);
  return text === '' ? EMPTY : hash(text);
}

export function fingerprintsOf(values: FaceValues): Record<FaceField, string> {
  return {
    title: fingerprint('title', values.title),
    description: fingerprint('description', values.description),
    attributes: fingerprint('attributes', values.attributes),
    photos: fingerprint('photos', values.photos),
  };
}

/** Lee las huellas guardadas, descartando lo que no se reconoce. */
export function parseFingerprints(raw: unknown): Fingerprints {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Fingerprints = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isFaceField(key) && typeof value === 'string') out[key] = value;
  }
  return out;
}

/**
 * same: igual en los dos lados.
 * draft: cambió en la app y falta subirlo: es parte del borrador.
 * incoming: cambió en el canal y la app no lo tocó: la próxima lectura lo toma.
 * choose: cambió en los dos lados, o ya era distinto la primera vez: hay que elegir.
 */
export type FieldState = 'same' | 'draft' | 'incoming' | 'choose';

export function fieldState(app: string, channel: string, agreed: string | undefined): FieldState {
  if (app === channel || app === FOLLOW) return 'same';
  if (agreed === undefined) {
    // La primera vez: si a un lado le falta, el otro lo trae.
    if (app === EMPTY) return 'incoming';
    if (channel === EMPTY) return 'draft';
    return 'choose';
  }
  if (app === agreed) return 'incoming';
  if (channel === agreed) return 'draft';
  return 'choose';
}

export type FieldPlan = {
  field: FaceField;
  state: FieldState;
  // La app toma el valor del canal.
  take: boolean;
  // La nueva huella acordada; sin cambio, la que estaba.
  agreed: string | undefined;
};

/**
 * Qué hacer con cada dato después de leer el canal. Lo que cambió solo en el
 * canal se toma; lo que cambió solo en la app queda como borrador; lo que
 * cambió en los dos lados no se toca y queda para elegir.
 */
export function planFaces(app: Record<FaceField, string>, channel: Record<FaceField, string>, agreed: Fingerprints): FieldPlan[] {
  return FACE_FIELDS.map((field) => {
    const state = fieldState(app[field], channel[field], agreed[field]);
    if (state === 'same' || state === 'incoming') return { field, state, take: state === 'incoming', agreed: channel[field] };
    if (state === 'draft') return { field, state, take: false, agreed: agreed[field] ?? channel[field] };
    return { field, state, take: false, agreed: agreed[field] };
  });
}

export type Rejection = { message: string; at: string; fingerprint: string };

/** Lo que el canal no aceptó al subir, por dato. */
export function parseRejections(raw: unknown): Partial<Record<FaceField, Rejection>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Partial<Record<FaceField, Rejection>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isFaceField(key) || !value || typeof value !== 'object') continue;
    const r = value as Record<string, unknown>;
    if (typeof r.message === 'string' && typeof r.at === 'string' && typeof r.fingerprint === 'string') {
      out[key] = { message: r.message, at: r.at, fingerprint: r.fingerprint };
    }
  }
  return out;
}

export type FaceSummary = {
  draft: FaceField[];
  choose: FaceField[];
  // Los del borrador que el canal no aceptó, mientras la app siga con el mismo valor.
  rejected: { field: FaceField; message: string; at: string }[];
};

/** En qué está la publicación: los datos del borrador y los que hay que elegir. */
export function faceSummary(
  app: Record<FaceField, string>,
  copy: { fingerprints: unknown; agreed: unknown; rejections?: unknown } | null,
): FaceSummary {
  const summary: FaceSummary = { draft: [], choose: [], rejected: [] };
  if (!copy) return summary;
  const channel = parseFingerprints(copy.fingerprints);
  const agreed = parseFingerprints(copy.agreed);
  const rejections = parseRejections(copy.rejections);
  for (const field of FACE_FIELDS) {
    const state = fieldState(app[field], channel[field] ?? EMPTY, agreed[field]);
    if (state === 'draft') {
      summary.draft.push(field);
      const r = rejections[field];
      if (r && r.fingerprint === app[field]) summary.rejected.push({ field, message: r.message, at: r.at });
    } else if (state === 'choose') summary.choose.push(field);
  }
  return summary;
}

// ───────────────────────────── Datos de catálogo ─────────────────────────────

const attributeKey = (name: string) => oneSpace(name).toLowerCase();

export type AttributeDiff = {
  // Están en los dos lados con otro valor.
  changed: { name: string; from: string; to: string }[];
  // Están en la app y no en el canal.
  added: NameValue[];
  // Están en el canal y no en la app.
  removed: NameValue[];
};

/** Qué datos de catálogo de la app son distintos de los del canal. */
export function attributeDiff(app: NameValue[], channel: NameValue[]): AttributeDiff {
  const theirs = new Map(channel.map((a) => [attributeKey(a.name), a]));
  const ours = new Set(app.map((a) => attributeKey(a.name)));
  const diff: AttributeDiff = { changed: [], added: [], removed: [] };
  for (const a of app) {
    if (!a.value.trim()) continue;
    const other = theirs.get(attributeKey(a.name));
    if (!other) diff.added.push(a);
    else if (oneSpace(other.value) !== oneSpace(a.value)) diff.changed.push({ name: a.name, from: other.value, to: a.value });
  }
  for (const a of channel) if (!ours.has(attributeKey(a.name))) diff.removed.push(a);
  return diff;
}

/** Los datos del canal con los que se subieron: reemplazan al de su mismo nombre o se suman al final. */
export function mergeAttributes(channel: NameValue[], sent: NameValue[]): NameValue[] {
  const out = channel.map((a) => ({ ...a }));
  for (const s of sent) {
    const at = out.findIndex((a) => attributeKey(a.name) === attributeKey(s.name));
    if (at >= 0) out[at] = { name: s.name, value: s.value };
    else out.push({ name: s.name, value: s.value });
  }
  return out;
}
