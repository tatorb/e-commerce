import Link from 'next/link';
import { AlertTriangle, BellRing, ExternalLink, ListTodo } from 'lucide-react';
import { CopyButton } from '@/components/apply/CopyButton';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card } from '@/components/ui/card';
import { TabLinks } from '@/components/ui/tab-links';
import { can } from '@/domain/access';
import { owed, owedText, SHOWN_WHEN_SHORT } from '@/domain/stock-cushion';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { formatDateTime, formatDuration, plural } from '@/lib/format';
import { ALARM_FILTERS, alarmFilterOf, groupStockAlarms, loadStockAlarms, orderItems, orderSummaryText, parseAlarmFilter, type AlarmMeasure, type AlarmProduct } from '@/lib/stock-alarms';
import { stockTaskSettings } from '@/lib/stock-task-recipients';
import { StockTaskRecipients } from '@/components/tasks/StockTaskRecipients';
import { cn } from '@/lib/utils/cn';

// Alarmas de stock: las medidas que muestran más stock del que hay, con
// "Mostrar más de 5" en su producto, agrupadas por producto y con las
// publicaciones que las venden. De entrada, las que se quedaron sin stock y
// hay que reponer; también las que tienen 1 o 2, y todas. Arriba, a quién le
// llegan las tareas de stock; abajo, en todas las pestañas, el resumen de
// pedido para copiar y pegar.

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
  const [rows, recipients] = await Promise.all([loadStockAlarms(prisma, account.id), stockTaskSettings(prisma, account.id)]);
  const groups = groupStockAlarms(rows);
  const shown = groups
    .map((g) => ({ ...g, measures: g.measures.filter((m) => alarmFilterOf(m, filter)) }))
    .filter((g) => g.measures.length > 0);
  const counts = Object.fromEntries(ALARM_FILTERS.map((f) => [f.key, groups.reduce((n, g) => n + g.measures.filter((m) => alarmFilterOf(m, f.key)).length, 0)]));
  const measureCount = shown.reduce((n, g) => n + g.measures.length, 0);
  const canProducts = can(user.access, 'productos', 'read');
  const canPublications = can(user.access, 'publicaciones', 'read');
  const summary = orderSummaryText(orderItems(rows));
  const now = new Date();

  return (
    <>
      <PageHeader>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Alarmas de stock</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Las medidas que muestran más stock del que hay en <strong>{account.name}</strong>, por producto, con las publicaciones que las venden. Con «Mostrar más
            de 5» prendido en un producto, los canales muestran {SHOWN_WHEN_SHORT} con 5 o menos, también en 0: la publicación nunca se pausa sola. Cuando una venta
            deja 1 o 0 sale la alarma y una tarea para reponer, y al día sin reponer otro aviso. Si hay que pausar, se pausa a mano. Al cargar el stock en el
            producto, la tarea se finaliza sola.
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
        <StockTaskRecipients
          accountSlug={account.slug}
          candidates={recipients.candidates}
          everyAdmin={recipients.everyAdmin}
          canEdit={can(user.access, 'tareas', 'write')}
        />
        {shown.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            {filter === 'sin-stock'
              ? 'Ninguna medida se quedó sin stock mostrando más de 5.'
              : filter === 'todas'
                ? 'Ninguna medida muestra más stock del que hay. «Mostrar más de 5» se prende en la pestaña Costo y Stock de cada producto.'
                : `Ninguna medida con ${filter === 'queda-1' ? '1 unidad' : '2 unidades'} muestra más de 5.`}
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {plural(measureCount, 'medida', 'medidas')} en {plural(shown.length, 'producto', 'productos')}.
            </p>
            {shown.map((g) => (
              <ProductAlarms
                key={g.productId}
                group={g}
                accountSlug={account.slug}
                timeZone={account.timezone}
                now={now}
                canProducts={canProducts}
                canPublications={canPublications}
              />
            ))}
          </>
        )}
        <OrderSummary text={summary} />
      </PageBody>
    </>
  );
}

type Shared = { accountSlug: string; timeZone: string; now: Date; canProducts: boolean; canPublications: boolean };

/** Un producto con sus medidas en alarma. */
function ProductAlarms({ group: g, accountSlug, canProducts, ...rest }: Shared & { group: AlarmProduct }) {
  const stockHref = `/a/${accountSlug}/productos/${g.productId}?seccion=stock`;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/50 px-4 py-3">
        <h2 className="font-semibold">
          {canProducts ? (
            <Link href={stockHref} className="underline-offset-4 hover:underline">
              {g.productName}
            </Link>
          ) : (
            g.productName
          )}
        </h2>
        <span className="text-xs text-muted-foreground">{plural(g.measures.length, 'medida', 'medidas')}</span>
      </div>
      <div className="divide-y">
        {g.measures.map((m) => (
          <MeasureAlarm key={m.stockKey} measure={m} accountSlug={accountSlug} canProducts={canProducts} {...rest} />
        ))}
      </div>
    </Card>
  );
}

/** El pedido para copiar y pegar: un SKU por línea, de lo que se quedó sin stock y sigue activo en Mercado Libre. */
function OrderSummary({ text }: { text: string }) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-base font-semibold">Resumen de pedido</h2>
          <p className="text-sm text-muted-foreground">Los productos sin stock con alguna publicación activa en Mercado Libre, un SKU por línea, para copiar y pegar.</p>
        </div>
        {text ? <CopyButton value={text} label="el resumen de pedido" /> : null}
      </div>
      {text ? (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-sans text-sm">{text}</pre>
      ) : (
        <p className="text-sm text-muted-foreground">Ningún producto sin stock tiene publicaciones activas en Mercado Libre: no hay nada para pedir.</p>
      )}
    </Card>
  );
}

/** Una medida: su SKU, cuánto hay, desde cuándo falta, su tarea y las publicaciones que la venden. */
function MeasureAlarm({ measure: m, accountSlug, timeZone, now, canPublications }: Shared & { measure: AlarmMeasure }) {
  const missing = owed(m.real);
  const when = (d: Date) => formatDateTime(d, timeZone);
  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex flex-wrap items-baseline gap-x-2 font-medium">
            {m.measure && m.measure !== m.sku ? <span>Medida {m.measure}</span> : null}
            <span className={m.measure && m.measure !== m.sku ? 'text-sm font-normal text-muted-foreground' : undefined}>SKU {m.sku ?? 'sin cargar en la ficha'}</span>
          </p>
          <Situation measure={m} when={when} now={now} />
        </div>
        <div className="flex shrink-0 flex-col gap-1 sm:items-end sm:text-right">
          <p className={cn('text-lg font-semibold tabular-nums', m.real <= 0 ? 'text-destructive' : 'text-foreground')}>Hay {Math.max(m.real, 0)}</p>
          {missing > 0 ? <p className="text-xs font-medium text-destructive">{owedText(missing)}</p> : null}
          {m.taskId ? (
            <Link href={`/a/${accountSlug}/tareas/${m.taskId}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline">
              <ListTodo className="h-3.5 w-3.5" aria-hidden />
              Ver la tarea
            </Link>
          ) : null}
        </div>
      </div>
      <ul className="space-y-1.5 rounded-lg border bg-muted/30 p-2.5 text-sm">
        {m.listings.map((r) => (
          <li key={r.publicationId} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {canPublications ? (
              <Link href={`/a/${accountSlug}/publicaciones/${r.publicationId}`} className="min-w-0 truncate underline-offset-4 hover:underline">
                {r.title}
              </Link>
            ) : (
              <span className="min-w-0 truncate">{r.title}</span>
            )}
            <span className="tabular-nums text-muted-foreground">{r.externalId ?? 'Sin publicar'}</span>
            <span className="text-muted-foreground">· {r.storeName}</span>
            {r.url ? (
              <a href={r.url} target="_blank" rel="noreferrer" aria-label={`Ver en ${r.channelName}`} className="text-primary">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              se ve {r.shown}
              {r.inChannel !== null && r.inChannel !== r.shown ? ` · en ${r.channelName} hoy ${r.inChannel}, se sube ${r.shown}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cómo está, en palabras: desde cuándo falta y si salió el aviso del día. */
function Situation({ measure: r, when, now }: { measure: AlarmMeasure; when: (d: Date) => string; now: Date }) {
  const line = 'flex items-start gap-1.5 text-sm';
  if (r.outSince) {
    return (
      <div className="space-y-0.5">
        <p className={cn(line, 'text-destructive')}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Sin stock hace {formatDuration(r.outSince, now)}, desde el {when(r.outSince)}.
        </p>
        <p className="pl-5 text-xs text-muted-foreground">
          {r.remindedAt ? 'Ya salió el aviso del primer día. ' : r.remindAt ? `Otro aviso el ${when(r.remindAt)}. ` : ''}
          {`En los canales se sigue viendo ${SHOWN_WHEN_SHORT}.`}
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
  return <p className="text-sm text-muted-foreground">Se muestra más de lo que hay: {plural(r.real, 'unidad', 'unidades')}.</p>;
}
