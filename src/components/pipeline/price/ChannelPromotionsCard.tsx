'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/ui/brand-loader';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import type { ChannelCampaign } from '@/channels/publish-types';
import { formatPercent, formatPrice } from '@/domain/money';
import { combinedBounds, dealPrice, discountFit, discountOptions, type DiscountBounds } from '@/domain/promotions';
import type { PromotionsResult } from '@/lib/channel-promotions';
import { readPromotionsAction } from '@/app/a/[cuenta]/pipeline/price-actions';
import { cn } from '@/lib/utils/cn';

// En el paso Precio: lo que el canal deja hacer hoy con el descuento de las
// publicaciones de la pestaña. Se pregunta al abrir la pantalla, sin frenar la
// carga, y se puede volver a preguntar. Las campañas son solo para ver: para
// sumarse, por ahora, se hace en el canal.

export type PromotionsState = { kind: 'loading' } | { kind: 'done'; result: PromotionsResult };

/** Pregunta al canal al abrir y cada vez que se pide. */
export function usePromotions(accountSlug: string, publicationIds: string[]) {
  const [state, setState] = useState<PromotionsState>({ kind: 'loading' });
  const key = publicationIds.join(',');
  // Solo vale la última respuesta, si se pidió de nuevo antes de que llegue.
  const asked = useRef(0);
  const ask = useCallback(() => {
    const n = ++asked.current;
    readPromotionsAction(accountSlug, key.split(','))
      .catch((): PromotionsResult => ({ ok: false, error: 'Se cortó la conexión con la app. Probá de nuevo.' }))
      .then((result) => n === asked.current && setState({ kind: 'done', result }));
  }, [accountSlug, key]);
  useEffect(ask, [ask]);
  const reload = () => {
    setState({ kind: 'loading' });
    ask();
  };
  return { state, reload };
}

/** Lo que aceptan todas las publicadas de la pestaña juntas. undefined si todavía no se sabe. */
export function boundsOf(state: PromotionsState): DiscountBounds | null | undefined {
  if (state.kind !== 'done' || !state.result.ok || state.result.read.length === 0) return undefined;
  return combinedBounds(state.result.read.map((r) => r.promotions.discount));
}

/** El aviso cuando el canal no va a aceptar el descuento elegido, o null. */
export function promotionWarning(state: PromotionsState, listPrice: number, pct: number): string | null {
  if (state.kind !== 'done' || !state.result.ok || !(pct > 0)) return null;
  const { channelName, read } = state.result;
  const bounds = boundsOf(state);
  if (bounds === undefined) return null;
  if (bounds === null) {
    return read.some((r) => r.promotions.current)
      ? null
      : `Hoy ${channelName} no deja ponerle un descuento propio a esta publicación: lo va a rechazar.`;
  }
  const fit = discountFit(listPrice, pct, bounds);
  const deal = formatPrice(dealPrice(listPrice, pct));
  if (fit === 'small') return `Con ${formatPercent(pct, 2)} el comprador paga ${deal}, y ${channelName} acepta hasta ${formatPrice(bounds.maxPrice)}: lo va a rechazar porque le parece chico.`;
  if (fit === 'big') return `Con ${formatPercent(pct, 2)} el comprador paga ${deal}, y ${channelName} acepta desde ${formatPrice(bounds.minPrice)}: lo va a rechazar porque es demasiado.`;
  return null;
}

const STATUS: Record<ChannelCampaign['status'], { text: string; className: string }> = {
  active: { text: 'Está adentro', className: 'bg-emerald-100 text-emerald-900' },
  scheduled: { text: 'Programada', className: 'bg-sky-100 text-sky-900' },
  invited: { text: 'La invitan', className: 'bg-amber-100 text-amber-900' },
};

/** "del 3/11 al 16/11", en la hora de la cuenta. */
function datesText(start: Date | null, finish: Date | null, timeZone: string): string | null {
  const day = (d: Date) => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'numeric', timeZone }).format(d);
  if (start && finish) return `Del ${day(start)} al ${day(finish)}`;
  if (finish) return `Hasta el ${day(finish)}`;
  if (start) return `Desde el ${day(start)}`;
  return null;
}

function CampaignRow({ c, code, channelName, timeZone }: { c: ChannelCampaign; code: string | null; channelName: string; timeZone: string }) {
  const status = STATUS[c.status];
  const parts = [
    c.price !== null ? `El comprador paga ${formatPrice(c.price)}` : null,
    c.channelPct ? `${channelName} pone ${formatPercent(c.channelPct)}${c.sellerPct !== null ? ` y la tienda ${formatPercent(c.sellerPct)}` : ''}` : null,
    datesText(c.start, c.finish, timeZone),
  ].filter(Boolean);
  return (
    <li className="space-y-0.5 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium">{c.name ?? c.kind}</span>
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', status.className)}>{status.text}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {[code, c.name ? c.kind : null].filter(Boolean).join(' · ')}
        {code || c.name ? '. ' : ''}
        {parts.length > 0 ? `${parts.join(', ')}.` : null}
      </p>
    </li>
  );
}

export function ChannelPromotionsCard({
  state,
  reload,
  channelName,
  listPrice,
  channelListPrice,
  range,
  onUse,
  timeZone,
}: {
  state: PromotionsState;
  reload: () => void;
  channelName: string;
  // El precio publicado de la pestaña, como está ahora en la pantalla.
  listPrice: number;
  // El que tiene hoy en el canal.
  channelListPrice: number | null;
  // El descuento en % que acepta el canal.
  range: { min: number; max: number } | null;
  onUse: (pct: number) => void;
  timeZone: string;
}) {
  const loading = state.kind === 'loading';
  return (
    <SectionCard
      banded
      title={`Lo que acepta ${channelName}`}
      description="El descuento propio que deja poner hoy y las campañas de la publicación."
      action={
        <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
          Volver a consultar
        </Button>
      }
    >
      <SectionBody>
        {state.kind === 'loading' ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <BrandMark />
            Consultando a {channelName}…
          </p>
        ) : !state.result.ok ? (
          <p className="text-sm text-destructive" role="alert">
            {state.result.error}
          </p>
        ) : state.result.read.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cuando la publicación esté en {channelName}, acá vas a ver qué descuento acepta.</p>
        ) : (
          <Result
            result={state.result}
            listPrice={listPrice}
            channelListPrice={channelListPrice}
            range={range}
            onUse={onUse}
            timeZone={timeZone}
          />
        )}
      </SectionBody>
    </SectionCard>
  );
}

function Result({
  result,
  listPrice,
  channelListPrice,
  range,
  onUse,
  timeZone,
}: {
  result: Extract<PromotionsResult, { ok: true }>;
  listPrice: number;
  channelListPrice: number | null;
  range: { min: number; max: number } | null;
  onUse: (pct: number) => void;
  timeZone: string;
}) {
  const { channelName, read, unpublished } = result;
  const several = read.length > 1;
  const bounds = combinedBounds(read.map((r) => r.promotions.discount));
  const current = read.map((r) => r.promotions.current).find(Boolean) ?? null;
  const { smallest, largest, suggested } = discountOptions(listPrice, bounds, range);
  const campaigns = read.flatMap((r) => r.promotions.campaigns.map((c) => ({ c, code: several ? r.externalId : null })));
  const differs = channelListPrice !== null && listPrice > 0 && Math.round(listPrice) !== Math.round(channelListPrice);

  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-6">
      <div className="space-y-2">
        <p className="text-sm font-medium">Descuento propio{several ? ', para que lo acepten todas' : ''}</p>
        {bounds ? (
          <>
            <dl className="divide-y rounded-md border text-sm">
              <div className="flex flex-wrap justify-between gap-x-3 px-3 py-2">
                <dt>El comprador puede pagar</dt>
                <dd className="font-medium tabular-nums">
                  {bounds.minPrice !== null && bounds.maxPrice !== null
                    ? `de ${formatPrice(bounds.minPrice)} a ${formatPrice(bounds.maxPrice)}`
                    : bounds.maxPrice !== null
                      ? `hasta ${formatPrice(bounds.maxPrice)}`
                      : bounds.minPrice !== null
                        ? `desde ${formatPrice(bounds.minPrice)}`
                        : 'sin límite informado'}
                </dd>
              </div>
              {listPrice > 0 && (smallest !== null || largest !== null) ? (
                <div className="flex flex-wrap justify-between gap-x-3 px-3 py-2">
                  <dt>
                    Descuento <span className="text-muted-foreground">sobre {formatPrice(Math.round(listPrice))}</span>
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {smallest !== null && largest !== null
                      ? `de ${formatPercent(smallest, 2)} a ${formatPercent(largest, 2)}`
                      : smallest !== null
                        ? `desde ${formatPercent(smallest, 2)}`
                        : `hasta ${formatPercent(largest, 2)}`}
                  </dd>
                </div>
              ) : null}
              {bounds.suggestedPrice !== null ? (
                <div className="flex flex-wrap justify-between gap-x-3 px-3 py-2">
                  <dt>Sugerido por {channelName}</dt>
                  <dd className="font-medium tabular-nums">
                    {formatPrice(bounds.suggestedPrice)}
                    {suggested !== null ? <span className="text-muted-foreground"> ({formatPercent(suggested, 2)})</span> : null}
                  </dd>
                </div>
              ) : null}
            </dl>
            {smallest !== null || suggested !== null ? (
              <div className="flex flex-wrap gap-2">
                {smallest !== null ? (
                  <Button size="sm" variant="outline" onClick={() => onUse(smallest)}>
                    Usar el más chico que acepta ({formatPercent(smallest, 2)})
                  </Button>
                ) : null}
                {suggested !== null && suggested !== smallest ? (
                  <Button size="sm" variant="outline" onClick={() => onUse(suggested)}>
                    Usar el sugerido ({formatPercent(suggested, 2)})
                  </Button>
                ) : null}
              </div>
            ) : null}
            {differs ? (
              <p className="text-xs text-muted-foreground">
                {channelName} lo informa con el precio que tiene hoy, {formatPrice(channelListPrice)}. Con otro precio publicado puede cambiar.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {current
              ? `Tiene un descuento ${current.scheduled ? 'programado' : 'puesto'}${current.price !== null ? `: el comprador paga ${formatPrice(current.price)}` : ''}. ${channelName} no informa el rango hasta que se saque.`
              : `Hoy ${channelName} no deja ponerle un descuento propio. Pasa, por ejemplo, si la reputación no está en verde o si está en una campaña que no lo permite.`}
          </p>
        )}
        {bounds && current ? (
          <p className="text-xs text-muted-foreground">
            Tiene un descuento {current.scheduled ? 'programado' : 'puesto'}
            {current.price !== null ? `: el comprador paga ${formatPrice(current.price)}` : ''}.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Campañas</p>
        {campaigns.length > 0 ? (
          <>
            <ul className="divide-y rounded-md border text-sm">
              {campaigns.map(({ c, code }, i) => (
                <CampaignRow key={i} c={c} code={code} channelName={channelName} timeZone={timeZone} />
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Para sumarse a una, por ahora, se hace en {channelName}.</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No está en ninguna campaña y no la invitan a ninguna.</p>
        )}
      </div>
      {unpublished > 0 ? (
        <p className="text-xs text-muted-foreground md:col-span-2">
          {unpublished === 1 ? 'Una de las medidas todavía no está' : `${unpublished} de las medidas todavía no están`} en {channelName}: no se consultó.
        </p>
      ) : null}
    </div>
  );
}
