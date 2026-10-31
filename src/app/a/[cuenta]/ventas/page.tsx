import Link from 'next/link';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card } from '@/components/ui/card';
import { Figure, money, PeriodPicker, ReaderNotice, SaleLine, SalesHeader } from '@/components/sales/SalesParts';
import { parsePeriod } from '@/domain/sales';
import { formatPercent } from '@/domain/money';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { plural } from '@/lib/format';
import { dispatchDueCount, listSales, parseSaleFilter, parseShipFilter, readerStatus, SALE_FILTERS, SHIP_FILTERS } from '@/lib/sales/queries';
import { cn } from '@/lib/utils/cn';

// Ventas: la lista de las ventas de la cuenta en un período, con filtros por
// estado y envío y un buscador, y arriba lo que suman.

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Ventas · ${account.name}` : 'Ventas' };
}

type Search = { periodo?: string; desde?: string; hasta?: string; estado?: string; envio?: string; q?: string; pagina?: string };

export default async function SalesPage({ params, searchParams }: { params: Promise<{ cuenta: string }>; searchParams: Promise<Search> }) {
  const [{ cuenta }, search] = await Promise.all([params, searchParams]);
  const { account } = await requireAccount(cuenta, 'ventas');
  const now = new Date();
  const tz = account.timezone;
  const period = parsePeriod(search, now, tz);
  const state = parseSaleFilter(search.estado);
  const ship = parseShipFilter(search.envio);
  const q = (search.q ?? '').slice(0, 100);
  const page = Math.max(1, Number(search.pagina) || 1);
  const [list, status, due] = await Promise.all([
    listSales(prisma, account.id, { period, state, ship, q, page }),
    readerStatus(prisma, account.id),
    dispatchDueCount(prisma, account.id, now, tz),
  ]);
  const s = list.summary;
  const keepPeriod = { periodo: period.key === 'fechas' ? undefined : period.key, desde: period.key === 'fechas' ? period.fromDay : undefined, hasta: period.key === 'fechas' ? period.toDay : undefined };
  const keep = { ...keepPeriod, estado: state === 'todas' ? undefined : state, envio: ship === 'todos' ? undefined : ship, q: q || undefined };
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, ...extra })) if (v) p.set(k, v);
    const str = p.toString();
    return str ? `?${str}` : '?';
  };

  return (
    <>
      <PageHeader>
        <SalesHeader accountSlug={account.slug} accountName={account.name} active="ventas" counts={{ envios: due }} />
      </PageHeader>
      <PageBody>
        <ReaderNotice status={status} timeZone={tz} />
        <PeriodPicker period={period} keep={{ estado: keep.estado, envio: keep.envio, q: keep.q }} />

        <Card className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 xl:grid-cols-6">
          <Figure label={`Vendido · ${period.label.toLowerCase()}`} value={money(s.sold)} hint={`${plural(s.count, 'venta pagada', 'ventas pagadas')}, ${plural(s.units, 'unidad', 'unidades')}`} big />
          <Figure label="Comisión del canal" value={money(-s.fee)} tone="muted" hint="Con el costo de las cuotas" />
          <Figure label="Envíos a cargo" value={money(-s.shipping)} tone="muted" hint={s.shippingUnknown ? `Falta el costo de ${plural(s.shippingUnknown, 'envío', 'envíos')}` : undefined} />
          <Figure label="Queda después del canal" value={money(s.net)} />
          <Figure
            label="Ganancia"
            value={s.withCost.count > 0 ? money(s.withCost.profit) : '—'}
            tone={s.withCost.profit >= 0 ? 'good' : 'bad'}
            hint={
              s.withCost.count > 0
                ? `${s.withCost.marginPct !== null ? `${formatPercent(s.withCost.marginPct)} sobre el costo` : ''}${s.withoutCost > 0 ? `. ${plural(s.withoutCost, 'venta', 'ventas')} sin costo cargado` : ''}`
                : 'Cargá el costo de reposición en cada producto'
            }
          />
          <Figure
            label="Canceladas"
            value={plural(s.cancelled.count, 'venta', 'ventas')}
            tone="muted"
            hint={s.claims > 0 ? `${plural(s.claims, 'reclamo', 'reclamos')} en el período` : s.pending.count > 0 ? `${plural(s.pending.count, 'sin pagar', 'sin pagar')}` : undefined}
          />
        </Card>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {SALE_FILTERS.map((f) => (
              <Link
                key={f.key}
                href={href({ estado: f.key === 'todas' ? undefined : f.key, pagina: undefined })}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium',
                  state === f.key ? 'border-foreground bg-foreground text-background' : 'bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <form className="flex flex-wrap items-center gap-2">
            {Object.entries(keepPeriod).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            {keep.estado ? <input type="hidden" name="estado" value={keep.estado} /> : null}
            <select name="envio" defaultValue={ship} aria-label="Envío" className="h-9 rounded-md border bg-background px-2 text-sm">
              {SHIP_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <label className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                name="q"
                defaultValue={q}
                placeholder="Venta, comprador, SKU, código o producto"
                aria-label="Buscar"
                className="h-9 w-72 max-w-full rounded-md border bg-background pl-8 pr-2 text-sm"
              />
            </label>
            <button type="submit" className="h-9 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted">
              Buscar
            </button>
          </form>
        </div>

        {list.rows.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            {q ? `Ninguna venta coincide con «${q}» en ${period.label.toLowerCase()}.` : `No hay ventas en ${period.label.toLowerCase()} con estos filtros.`}
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {plural(list.total, 'venta', 'ventas')}
              {list.pages > 1 ? `, página ${list.page} de ${list.pages}` : ''}.
            </p>
            <Card className="divide-y">
              {list.rows.map((r) => (
                <SaleLine key={r.id} row={r} accountSlug={account.slug} timeZone={tz} now={now} />
              ))}
            </Card>
            {list.pages > 1 ? (
              <nav className="flex items-center justify-between text-sm" aria-label="Páginas">
                {list.page > 1 ? (
                  <Link href={href({ pagina: String(list.page - 1) })} className="font-medium text-primary underline-offset-4 hover:underline">
                    Anteriores
                  </Link>
                ) : (
                  <span />
                )}
                {list.page < list.pages ? (
                  <Link href={href({ pagina: String(list.page + 1) })} className="font-medium text-primary underline-offset-4 hover:underline">
                    Más ventas
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
        <p className="text-xs text-muted-foreground">
          La ganancia resta lo que se llevó el canal, el IVA y los impuestos estimados con los parámetros de Ajustes, Precios, el embalaje y el costo de reposición de cada producto.
        </p>
      </PageBody>
    </>
  );
}
