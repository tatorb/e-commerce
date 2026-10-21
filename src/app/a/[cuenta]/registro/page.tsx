import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UrlFilterDropdown } from '@/components/filters/UrlFilterDropdown';
import {
  AUTOMATIC,
  changeSides,
  FAILED_KINDS,
  fieldLabel,
  isLogFiltered,
  kindLabel,
  LOG_TYPES,
  parseLogSearch,
  personOf,
  readLabel,
  readSummary,
  SIDE_LABELS,
  type LogChange,
  type LogRead,
  type LogSearch,
} from '@/domain/sync-log';
import { titleOrUntitled } from '@/domain/publication-title';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { formatDateTime, plural } from '@/lib/format';
import { loadSyncLog } from '@/lib/queries/sync-log';
import { cn } from '@/lib/utils/cn';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Registro · ${account.name}` : 'Registro' };
}

// Lo más largo que se muestra de un texto antes de "Ver completo".
const PREVIEW = 280;

function Side({ label, text, tone }: { label: string; text: string; tone?: 'muted' }) {
  const long = text.length > PREVIEW;
  return (
    <div className="min-w-0 space-y-0.5">
      {label ? <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p> : null}
      {!text ? (
        <p className="text-muted-foreground">Vacío</p>
      ) : long ? (
        <details className="group">
          <summary className="cursor-pointer list-none">
            <span className={cn('whitespace-pre-line break-words group-open:hidden', tone === 'muted' && 'text-muted-foreground')}>
              {text.slice(0, PREVIEW).trimEnd()}…
            </span>
            <span className="ml-1 text-xs font-medium underline-offset-4 hover:underline group-open:hidden">Ver completo</span>
          </summary>
          <p className={cn('whitespace-pre-line break-words', tone === 'muted' && 'text-muted-foreground')}>{text}</p>
        </details>
      ) : (
        <p className={cn('whitespace-pre-line break-words', tone === 'muted' && 'text-muted-foreground')}>{text}</p>
      )}
    </div>
  );
}

function ChangeItem({ e, accountSlug, timeZone, showStore }: { e: LogChange; accountSlug: string; timeZone: string; showStore: boolean }) {
  const failed = FAILED_KINDS.includes(e.kind);
  const sides = changeSides(e.field, e.before, e.after);
  const [beforeLabel, afterLabel] = SIDE_LABELS[e.kind];
  // Al elegir lo de la app, el antes y el después son lo mismo.
  const single = e.kind === 'CHOSE_APP' || e.kind === 'CREATED' || !beforeLabel;
  return (
    <li className="space-y-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="tabular-nums text-xs text-muted-foreground">{formatDateTime(e.at, timeZone)}</span>
        <Badge variant={failed ? 'destructive' : e.kind === 'SENT' || e.kind === 'CREATED' ? 'default' : e.kind === 'TAKEN' ? 'secondary' : 'outline'}>
          {kindLabel(e.kind)}
        </Badge>
        <span className="font-medium">{fieldLabel(e.field)}</span>
        <span className="text-xs text-muted-foreground sm:ml-auto">{personOf(e)}</span>
      </div>
      <p className="min-w-0">
        <Link href={`/a/${accountSlug}/publicaciones/${e.publication.id}`} className="font-medium underline-offset-4 hover:underline">
          {titleOrUntitled(e.publication.title)}
        </Link>
        <span className="text-xs text-muted-foreground">
          {e.publication.externalId ? ` · ${e.publication.externalId}` : ' · sin publicar'}
          {showStore ? ` · ${e.publication.storeName}` : ''}
        </span>
      </p>
      {e.message ? (
        <p className={cn('rounded-md px-3 py-2', failed ? 'bg-alert/10' : 'bg-muted')}>
          <span className="font-medium">Motivo:</span> {e.message}
        </p>
      ) : null}
      {e.kind === 'CREATE_FAILED' ? null : single ? (
        <Side label={afterLabel} text={sides.after} />
      ) : (
        <div className="grid gap-3 rounded-md border px-3 py-2 sm:grid-cols-2">
          <Side label={beforeLabel} text={sides.before} tone="muted" />
          <Side label={afterLabel} text={sides.after} />
        </div>
      )}
    </li>
  );
}

function ReadItem({ e, timeZone }: { e: LogRead; timeZone: string }) {
  const problem = e.status === 'FAILED' || e.errors.length > 0;
  return (
    <li className="space-y-1.5 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="tabular-nums text-xs text-muted-foreground">{formatDateTime(e.at, timeZone)}</span>
        <Badge variant={e.status === 'FAILED' ? 'destructive' : 'outline'}>{readLabel(e)}</Badge>
        <span className="font-medium">{e.storeName}</span>
        <span className="text-xs text-muted-foreground sm:ml-auto">{personOf(e)}</span>
      </div>
      <p className="text-muted-foreground">{readSummary(e)}</p>
      {problem && e.errors.length > 0 ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">{plural(e.errors.length, 'aviso', 'avisos')}</summary>
          <ul className="mt-1 space-y-0.5">
            {e.errors.slice(-20).map((x, i) => (
              <li key={i}>{x.message}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

export default async function SyncLogPage({ params, searchParams }: { params: Promise<{ cuenta: string }>; searchParams: Promise<LogSearch> }) {
  const [{ cuenta }, search] = await Promise.all([params, searchParams]);
  const { account } = await requireAccount(cuenta);
  const tz = account.timezone;
  const filters = parseLogSearch(search);
  const log = await loadSyncLog(account.id, tz, filters);
  const filtered = isLogFiltered(filters);

  const kept = Object.entries(search).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '');
  const hrefWith = (changes: Record<string, string | null>) => {
    const sp = new URLSearchParams(kept.filter(([k]) => !(k in changes)));
    for (const [k, v] of Object.entries(changes)) if (v) sp.set(k, v);
    const qs = sp.toString();
    return qs ? `?${qs}` : '?';
  };
  const sheetQuery = new URLSearchParams(kept.filter(([k]) => k !== 'page')).toString();
  const sheetHref = `/a/${account.slug}/registro/planilla${sheetQuery ? `?${sheetQuery}` : ''}`;

  return (
    <>
      <PageHeader className="max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Registro</h1>
            <p className="text-sm text-muted-foreground">
              Todo lo que pasó entre la app y el canal en <strong>{account.name}</strong>: lo que llegó, lo que se subió, lo que se eligió y lo que
              no se pudo, con el motivo. Cada dato con su antes y su después.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <a href={sheetHref} download>
              <Download className="h-4 w-4" />
              Descargar planilla
            </a>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UrlFilterDropdown
            label="Qué pasó"
            paramKey="tipo"
            options={LOG_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            selected={filters.types}
          />
          <UrlFilterDropdown
            label="Persona"
            paramKey="persona"
            options={[{ value: AUTOMATIC, label: 'Automático' }, ...log.people.map((u) => ({ value: u.id, label: u.name }))]}
            selected={filters.people}
          />
          {filters.publicationId ? (
            <Link
              href={hrefWith({ publicacion: null, page: null })}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-foreground bg-foreground px-3 py-1 text-xs font-medium text-background"
              title="Quitar este filtro"
            >
              <span className="truncate">Solo {log.publication ? titleOrUntitled(log.publication.title) : 'esa publicación'}</span>
              <X className="h-3 w-3 shrink-0" aria-hidden />
            </Link>
          ) : null}
        </div>
      </PageHeader>
      <PageBody className="max-w-5xl">
        <Card>
          <form className="flex flex-wrap items-end gap-3 p-4" action="" method="get">
            <label className="w-full space-y-1 sm:w-64">
              <span className="text-xs font-medium text-muted-foreground">Publicación</span>
              <Input name="q" defaultValue={filters.q} placeholder="título o código…" aria-label="Buscar publicación" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Desde</span>
              <Input type="date" name="desde" defaultValue={filters.from ?? ''} className="w-40" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Hasta</span>
              <Input type="date" name="hasta" defaultValue={filters.to ?? ''} className="w-40" />
            </label>
            {kept
              .filter(([k]) => !['q', 'desde', 'hasta', 'page'].includes(k))
              .map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
            <Button type="submit">Filtrar</Button>
            {filtered ? (
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="?">Limpiar</Link>
              </Button>
            ) : null}
          </form>
        </Card>

        <p className="text-sm text-muted-foreground">
          {plural(log.total, 'movimiento', 'movimientos')}
          {log.pages > 1 ? ` · página ${filters.page} de ${log.pages}` : ''}
          {filters.types.length === 0 && !filters.q && !filters.publicationId
            ? '. Las lecturas del canal aparecen solo si tuvieron problemas: para verlas todas, elegí Lecturas del canal.'
            : ''}
        </p>

        <Card className="overflow-hidden">
          {log.entries.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              {filtered ? 'No hay movimientos que coincidan.' : 'Todavía no pasó nada entre la app y el canal.'}
            </p>
          ) : (
            <ul className="divide-y">
              {log.entries.map((e) =>
                e.type === 'change' ? (
                  <ChangeItem key={e.key} e={e} accountSlug={account.slug} timeZone={tz} showStore={log.manyStores} />
                ) : (
                  <ReadItem key={e.key} e={e} timeZone={tz} />
                ),
              )}
            </ul>
          )}
        </Card>

        {log.pages > 1 ? (
          <nav className="flex items-center justify-between gap-2" aria-label="Páginas">
            {filters.page > 1 ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={hrefWith({ page: filters.page - 1 > 1 ? String(filters.page - 1) : null })}>
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {filters.page < log.pages ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={hrefWith({ page: String(filters.page + 1) })}>
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : log.capped ? (
              <p className="text-xs text-muted-foreground">Para ver lo anterior, filtrá por fecha.</p>
            ) : null}
          </nav>
        ) : null}
      </PageBody>
    </>
  );
}
