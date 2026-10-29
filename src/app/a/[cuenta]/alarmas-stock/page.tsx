import Link from 'next/link';
import { AlertTriangle, BellRing, ExternalLink, ListTodo, PauseCircle } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card } from '@/components/ui/card';
import { TabLinks } from '@/components/ui/tab-links';
import { can } from '@/domain/access';
import { owed, owedText, SELL_WITHOUT_STOCK, SHOWN_WHEN_SHORT } from '@/domain/stock-cushion';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { formatDateTime, formatDuration, plural } from '@/lib/format';
import { ALARM_FILTERS, alarmFilterOf, loadStockAlarms, parseAlarmFilter, type AlarmRow } from '@/lib/stock-alarms';
import { cn } from '@/lib/utils/cn';

// Alarmas de stock: las publicaciones que muestran más stock del que hay, con
// "Mostrar más de 5" en su producto. De entrada, las que se quedaron sin stock
// y hay que reponer; también las que tienen 1 o 2, y todas.

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Alarmas de stock · ${account.name}` : 'Alarmas de stock' };
}

export default async function StockAlarmsPage({ params, searchParams }: { params: Promise<{ cuenta: string }>; searchParams: Promise<{ ver?: string }> }) {
  const [{ cuenta }, search] = await Promise.all([params, searchParams]);
  const { user, account } = await requireAccount(cuenta, 'alarmas');
  const filter = parseAlarmFilter(search.ver);
  const rows = await loadStockAlarms(prisma, account.id);
  const shown = rows.filter((r) => alarmFilterOf(r, filter));
  const counts = Object.fromEntries(ALARM_FILTERS.map((f) => [f.key, rows.filter((r) => alarmFilterOf(r, f.key)).length]));
  const canProducts = can(user.access, 'productos', 'read');
  const canPublications = can(user.access, 'publicaciones', 'read');
  const now = new Date();

  return (
    <>
      <PageHeader>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Alarmas de stock</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Las publicaciones que muestran más stock del que hay en <strong>{account.name}</strong>. Con «Mostrar más de 5» prendido en un producto, los canales
            muestran {SHOWN_WHEN_SHORT} aunque haya de 1 a 5, y se pueden vender {SELL_WITHOUT_STOCK} sin tenerlas. Al día sin reponer sale otro aviso y a los dos
            días la publicación se pausa. Se resuelve cargando el stock en el producto.
          </p>
        </div>
        <TabLinks
          label="Qué alarmas"
          items={ALARM_FILTERS.map((f) => ({
            key: f.key,
            href: f.key === 'sin-stock' ? '?' : `?ver=${f.key}`,
            label: f.label,
            active: f.key === filter,
            count: counts[f.key],
          }))}
        />
      </PageHeader>
      <PageBody>
        {shown.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            {filter === 'sin-stock'
              ? 'Ninguna publicación se quedó sin stock mostrando más de 5.'
              : filter === 'todas'
                ? 'Ninguna publicación muestra más stock del que hay. «Mostrar más de 5» se prende en la pestaña Stock de cada producto.'
                : `Ninguna publicación con ${filter === 'queda-1' ? '1 unidad' : '2 unidades'} muestra más de 5.`}
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{plural(shown.length, 'publicación', 'publicaciones')}.</p>
            <Card className="divide-y">
              {shown.map((r) => (
                <AlarmLine
                  key={`${r.publicationId}:${r.measure ?? ''}`}
                  row={r}
                  accountSlug={account.slug}
                  timeZone={account.timezone}
                  now={now}
                  canProducts={canProducts}
                  canPublications={canPublications}
                />
              ))}
            </Card>
          </>
        )}
      </PageBody>
    </>
  );
}

function AlarmLine({
  row: r,
  accountSlug,
  timeZone,
  now,
  canProducts,
  canPublications,
}: {
  row: AlarmRow;
  accountSlug: string;
  timeZone: string;
  now: Date;
  canProducts: boolean;
  canPublications: boolean;
}) {
  const missing = owed(r.real);
  const when = (d: Date) => formatDateTime(d, timeZone);
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">
          {canProducts ? (
            <Link href={`/a/${accountSlug}/productos/${r.productId}?seccion=stock`} className="underline-offset-4 hover:underline">
              {r.productName}
            </Link>
          ) : (
            r.productName
          )}
          {r.measure ? <span className="text-muted-foreground"> · medida {r.measure}</span> : null}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          {canPublications ? (
            <Link href={`/a/${accountSlug}/publicaciones/${r.publicationId}`} className="underline-offset-4 hover:underline">
              {r.title}
            </Link>
          ) : (
            <span>{r.title}</span>
          )}
          <span className="tabular-nums">{r.externalId ?? 'Sin publicar'}</span>
          <span>· {r.storeName}</span>
          {r.url ? (
            <a href={r.url} target="_blank" rel="noreferrer" aria-label={`Ver en ${r.channelName}`} className="text-primary">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </p>
        <Situation row={r} when={when} now={now} />
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 sm:items-end sm:text-right">
        <p className="text-sm">
          <span className={cn('text-lg font-semibold tabular-nums', r.real <= 0 ? 'text-destructive' : 'text-foreground')}>Hay {Math.max(r.real, 0)}</span>
          <span className="text-muted-foreground"> · se ve {r.shown}</span>
        </p>
        {r.inChannel !== null && r.inChannel !== r.shown ? (
          <p className="text-xs text-muted-foreground">
            En {r.channelName} hoy: {r.inChannel}. Se sube {r.shown}.
          </p>
        ) : null}
        {missing > 0 ? <p className="text-xs font-medium text-destructive">{owedText(missing)}</p> : null}
        {r.taskId ? (
          <Link href={`/a/${accountSlug}/tareas/${r.taskId}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline">
            <ListTodo className="h-3.5 w-3.5" aria-hidden />
            Ver la tarea
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Cómo está, en palabras: desde cuándo falta, si salió el aviso del día y cuándo se pausa. */
function Situation({ row: r, when, now }: { row: AlarmRow; when: (d: Date) => string; now: Date }) {
  const line = 'flex items-start gap-1.5 text-sm';
  if (r.cutAt) {
    return (
      <p className={cn(line, 'text-destructive')}>
        <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Pausada el {when(r.cutAt)}: pasaron dos días sin reponer. Vuelve a mostrar {SHOWN_WHEN_SHORT} al cargar el stock.
      </p>
    );
  }
  if (r.outSince && r.real <= -SELL_WITHOUT_STOCK) {
    return (
      <p className={cn(line, 'text-destructive')}>
        <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Ya se vendieron {SELL_WITHOUT_STOCK} sin tener: se pausó hasta cargar el stock.
      </p>
    );
  }
  if (r.outSince) {
    return (
      <div className="space-y-0.5">
        <p className={cn(line, 'text-destructive')}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Sin stock hace {formatDuration(r.outSince, now)}, desde el {when(r.outSince)}.
        </p>
        <p className="pl-5 text-xs text-muted-foreground">
          {r.remindedAt ? `Ya salió el aviso del primer día. ` : r.remindAt ? `Otro aviso el ${when(r.remindAt)}. ` : ''}
          {r.pauseAt ? `Se pausa el ${when(r.pauseAt)}.` : ''}
        </p>
      </div>
    );
  }
  if (r.real === 1) {
    return (
      <p className={cn(line, 'text-amber-700 dark:text-amber-400')}>
        <BellRing className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Queda la última. Si se vende, salta la alarma para reponer.
      </p>
    );
  }
  return <p className="text-sm text-muted-foreground">Se muestra {r.shown} con {plural(r.real, 'unidad', 'unidades')}.</p>;
}
