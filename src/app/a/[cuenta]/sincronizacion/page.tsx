import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { ChoiceList } from '@/components/sync/ChoiceList';
import { SyncNowButton } from '@/components/sync/SyncNowButton';
import { SYNC_CHANGE_LABEL } from '@/domain/channel-sync';
import { fieldLabel } from '@/domain/sync-log';
import { titleOrUntitled } from '@/domain/publication-title';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { formatDateTime, formatDuration, plural } from '@/lib/format';
import { loadSyncOverview, type SyncOverview } from '@/lib/queries/sync';

export const dynamic = 'force-dynamic';
// "Leer ahora" lee por tandas, y cada tanda hace varios pedidos al canal.
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Sincronización · ${account.name}` : 'Sincronización' };
}

type Run = SyncOverview['runs'][number];

function runErrors(run: Run): { at: string; message: string }[] {
  return Array.isArray(run.errors) ? (run.errors as { at: string; message: string }[]) : [];
}

function how(run: Run): string {
  return run.trigger === 'SCHEDULE' ? 'automática' : `pedida por ${run.user?.name ?? 'alguien del equipo'}`;
}

function LastRead({ run, timeZone }: { run: Run | null; timeZone: string }) {
  if (!run) return <p className="text-sm text-muted-foreground">Todavía no se leyó. Tocá Leer ahora para la primera lectura.</p>;
  const errors = runErrors(run);
  if (run.status === 'FAILED') {
    return (
      <p className="text-sm">
        <span className="font-medium text-destructive">La última lectura no terminó</span>, el {formatDateTime(run.startedAt, timeZone)}.{' '}
        {errors.at(-1)?.message}
      </p>
    );
  }
  return (
    <p className="text-sm">
      Última lectura el {formatDateTime(run.finishedAt ?? run.startedAt, timeZone)}, {how(run)}. Leyó{' '}
      {plural(run.read, 'publicación', 'publicaciones')}
      {run.updated > 0 ? ` y trajo cambios en ${run.updated}` : ', sin cambios que traer'}.
    </p>
  );
}

export default async function SyncPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { account } = await requireAccount(cuenta);
  const overview = await loadSyncOverview(account.id);
  const tz = account.timezone;
  const scheduled = Boolean(process.env.CRON_SECRET);
  const channels = [...new Set(overview.stores.map((s) => s.channelName))].join(' y ') || 'los canales';

  return (
    <>
      <PageHeader className="max-w-5xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sincronización</h1>
          <p className="text-sm text-muted-foreground">
            La app lee las publicaciones de <strong>{account.name}</strong> en {channels} cada hora. Si algo cambió allá y en la app no lo tocaste,
            la app lo toma sola. Si cambió en los dos lados, te lo muestra acá para que elijas.
          </p>
        </div>
      </PageHeader>
      <PageBody className="max-w-5xl">
        {!scheduled ? (
          <div className="rounded-lg border border-dashed px-4 py-3 text-sm">
            <p className="font-medium">La lectura automática todavía no está activada.</p>
            <p className="mt-1 text-muted-foreground">
              Falta cargar la clave CRON_SECRET en Vercel y en GitHub. Mientras tanto, podés leer con el botón Leer ahora.
            </p>
          </div>
        ) : null}

        {overview.stores.length === 0 ? (
          <SectionCard title="Sin tiendas conectadas">
            <SectionBody>
              <p className="text-sm text-muted-foreground">
                Para leer las publicaciones del canal, conectá la tienda en{' '}
                <Link href={`/a/${account.slug}/conexion`} className="font-medium text-foreground underline-offset-4 hover:underline">
                  Conexión
                </Link>
                .
              </p>
            </SectionBody>
          </SectionCard>
        ) : null}

        {overview.stores.map((store) => (
          <SectionCard
            key={store.id}
            title={`${store.channelName} · ${store.name}`}
            action={store.connected ? <SyncNowButton accountSlug={account.slug} storeId={store.id} resume={store.running !== null} /> : null}
          >
            <SectionBody className="space-y-2">
              {!store.connected ? (
                <p className="text-sm">
                  <span className="font-medium text-destructive">No se puede leer:</span> hay que volver a conectar la tienda en{' '}
                  <Link href={`/a/${account.slug}/conexion`} className="font-medium underline-offset-4 hover:underline">
                    Conexión
                  </Link>
                  .
                </p>
              ) : null}
              {store.running ? (
                <p className="text-sm">
                  <span className="font-medium">Leyendo ahora:</span> {store.running.position} de {store.running.total}. Sigue sola aunque cierres la
                  pantalla.
                </p>
              ) : null}
              <LastRead run={store.last} timeZone={tz} />
              {store.last?.newInChannel ? (
                <p className="text-sm">
                  Hay {plural(store.last.newInChannel, 'publicación', 'publicaciones')} en {store.channelName} que no están en la app.{' '}
                  <Link href={`/a/${account.slug}/importar`} className="font-medium underline-offset-4 hover:underline">
                    Traelas desde Importar
                  </Link>
                  .
                </p>
              ) : null}
            </SectionBody>
          </SectionCard>
        ))}

        {overview.copies > 0 ? (
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat value={overview.upToDate} label="Al día" />
            <Stat value={overview.drafts} label="Con borrador" hint="Cambios de la app sin subir" />
            <Stat value={overview.toChoose.length} label="Para elegir" alert={overview.toChoose.length > 0} />
          </div>
        ) : null}

        <SectionCard
          title="Para elegir"
          count={overview.toChoose.length}
          description="El mismo dato es distinto en la app y en el canal. La app no pisa ninguno de los dos hasta que elijas."
        >
          {overview.toChoose.length > 0 ? (
            <ChoiceList accountSlug={account.slug} rows={overview.toChoose} />
          ) : (
            <SectionBody>
              <p className="text-sm text-muted-foreground">No hay nada para elegir.</p>
            </SectionBody>
          )}
        </SectionCard>

        <SectionCard
          title="Lo que cambió por la sincronización"
          description="Los datos que llegaron del canal, lo que se subió y lo que se eligió, lo más nuevo primero."
          action={
            <Link href={`/a/${account.slug}/registro`} className="text-xs font-medium underline-offset-4 hover:underline">
              Ver todo en el Registro
            </Link>
          }
        >
          {overview.changes.length > 0 ? (
            <ul className="divide-y text-sm">
              {overview.changes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2.5">
                  <span className="tabular-nums text-xs text-muted-foreground">{formatDateTime(c.createdAt, tz)}</span>
                  <span className="font-medium">{titleOrUntitled(c.publication.title)}</span>
                  <span className="text-xs text-muted-foreground">{c.publication.externalId}</span>
                  <span className="basis-full text-muted-foreground sm:basis-auto sm:ml-auto">
                    {fieldLabel(c.field)}: {SYNC_CHANGE_LABEL[c.kind]}
                    {c.user ? `, ${c.user.name}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <SectionBody>
              <p className="text-sm text-muted-foreground">Todavía no cambió nada.</p>
            </SectionBody>
          )}
        </SectionCard>

        {overview.runs.length > 0 ? (
          <SectionCard title="Últimas lecturas">
            <ul className="divide-y text-sm">
              {overview.runs.map((run) => {
                const errors = runErrors(run);
                return (
                  <li key={run.id} className="space-y-1 px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="tabular-nums">{formatDateTime(run.startedAt, tz)}</span>
                      <span className="text-muted-foreground">
                        {run.store.name}, {how(run)}
                      </span>
                      <Badge variant={run.status === 'FAILED' ? 'destructive' : 'secondary'} className="ml-auto">
                        {run.status === 'RUNNING' ? 'En curso' : run.status === 'DONE' ? 'Terminó' : 'No terminó'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leyó {run.read} de {run.total}
                      {run.updated > 0 ? `, con cambios en ${run.updated}` : ''}
                      {run.finishedAt ? `, en ${formatDuration(run.startedAt, run.finishedAt)}` : ''}.
                    </p>
                    {errors.length > 0 ? (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">{plural(errors.length, 'aviso', 'avisos')}</summary>
                        <ul className="mt-1 space-y-0.5">
                          {errors.slice(-10).map((e, i) => (
                            <li key={i}>{e.message}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        ) : null}
      </PageBody>
    </>
  );
}

function Stat({ value, label, hint, alert = false }: { value: number; label: string; hint?: string; alert?: boolean }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-3">
      <p className={`text-2xl font-semibold tabular-nums ${alert ? 'text-destructive' : ''}`}>{value}</p>
      <p className="text-xs font-medium">{label}</p>
      {hint ? <p className="hidden text-[11px] text-muted-foreground sm:block">{hint}</p> : null}
    </div>
  );
}
