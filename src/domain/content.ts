import type { Prisma } from '@/generated/prisma/client';
import { parseNameValueList, type NameValue } from './name-value';

// Contenido de una publicación y de su ficha maestra, campo por campo. Lo usan
// las importaciones, y más adelante la lectura por API, para completar o
// reemplazar lo que ya está en la app. No sabe de archivos ni de canales.
// Solo importa tipos de Prisma: sus etiquetas se usan también en el navegador.

export const CONTENT_FIELDS = [
  'title',
  'description',
  'brand',
  'partNumber',
  'productType',
  'engineSystem',
  'line',
  'origin',
  'warranty',
  'kitContents',
  'notes',
  'measures',
  'specs',
  'compatibilities',
  'photos',
  'videos',
] as const;

export type ContentField = (typeof CONTENT_FIELDS)[number];

export const CONTENT_FIELD_LABEL: Record<ContentField, string> = {
  title: 'Título',
  description: 'Descripción',
  brand: 'Marca del repuesto',
  partNumber: 'Número de pieza',
  productType: 'Tipo de producto',
  engineSystem: 'Sistema del motor',
  line: 'Línea',
  origin: 'Origen',
  warranty: 'Garantía',
  kitContents: 'Contenido del kit',
  notes: 'Notas',
  measures: 'Medidas',
  specs: 'Ficha técnica',
  compatibilities: 'Compatibilidades',
  photos: 'Fotos',
  videos: 'Video',
};

// Qué tipo de dato es cada campo: define cómo se edita y cómo se valida.
export type ContentFieldKind = 'short' | 'long' | 'specs' | 'compatibilities' | 'measures' | 'links';

export const CONTENT_FIELD_KIND: Record<ContentField, ContentFieldKind> = {
  title: 'short',
  description: 'long',
  brand: 'short',
  partNumber: 'short',
  productType: 'short',
  engineSystem: 'short',
  line: 'short',
  origin: 'short',
  warranty: 'short',
  kitContents: 'long',
  notes: 'long',
  measures: 'measures',
  specs: 'specs',
  compatibilities: 'compatibilities',
  photos: 'links',
  videos: 'links',
};

export function isContentField(value: string): value is ContentField {
  return (CONTENT_FIELDS as readonly string[]).includes(value);
}

const PUBLICATION_TEXT = ['title', 'description'] as const;
const PRODUCT_TEXT = [
  'brand',
  'partNumber',
  'productType',
  'engineSystem',
  'line',
  'origin',
  'warranty',
  'kitContents',
  'notes',
] as const;

type PublicationTextField = (typeof PUBLICATION_TEXT)[number];
type ProductTextField = (typeof PRODUCT_TEXT)[number];
type TextField = PublicationTextField | ProductTextField;

/** Título y descripción viven en la publicación; lo demás, en la ficha. */
export function isPublicationField(field: ContentField): field is PublicationTextField {
  return (PUBLICATION_TEXT as readonly string[]).includes(field);
}

export type Compat = {
  vehicleBrand: string | null;
  model: string | null;
  engine: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  note: string | null;
};

export type VariantMeasure = { id: string; sku: string | null; measure: string | null };

export type ContentSnapshot = Record<TextField, string | null> & {
  measures: VariantMeasure[];
  specs: NameValue[];
  compatibilities: Compat[];
  photos: string[];
  videos: string[];
};

// Lo que trae una fila o una lectura. Solo los campos con dato: lo que no
// viene no se toca.
export type MeasureLine = { sku: string | null; measure: string };
export type IncomingContent = Partial<Record<TextField, string>> & {
  measures?: MeasureLine[];
  specs?: NameValue[];
  compatibilities?: Compat[];
  photos?: string[];
  videos?: string[];
};

export type UpdateMode = 'FILL_EMPTY' | 'REPLACE';

export type FieldChange = {
  field: ContentField;
  // Completar: la app no tenía nada. Reemplazar: tenía otra cosa.
  kind: 'fill' | 'replace';
  before: unknown;
  after: unknown;
};

/** Texto comparable: sin espacios en las puntas, saltos de línea iguales, vacío como null. */
export function cleanText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const v = value.replace(/\r\n?/g, '\n').trim();
  return v === '' ? null : v;
}

// Con las claves ordenadas: la base devuelve los objetos guardados con otro
// orden de claves, y eso no tiene que contar como diferencia.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value ?? null;
}

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/**
 * Compara lo que llega con lo que hay y devuelve qué cambia. Una lista que
 * llega reemplaza la lista entera; en "solo completar" se carga únicamente
 * si la app no tenía ninguna. Las medidas van una por una, por SKU.
 */
export function planContentUpdate(
  current: ContentSnapshot,
  incoming: IncomingContent,
  mode: UpdateMode,
  opts: { publication: boolean },
): { changes: FieldChange[]; warnings: string[] } {
  const changes: FieldChange[] = [];
  const warnings: string[] = [];

  const consider = (field: ContentField, before: unknown, after: unknown, empty: boolean) => {
    if (sameValue(before, after)) return;
    if (empty) changes.push({ field, kind: 'fill', before, after });
    else if (mode === 'REPLACE') changes.push({ field, kind: 'replace', before, after });
  };

  for (const field of [...PUBLICATION_TEXT, ...PRODUCT_TEXT]) {
    if (!opts.publication && isPublicationField(field)) continue;
    const after = cleanText(incoming[field]);
    if (after === null) continue;
    consider(field, current[field], after, current[field] === null);
  }

  if (incoming.measures && incoming.measures.length > 0) {
    const after = current.measures.map((v) => ({ ...v }));
    let filled = false;
    let replaced = false;
    for (const line of incoming.measures) {
      const measure = cleanText(line.measure);
      if (measure === null) continue;
      const target = line.sku
        ? after.find((v) => v.sku !== null && v.sku.toUpperCase() === line.sku!.toUpperCase())
        : after.length === 1
          ? after[0]
          : undefined;
      if (!target) {
        warnings.push(
          line.sku
            ? `El SKU ${line.sku} no está en el producto: esa medida no se carga.`
            : `«${measure}» no dice a qué SKU corresponde: esa medida no se carga.`,
        );
        continue;
      }
      if (target.measure === measure) continue;
      if (target.measure === null) {
        target.measure = measure;
        filled = true;
      } else if (mode === 'REPLACE') {
        target.measure = measure;
        replaced = true;
      }
    }
    if (filled || replaced) {
      changes.push({ field: 'measures', kind: replaced ? 'replace' : 'fill', before: current.measures, after });
    }
  }

  const lists = ['specs', 'compatibilities', 'photos', 'videos'] as const;
  for (const field of lists) {
    const after = incoming[field];
    if (!after || after.length === 0) continue;
    consider(field, current[field], after, current[field].length === 0);
  }

  return { changes, warnings };
}

/** El valor de un campo en una foto del contenido. */
export function readContentField(snapshot: ContentSnapshot, field: ContentField): unknown {
  return snapshot[field];
}

// ───────────────────────────── Lectura y escritura ─────────────────────────────

type Tx = Prisma.TransactionClient;

export const PRODUCT_CONTENT_SELECT = {
  brand: true,
  partNumber: true,
  productType: true,
  engineSystem: true,
  line: true,
  origin: true,
  warranty: true,
  kitContents: true,
  notes: true,
  specs: true,
  variants: { orderBy: { position: 'asc' }, select: { id: true, sku: true, measure: true } },
  compatibilities: {
    orderBy: { position: 'asc' },
    select: { vehicleBrand: true, model: true, engine: true, yearFrom: true, yearTo: true, note: true },
  },
  assets: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { kind: true, url: true } },
} satisfies Prisma.ProductSelect;

type ProductContentRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_CONTENT_SELECT }>;

/** Arma la foto del contenido con lo que viene de la base. */
export function toContentSnapshot(
  product: ProductContentRow,
  publication: { title: string | null; description: string | null } | null,
): ContentSnapshot {
  return {
    title: cleanText(publication?.title),
    description: cleanText(publication?.description),
    brand: cleanText(product.brand),
    partNumber: cleanText(product.partNumber),
    productType: cleanText(product.productType),
    engineSystem: cleanText(product.engineSystem),
    line: cleanText(product.line),
    origin: cleanText(product.origin),
    warranty: cleanText(product.warranty),
    kitContents: cleanText(product.kitContents),
    notes: cleanText(product.notes),
    measures: product.variants.map((v) => ({ id: v.id, sku: cleanText(v.sku), measure: cleanText(v.measure) })),
    specs: parseNameValueList(product.specs),
    compatibilities: product.compatibilities.map((c) => ({
      vehicleBrand: cleanText(c.vehicleBrand),
      model: cleanText(c.model),
      engine: cleanText(c.engine),
      yearFrom: c.yearFrom,
      yearTo: c.yearTo,
      note: cleanText(c.note),
    })),
    photos: product.assets.filter((a) => a.kind === 'PHOTO').map((a) => a.url),
    videos: product.assets.filter((a) => a.kind === 'VIDEO').map((a) => a.url),
  };
}

export async function loadContent(tx: Tx, productId: string, publicationId: string | null): Promise<ContentSnapshot> {
  const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: PRODUCT_CONTENT_SELECT });
  const publication = publicationId
    ? await tx.publication.findUnique({ where: { id: publicationId }, select: { title: true, description: true } })
    : null;
  return toContentSnapshot(product, publication);
}

// Los videos van después de las fotos: una ficha tiene como mucho 100 activos.
const VIDEO_POSITION = 100;

/** Escribe un campo. El valor tiene la forma que devuelve planContentUpdate. */
export async function writeContentField(
  tx: Tx,
  target: { productId: string; publicationId: string | null },
  field: ContentField,
  value: unknown,
): Promise<void> {
  const { productId, publicationId } = target;
  if (isPublicationField(field)) {
    if (!publicationId) throw new Error(`Falta la publicación para cambiar ${field}.`);
    await tx.publication.update({ where: { id: publicationId }, data: { [field]: value as string | null } });
    return;
  }
  switch (field) {
    case 'specs':
      await tx.product.update({ where: { id: productId }, data: { specs: value as NameValue[] } });
      return;
    case 'compatibilities': {
      const list = value as Compat[];
      await tx.compatibility.deleteMany({ where: { productId } });
      if (list.length > 0) {
        await tx.compatibility.createMany({ data: list.map((c, position) => ({ ...c, productId, position })) });
      }
      return;
    }
    case 'photos':
    case 'videos': {
      const kind = field === 'photos' ? 'PHOTO' : 'VIDEO';
      const offset = field === 'photos' ? 0 : VIDEO_POSITION;
      const urls = value as string[];
      await tx.asset.deleteMany({ where: { productId, kind } });
      if (urls.length > 0) {
        await tx.asset.createMany({ data: urls.map((url, i) => ({ productId, kind, url, position: offset + i })) });
      }
      return;
    }
    case 'measures':
      for (const v of value as VariantMeasure[]) {
        await tx.productVariant.updateMany({ where: { id: v.id, productId }, data: { measure: v.measure } });
      }
      return;
    default:
      await tx.product.update({ where: { id: productId }, data: { [field]: value as string | null } });
  }
}
