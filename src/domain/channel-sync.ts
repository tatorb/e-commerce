import { cleanText } from './content';
import { parseNameValueList, type NameValue } from './name-value';

// Las caras de una publicación: lo que tiene la app y lo que está en el canal.
// Para saber de qué lado cambió cada dato se guarda, además, la huella de lo
// último en que las dos coincidieron. Este módulo no sabe nada de canales.

export const FACE_FIELDS = ['title', 'description', 'attributes'] as const;
export type FaceField = (typeof FACE_FIELDS)[number];

export const FACE_FIELD_LABEL: Record<FaceField, string> = {
  title: 'Título',
  description: 'Descripción',
  attributes: 'Datos de catálogo',
};

// Cómo se cuenta cada cambio en el historial.
export const SYNC_CHANGE_LABEL = {
  TAKEN: 'llegó del canal',
  CHOSE_CHANNEL: 'se eligió lo del canal',
  CHOSE_APP: 'se eligió lo de la app',
  SENT: 'se subió al canal',
  DISCARDED: 'se descartó el cambio de la app',
} as const;

export function isFaceField(value: string): value is FaceField {
  return (FACE_FIELDS as readonly string[]).includes(value);
}

export type FaceValues = { title: string | null; description: string | null; attributes: NameValue[] };
export type Fingerprints = Partial<Record<FaceField, string>>;

/** Los datos de una cara, de la publicación o de la copia del canal, como se guardan. */
export function faceValues(p: { title: string | null; description: string | null; attributes: unknown }): FaceValues {
  return { title: p.title, description: p.description, attributes: parseNameValueList(p.attributes) };
}

const oneSpace = (s: string) => s.replace(/\s+/g, ' ').trim();

/** El dato como se compara: sin diferencias de espacios, saltos de línea ni orden de los datos de catálogo. */
function normalized(field: FaceField, value: FaceValues[FaceField]): string {
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
  const text = normalized(field, value);
  return text === '' ? EMPTY : hash(text);
}

export function fingerprintsOf(values: FaceValues): Record<FaceField, string> {
  return {
    title: fingerprint('title', values.title),
    description: fingerprint('description', values.description),
    attributes: fingerprint('attributes', values.attributes),
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
  if (app === channel) return 'same';
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
