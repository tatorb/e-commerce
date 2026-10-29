import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { available, STOCK_MOVE_LABEL, stockText } from '@/domain/stock';
import { formatDateTime } from '@/lib/format';
import type { ProductStockView } from '@/lib/stock';
import { plannedText } from '@/lib/stock-plan';
import { cn } from '@/lib/utils/cn';
import { DropOrphanStockButton, ShowMoreSwitch, StockForm, StockReviewedButton } from './StockForm';
import { cushionDeadlines, cushionText, owed, owedText, SELL_WITHOUT_STOCK, SHOWN_WHEN_SHORT } from '@/domain/stock-cushion';

// El stock del producto: cuánto hay, qué muestra cada publicación y lo que fue
// pasando. Un combo no tiene stock propio: sale de sus piezas.

export function ProductStockPanel({
  accountSlug,
  view,
  timeZone,
  canEdit,
}: {
  accountSlug: string;
  view: ProductStockView;
  timeZone: string;
  canEdit: boolean;
}) {
  const isCombo = view.kind === 'COMBO';
  const combo = view.parts?.kind === 'COMBO' ? view.parts : null;
  const comboUnits = combo ? available(combo, null) : null;

  return (
    <>
      <SectionCard
        title="Stock"
        description={
          isCombo
            ? 'Un combo no tiene stock propio: alcanza para los que se pueden armar con el stock de sus piezas.'
            : view.managed
              ? `Lo heredan todas sus publicaciones. Cada venta lo descuenta y la cantidad nueva se sube sola a las demás. Desde el ${view.since ? formatDateTime(view.since, timeZone) : ''}.`
              : 'Todavía no se lleva en la app: cada publicación sigue a la cantidad de su canal. Se toma solo de sus publicaciones cuando la tienda lee las ventas, o se carga acá.'
        }
      >
        <SectionBody>
          {view.review ? (
            <div role="note" className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-alert/40 bg-alert/10 px-3 py-2 text-sm">
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {view.review}
              </p>
              {canEdit ? <StockReviewedButton accountSlug={accountSlug} productId={view.id} /> : null}
            </div>
          ) : null}

          {combo ? (
            <div className="space-y-2 text-sm">
              {combo.parts.length === 0 ? (
                <p className="text-muted-foreground">Todavía no tiene piezas cargadas.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {combo.parts.map((part) => (
                    <li key={part.product.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <Link href={`/a/${accountSlug}/productos/${part.product.id}?seccion=stock`} className="font-medium underline-offset-4 hover:underline">
                        {part.quantity > 1 ? `${part.quantity} × ` : ''}
                        {part.product.name}
                      </Link>
                      <span className="text-muted-foreground">
                        {part.product.stock
                          ? `Stock ${stockText(part.product.slots.map((s) => ({ label: s.label, quantity: part.product.stock![s.key] ?? 0 })))}`
                          : 'Sin stock en la app'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {comboUnits !== null ? <p>Alcanza para armar {comboUnits === 1 ? '1 combo' : `${comboUnits} combos`}.</p> : null}
            </div>
          ) : canEdit ? (
            <StockForm accountSlug={accountSlug} productId={view.id} lines={view.lines} managed={view.managed} />
          ) : (
            <p className="text-sm">
              {view.managed ? stockText(view.lines.map((l) => ({ label: l.label, quantity: l.quantity ?? 0 }))) : 'Sin stock cargado.'}
            </p>
          )}

          {!isCombo ? (
            <div className="space-y-2 rounded-lg border px-3 py-2.5">
              <ShowMoreSwitch accountSlug={accountSlug} productId={view.id} on={view.showMore} readOnly={!canEdit || !view.managed} />
              <p className="text-xs text-muted-foreground">
                {view.managed
                  ? `Prendido, los canales muestran ${SHOWN_WHEN_SHORT} aunque haya de 1 a 5, para que la publicación no se pause al vender la última. Avisa cuando queda 1 y cuando se vende la última; se pueden vender ${SELL_WITHOUT_STOCK} sin tenerlas. Al día sin reponer avisa otra vez y a los dos días se pausa. Lo resuelve cargar el stock.`
                  : 'Se prende cuando la app lleva el stock del producto.'}
              </p>
              {view.showMore ? (
                <ul className="space-y-1 text-sm">
                  {view.lines.map((l) => (
                    <li key={l.key} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{view.lines.length > 1 ? `${l.label || 'Sin medida'}:` : ''}</span>
                      <span className="tabular-nums">{l.quantity === null || l.shown === null ? 'Sin stock cargado' : cushionText(l.quantity, l.shown)}</span>
                      <MeasureAlarm quantity={l.quantity} alarm={l.alarm} timeZone={timeZone} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {view.orphans.length > 0 ? (
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>Hay stock de medidas que ya no están en la ficha. No lo usa ninguna publicación ni se sube al canal.</p>
              <ul className="divide-y rounded-md border">
                {view.orphans.map((o) => (
                  <li key={o.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                    <span>
                      {o.label || 'Sin nombre'}: {o.quantity}
                    </span>
                    {canEdit ? <DropOrphanStockButton accountSlug={accountSlug} productId={view.id} stockKey={o.key} label={o.label || 'sin nombre'} /> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </SectionBody>
      </SectionCard>

      <SectionCard
        title="Publicaciones"
        count={view.publications.length}
        description={isCombo ? 'Las del combo, con lo que les toca.' : 'Las del producto y las de los combos en que está, con lo que les toca.'}
      >
        {view.publications.length === 0 ? (
          <SectionBody>
            <p className="text-sm text-muted-foreground">Todavía no tiene publicaciones.</p>
          </SectionBody>
        ) : (
          <ul className="divide-y text-sm">
            {view.publications.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <Link href={`/a/${accountSlug}/publicaciones/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                    {p.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {p.externalId ? ` · ${p.externalId}` : ' · sin publicar'} · {p.storeName}
                    {p.comboName && !isCombo ? ` · combo ${p.comboName}` : ''}
                  </span>
                </div>
                <div className={cn('shrink-0 text-xs sm:max-w-sm sm:text-right', !p.plan.managed && 'text-muted-foreground')}>
                  {p.plan.managed ? (
                    <span className="inline-flex flex-wrap items-center gap-1.5 sm:justify-end">
                      <span className="font-medium">{plannedText(p.plan)}</span>
                      {p.plan.pending ? <Badge variant="secondary">Se sube en la próxima pasada</Badge> : null}
                    </span>
                  ) : (
                    p.plan.reason
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {!isCombo ? (
        <SectionCard title="Movimientos" description="Lo que fue pasando con el stock, lo más nuevo primero.">
          {view.moves.length === 0 ? (
            <SectionBody>
              <p className="text-sm text-muted-foreground">Todavía no hubo movimientos.</p>
            </SectionBody>
          ) : (
            <ul className="divide-y text-sm">
              {view.moves.map((m) => (
                <li key={m.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2">
                  <span className="tabular-nums text-xs text-muted-foreground">{formatDateTime(m.createdAt, timeZone)}</span>
                  <span className="font-medium">{STOCK_MOVE_LABEL[m.kind]}</span>
                  <span className={cn('tabular-nums', m.delta < 0 ? 'text-destructive' : 'text-emerald-700')}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </span>
                  <span className="text-muted-foreground">
                    {m.label ? `${m.label} · ` : ''}quedó {m.after}
                  </span>
                  {m.publication ? (
                    <Link href={`/a/${accountSlug}/publicaciones/${m.publication.id}`} className="text-xs underline-offset-4 hover:underline">
                      {m.publication.externalId ?? 'sin publicar'}
                    </Link>
                  ) : null}
                  <span className="text-xs text-muted-foreground sm:ml-auto">{m.user?.name ?? (m.kind === 'MANUAL' ? '' : 'Automático')}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}
    </>
  );
}

/** Cómo está la alarma de una medida, en pocas palabras. */
function MeasureAlarm({
  quantity,
  alarm,
  timeZone,
}: {
  quantity: number | null;
  alarm: { lowAt: Date | null; outSince: Date | null; remindedAt: Date | null; cutAt: Date | null } | null;
  timeZone: string;
}) {
  if (quantity === null) return null;
  const when = (d: Date) => formatDateTime(d, timeZone);
  const missing = owed(quantity);
  const extra = missing > 0 ? ` ${owedText(missing)}.` : '';
  if (alarm?.cutAt) return <span className="text-xs text-destructive">Pausada el {when(alarm.cutAt)} por no reponer en dos días.{extra}</span>;
  if (alarm?.outSince && quantity <= -SELL_WITHOUT_STOCK) return <span className="text-xs text-destructive">Ya se vendieron {SELL_WITHOUT_STOCK} sin tener: pausada hasta cargar el stock.</span>;
  if (alarm?.outSince) {
    return (
      <span className="text-xs text-destructive">
        Sin stock desde el {when(alarm.outSince)}: se pausa el {when(cushionDeadlines(alarm.outSince).cutAt)}.{extra}
      </span>
    );
  }
  if (quantity === 1) return <span className="text-xs text-amber-700 dark:text-amber-400">Queda la última: si se vende, salta la alarma.</span>;
  return null;
}
