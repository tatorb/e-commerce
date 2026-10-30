'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ChannelCampaign } from '@/channels/publish-types';
import { formatPercent, formatPrice, parsePrice } from '@/domain/money';
import { marginLevel, marginOf, type InstallmentPlan, type PricingParams } from '@/domain/pricing';
import { campaignPrice, campaignPriceProblem, campaignRevenue } from '@/domain/promotions';
import type { CampaignChoice, PendingCampaign } from '@/lib/channel-campaigns';
import { cancelCampaignAction, queueCampaignAction } from '@/app/a/[cuenta]/pipeline/price-actions';
import { sendCampaignNowAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';
import { cn } from '@/lib/utils/cn';

// Las campañas del canal de una publicación, con lo que se puede hacer desde
// la app: sumarse a las que la invitan y salir de las que está. En el Pipeline
// queda en Por subir (mode queue); en la página de la publicación se manda en
// el momento (mode now). Antes de confirmar, muestra el precio para el
// comprador, lo que pone cada uno y el margen que queda.

export type CampaignItem = { publicationId: string; code: string | null; campaign: ChannelCampaign };

/** Con qué se calcula el margen: el costo, los parámetros de precio y las cuotas de la publicación. */
export type MarginContext = { cost: number | null; params: PricingParams; plan: InstallmentPlan };

/** La campaña abierta para sumarse o salir, con el precio escrito: Guardar en el paso Precio la deja en Por subir. problem: por qué no se puede todavía. */
export type CampaignDraft = { publicationId: string; choice: CampaignChoice; problem: string | null };

const STATUS: Record<ChannelCampaign['status'], { text: string; className: string }> = {
  active: { text: 'Está adentro', className: 'bg-emerald-100 text-emerald-900' },
  scheduled: { text: 'Programada', className: 'bg-sky-100 text-sky-900' },
  invited: { text: 'La invitan', className: 'bg-amber-100 text-amber-900' },
};

/** "Del 3/11 al 16/11", en la hora de la cuenta. */
function datesText(start: Date | null, finish: Date | null, timeZone: string): string | null {
  const day = (d: Date) => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'numeric', timeZone }).format(d);
  if (start && finish) return `Del ${day(start)} al ${day(finish)}`;
  if (finish) return `Hasta el ${day(finish)}`;
  if (start) return `Desde el ${day(start)}`;
  return null;
}

const amountText = (n: number | null) => (n === null ? '' : new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n));

/** El precio que se propone al abrir una campaña: el sugerido o, si no, el más alto que acepta. */
const startText = (c: ChannelCampaign) => amountText(c.range?.suggestedPrice ?? c.range?.maxPrice ?? null);

/** Lo que se pide con la campaña abierta y el precio escrito, y por qué no se puede, si no entra. */
function draftOf(item: CampaignItem, action: 'join' | 'leave', priceText: string): CampaignDraft {
  const c = item.campaign;
  const withPrice = action === 'join' && c.join === 'price';
  const typed = parsePrice(priceText);
  const price = withPrice ? (typeof typed === 'number' ? typed : null) : c.price;
  return {
    publicationId: item.publicationId,
    choice: { action, ref: c.ref!, name: c.name ?? c.kind, kind: c.kind, price: withPrice && price !== null ? campaignPrice(price) : null, pausesOwnDiscount: c.pausesOwnDiscount },
    problem: withPrice ? campaignPriceProblem(price ?? 0, c.range, c.listPrice) : null,
  };
}

/** "de $ 1.000 a $ 2.000", "hasta $ 2.000"… */
function rangeText(r: NonNullable<ChannelCampaign['range']>): string | null {
  if (r.minPrice !== null && r.maxPrice !== null) return `de ${formatPrice(r.minPrice)} a ${formatPrice(r.maxPrice)}`;
  if (r.maxPrice !== null) return `hasta ${formatPrice(r.maxPrice)}`;
  if (r.minPrice !== null) return `desde ${formatPrice(r.minPrice)}`;
  return null;
}

export function CampaignList({
  accountSlug,
  items,
  pending,
  mode,
  channelName,
  margin,
  timeZone,
  onChanged,
  onDraft,
}: {
  accountSlug: string;
  items: CampaignItem[];
  pending: PendingCampaign[];
  mode: 'queue' | 'now';
  channelName: string;
  margin: MarginContext | null;
  timeZone: string;
  // Después de pedir o mandar algo: volver a consultar al canal.
  onChanged: () => void;
  // La campaña que está abierta, o null al cerrarla.
  onDraft?: (draft: CampaignDraft | null) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No está en ninguna campaña y no la invitan a ninguna.</p>;
  const keyOf = (i: CampaignItem, n: number) => `${i.publicationId}:${i.campaign.ref ?? n}`;
  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-md border text-sm">
        {items.map((item, n) => {
          const key = keyOf(item, n);
          const queued = pending.find((p) => p.publicationId === item.publicationId && p.ref === item.campaign.ref) ?? null;
          return (
            <CampaignRow
              key={key}
              accountSlug={accountSlug}
              item={item}
              queued={queued}
              mode={mode}
              channelName={channelName}
              margin={margin}
              timeZone={timeZone}
              open={open === key}
              onOpen={(on) => {
                setOpen(on ? key : null);
                setNotice(null);
                if (!on) onDraft?.(null);
              }}
              onDraft={onDraft}
              onDone={(text) => {
                setOpen(null);
                setNotice({ kind: 'ok', text });
                onDraft?.(null);
                onChanged();
              }}
              onError={(text) => setNotice({ kind: 'error', text })}
            />
          );
        })}
      </ul>
      {notice ? (
        <p className={cn('text-sm', notice.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
          {notice.text}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {mode === 'queue'
          ? `Sumarse o salir queda en Por subir y se manda a ${channelName} con los demás cambios.`
          : `Sumarse o salir se manda a ${channelName} en el momento.`}{' '}
        Oferta del día, relámpago y por volumen se manejan en {channelName}.
      </p>
    </div>
  );
}

function CampaignRow({
  accountSlug,
  item,
  queued,
  mode,
  channelName,
  margin,
  timeZone,
  open,
  onOpen,
  onDraft,
  onDone,
  onError,
}: {
  accountSlug: string;
  item: CampaignItem;
  queued: PendingCampaign | null;
  mode: 'queue' | 'now';
  channelName: string;
  margin: MarginContext | null;
  timeZone: string;
  open: boolean;
  onOpen: (on: boolean) => void;
  onDraft?: (draft: CampaignDraft | null) => void;
  onDone: (text: string) => void;
  onError: (text: string) => void;
}) {
  const router = useRouter();
  const c = item.campaign;
  const status = STATUS[c.status];
  const [pending, setPending] = useState(false);
  const facts = [
    c.price !== null ? `El comprador paga ${formatPrice(c.price)}` : null,
    c.channelPct ? `${channelName} pone ${formatPercent(c.channelPct)}${c.sellerPct !== null ? ` y la tienda ${formatPercent(c.sellerPct)}` : ''}` : null,
    datesText(c.start, c.finish, timeZone),
  ].filter(Boolean);
  const name = c.name ?? c.kind;
  const action = c.status === 'invited' ? 'join' : 'leave';
  const canAct = action === 'join' ? c.join !== null : c.canLeave;

  async function cancel() {
    if (!queued) return;
    setPending(true);
    const r = await cancelCampaignAction(accountSlug, queued.id).catch(() => null);
    setPending(false);
    if (!r) return onError('Se cortó la conexión con la app. Probá de nuevo.');
    if (!r.ok) return onError(r.error);
    router.refresh();
    onDone(`Se sacó de Por subir: ${queued.action === 'join' ? 'sumarse a' : 'salir de'} ${name}.`);
  }

  return (
    <li className="space-y-2 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{name}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', status.className)}>{status.text}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {[item.code, c.name ? c.kind : null].filter(Boolean).join(' · ')}
            {item.code || c.name ? '. ' : ''}
            {facts.length > 0 ? `${facts.join(', ')}.` : null}
          </p>
        </div>
        {queued ? null : canAct && !open ? (
          <Button
            access={mode === 'now' ? 'subir' : undefined}
            size="sm"
            variant="outline"
            onClick={() => {
              onOpen(true);
              onDraft?.(draftOf(item, action, startText(c)));
            }}
          >
            {action === 'join' ? 'Sumarse' : 'Salir'}
          </Button>
        ) : !canAct ? (
          <span className="text-xs text-muted-foreground">Se maneja en {channelName}</span>
        ) : null}
      </div>
      {queued ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
          <span>
            En Por subir: {queued.action === 'join' ? `sumarse${queued.price !== null ? ` con ${formatPrice(queued.price)}` : ''}` : 'salir'}
            {queued.rejection ? <span className="block text-destructive">No se pudo la última vez: {queued.rejection}</span> : null}
          </span>
          <Button size="sm" variant="ghost" onClick={cancel} disabled={pending} pending={pending}>
            Sacar de Por subir
          </Button>
        </div>
      ) : null}
      {open && !queued ? (
        <ChoicePanel
          accountSlug={accountSlug}
          item={item}
          action={action}
          mode={mode}
          channelName={channelName}
          margin={margin}
          onCancel={() => onOpen(false)}
          onPrice={(text) => onDraft?.(draftOf(item, action, text))}
          onDone={onDone}
          onError={onError}
        />
      ) : null}
    </li>
  );
}

function ChoicePanel({
  accountSlug,
  item,
  action,
  mode,
  channelName,
  margin,
  onCancel,
  onPrice,
  onDone,
  onError,
}: {
  accountSlug: string;
  item: CampaignItem;
  action: 'join' | 'leave';
  mode: 'queue' | 'now';
  channelName: string;
  margin: MarginContext | null;
  onCancel: () => void;
  // Cada vez que cambia el precio escrito.
  onPrice: (text: string) => void;
  onDone: (text: string) => void;
  onError: (text: string) => void;
}) {
  const router = useRouter();
  const c = item.campaign;
  const name = c.name ?? c.kind;
  const withPrice = action === 'join' && c.join === 'price';
  const [priceText, setPriceText] = useState(startText(c));
  const [pending, setPending] = useState(false);
  const { choice, problem } = draftOf(item, action, priceText);
  const typed = parsePrice(priceText);
  const price = withPrice ? (typeof typed === 'number' ? typed : null) : c.price;
  // El margen: con lo que recibe la tienda, que suma la parte que pone el canal.
  const revenue = action === 'join' && price !== null ? campaignRevenue({ price, channelPct: c.channelPct, listPrice: c.listPrice }) : null;
  const marginPct = revenue !== null && margin?.cost ? marginOf(revenue, margin.cost, margin.params, margin.plan) : null;
  const level = marginPct !== null && margin ? marginLevel(marginPct, margin.params) : null;

  async function confirm() {
    setPending(true);
    const r = await (mode === 'queue' ? queueCampaignAction(accountSlug, item.publicationId, choice) : sendCampaignNowAction(accountSlug, item.publicationId, choice)).catch(
      () => null,
    );
    setPending(false);
    if (!r) return onError('Se cortó la conexión con la app. Probá de nuevo.');
    if (!r.ok) return onError(r.error);
    router.refresh();
    const verb = action === 'join' ? `sumarse a ${name}` : `salir de ${name}`;
    onDone(mode === 'queue' ? `Quedó en Por subir: ${verb}.` : action === 'join' ? `Se sumó a ${name} en ${channelName}.` : `Salió de ${name} en ${channelName}.`);
  }

  return (
    <div className="space-y-2 rounded-md border bg-background px-3 py-2.5">
      {action === 'join' ? (
        <>
          {withPrice ? (
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor={`precio-${item.publicationId}-${c.ref}`}>
                Precio para el comprador en la campaña
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  id={`precio-${item.publicationId}-${c.ref}`}
                  inputMode="decimal"
                  value={priceText}
                  onChange={(e) => {
                    setPriceText(e.target.value);
                    onPrice(e.target.value);
                  }}
                  className="h-8 max-w-40 tabular-nums"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {c.range && rangeText(c.range) ? `${channelName} acepta ${rangeText(c.range)}.` : `${channelName} no informó el rango.`}
                {c.range?.suggestedPrice ? ` Sugiere ${formatPrice(c.range.suggestedPrice)}.` : ''}
                {c.listPrice && price ? ` Es ${formatPercent((1 - price / c.listPrice) * 100)} menos que ${formatPrice(c.listPrice)}.` : ''}
              </p>
              {problem ? <p className="text-xs text-destructive">{problem}</p> : null}
            </div>
          ) : (
            <p className="text-sm">
              {c.price !== null ? `El comprador paga ${formatPrice(c.price)}` : `El precio lo pone ${channelName}`}
              {c.channelPct ? `, ${channelName} pone ${formatPercent(c.channelPct)}${c.sellerPct !== null ? ` y la tienda ${formatPercent(c.sellerPct)}` : ''}` : ''}.
            </p>
          )}
          {marginPct !== null && level ? (
            <p className={cn('text-sm', level === 'below' ? 'text-red-700' : level === 'between' ? 'text-amber-700' : 'text-emerald-700')}>
              Te queda un margen de {formatPercent(marginPct)} sobre el costo
              {level === 'below' && margin ? `, debajo del mínimo de ${formatPercent(margin.params.minMarginPct)}` : ''}.
              <span className="block text-xs text-muted-foreground">
                Estimado con lo que recibe la tienda{c.channelPct ? `, que suma lo que pone ${channelName}` : ''}.
              </span>
            </p>
          ) : margin && !margin.cost ? (
            <p className="text-xs text-muted-foreground">Sin el costo cargado no se puede calcular el margen.</p>
          ) : null}
          {c.pausesOwnDiscount ? (
            <p className="text-xs text-amber-700">Mientras esté en esta campaña, {channelName} frena el descuento propio.</p>
          ) : null}
        </>
      ) : (
        <p className="text-sm">Sale de {name} y el comprador vuelve a pagar el precio de siempre, con el descuento propio si tiene.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button access={mode === 'now' ? 'subir' : undefined} size="sm" onClick={confirm} disabled={pending || problem !== null} pending={pending}>
          {mode === 'queue' ? 'Dejar en Por subir' : action === 'join' ? 'Sumarse ahora' : 'Salir ahora'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
