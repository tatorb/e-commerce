import { CHANNEL_STATUS_LABEL } from '@/domain/channel-status';
import { PIPELINE_STATUSES } from '@/domain/pipeline';
import { scoreBand } from '@/domain/standard';
import type { TitleLock } from '@/domain/title-lock';
import type { ChannelStatus, PipelineStatus, ProductKind, Stage } from '@/generated/prisma/enums';

// Filtros y orden de Publicaciones (la lista de publicaciones). Los usan la
// pantalla y la descarga de la planilla de contenido, así bajás exactamente
// lo que ves. Sin la base de datos, para poder probarlos solos.

export type PublicationSearch = {
  q?: string;
  puntaje?: string;
  estado?: string;
  pipeline?: string;
  tipoProducto?: string;
  tipo?: string;
  visitas?: string;
  ventas?: string;
  bloqueado?: string;
  propuesta?: string;
  sincro?: string;
  stock?: string;
  orden?: string;
};

export const BANDS = [
  { value: '', label: 'Todas' },
  { value: 'bajo', label: 'Menos de 50' },
  { value: 'medio', label: '50 a 79' },
  { value: 'alto', label: '80 o más' },
] as const;
const BAND_KEY = { bajo: 'low', medio: 'mid', alto: 'high' } as const;

export const SORTS = [
  { value: 'puntaje', label: 'Menor puntaje primero' },
  { value: 'puntaje-desc', label: 'Mayor puntaje primero' },
  { value: 'visitas', label: 'Más visitas primero' },
  { value: 'ventas', label: 'Más ventas primero' },
  { value: 'cantidad', label: 'Menos cantidad primero' },
  { value: 'titulo', label: 'Título' },
];

export const CHANNEL_STATUSES = Object.keys(CHANNEL_STATUS_LABEL) as ChannelStatus[];

// Rangos de visitas en 90 días. "Sin dato" es que no hay medición.
export const VISIT_RANGES = [
  { value: '0', label: 'Sin visitas', min: 0, max: 0 },
  { value: '1-49', label: '1 a 49', min: 1, max: 49 },
  { value: '50-99', label: '50 a 99', min: 50, max: 99 },
  { value: '100', label: '100 o más', min: 100, max: Infinity },
  { value: 'sin-dato', label: 'Sin dato', min: null, max: null },
] as const;

// Individual o combo, como en la ficha.
export const KIND_OPTIONS = [
  { value: 'individual', label: 'Individuales', kind: 'INDIVIDUAL' },
  { value: 'combo', label: 'Combos', kind: 'COMBO' },
] as const satisfies readonly { value: string; label: string; kind: ProductKind }[];

/** Los tipos que pide la dirección, por ejemplo ?tipo=combo. */
export function parseKinds(raw: string | undefined): ProductKind[] {
  const wanted = (raw ?? '').split(',');
  return KIND_OPTIONS.filter((o) => wanted.includes(o.value)).map((o) => o.kind);
}

export const SALES_OPTIONS = [
  { value: 'con', label: 'Con ventas en 90 días' },
  { value: 'sin', label: 'Sin ventas en 90 días' },
  { value: 'sin-dato', label: 'Sin dato' },
] as const;

// La cantidad disponible en el canal. "Sin dato" es que todavía no se leyó.
export const STOCK_OPTIONS = [
  { value: 'sin', label: 'Sin stock' },
  { value: 'con', label: 'Con stock' },
  { value: 'sin-dato', label: 'Sin dato' },
] as const;

export const LOCK_OPTIONS = [
  { value: 'si', label: 'Título bloqueado' },
  { value: 'no', label: 'Título libre' },
  { value: 'sin-dato', label: 'Sin dato' },
] as const;

// Cómo está frente a lo que se leyó del canal.
export const SYNC_OPTIONS = [
  { value: 'al-dia', label: 'Al día' },
  { value: 'borrador', label: 'Con borrador' },
  { value: 'elegir', label: 'Para elegir' },
  { value: 'rechazada', label: 'Rechazada por el canal' },
  { value: 'sin-leer', label: 'Sin leer del canal' },
] as const;

export type SyncState = { read: boolean; draft: boolean; choose: boolean; rejected: boolean };

function syncOptions(s: SyncState): string[] {
  if (!s.read) return ['sin-leer'];
  const out: string[] = [];
  if (s.draft) out.push('borrador');
  if (s.choose) out.push('elegir');
  if (s.rejected) out.push('rechazada');
  return out.length > 0 ? out : ['al-dia'];
}

// Atajos del recorrido de la propuesta completa con IA.
export const PROPOSAL_SHORTCUTS = {
  revisar: { label: 'Propuestas para revisar', stages: ['PROPOSAL_GENERATED', 'IN_REVIEW'] as Stage[] },
  aplicar: { label: 'Propuestas para aplicar', stages: ['APPROVED'] as Stage[] },
};

// El tipo de producto es texto libre de la ficha y puede tener comas: en la
// dirección se escapan, porque los filtros se separan con comas.
export const encodeProductType = (type: string) => type.replace(/%/g, '%25').replace(/,/g, '%2C');
function decodeProductType(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export type CatalogFilters = {
  band: keyof typeof BAND_KEY | '';
  statuses: ChannelStatus[];
  pipeline: PipelineStatus[];
  productTypes: string[];
  kinds: ProductKind[];
  visits: string[];
  sales: string[];
  locked: string[];
  proposal: keyof typeof PROPOSAL_SHORTCUTS | '';
  sync: string[];
  stock: string[];
  sort: string;
  q: string;
};

function list(raw: string | undefined, allowed: readonly string[]): string[] {
  return (raw ?? '').split(',').filter((v) => allowed.includes(v));
}

export function parsePublicationSearch(search: PublicationSearch): CatalogFilters {
  return {
    band: search.puntaje && search.puntaje in BAND_KEY ? (search.puntaje as keyof typeof BAND_KEY) : '',
    statuses: list(search.estado, CHANNEL_STATUSES) as ChannelStatus[],
    pipeline: list(search.pipeline, PIPELINE_STATUSES) as PipelineStatus[],
    productTypes: (search.tipoProducto ?? '')
      .split(',')
      .filter(Boolean)
      .map(decodeProductType)
      .filter((f): f is string => Boolean(f)),
    kinds: parseKinds(search.tipo),
    visits: list(search.visitas, VISIT_RANGES.map((r) => r.value)),
    sales: list(search.ventas, SALES_OPTIONS.map((o) => o.value)),
    locked: list(search.bloqueado, LOCK_OPTIONS.map((o) => o.value)),
    proposal: search.propuesta && search.propuesta in PROPOSAL_SHORTCUTS ? (search.propuesta as 'revisar' | 'aplicar') : '',
    sync: list(search.sincro, SYNC_OPTIONS.map((o) => o.value)),
    stock: list(search.stock, STOCK_OPTIONS.map((o) => o.value)),
    sort: SORTS.some((s) => s.value === search.orden) ? search.orden! : 'puntaje',
    q: search.q?.trim().toLowerCase() ?? '',
  };
}

export function isFiltered(f: CatalogFilters): boolean {
  return Boolean(
    f.band ||
      f.statuses.length ||
      f.pipeline.length ||
      f.productTypes.length ||
      f.kinds.length ||
      f.visits.length ||
      f.sales.length ||
      f.locked.length ||
      f.proposal ||
      f.sync.length ||
      f.stock.length ||
      f.q,
  );
}

/** Lo que necesita el filtro de cada publicación. */
export type Filterable = {
  title: string | null;
  externalId: string | null;
  skus: string[];
  score: number | null;
  stage: Stage;
  channelStatus: ChannelStatus;
  pipelineStatus: PipelineStatus;
  productType: string | null;
  kind: ProductKind;
  visits: number | null;
  sales: number | null;
  titleLock: TitleLock;
  sync: SyncState;
  // La cantidad disponible en el canal, en total.
  stock: number | null;
};

function visitRange(visits: number | null): string {
  if (visits === null) return 'sin-dato';
  return VISIT_RANGES.find((r) => r.min !== null && visits >= r.min && visits <= r.max)?.value ?? 'sin-dato';
}

function salesOption(sales: number | null): string {
  return sales === null ? 'sin-dato' : sales > 0 ? 'con' : 'sin';
}

function stockOption(stock: number | null): string {
  return stock === null ? 'sin-dato' : stock > 0 ? 'con' : 'sin';
}

function lockOption(lock: TitleLock): string {
  return lock.locked === null ? 'sin-dato' : lock.locked ? 'si' : 'no';
}

export function filterPublications<T extends Filterable>(all: T[], f: CatalogFilters): T[] {
  const { band, statuses, pipeline, productTypes, kinds, visits, sales, locked, proposal, sync, stock, sort, q } = f;
  const proposalStages = proposal ? PROPOSAL_SHORTCUTS[proposal].stages : null;
  const typeSet = new Set(productTypes.map((x) => x.toLowerCase()));
  return all
    .filter((p) => !band || scoreBand(p.score) === BAND_KEY[band])
    // Las eliminadas quedan archivadas: solo se ven si se filtra por ese estado.
    .filter((p) => (statuses.length === 0 ? p.channelStatus !== 'DELETED' : statuses.includes(p.channelStatus)))
    .filter((p) => pipeline.length === 0 || pipeline.includes(p.pipelineStatus))
    .filter((p) => typeSet.size === 0 || typeSet.has((p.productType ?? '').toLowerCase()))
    .filter((p) => kinds.length === 0 || kinds.includes(p.kind))
    .filter((p) => visits.length === 0 || visits.includes(visitRange(p.visits)))
    .filter((p) => sales.length === 0 || sales.includes(salesOption(p.sales)))
    .filter((p) => locked.length === 0 || locked.includes(lockOption(p.titleLock)))
    .filter((p) => !proposalStages || proposalStages.includes(p.stage))
    .filter((p) => sync.length === 0 || syncOptions(p.sync).some((o) => sync.includes(o)))
    .filter((p) => stock.length === 0 || stock.includes(stockOption(p.stock)))
    .filter(
      (p) =>
        !q ||
        (p.title ?? '').toLowerCase().includes(q) ||
        (p.externalId ?? '').toLowerCase().includes(q) ||
        p.skus.some((s) => s.toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      // Sin puntaje, siempre al final.
      const sa = a.score ?? (sort === 'puntaje-desc' ? -1 : 101);
      const sb = b.score ?? (sort === 'puntaje-desc' ? -1 : 101);
      if (sort === 'puntaje') return sa - sb || (b.visits ?? 0) - (a.visits ?? 0);
      if (sort === 'puntaje-desc') return sb - sa || (b.visits ?? 0) - (a.visits ?? 0);
      if (sort === 'visitas') return (b.visits ?? -1) - (a.visits ?? -1) || sa - sb;
      if (sort === 'ventas') return (b.sales ?? -1) - (a.sales ?? -1) || (b.visits ?? -1) - (a.visits ?? -1);
      // Sin dato, al final.
      if (sort === 'cantidad') return (a.stock ?? Infinity) - (b.stock ?? Infinity) || (b.sales ?? -1) - (a.sales ?? -1);
      // Las que no tienen título, al final.
      if (!a.title || !b.title) return Number(!a.title) - Number(!b.title);
      return a.title.localeCompare(b.title, 'es');
    });
}

/** Los tipos de producto que hay, con cuántas publicaciones cada uno, del más común al menos. */
export function productTypeOptions(all: { productType: string | null }[]): { value: string; label: string }[] {
  const counts = new Map<string, number>();
  for (const p of all) if (p.productType) counts.set(p.productType, (counts.get(p.productType) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([type, n]) => ({ value: encodeProductType(type), label: `${type} · ${n}` }));
}
