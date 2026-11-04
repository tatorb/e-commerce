import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { Figure, money, SaleLine } from '@/components/sales/SalesParts';
import { plural } from '@/lib/format';
import type { SalesHistory } from '@/lib/sales/queries';

// El historial de ventas de una publicación, de una familia o de un producto:
// un resumen de lo vendido y las ventas, las más nuevas primero. Lo mismo que
// la sección Ventas, filtrado a lo que se está mirando.

export function SalesHistoryCard({
  accountSlug,
  history,
  timeZone,
  // De qué es: "esta publicación", "las medidas de la familia", "las publicaciones del producto".
  of,
  // Para ver todas en Ventas, buscando por el código.
  search,
}: {
  accountSlug: string;
  history: SalesHistory;
  timeZone: string;
  of: string;
  search: string | null;
}) {
  const now = new Date();
  const s = history.summary;
  const all = search ? `/a/${accountSlug}/ventas?q=${encodeURIComponent(search)}` : `/a/${accountSlug}/ventas`;
  return (
    <SectionCard
      title="Historial de ventas"
      icon={<Receipt />}
      description={`Las ventas de ${of}${history.since ? `, desde el ${history.since.toLocaleDateString('es-AR', { timeZone })}` : ''}. Sin las canceladas en el resumen.`}
      action={
        history.total > history.rows.length ? (
          <Link href={all} className="text-xs underline">
            Ver todas en Ventas
          </Link>
        ) : null
      }
    >
      <SectionBody>
        {history.total === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no tiene ventas leídas del canal.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Figure label="Ventas" value={s.count} hint={s.cancelled > 0 ? `${plural(s.cancelled, 'cancelada', 'canceladas')} aparte` : undefined} />
              <Figure label="Unidades" value={s.units} />
              <Figure label="Vendido" value={money(s.sold, s.currency)} />
              <Figure
                label="Ganancia"
                value={s.profit === null ? 'Sin costo' : money(s.profit, s.currency)}
                tone={s.profit === null ? 'muted' : s.profit >= 0 ? 'good' : 'bad'}
                hint={s.withoutCost > 0 && s.profit !== null ? `${plural(s.withoutCost, 'venta', 'ventas')} sin costo cargado no suman` : undefined}
              />
            </div>
            <div className="-mx-4 divide-y border-t">
              {history.rows.map((r) => (
                <SaleLine key={r.id} row={r} accountSlug={accountSlug} timeZone={timeZone} now={now} />
              ))}
            </div>
            {history.total > history.rows.length ? (
              <p className="text-xs text-muted-foreground">
                Se ven las {history.rows.length} más nuevas de {history.total}.{' '}
                <Link href={all} className="underline">
                  Ver todas en Ventas
                </Link>
              </p>
            ) : null}
          </>
        )}
      </SectionBody>
    </SectionCard>
  );
}
