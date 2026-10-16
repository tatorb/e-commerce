import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClipboardCheck, Download, Send, SlidersHorizontal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { UrlFilterDropdown } from '@/components/filters/UrlFilterDropdown';
import { SortSelect } from '@/components/filters/SortSelect';
import { ChannelStatusBadge, StageBadge } from '@/components/stages/StageBadge';
import { ScoreBadge } from '@/components/stages/ScoreBadge';
import { ContentSheetInstructions } from '@/components/import/ContentSheetInstructions';
import { BulkProposalDialog } from '@/components/proposals/BulkProposalDialog';
import { AI_NOT_CONFIGURED, isAiConfigured } from '@/ai/claude';
import { needsProposal } from '@/domain/proposals';
import { STAGES, STAGE_LABEL } from '@/domain/stages';
import { CHANNEL_STATUS_LABEL } from '@/domain/channel-status';
import { contentSheetInstructions } from '@/importers/content-sheet';
import { prisma } from '@/lib/db';
import { getAccountBySlug } from '@/lib/queries/accounts';
import {
  BANDS,
  CHANNEL_STATUSES,
  SORTS,
  filterPublications,
  isFiltered,
  parsePublicationSearch,
  type PublicationSearch,
} from '@/lib/queries/publication-list';
import { listScoredPublications, type ScoredPublication } from '@/lib/queries/scoring';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

export const dynamic = 'force-dynamic';
// Cada propuesta de la tanda es un pedido que puede tardar más de un minuto.
export const maxDuration = 300;

// Propuestas por tanda.
const BULK_LIMIT = 50;

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  return { title: account ? `Publicaciones · ${account.name}` : 'Publicaciones' };
}

function chipClass(active: boolean): string {
  return cn(
    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
    active
      ? 'bg-foreground text-background border-foreground'
      : 'bg-background text-foreground/70 border-border hover:bg-muted hover:text-foreground',
  );
}

function MissingList({ item }: { item: ScoredPublication }) {
  if (item.missing.length === 0) return <span className="text-muted-foreground">—</span>;
  const names = item.missing.slice(0, 2).map((m) => m.name);
  const rest = item.missing.length - names.length;
  return (
    <span className="text-muted-foreground">
      {names.join(', ')}
      {rest > 0 ? ` y ${rest} más` : ''}
    </span>
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
  const account = await getAccountBySlug(cuenta);
  if (!account) notFound();

  const filters = parsePublicationSearch(search);
  const { band, stages, statuses, sort } = filters;

  const [all, stores] = await Promise.all([
    listScoredPublications(account.id),
    prisma.store.findMany({ where: { accountId: account.id }, select: { channel: { select: { name: true } } } }),
  ]);
  const items = filterPublications(all, filters);
  const channelNames = [...new Set(stores.map((s) => s.channel.name))];
  const ready = items.filter((p) => needsProposal(p.stage));
  const toReview = all.filter((p) => p.stage === 'PROPOSAL_GENERATED' || p.stage === 'IN_REVIEW').length;
  const toApply = all.filter((p) => p.stage === 'APPROVED').length;

  const scored = items.filter((p) => p.score !== null);
  const average = scored.length ? Math.round(scored.reduce((s, p) => s + p.score!, 0) / scored.length) : null;

  function bandHref(value: string): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(search)) if (v && k !== 'puntaje') sp.set(k, v);
    if (value) sp.set('puntaje', value);
    const qs = sp.toString();
    return qs ? `?${qs}` : '?';
  }

  const base = `/a/${account.slug}/productos`;
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
            <h1 className="text-2xl font-semibold tracking-tight">Publicaciones</h1>
            <p className="text-sm text-muted-foreground">
              El puntaje de cada publicación de <strong>{account.name}</strong> según el estándar. Empezá por las de
              menor puntaje.
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
          {toReview > 0 ? (
            <Button size="sm" asChild>
              <Link href="?etapa=PROPOSAL_GENERATED,IN_REVIEW">
                <ClipboardCheck className="h-4 w-4" />
                Para revisar · {toReview}
              </Link>
            </Button>
          ) : null}
          {toApply > 0 ? (
            <Button size="sm" asChild>
              <Link href="?etapa=APPROVED">
                <Send className="h-4 w-4" />
                Para aplicar · {toApply}
              </Link>
            </Button>
          ) : null}
          <BulkProposalDialog
            accountSlug={account.slug}
            items={ready.slice(0, BULK_LIMIT).map((p) => ({ id: p.id, title: p.title }))}
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
            <Link key={b.value} href={bandHref(b.value)} className={chipClass(band === b.value)}>
              {b.label}
            </Link>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <UrlFilterDropdown
            label="Etapa"
            paramKey="etapa"
            options={STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
            selected={stages}
          />
          <UrlFilterDropdown
            label="Estado"
            paramKey="estado"
            options={CHANNEL_STATUSES.map((s) => ({ value: s, label: CHANNEL_STATUS_LABEL[s] }))}
            selected={statuses}
          />
          <SortSelect options={SORTS} value={sort} />
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
              {band ? <input type="hidden" name="puntaje" value={band} /> : null}
              {search.etapa ? <input type="hidden" name="etapa" value={search.etapa} /> : null}
              {search.estado ? <input type="hidden" name="estado" value={search.estado} /> : null}
              {search.orden ? <input type="hidden" name="orden" value={search.orden} /> : null}
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

        <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-10 text-center text-muted-foreground text-sm">
              {all.length === 0
                ? 'Todavía no hay publicaciones. Cargalas desde Importar o desde la ficha de un producto.'
                : 'No hay publicaciones que coincidan.'}
            </div>
          ) : (
            <>
              <div className="md:hidden divide-y overflow-y-auto flex-1 min-h-0">
                {items.map((p) => (
                  <div key={p.id} className="px-3 py-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`${base}/${p.productId}`} className="font-medium hover:underline min-w-0">
                        {p.title}
                      </Link>
                      <ScoreBadge score={p.score} className="shrink-0" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <StageBadge stage={p.stage} />
                      <ChannelStatusBadge status={p.channelStatus} />
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[p.externalId, p.skus.join(' / ')].filter(Boolean).join(' · ') || '—'}
                      {p.visits !== null ? ` · ${plural(p.visits, 'visita')}` : ''}
                    </div>
                    <div className="text-xs">
                      <MissingList item={p} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:flex md:flex-1 md:min-h-0 md:flex-col">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Puntaje</TableHead>
                      <TableHead>Publicación</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead className="text-right">Visitas 90 días</TableHead>
                      <TableHead>Le falta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <ScoreBadge score={p.score} />
                        </TableCell>
                        <TableCell className="max-w-[22rem]">
                          <Link href={`${base}/${p.productId}`} className="font-medium hover:underline line-clamp-2">
                            {p.title}
                          </Link>
                          <div className="text-xs text-muted-foreground truncate">
                            {[p.externalId, p.skus.join(' / ')].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ChannelStatusBadge status={p.channelStatus} />
                        </TableCell>
                        <TableCell>
                          <StageBadge stage={p.stage} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.visits === null ? <span className="text-muted-foreground">—</span> : p.visits}
                        </TableCell>
                        <TableCell className="max-w-[16rem] text-sm">
                          <MissingList item={p} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>
      </PageBody>
    </>
  );
}
