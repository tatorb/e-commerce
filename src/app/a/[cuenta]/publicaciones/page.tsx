import Link from 'next/link';
import { ClipboardCheck, Download, Send, SlidersHorizontal, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { UrlFilterDropdown } from '@/components/filters/UrlFilterDropdown';
import { SortSelect } from '@/components/filters/SortSelect';
import { CatalogTable, type CatalogRow } from '@/components/catalog/CatalogTable';
import { AddByCodeDialog } from '@/components/catalog/AddByCodeDialog';
import { ContentSheetInstructions } from '@/components/import/ContentSheetInstructions';
import { BulkProposalDialog } from '@/components/proposals/BulkProposalDialog';
import { AI_NOT_CONFIGURED, isAiConfigured } from '@/ai/claude';
import { needsProposal } from '@/domain/proposals';
import { CHANNEL_STATUS_LABEL } from '@/domain/channel-status';
import { PIPELINE_STATUSES, PIPELINE_STATUS_LABEL } from '@/domain/pipeline';
import { channelInfo } from '@/channels';
import { contentSheetInstructions } from '@/importers/content-sheet';
import { prisma } from '@/lib/db';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import {
  BANDS,
  CHANNEL_STATUSES,
  LOCK_OPTIONS,
  SYNC_OPTIONS,
  PROPOSAL_SHORTCUTS,
  SALES_OPTIONS,
  SORTS,
  VISIT_RANGES,
  encodeFamily,
  familyOptions,
  KIND_OPTIONS,
  filterPublications,
  isFiltered,
  parsePublicationSearch,
  type PublicationSearch,
} from '@/lib/queries/publication-list';
import { listScoredPublications } from '@/lib/queries/scoring';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { titleOrUntitled } from '@/domain/publication-title';

export const dynamic = 'force-dynamic';
// Cada propuesta de la tanda es un pedido que puede tardar más de un minuto.
export const maxDuration = 300;

// Propuestas por tanda.
const BULK_LIMIT = 50;

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Catálogo · ${account.name}` : 'Catálogo' };
}

function chipClass(active: boolean): string {
  return cn(
    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
    active
      ? 'bg-foreground text-background border-foreground'
      : 'bg-background text-foreground/70 border-border hover:bg-muted hover:text-foreground',
  );
}

export default async function PublicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ cuenta: string }>;
  searchParams: Promise<PublicationSearch>;
}) {
  const [{ cuenta }, search] = await Promise.all([params, searchParams]);
  const { account } = await requireAccount(cuenta);

  const filters = parsePublicationSearch(search);
  const { band, statuses, sort } = filters;

  const [all, stores] = await Promise.all([
    listScoredPublications(account.id),
    prisma.store.findMany({
      where: { accountId: account.id },
      select: { channel: { select: { name: true, kind: true } } },
    }),
  ]);
  const items = filterPublications(all, filters);
  const channelNames = [...new Set(stores.map((s) => s.channel.name))];
  const codeExample = stores.length > 0 ? channelInfo(stores[0].channel.kind, stores[0].channel.name).externalIdPlaceholder : '';
  const rows: CatalogRow[] = items.map((p) => ({
    id: p.id,
    productId: p.productId,
    title: p.title,
    kind: p.kind,
    externalId: p.externalId,
    skus: p.skus,
    score: p.score,
    channelStatus: p.channelStatus,
    pipelineStatus: p.pipelineStatus,
    pipelineStep: p.pipelineStep,
    pipelineRemoval: p.pipelineRemoval,
    visits: p.visits,
    sales: p.sales,
    titleLock: p.titleLock,
    missing: p.missing.map((m) => m.name),
    sync: p.sync,
  }));
  const ready = items.filter((p) => needsProposal(p.stage));
  const toReview = all.filter((p) => p.stage === 'PROPOSAL_GENERATED' || p.stage === 'IN_REVIEW').length;
  const toApply = all.filter((p) => p.stage === 'APPROVED').length;

  const scored = items.filter((p) => p.score !== null);
  const average = scored.length ? Math.round(scored.reduce((s, p) => s + p.score!, 0) / scored.length) : null;

  function hrefWith(key: string, value: string): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(search)) if (v && k !== key) sp.set(k, v);
    if (value) sp.set(key, value);
    const qs = sp.toString();
    return qs ? `?${qs}` : '?';
  }

  const filtered = isFiltered(filters);
  const query = new URLSearchParams(
    Object.entries(search).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''),
  ).toString();
  const sheetHref = `/a/${account.slug}/publicaciones/planilla${query ? `?${query}` : ''}`;

  return (
    <>
      <PageHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Catálogo</h1>
            <p className="text-sm text-muted-foreground">
              Todas las publicaciones de <strong>{account.name}</strong>, con su puntaje según el estándar. Elegí las
              que querés corregir y agregalas al pipeline.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/a/${account.slug}/estandar`}>
              <SlidersHorizontal className="h-4 w-4" />
              Ver estándar
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddByCodeDialog accountSlug={account.slug} example={codeExample} />
          {toReview > 0 ? (
            <Button size="sm" variant="outline" asChild>
              <Link href="?propuesta=revisar">
                <ClipboardCheck className="h-4 w-4" />
                Propuestas para revisar · {toReview}
              </Link>
            </Button>
          ) : null}
          {toApply > 0 ? (
            <Button size="sm" variant="outline" asChild>
              <Link href="?propuesta=aplicar">
                <Send className="h-4 w-4" />
                Propuestas para aplicar · {toApply}
              </Link>
            </Button>
          ) : null}
          <BulkProposalDialog
            accountSlug={account.slug}
            items={ready.slice(0, BULK_LIMIT).map((p) => ({ id: p.id, title: titleOrUntitled(p.title) }))}
            readyTotal={ready.length}
            viewing={items.length}
            disabledReason={isAiConfigured() ? null : AI_NOT_CONFIGURED}
          />
          <Button size="sm" variant="outline" asChild>
            <a href={sheetHref} download>
              <Download className="h-4 w-4" />
              Descargar planilla de contenido
            </a>
          </Button>
          <ContentSheetInstructions text={contentSheetInstructions(channelNames.join(' y ') || 'la tienda')} />
          <span className="text-xs text-muted-foreground">
            {!filtered
              ? 'Trae todas las publicaciones. Filtrá antes para bajar una tanda.'
              : items.length === 1
                ? 'Trae la publicación que estás viendo.'
                : `Trae las ${items.length} publicaciones que estás viendo.`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {BANDS.map((b) => (
            <Link key={b.value} href={hrefWith('puntaje', b.value)} className={chipClass(band === b.value)}>
              {b.label}
            </Link>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <UrlFilterDropdown
            label="Pipeline"
            paramKey="pipeline"
            options={PIPELINE_STATUSES.map((s) => ({ value: s, label: PIPELINE_STATUS_LABEL[s] }))}
            selected={filters.pipeline}
          />
          <UrlFilterDropdown
            label="Tipo"
            paramKey="tipo"
            options={KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            selected={KIND_OPTIONS.filter((o) => filters.kinds.includes(o.kind)).map((o) => o.value)}
          />
          <UrlFilterDropdown
            label="Familia"
            paramKey="familia"
            options={familyOptions(all)}
            selected={filters.families.map(encodeFamily)}
          />
          <UrlFilterDropdown
            label="Visitas"
            paramKey="visitas"
            options={VISIT_RANGES.map((r) => ({ value: r.value, label: r.label }))}
            selected={filters.visits}
          />
          <UrlFilterDropdown
            label="Ventas"
            paramKey="ventas"
            options={SALES_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            selected={filters.sales}
          />
          <UrlFilterDropdown
            label="Título"
            paramKey="bloqueado"
            options={LOCK_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            selected={filters.locked}
          />
          <UrlFilterDropdown
            label="Sincronización"
            paramKey="sincro"
            options={SYNC_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            selected={filters.sync}
          />
          <UrlFilterDropdown
            label="Estado"
            paramKey="estado"
            options={CHANNEL_STATUSES.map((s) => ({ value: s, label: CHANNEL_STATUS_LABEL[s] }))}
            selected={statuses}
          />
          <SortSelect options={SORTS} value={sort} />
          {filters.proposal ? (
            <Link
              href={hrefWith('propuesta', '')}
              className={cn(chipClass(true), 'inline-flex items-center gap-1')}
              title="Quitar este filtro"
            >
              {PROPOSAL_SHORTCUTS[filters.proposal].label}
              <X className="h-3 w-3" aria-hidden />
            </Link>
          ) : null}
        </div>
      </PageHeader>
      <PageBody>
        <Card>
          <div className="p-4">
            <form className="flex flex-wrap gap-3 items-end" action="" method="get">
              <Input
                name="q"
                defaultValue={search.q}
                placeholder="título, ID o SKU…"
                className="w-full sm:w-80"
                aria-label="Buscar"
              />
              {Object.entries(search)
                .filter(([k, v]) => k !== 'q' && typeof v === 'string' && v !== '')
                .map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v as string} />
                ))}
              <Button type="submit">Buscar</Button>
              {filtered ? (
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link href="?">Limpiar</Link>
                </Button>
              ) : null}
            </form>
          </div>
        </Card>

        <p className="text-muted-foreground text-sm">
          {plural(items.length, 'publicación', 'publicaciones')}
          {average !== null ? ` · puntaje promedio ${average}` : ''}
          {filtered ? ` · de ${all.length} en total` : ''}
        </p>

        {items.length === 0 ? (
          <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 flex items-center justify-center p-10 text-center text-muted-foreground text-sm">
              {all.length === 0
                ? 'Todavía no hay publicaciones. Cargalas desde Importar o desde la ficha de un producto.'
                : 'No hay publicaciones que coincidan.'}
            </div>
          </Card>
        ) : (
          <CatalogTable accountSlug={account.slug} rows={rows} channelName={channelNames.join(' y ') || 'el canal'} />
        )}
      </PageBody>
    </>
  );
}
