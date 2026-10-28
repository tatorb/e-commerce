import Link from 'next/link';
import { TAB_ROW, TabCount, tabClass } from '@/components/ui/tab-links';
import { Check, MailWarning } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UrlFilterDropdown } from '@/components/filters/UrlFilterDropdown';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { TaskList } from '@/components/tasks/TaskList';
import { can } from '@/domain/access';
import { parseTaskSearch, TASK_VIEWS, type TaskSearch } from '@/domain/tasks';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { isEmailConfigured } from '@/lib/email';
import { plural } from '@/lib/format';
import { assignablePeople, listTasks } from '@/lib/tasks';
import { cn } from '@/lib/utils/cn';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Tareas · ${account.name}` : 'Tareas' };
}

export default async function TasksPage({ params, searchParams }: { params: Promise<{ cuenta: string }>; searchParams: Promise<TaskSearch> }) {
  const [{ cuenta }, search] = await Promise.all([params, searchParams]);
  const { user, account, canWrite } = await requireAccount(cuenta, 'tareas');
  const tz = account.timezone;
  // Sin el permiso de Tareas, ve solo las suyas.
  const seesAll = can(user.access, 'tareas', 'read');
  const filters = parseTaskSearch(search);
  const now = new Date();
  const [list, people] = await Promise.all([
    listTasks(prisma, { accountId: account.id, viewer: user, filters, timeZone: tz, now }),
    seesAll ? assignablePeople(prisma, account.id) : Promise.resolve([]),
  ]);

  const kept = Object.entries(search).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '');
  const hrefWith = (changes: Record<string, string | null>) => {
    const sp = new URLSearchParams(kept.filter(([k]) => !(k in changes)));
    for (const [k, v] of Object.entries(changes)) if (v) sp.set(k, v);
    const qs = sp.toString();
    return qs ? `?${qs}` : '?';
  };
  const filtered = Boolean(filters.q || filters.people.length || filters.mine);

  return (
    <>
      <PageHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Tareas</h1>
            <p className="text-sm text-muted-foreground">
              {seesAll ? (
                <>
                  Lo que tiene que hacer el equipo en <strong>{account.name}</strong>, con su fecha de aviso y de finalización. Arriba, las
                  vencidas y las que ya llegaron al aviso.
                </>
              ) : (
                <>
                  Tus tareas en <strong>{account.name}</strong>. Arriba, las vencidas y las que ya llegaron al aviso.
                </>
              )}
            </p>
          </div>
          {canWrite ? <TaskDialog accountSlug={account.slug} timeZone={tz} people={people} meId={user.id} /> : null}
        </div>
        <div className={TAB_ROW} role="tablist" aria-label="Qué tareas">
          {TASK_VIEWS.map((v) => {
            const on = v.value === filters.view;
            return (
              <Link key={v.value} href={hrefWith({ ver: v.value === 'abiertas' ? null : v.value })} role="tab" aria-selected={on} className={tabClass(on)}>
                {v.label}
                <TabCount active={on}>{list.counts[v.value]}</TabCount>
              </Link>
            );
          })}
        </div>
      </PageHeader>
      <PageBody>
        {user.isAdmin && !isEmailConfigured() ? (
          <p role="note" className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <MailWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Los mails de las tareas están apagados hasta cargar la clave de Resend en Vercel. Los avisos en la app andan igual.
          </p>
        ) : null}

        {seesAll ? (
          <Card>
            <form className="flex flex-wrap items-end gap-3 p-4" action="" method="get">
              <label className="w-full space-y-1 sm:w-72">
                <span className="text-xs font-medium text-muted-foreground">Buscar</span>
                <Input name="q" defaultValue={filters.q} placeholder="tarea, publicación o código…" aria-label="Buscar tareas" />
              </label>
              {kept
                .filter(([k]) => k !== 'q')
                .map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
              <Button access="view" type="submit">
                Buscar
              </Button>
              <Link
                href={hrefWith({ mias: filters.mine ? null : '1' })}
                aria-pressed={filters.mine}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
                  filters.mine ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {filters.mine ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                Solo las mías
              </Link>
              <UrlFilterDropdown label="Persona" paramKey="persona" options={people.map((p) => ({ value: p.id, label: p.name }))} selected={filters.people} />
              {filtered ? (
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link href={hrefWith({ q: null, persona: null, mias: null })}>Limpiar</Link>
                </Button>
              ) : null}
            </form>
          </Card>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {plural(list.tasks.length, 'tarea', 'tareas')}
          {list.truncated ? '. Se muestran las más nuevas: buscá para encontrar otras.' : '.'}
        </p>

        <Card className="overflow-hidden">
          {list.tasks.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              {filtered
                ? 'No hay tareas que coincidan.'
                : filters.view === 'abiertas'
                  ? seesAll
                    ? 'No hay tareas abiertas.'
                    : 'No tenés tareas abiertas.'
                  : 'No hay tareas acá.'}
            </p>
          ) : (
            <TaskList accountSlug={account.slug} tasks={list.tasks} now={now} timeZone={tz} />
          )}
        </Card>
      </PageBody>
    </>
  );
}
