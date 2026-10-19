import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImportWizard } from '@/components/import/ImportWizard';
import { UndoImportButton } from '@/components/import/UndoImportButton';
import { ImportStatusBadge } from '@/components/stages/StageBadge';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { formatDateTime, plural } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  return { title: account ? `Importar · ${account.name}` : 'Importar' };
}

function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(new Date());
}

export default async function ImportPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  if (!account) notFound();

  const [stores, mappings, runs] = await Promise.all([
    prisma.store.findMany({ where: { accountId: account.id }, orderBy: { name: 'asc' }, include: { channel: true } }),
    prisma.importMapping.findMany({ where: { accountId: account.id }, orderBy: { updatedAt: 'desc' } }),
    prisma.importRun.findMany({
      where: { accountId: account.id },
      orderBy: { startedAt: 'desc' },
      take: 20,
      include: { user: { select: { name: true } }, store: { select: { name: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader className="max-w-5xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Importar</h1>
          <p className="text-sm text-muted-foreground">
            Cargá publicaciones de <strong>{account.name}</strong> desde un Excel o un CSV, o completá su contenido con
            la planilla que se descarga desde Publicaciones. El archivo se lee en tu navegador: a la app solo viajan las
            columnas que elegís importar.
          </p>
        </div>
      </PageHeader>
      <PageBody className="max-w-5xl">
        <ImportWizard
          accountSlug={account.slug}
          stores={stores.map((s) => ({ id: s.id, name: s.name, channelKind: s.channel.kind, channelName: s.channel.name }))}
          savedMappings={mappings.map((m) => ({
            id: m.id,
            name: m.name,
            headers: Array.isArray(m.headers) ? (m.headers as string[]) : [],
            fields: m.fields && typeof m.fields === 'object' ? (m.fields as Record<string, string>) : {},
          }))}
          defaultDate={todayIn(account.timezone)}
        />

        <Card>
          <CardHeader>
            <CardTitle>Importaciones anteriores</CardTitle>
            <CardDescription>Si una importación salió mal, la podés deshacer y volver a importar.</CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay importaciones.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {runs.map((run) => (
                  <li key={run.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm truncate">{run.fileName}</span>
                        <ImportStatusBadge status={run.status} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(run.startedAt, account.timezone)} · {run.user?.name ?? '—'} · hoja{' '}
                        {run.sheetName} · {run.store.name}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {plural(run.productsCreated, 'producto nuevo', 'productos nuevos')} ·{' '}
                        {plural(run.publicationsCreated, 'publicación', 'publicaciones')} ·{' '}
                        {plural(run.publicationsExisting, 'ya estaba', 'ya estaban')} ·{' '}
                        {run.fieldsChanged > 0 ? `${plural(run.fieldsChanged, 'campo completado', 'campos completados')} · ` : ''}
                        {plural(run.measurementsSaved, 'medición', 'mediciones')}
                        {run.rowsWithErrors > 0 ? ` · ${plural(run.rowsWithErrors, 'fila con error', 'filas con error')}` : ''}
                      </div>
                      {run.status === 'UNDONE' && run.productsKept > 0 ? (
                        <div className="text-xs text-muted-foreground">
                          {run.productsKept === 1
                            ? 'Al deshacer quedó 1 producto porque tiene publicaciones cargadas después o está en un combo.'
                            : `Al deshacer quedaron ${run.productsKept} productos porque tienen publicaciones cargadas después o están en un combo.`}
                        </div>
                      ) : null}
                    </div>
                    {run.status === 'DONE' || run.status === 'FAILED' || run.status === 'RUNNING' ? (
                      <UndoImportButton
                        accountSlug={account.slug}
                        runId={run.id}
                        productsCreated={run.productsCreated}
                        publicationsCreated={run.publicationsCreated}
                        fieldsChanged={run.fieldsChanged}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
