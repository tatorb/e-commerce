import { AlertTriangle, CheckCircle2, PackageCheck, Truck, Warehouse } from 'lucide-react';
import type * as React from 'react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { ReaderNotice, SaleLine, SalesHeader } from '@/components/sales/SalesParts';
import { dispatchUrgency } from '@/domain/sales';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { plural } from '@/lib/format';
import { readerStatus, shipmentGroups, type SaleRow } from '@/lib/sales/queries';

// Envíos: lo que hay que despachar, por hora límite, lo que está en camino,
// lo que tuvo problemas, lo entregado en la última semana y lo que despacha
// el canal desde su depósito.

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Envíos · ${account.name}` : 'Envíos' };
}

export default async function ShipmentsPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { account } = await requireAccount(cuenta, 'ventas');
  const now = new Date();
  const tz = account.timezone;
  const [groups, status] = await Promise.all([shipmentGroups(prisma, account.id, now), readerStatus(prisma, account.id)]);
  const due = groups.toShip.filter((r) => {
    const u = dispatchUrgency(r.dispatchBy, now, tz);
    return u === 'late' || u === 'today';
  }).length;
  const list = (rows: SaleRow[], empty: string, deadline = false) =>
    rows.length === 0 ? (
      <SectionBody>
        <p className="text-sm text-muted-foreground">{empty}</p>
      </SectionBody>
    ) : (
      <div className="divide-y">
        {rows.map((r) => (
          <SaleLine key={r.id} row={r} accountSlug={account.slug} timeZone={tz} now={now} showDeadline={deadline} />
        ))}
      </div>
    );
  const card = (title: string, icon: React.ReactNode, rows: SaleRow[], description: string, empty: string, deadline?: boolean) => (
    <SectionCard title={title} icon={icon} count={rows.length} description={description} banded>
      {list(rows, empty, deadline)}
    </SectionCard>
  );

  return (
    <>
      <PageHeader>
        <SalesHeader accountSlug={account.slug} accountName={account.name} active="envios" counts={{ envios: due }} />
      </PageHeader>
      <PageBody>
        <ReaderNotice status={status} timeZone={tz} />
        {due > 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {plural(due, 'envío hay', 'envíos hay')} que despachar hoy o ya se pasaron de la hora límite.
          </p>
        ) : null}
        {card('Para despachar', <PackageCheck />, groups.toShip, 'Los que prepara y despacha la tienda, primero los que vencen antes. Pasado el plazo, el canal puede bajar la reputación.', 'No hay envíos para despachar.', true)}
        {card('Con problemas', <AlertTriangle />, groups.problems, 'Los demorados, los que no se pudieron entregar y los que vuelven.', 'Ningún envío tiene problemas.')}
        {card('En camino', <Truck />, groups.onTheWay, 'Ya salieron y todavía no llegaron.', 'No hay envíos en camino.')}
        {card('Entregados en los últimos 7 días', <CheckCircle2 />, groups.delivered, 'Desde la entrega, el medio de pago empieza a contar para liberar la plata.', 'No se entregó nada en los últimos 7 días.')}
        {card('Los despacha el canal', <Warehouse />, groups.channel, 'Los que salen del depósito del canal, como Full: la tienda no tiene que hacer nada.', 'Ninguna venta sale del depósito del canal.')}
      </PageBody>
    </>
  );
}
