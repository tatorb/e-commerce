import type { ChannelAdapter } from '@/channels/types';
import type { ChannelStatus } from '@/generated/prisma/enums';
import { parsePrice } from '@/domain/money';
import { METRICS, type MetricKey, type Metrics } from '@/domain/measurements';
import { productInputSchema, type ProductData } from '@/domain/products';
import type { IncomingContent } from '@/domain/content';
import { parseCompatibilities, parseLinks, parseMeasures, parseSpecs } from './cells';
import { normalizeHeader, type FieldKey } from './fields';
import type { RowInput } from './mapping';
import type { Cell } from './spreadsheet';

// Traduce una fila del archivo (ya reducida a campos) a lo que se guarda:
// producto, publicación y medición. Corre igual en el navegador, para la
// revisión, y en el servidor, al importar.

export type ImportRecord = {
  rowNumber: number;
  product: ProductData | null;
  skus: string[];
  publication: {
    externalId: string | null;
    url: string | null;
    title: string | null;
    description: string | null;
    price: number | null;
    channelStatus: ChannelStatus;
  };
  metrics: Metrics;
  // Lo que la fila trae con dato, para completar lo que ya está en la app.
  content: IncomingContent;
  warnings: string[];
  error: string | null;
};

function text(v: Cell | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  return v.replace(/\r\n?/g, '\n').trim();
}

function number(v: Cell | undefined): number | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 'invalid';
  if (typeof v === 'boolean') return 'invalid';
  const s = v.trim().replace(/\s/g, '');
  if (s === '') return null;
  const direct = Number(s);
  if (Number.isFinite(direct)) return direct;
  const ar = parsePrice(s);
  return ar === null ? null : ar;
}

function bool(v: Cell | undefined): boolean | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const n = normalizeHeader(v);
  if (['si', 's', 'yes', 'true', 'x', '1', 'tiene'].includes(n)) return true;
  if (['no', 'n', 'false', '0', 'no tiene'].includes(n)) return false;
  return 'invalid';
}

const STATUS_WORDS: Record<string, ChannelStatus> = {
  activa: 'ACTIVE',
  activo: 'ACTIVE',
  active: 'ACTIVE',
  publicada: 'ACTIVE',
  pausada: 'PAUSED',
  pausado: 'PAUSED',
  paused: 'PAUSED',
  inactiva: 'INACTIVE',
  inactivo: 'INACTIVE',
  inactive: 'INACTIVE',
  finalizada: 'INACTIVE',
  cerrada: 'INACTIVE',
  closed: 'INACTIVE',
  'sin publicar': 'UNPUBLISHED',
  'no publicada': 'UNPUBLISHED',
  borrador: 'UNPUBLISHED',
};

const NO_WARRANTY = new Set(['no informa', 'no', 'sin garantia', 'n a', 'na', 'ninguna']);

/** Separa "A / B" o "A; B" en varios SKU, sin repetidos. */
export function splitSkus(raw: string): string[] {
  const parts = raw
    .split(/\s+\/\s+|[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function toRecord(row: RowInput, adapter: ChannelAdapter): ImportRecord {
  const v = row.values;
  const get = (k: FieldKey) => v[k];
  const warnings: string[] = [];

  const title = text(get('pub.title')) || null;
  const name = text(get('product.name')) || title;

  // Estado en el canal.
  const rawStatus = text(get('pub.channelStatus'));
  let channelStatus: ChannelStatus | null = null;
  if (rawStatus) {
    channelStatus = STATUS_WORDS[normalizeHeader(rawStatus)] ?? null;
    if (!channelStatus) warnings.push(`No se entiende el estado «${rawStatus}», se tomó como Activa.`);
  }

  // ID externo, pasado por las reglas del canal.
  const rawId = text(get('pub.externalId'));
  let externalId: string | null = null;
  if (rawId) {
    const normalized = adapter.normalizeExternalId(rawId);
    if (normalized.ok) externalId = normalized.value;
    else if (channelStatus !== 'UNPUBLISHED') {
      warnings.push(`«${rawId}» no es un ID de ${adapter.name}: la publicación se crea sin ID.`);
    }
  }
  channelStatus ??= externalId ? 'ACTIVE' : 'UNPUBLISHED';

  // Link: el del archivo si es un link de verdad, o el que se arma con el ID.
  const rawUrl = text(get('pub.url'));
  const url = rawUrl && isHttpUrl(rawUrl) ? rawUrl : externalId ? adapter.publicationUrl(externalId) : null;

  // Precio público.
  let price: number | null = null;
  const rawPrice = get('pub.price');
  if (typeof rawPrice === 'number') {
    price = rawPrice >= 0 ? rawPrice : null;
  } else if (rawPrice !== null && rawPrice !== undefined && text(rawPrice) !== '') {
    const parsed = parsePrice(text(rawPrice));
    if (parsed === 'invalid') warnings.push(`No se entiende el precio «${text(rawPrice)}», queda vacío.`);
    else price = parsed;
  }

  // Métricas de la medición.
  const metrics: Metrics = {};
  for (const key of Object.keys(METRICS) as MetricKey[]) {
    const raw = get(`metric.${key}`);
    if (raw === undefined || raw === null || raw === '') continue;
    const kind = METRICS[key].kind;
    if (kind === 'text') {
      metrics[key] = text(raw);
    } else if (kind === 'boolean') {
      const b = bool(raw);
      if (b === 'invalid') warnings.push(`«${text(raw)}» no es Sí o No en ${METRICS[key].label}.`);
      else if (b !== null) metrics[key] = b;
    } else {
      const isPercentText = typeof raw === 'string' && raw.includes('%');
      const n = number(typeof raw === 'string' ? raw.replace('%', '') : raw);
      if (n === 'invalid') warnings.push(`«${text(raw)}» no es un número en ${METRICS[key].label}.`);
      else if (n !== null) metrics[key] = kind === 'percent' && isPercentText ? n / 100 : n;
    }
  }

  const warrantyText = text(get('product.warranty'));
  const warranty = NO_WARRANTY.has(normalizeHeader(warrantyText)) ? '' : warrantyText;

  // Celdas con varios datos.
  const measures = parseMeasures(text(get('product.measures')));
  const specs = parseSpecs(text(get('product.specs')));
  const compatList = parseCompatibilities(text(get('compat.list')));
  const photos = parseLinks(text(get('asset.photos')));
  const videos = parseLinks(text(get('asset.videos')));
  for (const [label, parsed] of [
    ['Medidas', measures],
    ['Ficha técnica', specs],
    ['Compatibilidades', compatList],
    ['Fotos', photos],
    ['Video', videos],
  ] as const) {
    for (const w of parsed.warnings) warnings.push(`${label}: ${w}`);
  }

  // Los SKU de la columna SKU y los de las medidas.
  const skus = [
    ...new Set([...splitSkus(text(get('product.skus'))), ...measures.items.flatMap((m) => (m.sku ? [m.sku] : []))]),
  ];
  const measureFor = new Map<string, string>();
  for (const m of measures.items) {
    if (m.sku) measureFor.set(m.sku.toUpperCase(), m.measure);
    else if (skus.length <= 1) measureFor.set((skus[0] ?? '').toUpperCase(), m.measure);
    else warnings.push(`Medidas: «${m.measure}» no dice a qué SKU corresponde.`);
  }
  const variants = (skus.length > 0 ? skus : measureFor.has('') ? [''] : []).map((sku) => ({
    sku,
    measure: measureFor.get(sku.toUpperCase()) ?? '',
  }));

  const vehicleBrand = text(get('compat.vehicleBrand'));
  const model = text(get('compat.model'));
  const engine = text(get('compat.engine'));
  const compatibilities = [
    ...(vehicleBrand || model || engine
      ? [{ vehicleBrand, model, engine, yearFrom: null, yearTo: null, note: '' }]
      : []),
    ...compatList.items.map((c) => ({
      vehicleBrand: c.vehicleBrand ?? '',
      model: c.model ?? '',
      engine: c.engine ?? '',
      yearFrom: c.yearFrom,
      yearTo: c.yearTo,
      note: c.note ?? '',
    })),
  ];

  const publication = {
    externalId,
    url,
    title,
    description: text(get('pub.description')) || null,
    price,
    channelStatus,
  };

  if (!name) {
    return {
      rowNumber: row.rowNumber,
      product: null,
      skus,
      publication,
      metrics,
      content: {},
      warnings,
      error: 'Falta el título o el nombre del producto.',
    };
  }

  const parsed = productInputSchema.safeParse({
    name,
    brand: text(get('product.brand')),
    partNumber: text(get('product.partNumber')),
    productType: text(get('product.productType')),
    engineSystem: text(get('product.engineSystem')),
    line: text(get('product.line')),
    origin: text(get('product.origin')),
    warranty,
    kitContents: text(get('product.kitContents')),
    notes: text(get('product.notes')),
    specs: specs.items,
    variants,
    compatibilities,
    assets: [
      ...photos.items.map((url) => ({ kind: 'PHOTO' as const, url })),
      ...videos.items.map((url) => ({ kind: 'VIDEO' as const, url })),
    ],
  });

  return {
    rowNumber: row.rowNumber,
    product: parsed.success ? parsed.data : null,
    skus,
    publication,
    metrics,
    content: parsed.success ? toIncomingContent(parsed.data, publication, measures.items) : {},
    warnings,
    error: parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Datos inválidos.'),
  };
}

/** Lo que la fila trae con dato, ya validado, para completar una ficha existente. */
function toIncomingContent(
  product: ProductData,
  publication: ImportRecord['publication'],
  measures: IncomingContent['measures'],
): IncomingContent {
  const content: IncomingContent = {};
  const texts = {
    title: publication.title,
    description: publication.description,
    brand: product.brand,
    partNumber: product.partNumber,
    productType: product.productType,
    engineSystem: product.engineSystem,
    line: product.line,
    origin: product.origin,
    warranty: product.warranty,
    kitContents: product.kitContents,
    notes: product.notes,
  };
  for (const [field, value] of Object.entries(texts) as [keyof typeof texts, string | null][]) {
    if (value) content[field] = value;
  }
  if (measures && measures.length > 0) content.measures = measures;
  if (product.specs.length > 0) content.specs = product.specs;
  if (product.compatibilities.length > 0) content.compatibilities = product.compatibilities;
  const photos = product.assets.filter((a) => a.kind === 'PHOTO').map((a) => a.url);
  const videos = product.assets.filter((a) => a.kind === 'VIDEO').map((a) => a.url);
  if (photos.length > 0) content.photos = photos;
  if (videos.length > 0) content.videos = videos;
  return content;
}
