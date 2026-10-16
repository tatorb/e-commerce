import { METRICS, METRIC_KEYS, type MetricKey } from '@/domain/measurements';

// Campos de la app a los que puede ir una columna de un archivo. Este módulo
// y el resto de src/importers son los únicos que saben de archivos.

export type FieldGroup = 'Producto' | 'Compatibilidad' | 'Publicación' | 'Fotos y video' | 'Medición';

export type FieldKey =
  | 'product.name'
  | 'product.brand'
  | 'product.partNumber'
  | 'product.productType'
  | 'product.engineSystem'
  | 'product.line'
  | 'product.origin'
  | 'product.warranty'
  | 'product.kitContents'
  | 'product.notes'
  | 'product.skus'
  | 'product.measures'
  | 'product.specs'
  | 'compat.vehicleBrand'
  | 'compat.model'
  | 'compat.engine'
  | 'compat.list'
  | 'pub.externalId'
  | 'pub.url'
  | 'pub.title'
  | 'pub.description'
  | 'pub.price'
  | 'pub.channelStatus'
  | 'asset.photos'
  | 'asset.videos'
  | `metric.${MetricKey}`;

export type FieldDef = {
  key: FieldKey;
  label: string;
  group: FieldGroup;
  // Encabezados que se reconocen solos, ya normalizados (ver normalizeHeader).
  synonyms: string[];
};

const METRIC_SYNONYMS: Record<MetricKey, string[]> = {
  visits_90d: ['visitas 90 dias', 'visitas'],
  purchase_intent_90d: ['intencion de compra 90 dias', 'intencion de compra'],
  sales_90d: ['ventas 90 dias', 'ventas'],
  conversion_90d: ['conversion 90 dias', 'conversion'],
  sold_visible: ['vendidos'],
  reviews: ['opiniones'],
  channel_quality: ['calidad segun ml', 'calidad segun el canal', 'calidad'],
  channel_goals: ['objetivos que pide ml', 'objetivos que pide el canal', 'objetivos'],
  photo_count: ['fotos', 'cantidad de fotos'],
  has_video: ['clip', 'video'],
  attribute_count: ['atributos de ficha', 'atributos'],
  own_description_chars: ['caracteres propios en descripcion', 'caracteres propios en la descripcion'],
  compatibility_loaded: ['compatibilidad cargada'],
};

export const FIELDS: FieldDef[] = [
  { key: 'product.name', label: 'Nombre del producto', group: 'Producto', synonyms: ['nombre', 'nombre del producto', 'producto'] },
  { key: 'product.brand', label: 'Marca del repuesto', group: 'Producto', synonyms: ['marca del repuesto', 'marca', 'fabricante'] },
  {
    key: 'product.partNumber',
    label: 'Número de pieza u OEM',
    group: 'Producto',
    synonyms: ['n de pieza', 'no de pieza', 'nro de pieza', 'numero de pieza', 'numero de pieza u oem', 'oem', 'codigo oem'],
  },
  { key: 'product.productType', label: 'Tipo de producto', group: 'Producto', synonyms: ['tipo de producto', 'tipo'] },
  { key: 'product.engineSystem', label: 'Sistema del motor', group: 'Producto', synonyms: ['sistema del motor', 'sistema'] },
  { key: 'product.line', label: 'Línea', group: 'Producto', synonyms: ['linea'] },
  { key: 'product.origin', label: 'Origen', group: 'Producto', synonyms: ['origen', 'pais de origen'] },
  { key: 'product.warranty', label: 'Garantía', group: 'Producto', synonyms: ['garantia'] },
  { key: 'product.kitContents', label: 'Contenido del kit', group: 'Producto', synonyms: ['contenido del kit'] },
  { key: 'product.notes', label: 'Notas', group: 'Producto', synonyms: ['notas', 'observaciones'] },
  { key: 'product.skus', label: 'SKU (uno o varios, separados por /)', group: 'Producto', synonyms: ['sku', 'skus'] },
  {
    key: 'product.measures',
    label: 'Medidas por SKU (SKU: medida, una por línea)',
    group: 'Producto',
    synonyms: ['medidas por sku', 'medidas', 'medida'],
  },
  {
    key: 'product.specs',
    label: 'Ficha técnica (Nombre: valor, uno por línea)',
    group: 'Producto',
    synonyms: ['ficha tecnica', 'caracteristicas', 'datos tecnicos'],
  },
  { key: 'compat.vehicleBrand', label: 'Marca del vehículo', group: 'Compatibilidad', synonyms: ['marca del vehiculo', 'marca vehiculo'] },
  { key: 'compat.model', label: 'Modelo', group: 'Compatibilidad', synonyms: ['modelo', 'modelos'] },
  { key: 'compat.engine', label: 'Motor', group: 'Compatibilidad', synonyms: ['motor'] },
  {
    key: 'compat.list',
    label: 'Compatibilidades (Marca | Modelo | Motor | Años, una por línea)',
    group: 'Compatibilidad',
    synonyms: ['compatibilidades', 'compatibilidad', 'vehiculos compatibles'],
  },
  {
    key: 'pub.externalId',
    label: 'ID de la publicación',
    group: 'Publicación',
    synonyms: ['id publicacion', 'id de la publicacion', 'id', 'item id'],
  },
  { key: 'pub.url', label: 'Link', group: 'Publicación', synonyms: ['link', 'url', 'enlace', 'link de la publicacion'] },
  { key: 'pub.title', label: 'Título', group: 'Publicación', synonyms: ['titulo'] },
  { key: 'pub.description', label: 'Descripción', group: 'Publicación', synonyms: ['descripcion'] },
  { key: 'pub.price', label: 'Precio', group: 'Publicación', synonyms: ['precio', 'precio de venta'] },
  {
    key: 'pub.channelStatus',
    label: 'Estado en el canal',
    group: 'Publicación',
    synonyms: ['estado', 'estado en el canal', 'estado de la publicacion'],
  },
  {
    key: 'asset.photos',
    label: 'Links de fotos (uno por línea)',
    group: 'Fotos y video',
    synonyms: ['links de fotos', 'link de fotos', 'fotos links', 'urls de fotos'],
  },
  {
    key: 'asset.videos',
    label: 'Link del video',
    group: 'Fotos y video',
    synonyms: ['link del video', 'links de video', 'link de video', 'url del video'],
  },
  ...METRIC_KEYS.map(
    (m): FieldDef => ({
      key: `metric.${m}`,
      label: METRICS[m].label,
      group: 'Medición',
      synonyms: METRIC_SYNONYMS[m],
    }),
  ),
];

export const FIELD_BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

export function isFieldKey(key: string): key is FieldKey {
  return FIELD_BY_KEY.has(key as FieldKey);
}

export const FIELD_GROUPS: FieldGroup[] = ['Producto', 'Compatibilidad', 'Publicación', 'Fotos y video', 'Medición'];

/**
 * Pasa un encabezado a una forma comparable: minúsculas, sin acentos, sin
 * signos ni "($)". "Nº de pieza" queda "n de pieza".
 */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Columnas con datos internos del cliente: costos, listas de proveedores,
// facturación, stock propio. No tienen campo de destino y se traban en "No
// importar": sus valores no se muestran ni salen del navegador.
const CONFIDENTIAL_PATTERNS = [
  'proveedor',
  'lista',
  'costo',
  'cargo por venta',
  'comision',
  'recibis',
  'facturacion',
  'deposito',
  'margen',
];

export function isConfidentialHeader(header: string): boolean {
  const n = normalizeHeader(header);
  return CONFIDENTIAL_PATTERNS.some((p) => n.includes(p));
}
