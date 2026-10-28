import Link from 'next/link';
import { ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TabLinks } from '@/components/ui/tab-links';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { NewPipelinePublicationDialog } from '@/components/pipeline/NewPipelinePublicationDialog';
import { PipelineBoard } from '@/components/pipeline/PipelineBoard';
import { ToPushList } from '@/components/sync/ToPushList';
import { QuestionsNotice } from '@/components/questions/QuestionsNotice';
import { UrlFilterDropdown } from '@/components/filters/UrlFilterDropdown';
import { KIND_OPTIONS, parseKinds } from '@/lib/queries/catalog-filters';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { listBoard } from '@/lib/queries/pipeline';
import { listStores } from '@/lib/queries/products';
import { listToPush } from '@/lib/queries/sync';
import { unansweredSummary } from '@/lib/queries/questions';
import { plural } from '@/lib/format';
import { prisma } from '@/lib/db';
import { openTasksByPublication } from '@/lib/tasks';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Pipeline · ${account.name}` : 'Pipeline' };
}

export default async function PipelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ cuenta: string }>;
  searchParams: Promise<{ tipo?: string; vista?: string }>;
}) {
  const [{ cuenta }, { tipo, vista }] = await Promise.all([params, searchParams]);
  const { user, account } = await requireAccount(cuenta, 'pipeline');

  const kinds = parseKinds(tipo);
  const toPushView = vista === 'por-subir';
  // Por subir mira todas las publicaciones de la cuenta: se carga solo en su pestaña.
  const [all, stores, toPush, questions] = await Promise.all([
    toPushView ? Promise.resolve([]) : listBoard(account.id),
    listStores(account.id),
    toPushView ? listToPush(account.id) : Promise.resolve([]),
    unansweredSummary(account.id),
  ]);
  const items = kinds.length > 0 ? all.filter((i) => kinds.includes(i.kind)) : all;
  // Cuántas tareas abiertas tiene cada tarjeta.
  const tasks = Object.fromEntries(await openTasksByPublication(prisma, { publicationIds: items.map((i) => i.id), viewer: user }));
  const catalogHref = `/a/${account.slug}/publicaciones?pipeline=UNTOUCHED,DISCARDED`;

  return (
    <>
      <PageHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              Las publicaciones de <strong>{account.name}</strong> que se están corrigiendo. Tocá una para abrir su paso, o
              arrastrala a otro paso: no hace falta pasar por los del medio.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={catalogHref}>
                <ListChecks className="h-4 w-4" />
                Agregar desde Publicaciones
              </Link>
            </Button>
            <NewPipelinePublicationDialog
              accountSlug={account.slug}
              stores={stores.map((s) => ({ id: s.id, name: s.name, channelName: s.channel.name }))}
            />
          </div>
        </div>
      </PageHeader>
      <PageBody>
        <QuestionsNotice accountSlug={account.slug} count={questions.count} oldestAt={questions.oldestAt} />
        <TabLinks
          label="Vista del pipeline"
          items={(
            [
              ['', 'Tablero'],
              ['por-subir', 'Por subir'],
            ] as const
          ).map(([key, label]) => ({
            key: key || 'tablero',
            href: key ? `?vista=${key}` : '?',
            label,
            active: (key === 'por-subir') === toPushView,
            count: key === 'por-subir' && toPushView ? toPush.length : null,
          }))}
        />
        {toPushView ? (
          <>
            <p className="text-sm text-muted-foreground">
              Las publicaciones con cambios de la app que todavía no están en el canal, vengan del pipeline o de un cambio suelto. Las que
              tienen datos para elegir se resuelven en su página.
            </p>
            {toPush.length > 0 ? (
              <ToPushList accountSlug={account.slug} rows={toPush} />
            ) : (
              <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                No hay cambios para subir: todo lo de la app ya está en el canal.
              </div>
            )}
          </>
        ) : all.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            Todavía no hay publicaciones en el pipeline. Elegilas en{' '}
            <Link href={catalogHref} className="text-primary underline-offset-4 hover:underline">
              Publicaciones
            </Link>{' '}
            y tocá Agregar al pipeline, o creá una con Nueva publicación.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <UrlFilterDropdown
                label="Tipo"
                paramKey="tipo"
                options={KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                selected={KIND_OPTIONS.filter((o) => kinds.includes(o.kind)).map((o) => o.value)}
              />
              <p className="text-sm text-muted-foreground">
                {kinds.length > 0
                  ? `${items.length} de ${plural(all.length, 'publicación', 'publicaciones')} en el pipeline.`
                  : `${plural(items.length, 'publicación', 'publicaciones')} en el pipeline.`}{' '}
                En cada paso, las que esperan hace más tiempo van primero.
              </p>
            </div>
            <PipelineBoard accountSlug={account.slug} items={items} showStore={stores.length > 1} openTasks={tasks} />
          </>
        )}
      </PageBody>
    </>
  );
}
