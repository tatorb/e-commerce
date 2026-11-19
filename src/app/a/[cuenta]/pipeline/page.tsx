import { ClipUploadList } from '@/components/clips/ClipUploadList';
import { clipRows } from '@/components/clips/rows';
import { offerApprovedClips, pendingClipUploads } from '@/lib/clip-uploads';
import Link from 'next/link';
import { loadProductOptions } from '@/lib/product-options';
import { ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TabLinks } from '@/components/ui/tab-links';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { RefreshButton } from '@/components/dashboard/RefreshButton';
import { PageBody } from '@/components/dashboard/PageBody';
import { NewPipelinePublicationDialog } from '@/components/pipeline/NewPipelinePublicationDialog';
import { PipelineBoard } from '@/components/pipeline/PipelineBoard';
import { ToPushList } from '@/components/sync/ToPushList';
import { CompatibilityPushList } from '@/components/sync/CompatibilityPushList';
import { QuestionsNotice } from '@/components/questions/QuestionsNotice';
import { UrlFilterDropdown } from '@/components/filters/UrlFilterDropdown';
import { KIND_OPTIONS, parseKinds } from '@/lib/queries/catalog-filters';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { listBoard } from '@/lib/queries/pipeline';
import { listStores } from '@/lib/queries/products';
import { listToPush } from '@/lib/queries/sync';
import { listCompatibilitiesToPush } from '@/lib/compatibility-push';
import { unansweredSummary } from '@/lib/queries/questions';
import { plural } from '@/lib/format';
import { prisma } from '@/lib/db';
import { listPendingClose } from '@/lib/recreate';
import { categoryAlerts } from '@/lib/channel-category';
import { CHANNEL_STATUS_LABEL } from '@/domain/channel-status';
import { openTasksByPublication } from '@/lib/tasks';
import { notesByCard } from '@/lib/publication-notes';

export const dynamic = 'force-dynamic';
// Subir desde Por subir relee el canal antes y después de mandar.
export const maxDuration = 60;

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
  searchParams: Promise<{ tipo?: string; vista?: string; tabla?: string }>;
}) {
  const [{ cuenta }, { tipo, vista, tabla }] = await Promise.all([params, searchParams]);
  const { user, account } = await requireAccount(cuenta, 'pipeline');

  const kinds = parseKinds(tipo);
  const toPushView = vista === 'por-subir';
  // Por subir mira todas las publicaciones de la cuenta: se carga solo en su pestaña.
  // Los clips aprobados antes de que entraran a Por subir se ofrecen acá, una sola vez.
  if (toPushView) await offerApprovedClips(prisma, account.id);
  const [all, stores, toPush, compatibilities, clips, toClose, questions, options] = await Promise.all([
    toPushView ? Promise.resolve([]) : listBoard(account.id),
    listStores(account.id),
    toPushView ? listToPush(account.id) : Promise.resolve([]),
    toPushView ? listCompatibilitiesToPush(prisma, account.id) : Promise.resolve([]),
    toPushView ? pendingClipUploads(prisma, account.id) : Promise.resolve([]),
    toPushView ? listPendingClose(prisma, account.id) : Promise.resolve([]),
    unansweredSummary(account.id),
    loadProductOptions(prisma, account.id),
  ]);
  const items = kinds.length > 0 ? all.filter((i) => kinds.includes(i.kind)) : all;
  // Cuántas tareas abiertas tiene cada tarjeta.
  const [taskCounts, noteCounts, alerts] = await Promise.all([
    openTasksByPublication(prisma, { publicationIds: items.map((i) => i.id), viewer: user }),
    notesByCard(prisma, account.id, items.map((i) => i.id)),
    categoryAlerts(prisma, items.map((i) => i.id)),
  ]);
  const tasks = Object.fromEntries(taskCounts);
  // Cuántas notas tiene cada tarjeta y la última, para leerla sin entrar.
  const notes = Object.fromEntries(
    Object.entries(noteCounts).map(([id, n]) => [id, { count: n.count, last: `${n.last.author}: ${n.last.text.length > 200 ? `${n.last.text.slice(0, 197)}…` : n.last.text}` }]),
  );
  const catalogHref = `/a/${account.slug}/publicaciones?pipeline=UNTOUCHED,DISCARDED`;
  // En Por subir, una pestaña por lista. Sin elegir, la primera que tiene algo.
  const tables = [
    { key: 'cambios', label: 'Cambios', count: toPush.length },
    { key: 'clips', label: 'Clips', count: clips.length },
    { key: 'compatibilidades', label: 'Compatibilidades', count: compatibilities.length },
    { key: 'por-finalizar', label: 'Por finalizar', count: toClose.length },
  ] as const;
  const table = tables.find((t) => t.key === tabla)?.key ?? tables.find((t) => t.count > 0)?.key ?? 'cambios';
  const nothing = (what: string) => <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">{what}</div>;

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
            <RefreshButton label="Actualizar el pipeline" />
            <Button size="sm" variant="outline" asChild>
              <Link href={catalogHref}>
                <ListChecks className="h-4 w-4" />
                Agregar desde Publicaciones
              </Link>
            </Button>
            <NewPipelinePublicationDialog
              accountSlug={account.slug}
              stores={stores.map((s) => ({ id: s.id, name: s.name, channelName: s.channel.name }))}
              types={options.types}
            />
          </div>
        </div>
        {/* Las pestañas van en el encabezado, que queda fijo al bajar. */}
        <div className="-mb-4 space-y-3 md:-mb-5">
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
              count: key === 'por-subir' && toPushView ? toPush.length + compatibilities.length + clips.length + toClose.length : null,
            }))}
           // La raya de abajo la pone el encabezado, salvo que sigan las pestañas de Por subir.
            className={toPushView ? undefined : 'border-b-0'}
          />
          {toPushView ? (
            <TabLinks
              label="Listas por subir"
              items={tables.map((t) => ({ key: t.key, href: `?vista=por-subir&tabla=${t.key}`, label: t.label, active: t.key === table, count: t.count }))}
              className="border-b-0"
            />
          ) : null}
        </div>
      </PageHeader>
      <PageBody>
        <QuestionsNotice accountSlug={account.slug} count={questions.count} oldestAt={questions.oldestAt} />
        {toPushView ? (
          table === 'cambios' ? (
            <>
              <p className="text-sm text-muted-foreground">
                Las publicaciones con cambios de la app que todavía no están en el canal, vengan del pipeline o de un cambio suelto. Las que
                tienen datos para elegir se resuelven en su página.
              </p>
              {toPush.length > 0 ? <ToPushList accountSlug={account.slug} rows={toPush} /> : nothing('No hay cambios para subir: todo lo de la app ya está en el canal.')}
            </>
          ) : table === 'clips' ? (
            <>
              <p className="text-sm text-muted-foreground">
                Los clips aprobados y elegidos que todavía no están en el canal. Mercado Libre no deja subirlos desde la app a las cuentas locales: se
                suben desde tu Chrome, con la extensión de Studio MRB o a mano. Va uno por producto, o uno por medida si cada medida tiene el suyo.
              </p>
              {clips.length > 0 ? <ClipUploadList accountSlug={account.slug} clips={clipRows(clips)} /> : nothing('No hay clips para subir.')}
            </>
          ) : table === 'por-finalizar' ? (
            <>
              <p className="text-sm text-muted-foreground">
                Las publicaciones que hay que finalizar en el canal y todavía no se pudo, por ejemplo porque están en revisión. La app lo reintenta cada hora
                y las saca de acá cuando lo logra.
              </p>
              {toClose.length > 0 ? (
                <ul className="divide-y rounded-2xl border bg-card shadow-card">
                  {toClose.map((p) => (
                    <li key={p.id} className="space-y-0.5 px-4 py-3 text-sm">
                      <Link href={`/a/${account.slug}/publicaciones/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                        {p.externalId ?? 'Sin código'} · {p.title ?? 'Sin título'}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {CHANNEL_STATUS_LABEL[p.channelStatus]}. {p.closeWantedWhy}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                nothing('No hay publicaciones por finalizar.')
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Lo que mostró la última auditoría: los vehículos que salen de la ficha y faltan en el canal, y los que cargó la tienda y no
                salen de la ficha. Las fichas sin compatibilidades no aparecen: sin datos no se puede corregir.
              </p>
              {compatibilities.length > 0 ? (
                <CompatibilityPushList accountSlug={account.slug} rows={compatibilities} />
              ) : (
                nothing('No hay compatibilidades para subir.')
              )}
            </>
          )
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
            <PipelineBoard
              accountSlug={account.slug}
              items={items}
              showStore={stores.length > 1}
              openTasks={tasks}
              notes={notes}
              categoryAlerts={Object.fromEntries([...alerts].map(([id, a]) => [id, a.text]))}
            />
          </>
        )}
      </PageBody>
    </>
  );
}
