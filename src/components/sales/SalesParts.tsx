import Link from 'next/link';
import { AlertTriangle, Clock, ExternalLink, MessageSquareWarning, Truck } from 'lucide-react';
import type * as React from 'react';
import { TabLinks } from '@/components/ui/tab-links';
import { formatPrice } from '@/domain/money';
import { dayText, dispatchUrgency, PERIODS, SALE_STATE_LABEL, SHIP_STATE_LABEL, skusText, type Period } from '@/domain/sales';
import { formatDateTime, plural } from '@/lib/format';
import type { ReaderStatus, SaleRow } from '@/lib/sales/queries';
import { cn } from '@/lib/utils/cn';
import { ReadSalesNow } from './ReadSalesNow';

// Las piezas de las pantallas de Ventas: el encabezado con sus pestañas, el
// período, cómo va la lectura, una fila de venta y los importes.

export function SalesHeader({
  accountSlug,
  accountName,
  active,
  counts,
  children,
}: {
  accountSlug: string;
  accountName: string;
  active: 'ventas' | 'caja' | 'envios';
  counts?: { envios?: number };
  children?: React.ReactNode;
}) {
  const base = `/a/${accountSlug}/ventas`;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Ventas</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Las ventas de <strong>{accountName}</strong> en sus canales: lo que pagó el comprador, lo que se llevó el canal, lo que queda y cuándo se cobra, y los envíos.
          </p>
        </div>
        <ReadSalesNow accountSlug={accountSlug} />
      </div>
      {children}
      <TabLinks
        label="Qué ver"
        items={[
          { key: 'ventas', href: base, label: 'Ventas', active: active === 'ventas' },
          { key: 'caja', href: `${base}/caja`, label: 'Caja', active: active === 'caja' },
          { key: 'envios', href: `${base}/envios`, label: 'Envíos', active: active === 'envios', count: counts?.envios },
        ]}
      />
    </>
  );
}

/** Los atajos del período y el formulario para elegir fechas. Conserva los demás filtros. */
export function PeriodPicker({ period, keep }: { period: Period; keep: Record<string, string | undefined> }) {
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : '?';
  };
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={qs({ periodo: p.key })}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              period.key === p.key ? 'border-foreground bg-foreground text-background' : 'bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form className="flex flex-wrap items-center gap-2 text-xs">
        {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <label className="flex items-center gap-1 text-muted-foreground">
          Desde
          <input type="date" name="desde" defaultValue={period.fromDay} className="h-8 rounded-md border bg-background px-2 text-foreground" />
        </label>
        <label className="flex items-center gap-1 text-muted-foreground">
          Hasta
          <input type="date" name="hasta" defaultValue={period.toDay} className="h-8 rounded-md border bg-background px-2 text-foreground" />
        </label>
        <button type="submit" className="h-8 rounded-md border bg-background px-3 font-medium hover:bg-muted">
          Ver
        </button>
      </form>
    </div>
  );
}

/** Cómo va la lectura: el historial, las que faltan completar y los errores. */
export function ReaderNotice({ status, timeZone }: { status: ReaderStatus[]; timeZone: string }) {
  if (status.length === 0) {
    return <p className="rounded-xl border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">La cuenta no tiene tiendas en un canal que deje leer las ventas.</p>;
  }
  return (
    <div className="space-y-1.5">
      {status.map((s) => {
        const lines: React.ReactNode[] = [];
        if (!s.connected) lines.push(<span key="c">La tienda no está conectada con {s.channelName}: conectala en Conexión para traer sus ventas.</span>);
        else if (!s.readAt) lines.push(<span key="n">Todavía no se leyeron las ventas. Tocá «Traer ventas ahora» o esperá la lectura de cada hora.</span>);
        else {
          if (s.history && !s.history.done)
            lines.push(
              <span key="h">
                Trayendo las ventas de los últimos 12 meses: va por el {s.history.pct} %{s.history.cursor ? `, ya llegó al ${dayText(s.history.cursor.toISOString().slice(0, 10))}` : ''}.
              </span>,
            );
          if (s.incomplete > 0) lines.push(<span key="i">Falta leer el envío y el pago de {plural(s.incomplete, 'venta', 'ventas')}.</span>);
        }
        if (s.lastError) lines.push(<span key="e" className="text-destructive">{s.lastError}</span>);
        if (lines.length === 0) return null;
        return (
          <p key={s.storeId} className="flex flex-wrap items-start gap-x-2 gap-y-0.5 rounded-xl border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
            <strong className="font-medium text-foreground">{s.storeName}</strong>
            {lines}
            {s.readAt ? <span className="text-xs">Última lectura: {formatDateTime(s.readAt, timeZone)}.</span> : null}
          </p>
        );
      })}
    </div>
  );
}

export const money = (n: number | null | undefined, currency = 'ARS') => formatPrice(n ?? null, currency);

/** Un importe con su nombre, para los resúmenes. */
export function Figure({ label, value, hint, tone, big }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'good' | 'bad' | 'muted'; big?: boolean }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'font-semibold tabular-nums',
          big ? 'text-2xl' : 'text-lg',
          tone === 'good' && 'text-emerald-700 dark:text-emerald-400',
          tone === 'bad' && 'text-destructive',
          tone === 'muted' && 'text-muted-foreground',
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** El estado de la venta y del envío, en palabras y con color. */
export function SaleBadges({ row, timeZone, now }: { row: SaleRow; timeZone: string; now: Date }) {
  const chip = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium';
  const urgency = row.shipState === 'TO_SHIP' && row.shipKind !== 'channel' ? dispatchUrgency(row.dispatchBy, now, timeZone) : null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {row.state !== 'PAID' ? (
        <span className={cn(chip, row.state === 'CANCELLED' ? 'bg-muted text-muted-foreground line-through' : 'bg-amber-100 text-amber-900')}>{SALE_STATE_LABEL[row.state]}</span>
      ) : null}
      {row.claim ? (
        <span className={cn(chip, 'bg-red-100 text-red-800')}>
          <MessageSquareWarning className="h-3 w-3" aria-hidden />
          Reclamo
        </span>
      ) : null}
      {row.state !== 'CANCELLED' && row.shipState !== 'NONE' ? (
        <span
          className={cn(
            chip,
            row.shipState === 'DELIVERED' && 'bg-emerald-100 text-emerald-800',
            row.shipState === 'SHIPPED' && 'bg-sky-100 text-sky-900',
            row.shipState === 'TO_SHIP' && (urgency === 'late' ? 'bg-red-100 text-red-800' : urgency === 'today' ? 'bg-amber-100 text-amber-900' : 'bg-muted text-foreground'),
            (row.shipState === 'NOT_DELIVERED' || row.shipState === 'RETURNED') && 'bg-red-100 text-red-800',
            (row.shipState === 'PENDING' || row.shipState === 'CANCELLED') && 'bg-muted text-muted-foreground',
          )}
        >
          <Truck className="h-3 w-3" aria-hidden />
          {SHIP_STATE_LABEL[row.shipState]}
          {row.shipKindLabel ? ` · ${row.shipKindLabel}` : ''}
        </span>
      ) : null}
      {row.shipDelayed && (row.shipState === 'TO_SHIP' || row.shipState === 'SHIPPED') ? (
        <span className={cn(chip, 'bg-amber-100 text-amber-900')}>
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Demorado
        </span>
      ) : null}
      {row.incomplete ? (
        <span className={cn(chip, 'bg-muted text-muted-foreground')}>
          <Clock className="h-3 w-3" aria-hidden />
          Falta leer el envío y el pago
        </span>
      ) : null}
    </span>
  );
}

/** Lo que se vendió: el primer producto y cuántos más, con la medida. */
export function linesText(row: SaleRow): string {
  const first = row.lines[0];
  if (!first) return 'Sin productos';
  const name = `${first.quantity > 1 ? `${first.quantity} × ` : ''}${first.title ?? first.listingId}${first.measure ? ` · ${first.measure}` : ''}`;
  return row.lines.length > 1 ? `${name} y ${plural(row.lines.length - 1, 'producto más', 'productos más')}` : name;
}

/** Una venta en una lista: qué, cuándo, de quién, el estado, el total y lo que deja. */
export function SaleLine({ row, accountSlug, timeZone, now, showDeadline }: { row: SaleRow; accountSlug: string; timeZone: string; now: Date; showDeadline?: boolean }) {
  const urgency = dispatchUrgency(row.dispatchBy, now, timeZone);
  return (
    <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">
          <Link href={`/a/${accountSlug}/ventas/${row.id}`} className="underline-offset-4 hover:underline">
            {linesText(row)}
          </Link>
        </p>
        <p className="text-sm text-muted-foreground">{skusText(row.lines)}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span className="tabular-nums">{formatDateTime(row.orderedAt, timeZone)}</span>
          <span>· Venta {row.orderId}</span>
          {row.buyer ? <span>· {row.buyer}</span> : null}
          <span>· {row.storeName}</span>
          {row.url ? (
            <a href={row.url} target="_blank" rel="noreferrer" aria-label={`Ver en ${row.channelName}`} className="text-primary">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </p>
        <SaleBadges row={row} timeZone={timeZone} now={now} />
        {showDeadline && row.dispatchBy ? (
          <p className={cn('text-sm', urgency === 'late' ? 'font-medium text-destructive' : urgency === 'today' ? 'font-medium text-amber-700' : 'text-muted-foreground')}>
            {urgency === 'late' ? 'Venció el plazo para despachar: ' : 'Despachar antes del '}
            {formatDateTime(row.dispatchBy, timeZone)}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-row gap-4 sm:flex-col sm:items-end sm:gap-0.5 sm:text-right">
        <p className={cn('text-lg font-semibold tabular-nums', row.state === 'CANCELLED' && 'text-muted-foreground line-through')}>{money(row.money.cancelled ? Number(row.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)) : row.money.sold, row.currency)}</p>
        {!row.money.cancelled ? (
          <p className="text-xs text-muted-foreground">
            Queda {money(row.money.net, row.currency)}
            {row.money.profit !== null ? (
              <>
                {' · '}
                <span className={cn('font-medium', row.money.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>gana {money(row.money.profit, row.currency)}</span>
              </>
            ) : (
              ' · sin costo cargado'
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}
