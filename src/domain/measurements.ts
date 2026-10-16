// Métricas que puede tener una medición. La lista es abierta: sumar una
// métrica nueva es agregar una línea acá, sin tocar la base.
//
// Hay dos tipos: rendimiento (visitas, ventas) y relevamiento del contenido
// que hoy tiene la publicación en el canal (cuántas fotos, si tiene video).
// Las segundas sirven mientras no tengamos el contenido real de cada
// publicación cargado en la app.

export type MetricKind = 'number' | 'percent' | 'boolean' | 'text';

export const METRICS = {
  visits_90d: { label: 'Visitas (90 días)', kind: 'number' },
  purchase_intent_90d: { label: 'Intención de compra (90 días)', kind: 'number' },
  sales_90d: { label: 'Ventas (90 días)', kind: 'number' },
  conversion_90d: { label: 'Conversión (90 días)', kind: 'percent' },
  sold_visible: { label: 'Vendidos visibles', kind: 'number' },
  reviews: { label: 'Opiniones', kind: 'number' },
  channel_quality: { label: 'Calidad según el canal', kind: 'number' },
  channel_goals: { label: 'Objetivos que pide el canal', kind: 'text' },
  photo_count: { label: 'Fotos', kind: 'number' },
  has_video: { label: 'Video o clip', kind: 'boolean' },
  attribute_count: { label: 'Atributos de la ficha', kind: 'number' },
  own_description_chars: { label: 'Caracteres propios en la descripción', kind: 'number' },
  compatibility_loaded: { label: 'Compatibilidad cargada', kind: 'boolean' },
} as const satisfies Record<string, { label: string; kind: MetricKind }>;

export type MetricKey = keyof typeof METRICS;
export type MetricValue = number | string | boolean;
export type Metrics = Partial<Record<MetricKey, MetricValue>>;

export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

export function isMetricKey(key: string): key is MetricKey {
  return key in METRICS;
}

/** Lee las métricas guardadas como JSON, descartando lo que no se reconoce. */
export function parseMetrics(raw: unknown): Metrics {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Metrics = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isMetricKey(key)) continue;
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return out;
}

/** Muestra un valor como lo lee una persona: "136", "0,7 %", "Sí". */
export function formatMetric(key: MetricKey, value: MetricValue): string {
  const kind = METRICS[key].kind;
  if (kind === 'boolean') return value === true ? 'Sí' : value === false ? 'No' : String(value);
  if (kind === 'percent' && typeof value === 'number') {
    return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(value * 100)} %`;
  }
  if (typeof value === 'number') return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
  return String(value);
}
