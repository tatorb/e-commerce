import { cleanText } from './content';
import { channelPhotos, orderedMeasures, parseMedia, photoKey, photoVariants, variantPhotos, type PhotoRef } from './media';
import { formatPercent, formatPrice } from './money';
import { parseNameValueList, type NameValue } from './name-value';
import { planLabel } from './pricing';

// Las caras de una publicación: lo que tiene la app y lo que está en el canal.
// Para saber de qué lado cambió cada dato se guarda, además, la huella de lo
// último en que las dos coincidieron. Este módulo no sabe nada de canales.

export const FACE_FIELDS = ['title', 'description', 'attributes', 'photos', 'price', 'installments', 'discount'] as const;
export type FaceField = (typeof FACE_FIELDS)[number];

export const FACE_FIELD_LABEL: Record<FaceField, string> = {
  title: 'Título',
  description: 'Descripción',
  attributes: 'Datos de catálogo',
  photos: 'Fotos',
  price: 'Precio',
  installments: 'Cuotas',
  discount: 'Descuento',
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
  STATUS_CHANGED: 'se cambió el estado',
  STATUS_FAILED: 'no se pudo cambiar el estado',
  RELISTED: 'se republicó',
  RENEWED: 'se renovó el descuento',
} as const;

export function isFaceField(value: string): value is FaceField {
  return (FACE_FIELDS as readonly string[]).includes(value);
}

// photos null: la app no eligió fotos, sigue a las del canal. price: el
// precio publicado, como texto con punto decimal, por ejemplo "125000.5".
// installments: el plan de cuotas, por ejemplo "6". discount: el descuento en
// %, por ejemplo "27.3", o "0" sin descuento. Null mientras no se sabe.
export type FaceValues = {
  title: string | null;
  description: string | null;
  attributes: NameValue[];
  photos: PhotoRef[] | null;
  price: string | null;
  installments: string | null;
  discount: string | null;
};
export type Fingerprints = Partial<Record<FaceField, string>>;

type Numeric = number | string | { toString(): string };

/** El precio como lo compara la cara: sin ceros de más; null si no hay o no es un precio. */
export function priceText(value: Numeric | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const n = Number(value.toString());
  return Number.isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100) : null;
}

/** Las cuotas como las compara la cara. */
export function installmentsText(value: number | null | undefined): string | null {
  return value === null || value === undefined || !Number.isInteger(value) || value < 0 ? null : String(value);
}

/** El descuento como lo compara la cara, con un decimal: "0" sin descuento. */
export function discountText(value: Numeric | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const n = Number(value.toString());
  return Number.isFinite(n) && n >= 0 && n < 100 ? String(Math.round(n * 10) / 10) : null;
}

/** El precio, las cuotas o el descuento en palabras, para mostrar. */
export function priceFaceText(field: 'price' | 'installments' | 'discount', value: string | number | null): string {
  if (value === null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (field === 'price') return formatPrice(n);
  if (field === 'installments') return planLabel(n);
  return n === 0 ? 'Sin descuento' : formatPercent(n);
}

type PriceValues = { price: Numeric | null; installments: number | null; discount: Numeric | null };

const priceFaces = (v: PriceValues) => ({ price: priceText(v.price), installments: installmentsText(v.installments), discount: discountText(v.discount) });

/** Los datos de la cara de la app, como los guarda la publicación. */
export function faceValues(p: { title: string | null; description: string | null; attributes: unknown; media?: unknown } & PriceValues): FaceValues {
  return {
    title: p.title,
    description: p.description,
    attributes: parseNameValueList(p.attributes),
    photos: parseMedia(p.media),
    ...priceFaces(p),
  };
}

/** Los datos de la cara del canal, como los guarda la copia de lo que se leyó. */
export function channelFaceValues(
  c: {
    title: string | null;
    description: string | null;
    attributes: unknown;
    photos: unknown;
    photoIds: unknown;
    variations: unknown;
  } & PriceValues,
): FaceValues {
  return {
    title: c.title,
    description: c.description,
    attributes: parseNameValueList(c.attributes),
    photos: channelPhotos(c.photos, c.photoIds, c.variations),
    ...priceFaces(c),
  };
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
  if (field === 'price' || field === 'installments' || field === 'discount') return (value as string | null) ?? '';
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
    price: fingerprint('price', values.price),
    installments: fingerprint('installments', values.installments),
    discount: fingerprint('discount', values.discount),
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
 * Las huellas guardadas de la copia del canal y lo acordado. El precio, las
 * cuotas y el descuento se sumaron después: una copia leída antes no tiene su
 * huella, así que se calcula de lo leído y se da por acordado, porque hasta
 * entonces la app tomaba siempre el precio del canal.
 */
export function storedPrints(copy: { fingerprints: unknown; agreed: unknown } & PriceValues): { channel: Fingerprints; agreed: Fingerprints } {
  const channel = parseFingerprints(copy.fingerprints);
  const agreed = parseFingerprints(copy.agreed);
  const read = priceFaces(copy);
  for (const field of ['price', 'installments', 'discount'] as const) {
    if (channel[field] !== undefined) continue;
    channel[field] = fingerprint(field, read[field]);
    agreed[field] ??= channel[field];
  }
  return { channel, agreed };
}

// Cómo empieza el motivo de una renovación sola que el canal no aceptó.
export const RENEWAL_FAILED = 'Al renovarlo solo: ';

// Un rato después de subir el descuento, el canal puede no mostrarlo todavía.
export const DISCOUNT_GRACE_MS = 60 * 60 * 1000;

/**
 * El descuento que subió la app y el canal no muestra. pending: lo subió hace
 * poco y todavía no se ve. expired: venció, y queda para volver a subir. En
 * los dos casos la app no lo pierde. Null: vale lo de siempre.
 */
export function heldDiscount(
  app: string | null,
  channel: string | null,
  copy: { discountUntil: Date | null; discountSentAt: Date | null } | null,
  now: Date,
): 'pending' | 'expired' | null {
  if (!copy?.discountUntil || !(Number(app) > 0) || channel !== '0') return null;
  if (now.getTime() >= copy.discountUntil.getTime()) return 'expired';
  return copy.discountSentAt && now.getTime() - copy.discountSentAt.getTime() < DISCOUNT_GRACE_MS ? 'pending' : null;
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
  copy: ({ fingerprints: unknown; agreed: unknown; rejections?: unknown } & PriceValues) | null,
): FaceSummary {
  const summary: FaceSummary = { draft: [], choose: [], rejected: [] };
  if (!copy) return summary;
  const { channel, agreed } = storedPrints(copy);
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
