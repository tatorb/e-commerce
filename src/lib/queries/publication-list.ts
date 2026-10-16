import { prisma } from '@/lib/db';
import { STAGES } from '@/domain/stages';
import { CHANNEL_STATUS_LABEL } from '@/domain/channel-status';
import { PRODUCT_CONTENT_SELECT, toContentSnapshot } from '@/domain/content';
import { scoreBand } from '@/domain/standard';
import type { ChannelStatus, Stage } from '@/generated/prisma/enums';
import type { ContentSheetRow } from '@/importers/content-sheet';
import type { ScoredPublication } from './scoring';

// Filtros y orden de la lista de publicaciones. Los usan la pantalla y la
// descarga de la planilla de contenido, así bajás exactamente lo que ves.

export type PublicationSearch = { q?: string; puntaje?: string; etapa?: string; estado?: string; orden?: string };

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
  { value: 'titulo', label: 'Título' },
];

export const CHANNEL_STATUSES = Object.keys(CHANNEL_STATUS_LABEL) as ChannelStatus[];

export type PublicationFilters = {
  band: keyof typeof BAND_KEY | '';
  stages: Stage[];
  statuses: ChannelStatus[];
  sort: string;
  q: string;
};

function list(raw: string | undefined, allowed: readonly string[]): string[] {
  return (raw ?? '').split(',').filter((v) => allowed.includes(v));
}

export function parsePublicationSearch(search: PublicationSearch): PublicationFilters {
  return {
    band: search.puntaje && search.puntaje in BAND_KEY ? (search.puntaje as keyof typeof BAND_KEY) : '',
    stages: list(search.etapa, STAGES) as Stage[],
    statuses: list(search.estado, CHANNEL_STATUSES) as ChannelStatus[],
    sort: SORTS.some((s) => s.value === search.orden) ? search.orden! : 'puntaje',
    q: search.q?.trim().toLowerCase() ?? '',
  };
}

export function isFiltered(f: PublicationFilters): boolean {
  return Boolean(f.band || f.stages.length || f.statuses.length || f.q);
}

export function filterPublications(all: ScoredPublication[], f: PublicationFilters): ScoredPublication[] {
  const { band, stages, statuses, sort, q } = f;
  return all
    .filter((p) => !band || scoreBand(p.score) === BAND_KEY[band])
    .filter((p) => stages.length === 0 || stages.includes(p.stage))
    .filter((p) => statuses.length === 0 || statuses.includes(p.channelStatus))
    .filter(
      (p) =>
        !q ||
        p.title.toLowerCase().includes(q) ||
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
      return a.title.localeCompare(b.title, 'es');
    });
}

/** El contenido de esas publicaciones, en el mismo orden, para la planilla. */
export async function listContentSheetRows(publicationIds: string[]): Promise<ContentSheetRow[]> {
  const publications = await prisma.publication.findMany({
    where: { id: { in: publicationIds } },
    select: {
      id: true,
      externalId: true,
      url: true,
      title: true,
      description: true,
      product: { select: PRODUCT_CONTENT_SELECT },
    },
  });
  const byId = new Map(publications.map((p) => [p.id, p]));
  return publicationIds.flatMap((id) => {
    const p = byId.get(id);
    if (!p) return [];
    return [{ externalId: p.externalId, url: p.url, content: toContentSnapshot(p.product, p) }];
  });
}
