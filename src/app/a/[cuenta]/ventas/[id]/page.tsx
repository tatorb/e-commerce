import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Boxes, CreditCard, ExternalLink, Package, Receipt, Truck } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { money, SaleBadges, linesText } from '@/components/sales/SalesParts';
import { can } from '@/domain/access';
import { formatPercent } from '@/domain/money';
import { CANCEL_BY_LABEL, dispatchUrgency, isReleased, SALE_STATE_LABEL, SHIP_STATE_LABEL } from '@/domain/sales';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { formatDateTime, plural } from '@/lib/format';
import { getSale } from '@/lib/sales/queries';
import { cn } from '@/lib/utils/cn';

// Una venta: lo que se vendió, la cuenta de lo que dejó, el pago con su
// liberación, el envío y lo que movió del stock.

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string; id: string }> }) {
  const { cuenta, id } = await params;
  const account = await accountForTitle(cuenta);
  if (!account) return { title: 'Venta' };
  const sale = await prisma.sale.findFirst({ where: { id, store: { accountId: account.id } }, select: { orderId: true } });
  return { title: sale ? `Venta ${sale.orderId} · ${account.name}` : 'Venta' };
}

const STOCK_STATUS: Record<string, string> = {
  COUNTED: 'Se descontó del stock.',
  RETURNED: 'Se canceló antes de entregarse: las unidades volvieron al stock.',
  KEPT: 'Se canceló ya entregada: las unidades no volvieron solas.',
  SKIPPED: 'No tocó el stock de la app.',
};

export default async function SalePage({ params }: { params: Promise<{ cuenta: string; id: string }> }) {
  const { cuenta, id } = await params;
  const { user, account } = await requireAccount(cuenta, 'ventas');
  const sale = await getSale(prisma, account.id, id);
  if (!sale) notFound();
  const now = new Date();
  const tz = account.timezone;
  const when = (d: Date | null) => (d ? formatDateTime(d, tz) : '—');
  const m = sale.money;
  const canProducts = can(user.access, 'productos', 'read');
  const canPublications = can(user.access, 'publicaciones', 'read');
  const urgency = dispatchUrgency(sale.dispatchBy, now, tz);
  const released = isReleased({ releaseAt: sale.releaseAt, released: sale.released }, now);
  const c = sale.currency;

  const breakdown: { label: string; value: number | null; hint?: string; strong?: boolean }[] = m.cancelled
    ? []
    : [
        { label: 'Pagó el comprador por los productos', value: m.sold, strong: true, hint: m.discount ? `Con ${money(m.discount, c)} de descuento sobre el precio publicado` : undefined },
        { label: 'Comisión del canal y cuotas', value: -m.fee, hint: m.feeEstimated ? 'Estimada con el cargo de Ajustes, Precios: el canal no la informó' : undefined },
        { label: 'Envío a cargo de la tienda', value: -m.shipping, hint: m.shippingUnknown ? (sale.shipState === 'NONE' ? 'Sin envío del canal' : 'Todavía no se sabe: cuenta como 0') : undefined },
        { label: 'Queda después del canal', value: m.net, strong: true },
        { label: 'IVA, estimado', value: -m.vat },
        { label: 'Impuestos, estimados', value: -m.taxes },
        ...(m.packaging > 0 ? [{ label: 'Embalaje y preparación', value: -m.packaging }] : []),
        { label: 'Costo de reposición', value: m.cost === null ? null : -m.cost, hint: m.cost === null ? 'Falta el costo de algún producto: cargalo en su pestaña Costo y Stock' : 'Sin IVA' },
      ];

  return (
    <>
      <PageHeader>
        <Breadcrumb items={[{ label: 'Ventas', href: `/a/${account.slug}/ventas` }, { label: `Venta ${sale.orderId}` }]} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="break-words text-xl font-bold leading-tight tracking-tight md:text-2xl">{linesText(sale)}</h1>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span>Venta {sale.orderId}</span>
              <span>· {when(sale.orderedAt)}</span>
              <span>· {sale.storeName}</span>
              {sale.buyerNickname || sale.buyerName ? <span>· {[sale.buyerName, sale.buyerNickname].filter(Boolean).join(', ')}</span> : null}
            </p>
            <SaleBadges row={sale} timeZone={tz} now={now} />
          </div>
          {sale.url ? (
            <a href={sale.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Ver en {sale.channelName}
            </a>
          ) : null}
        </div>
      </PageHeader>
      <PageBody>
        {sale.state === 'CANCELLED' ? (
          <p className="rounded-xl border bg-muted/40 px-3 py-2.5 text-sm">
            La venta se canceló{sale.cancelBy ? `, la pidió ${CANCEL_BY_LABEL[sale.cancelBy] ?? sale.cancelBy}` : ''}
            {sale.cancelReason ? `: ${sale.cancelReason}` : ''}. El canal devuelve lo que cobró, así que no deja nada.
          </p>
        ) : sale.state === 'PENDING' ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">Todavía no se pagó. Hasta que se pague no cuenta en la caja.</p>
        ) : null}
        {sale.packSales.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Se compró en un carrito junto con{' '}
            {sale.packSales.map((p, i) => (
              <span key={p.id}>
                {i > 0 ? ', ' : ''}
                <Link href={`/a/${account.slug}/ventas/${p.id}`} className="text-primary underline-offset-4 hover:underline">
                  la venta {p.orderId}
                </Link>
              </span>
            ))}
            . Comparten el envío y su costo se reparte según lo que pagó el comprador por cada una.
          </p>
        ) : null}

        <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
          <SectionCard title="Lo que se vendió" icon={<Package />} count={sale.units}>
            <ul className="divide-y">
              {sale.lines.map((l, i) => {
                const pub = l.publicationId ? sale.publications.get(l.publicationId) : null;
                const product = l.productId ? sale.products.get(l.productId) : null;
                return (
                  <li key={`${l.listingId}-${i}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between md:px-5">
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-medium">
                        {l.quantity} × {l.title ?? l.listingId}
                        {l.measure ? <span className="text-muted-foreground"> · medida {l.measure}</span> : null}
                      </p>
                      <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        <span className="tabular-nums">{l.listingId}</span>
                        {l.sku ? <span>SKU {l.sku}</span> : null}
                        {pub && canPublications ? (
                          <Link href={`/a/${account.slug}/publicaciones/${pub.id}`} className="text-primary underline-offset-4 hover:underline">
                            Publicación
                          </Link>
                        ) : null}
                        {product ? (
                          canProducts ? (
                            <Link href={`/a/${account.slug}/productos/${product.id}`} className="text-primary underline-offset-4 hover:underline">
                              {product.name}
                            </Link>
                          ) : (
                            <span>{product.name}</span>
                          )
                        ) : (
                          <span>No está en la app</span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-left text-sm tabular-nums sm:text-right">
                      <p className="font-medium">{money(l.unitPrice * l.quantity, c)}</p>
                      <p className="text-xs text-muted-foreground">
                        {money(l.unitPrice, c)} c/u{l.listPrice && l.listPrice > l.unitPrice ? ` · publicado ${money(l.listPrice, c)}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">Costo {l.unitCost === null ? 'sin cargar' : `${money(l.unitCost, c)} c/u`}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <SectionCard title="Lo que dejó" icon={<Receipt />}>
            {m.cancelled ? (
              <SectionBody>
                <p className="text-sm text-muted-foreground">Cancelada: no deja nada.</p>
              </SectionBody>
            ) : (
              <dl className="divide-y">
                {breakdown.map((r) => (
                  <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-2.5 md:px-5">
                    <dt className={cn('text-sm', r.strong ? 'font-medium' : 'text-muted-foreground')}>
                      {r.label}
                      {r.hint ? <span className="block text-xs text-muted-foreground">{r.hint}</span> : null}
                    </dt>
                    <dd className={cn('shrink-0 tabular-nums', r.strong ? 'font-semibold' : 'text-muted-foreground')}>{r.value === null ? '—' : money(r.value, c)}</dd>
                  </div>
                ))}
                <div className="flex items-start justify-between gap-4 px-4 py-3 md:px-5">
                  <dt className="text-sm font-semibold">
                    Ganancia
                    {m.marginPct !== null ? <span className="block text-xs font-normal text-muted-foreground">{formatPercent(m.marginPct)} sobre el costo</span> : null}
                  </dt>
                  <dd className={cn('shrink-0 text-lg font-bold tabular-nums', m.profit === null ? 'text-muted-foreground' : m.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
                    {m.profit === null ? '—' : money(m.profit, c)}
                  </dd>
                </div>
              </dl>
            )}
          </SectionCard>

          <SectionCard title="El pago" icon={<CreditCard />}>
            <SectionBody>
              {sale.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">El canal no informó pagos.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {sale.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2">
                      <span>
                        {p.method ?? 'Pago'}
                        {p.installments && p.installments > 1 ? ` en ${p.installments} cuotas` : ''}
                        <span className="text-xs text-muted-foreground">
                          {' '}
                          · {p.state === 'approved' ? 'aprobado' : p.state === 'pending' ? 'pendiente' : p.state === 'refunded' ? 'devuelto' : p.state === 'rejected' ? 'rechazado' : p.state === 'cancelled' ? 'cancelado' : p.state}
                          {p.approvedAt ? ` el ${when(new Date(p.approvedAt))}` : ''}
                        </span>
                      </span>
                      <span className="tabular-nums font-medium">{money(p.amount, c)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {!m.cancelled && sale.state === 'PAID' ? (
                <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="flex justify-between gap-3">
                    <span>{m.receivedFromPayment ? 'Lo que deposita el medio de pago' : 'Lo que queda, sin el dato del medio de pago'}</span>
                    <span className="tabular-nums font-semibold">{money(m.received, c)}</span>
                  </p>
                  {m.withheld > 0 ? <p className="text-xs text-muted-foreground">Retuvo {money(m.withheld, c)} más que la comisión y el envío, por ejemplo retenciones de impuestos.</p> : null}
                  <p className={cn('text-xs', released ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
                    {released
                      ? sale.releaseAt
                        ? `Liberada el ${when(sale.releaseAt)}.`
                        : 'Liberada.'
                      : sale.releaseAt
                        ? `Se libera el ${when(sale.releaseAt)}.`
                        : sale.claim
                          ? 'Retenida mientras siga el reclamo.'
                          : 'Todavía sin fecha de liberación.'}
                  </p>
                  {sale.refunded ? <p className="text-xs text-destructive">Se devolvieron {money(sale.refunded, c)}.</p> : null}
                </div>
              ) : null}
              {sale.paidAmount !== null && sale.buyerShipping ? (
                <p className="text-xs text-muted-foreground">
                  En total pagó {money(sale.paidAmount, c)}, con {money(sale.buyerShipping, c)} de envío.
                </p>
              ) : null}
            </SectionBody>
          </SectionCard>

          <SectionCard title="El envío" icon={<Truck />}>
            <SectionBody>
              {sale.shipState === 'NONE' ? (
                <p className="text-sm text-muted-foreground">Sin envío del canal: se arregla con el comprador.</p>
              ) : (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Estado</dt>
                  <dd>
                    {SHIP_STATE_LABEL[sale.shipState]}
                    {sale.shipDetail ? ` · ${sale.shipDetail}` : ''}
                  </dd>
                  {sale.shipKindLabel ? (
                    <>
                      <dt className="text-muted-foreground">Cómo</dt>
                      <dd>{sale.shipKindLabel}</dd>
                    </>
                  ) : null}
                  {sale.dispatchBy && sale.shipState === 'TO_SHIP' ? (
                    <>
                      <dt className="text-muted-foreground">Despachar antes del</dt>
                      <dd className={cn(urgency === 'late' && 'font-medium text-destructive', urgency === 'today' && 'font-medium text-amber-700')}>{when(sale.dispatchBy)}</dd>
                    </>
                  ) : null}
                  {sale.tracking ? (
                    <>
                      <dt className="text-muted-foreground">Seguimiento</dt>
                      <dd className="tabular-nums">{sale.tracking}</dd>
                    </>
                  ) : null}
                  {sale.shippedAt ? (
                    <>
                      <dt className="text-muted-foreground">Salió</dt>
                      <dd>{when(sale.shippedAt)}</dd>
                    </>
                  ) : null}
                  {sale.deliveredAt ? (
                    <>
                      <dt className="text-muted-foreground">Llegó</dt>
                      <dd>{when(sale.deliveredAt)}</dd>
                    </>
                  ) : sale.estimatedAt ? (
                    <>
                      <dt className="text-muted-foreground">Llega más o menos</dt>
                      <dd>{when(sale.estimatedAt)}</dd>
                    </>
                  ) : null}
                </dl>
              )}
            </SectionBody>
          </SectionCard>
        </div>

        <SectionCard title="Stock" icon={<Boxes />}>
          <SectionBody>
            {sale.stock ? (
              <>
                <p className="text-sm">{STOCK_STATUS[sale.stock.status] ?? ''}</p>
                {sale.stock.moves.length > 0 ? (
                  <ul className="text-sm text-muted-foreground">
                    {sale.stock.moves.map((mv, i) => (
                      <li key={i}>
                        {mv.productName}
                        {mv.measure ? ` · ${mv.measure}` : ''}: {mv.delta > 0 ? `volvieron ${mv.delta}` : `salieron ${-mv.delta}`}, quedó {mv.after}.
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {sale.state === 'PAID' ? 'Esta venta no pasó por el stock de la app: es de antes de que la tienda empezara a llevarlo, o todavía no se leyó.' : 'No tocó el stock.'}
              </p>
            )}
          </SectionBody>
        </SectionCard>
        <p className="text-xs text-muted-foreground">
          {SALE_STATE_LABEL[sale.state]}. Leída del canal el {when(sale.checkedAt)}
          {sale.incomplete ? '. Todavía falta leer el envío y el pago: se completa en la próxima lectura' : ''}. {plural(sale.units, 'unidad', 'unidades')}.
        </p>
      </PageBody>
    </>
  );
}
