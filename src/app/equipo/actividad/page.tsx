import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UrlFilterDropdown } from '@/components/filters/UrlFilterDropdown';
import { SECTION_KEYS, sectionLabel, TEAM_SECTION } from '@/domain/access';
import { ACTIVITY_TYPES, isActivityFiltered, parseActivitySearch, type ActivitySearch } from '@/domain/activity';
import { requireAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { DEFAULT_TIMEZONE, formatDateTime, plural } from '@/lib/format';
import { loadActivity, personName, type ActivityEntry } from '@/lib/queries/activity';

export const metadata = { title: 'Actividad · Equipo' };

export const dynamic = 'force-dynamic';

function Item({ e }: { e: ActivityEntry }) {
  const failed = e.kind === 'SIGN_IN_FAILED';
  return (
    <li className="space-y-1 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="tabular-nums text-xs text-muted-foreground">{formatDateTime(e.createdAt, DEFAULT_TIMEZONE)}</span>
        <span className="font-medium">{personName(e)}</span>
        {e.account ? <span className="text-xs text-muted-foreground">{e.account.name}</span> : null}
        {e.section ? <span className="text-xs text-muted-foreground">· {sectionLabel(e.section)}</span> : null}
        {e.via === 'CLAUDE' ? <Badge variant="outline">Desde Claude</Badge> : null}
        {failed ? <Badge variant="alert">No pudo entrar</Badge> : null}
      </div>
      <p className="break-words">
        {e.summary}
        {e.targetLabel ? (
          <>
            {' · '}
            {e.href ? (
              <Link href={e.href} className="font-medium underline-offset-4 hover:underline">
                {e.targetLabel}
              </Link>
            ) : (
              <span className="text-muted-foreground">{e.targetLabel}</span>
            )}
          </>
        ) : null}
      </p>
      {e.detail ? <p className="whitespace-pre-line break-words text-xs text-muted-foreground">{e.detail}</p> : null}
    </li>
  );
}

// Lo que hace cada persona en la app: lo que guarda o cambia, desde la app o
// desde Claude, y cuándo entra. Solo para administradores.
export default async function ActivityPage({ searchParams }: { searchParams: Promise<ActivitySearch> }) {
  await requireAdmin();
  const search = await searchParams;
  const filters = parseActivitySearch(search);
  const log = await loadActivity(prisma, filters, DEFAULT_TIMEZONE);
  const filtered = isActivityFiltered(filters);

  const kept = Object.entries(search).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '');
  const hrefWith = (changes: Record<string, string | null>) => {
    const sp = new URLSearchParams(kept.filter(([k]) => !(k in changes)));
    for (const [k, v] of Object.entries(changes)) if (v) sp.set(k, v);
    const qs = sp.toString();
    return qs ? `?${qs}` : '?';
  };
  const sheetQuery = new URLSearchParams(kept.filter(([k]) => k !== 'page')).toString();
  const sheetHref = `/equipo/actividad/planilla${sheetQuery ? `?${sheetQuery}` : ''}`;
  const sectionOptions = [...SECTION_KEYS.map((s) => ({ value: s, label: sectionLabel(s) })), { value: TEAM_SECTION, label: sectionLabel(TEAM_SECTION) }];

  return (
    <>
      <PageHeader className="max-w-5xl">
        <div className="space-y-2">
          <Breadcrumb items={[{ label: 'Equipo', href: '/equipo' }, { label: 'Actividad' }]} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Actividad</h1>
              <p className="text-sm text-muted-foreground">
                Lo que hace cada persona en la app: lo que guarda o cambia, también desde Claude, y cuándo entra. Lo que la app hace sola está en el
                Registro de cada cuenta.
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <a href={sheetHref} download>
                <Download className="h-4 w-4" />
                Descargar planilla
              </a>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UrlFilterDropdown label="Persona" paramKey="persona" options={log.people.map((u) => ({ value: u.id, label: u.name }))} selected={filters.people} />
          <UrlFilterDropdown label="Cuenta" paramKey="cuenta" options={log.accounts.map((a) => ({ value: a.id, label: a.name }))} selected={filters.accounts} />
          <UrlFilterDropdown label="Sección" paramKey="seccion" options={sectionOptions} selected={filters.sections} />
          <UrlFilterDropdown label="Qué" paramKey="tipo" options={ACTIVITY_TYPES.map((t) => ({ value: t.value, label: t.label }))} selected={filters.types} />
        </div>
      </PageHeader>
      <PageBody className="max-w-5xl">
        <Card>
          <form className="flex flex-wrap items-end gap-3 p-4" action="" method="get">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Desde</span>
              <Input type="date" name="desde" defaultValue={filters.from ?? ''} className="w-40" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Hasta</span>
              <Input type="date" name="hasta" defaultValue={filters.to ?? ''} className="w-40" />
            </label>
            {kept
              .filter(([k]) => !['desde', 'hasta', 'page'].includes(k))
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
        </p>

        <Card className="overflow-hidden">
          {log.entries.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">{filtered ? 'No hay movimientos que coincidan.' : 'Todavía no hay actividad.'}</p>
          ) : (
            <ul className="divide-y">
              {log.entries.map((e) => (
                <Item key={e.id} e={e} />
              ))}
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
            ) : null}
          </nav>
        ) : null}
      </PageBody>
    </>
  );
}
