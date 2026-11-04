import Link from 'next/link';
import { Banknote, CalendarClock, LineChart, Package, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { Figure, money, PeriodPicker, ReaderNotice, SalesHeader } from '@/components/sales/SalesParts';
import { dayText, parsePeriod } from '@/domain/sales';
import { formatPercent } from '@/domain/money';
import { can } from '@/domain/access';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { plural } from '@/lib/format';
import { cashPage, dispatchDueCount, readerStatus } from '@/lib/sales/queries';
import { cn } from '@/lib/utils/cn';

// Caja: lo que dejaron las ventas del período, con lo que se llevó el canal y
// la ganancia; la plata liberada en el período y la que falta liberar, día por
// día; y lo que dejó cada producto.

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Caja · ${account.name}` : 'Caja' };
}

type Search = { periodo?: string; desde?: string; hasta?: string };

export default async function CashPage({ params, searchParams }: { params: Promise<{ cuenta: string }>; searchParams: Promise<Search> }) {
  const [{ cuenta }, search] = await Promise.all([params, searchParams]);
  const { user, account } = await requireAccount(cuenta, 'ventas');
  const now = new Date();
  const tz = account.timezone;
  const period = parsePeriod(search, now, tz, 'mes');
  const [data, status, due] = await Promise.all([cashPage(prisma, account.id, period, now, tz), readerStatus(prisma, account.id), dispatchDueCount(prisma, account.id, now, tz)]);
  const s = data.summary;
  const canProducts = can(user.access, 'productos', 'read');
  const maxDay = Math.max(1, ...data.days.map((d) => d.sold));
  const label = period.label.toLowerCase();

  const rows: { label: string; value: number; hint?: string; strong?: boolean; tone?: 'good' | 'bad' }[] = [
    { label: 'Vendido', value: s.sold, hint: `${plural(s.count, 'venta', 'ventas')}, ${plural(s.units, 'unidad', 'unidades')}`, strong: true },
    ...(s.discount > 0 ? [{ label: 'Descuentos dados sobre el precio publicado', value: -s.discount, hint: 'Ya están restados de lo vendido' }] : []),
    { label: 'Comisión del canal y cuotas', value: -s.fee },
    { label: 'Envíos a cargo de la tienda', value: -s.shipping, hint: s.shippingUnknown ? `Todavía falta el costo de ${plural(s.shippingUnknown, 'envío', 'envíos')}` : undefined },
    { label: 'Queda después del canal', value: s.net, strong: true },
    { label: 'IVA, estimado', value: -s.vat },
    { label: 'Impuestos, estimados', value: -s.taxes, hint: 'Ingresos brutos, débitos y créditos, con el % de Ajustes, Precios' },
    ...(s.packaging > 0 ? [{ label: 'Embalaje y preparación', value: -s.packaging }] : []),
  ];

  return (
    <>
      <PageHeader>
        <SalesHeader accountSlug={account.slug} accountName={account.name} active="caja" counts={{ envios: due }} />
      </PageHeader>
      <PageBody>
        <ReaderNotice status={status} timeZone={tz} />
        <PeriodPicker period={period} keep={{}} />

        <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
          <SectionCard title="Resultado" icon={<LineChart />} description={`Las ventas pagadas de ${label}, por la fecha de la venta.`}>
            <SectionBody className="space-y-0 p-0 md:p-0">
              <dl className="divide-y">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-2.5 md:px-5">
                    <dt className={cn('text-sm', r.strong ? 'font-medium' : 'text-muted-foreground')}>
                      {r.label}
                      {r.hint ? <span className="block text-xs text-muted-foreground">{r.hint}</span> : null}
                    </dt>
                    <dd className={cn('shrink-0 tabular-nums', r.strong ? 'font-semibold' : 'text-muted-foreground')}>{money(r.value)}</dd>
                  </div>
                ))}
                <div className="flex items-start justify-between gap-4 bg-muted/40 px-4 py-3 md:px-5">
                  <dt className="text-sm font-medium">
                    Costo de reposición
                    <span className="block text-xs text-muted-foreground">
                      {s.withoutCost > 0
                        ? `Solo de ${plural(s.withCost.count, 'venta', 'ventas')}: a ${s.withoutCost} les falta el costo de algún producto, y quedan afuera de la ganancia`
                        : 'Sin IVA, el de la pestaña Costo y Stock de cada producto'}
                    </span>
                  </dt>
                  <dd className="shrink-0 font-semibold tabular-nums text-muted-foreground">{s.withCost.count > 0 ? money(-s.withCost.cost) : '—'}</dd>
                </div>
                <div className="flex items-start justify-between gap-4 px-4 py-3 md:px-5">
                  <dt className="text-sm font-semibold">
                    Ganancia
                    {s.withCost.marginPct !== null ? <span className="block text-xs font-normal text-muted-foreground">{formatPercent(s.withCost.marginPct)} sobre el costo</span> : null}
                  </dt>
                  <dd className={cn('shrink-0 text-lg font-bold tabular-nums', s.withCost.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
                    {s.withCost.count > 0 ? money(s.withCost.profit) : '—'}
                  </dd>
                </div>
              </dl>
            </SectionBody>
          </SectionCard>

          <div className="flex flex-col gap-4 md:gap-6">
            <SectionCard title="La plata" icon={<Wallet />} description="Lo que liberó el medio de pago y lo que todavía no se puede usar.">
              <SectionBody>
                <div className="grid grid-cols-2 gap-4">
                  <Figure label={`Liberado en ${label}`} value={money(data.cash.released.amount)} hint={plural(data.cash.released.count, 'venta', 'ventas')} tone="good" big />
                  <Figure label="Por liberar" value={money(data.cash.waiting.amount)} hint={plural(data.cash.waiting.count, 'venta', 'ventas')} big />
                </div>
                {data.cash.waiting.days.length > 0 || data.cash.waiting.undated.count > 0 ? (
                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                      Cuándo se libera
                    </p>
                    <ul className="divide-y rounded-lg border text-sm">
                      {data.cash.waiting.days.slice(0, 14).map((d) => (
                        <li key={d.day} className="flex items-center justify-between gap-3 px-3 py-1.5">
                          <span>{dayText(d.day)}</span>
                          <span className="text-xs text-muted-foreground">{plural(d.count, 'venta', 'ventas')}</span>
                          <span className="tabular-nums font-medium">{money(d.amount)}</span>
                        </li>
                      ))}
                      {data.cash.waiting.undated.count > 0 ? (
                        <li className="flex items-center justify-between gap-3 px-3 py-1.5 text-muted-foreground">
                          <span>Retenida o sin fecha todavía</span>
                          <span className="text-xs">{plural(data.cash.waiting.undated.count, 'venta', 'ventas')}</span>
                          <span className="tabular-nums">{money(data.cash.waiting.undated.amount)}</span>
                        </li>
                      ) : null}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      La fecha la da el medio de pago. Sin ella, la plata suele liberarse unos días después de la entrega. Un reclamo la retiene hasta que se resuelve.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay plata esperando liberarse.</p>
                )}
              </SectionBody>
            </SectionCard>

            <SectionCard title="Cancelaciones y reclamos" icon={<Banknote />}>
              <SectionBody className="grid grid-cols-3 gap-4">
                <Figure label="Canceladas" value={s.cancelled.count} hint={money(s.cancelled.amount)} tone="muted" />
                <Figure label="Sin pagar" value={s.pending.count} hint={money(s.pending.amount)} tone="muted" />
                <Figure label="Con reclamo" value={s.claims} tone={s.claims > 0 ? 'bad' : 'muted'} hint={s.claims > 0 ? <Link href={`/a/${account.slug}/ventas?estado=reclamos`} className="text-primary underline-offset-4 hover:underline">Ver</Link> : undefined} />
              </SectionBody>
            </SectionCard>
          </div>
        </div>

        {data.days.length > 1 ? (
          <SectionCard title="Vendido por día" icon={<LineChart />}>
            <SectionBody>
              <div className="flex h-40 items-end gap-1" role="img" aria-label="Lo vendido cada día del período">
                {data.days.map((d) => (
                  <div key={d.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
                    <div className="rounded-t bg-primary/80 group-hover:bg-primary" style={{ height: `${Math.max(2, (d.sold / maxDay) * 100)}%` }} title={`${dayText(d.day)}: ${money(d.sold)}, ${plural(d.count, 'venta', 'ventas')}`} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{dayText(data.days[0].day)}</span>
                <span>{dayText(data.days[data.days.length - 1].day)}</span>
              </div>
            </SectionBody>
          </SectionCard>
        ) : null}

        <SectionCard title="Por producto" icon={<Package />} count={data.products.length} description="Lo vendido y lo que dejó cada producto. Cada venta reparte su ganancia entre sus productos según lo que pagó el comprador por cada uno.">
          {data.products.length === 0 ? (
            <SectionBody>
              <p className="text-sm text-muted-foreground">No hay ventas pagadas en {label}.</p>
            </SectionBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium md:px-5">Producto</th>
                    <th className="px-3 py-2 text-right font-medium">Unidades</th>
                    <th className="px-3 py-2 text-right font-medium">Vendido</th>
                    <th className="px-3 py-2 text-right font-medium">Costo</th>
                    <th className="px-4 py-2 text-right font-medium md:px-5">Ganancia</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.products.slice(0, 100).map((p) => (
                    <tr key={p.productId ?? p.name}>
                      <td className="px-4 py-2 md:px-5">
                        {p.productId && canProducts ? (
                          <Link href={`/a/${account.slug}/productos/${p.productId}`} className="underline-offset-4 hover:underline">
                            {p.name}
                          </Link>
                        ) : (
                          <span>
                            {p.name}
                            {!p.productId ? <span className="block text-xs text-muted-foreground">No está en la app</span> : null}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.units}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(p.sold)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.cost === null ? 'Sin cargar' : money(p.cost)}</td>
                      <td className={cn('px-4 py-2 text-right font-medium tabular-nums md:px-5', p.profit === null ? 'text-muted-foreground' : p.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
                        {p.profit === null ? '—' : money(p.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </PageBody>
    </>
  );
}
