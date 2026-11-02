'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ChannelCampaign } from '@/channels/publish-types';
import { formatPercent, formatPrice, parsePrice } from '@/domain/money';
import { marginLevel, marginOf, type InstallmentPlan, type PricingParams } from '@/domain/pricing';
import { campaignRevenue } from '@/domain/promotions';
import { familyCampaigns, isIn, memberStateText, planFamilyAction, rangeText, splitText, type FamilyCampaign, type MemberPlan } from '@/domain/family-campaigns';
import type { PendingCampaign } from '@/lib/channel-campaigns';
import type { PromotionsRead } from '@/lib/channel-promotions';
import type { FamilyCampaignActionResult } from '@/lib/family-campaign-input';
import { cancelCampaignAction, queueFamilyCampaignAction } from '@/app/a/[cuenta]/pipeline/price-actions';
import { sendFamilyCampaignNowAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';
import { cn } from '@/lib/utils/cn';

// Las campañas del canal de una publicación y, en una familia, de todas sus
// medidas: cada campaña es una fila con cómo está cada medida, y sumarse o
// salir se pide para todas a la vez. En las que se elige el precio, solo para
// las medidas que comparten precio (las de la pestaña); las de otro precio se
// suman desde su pestaña. Si las medidas quedan en estados distintos, avisa
// que la familia está partida. En el Pipeline queda en Por subir (mode queue);
// en la página de la publicación se manda en el momento (mode now). Antes de
// confirmar, muestra el precio para el comprador, el margen y qué pasa con
// cada medida.

/** Con qué se calcula el margen: el costo, los parámetros de precio y las cuotas de la publicación. */
export type MarginContext = { cost: number | null; params: PricingParams; plan: InstallmentPlan };

/**
 * La campaña abierta para sumarse o salir, con el precio escrito: Guardar en el
 * paso Precio la deja en Por subir para las medidas que pueden. problem: por
 * qué no puede ninguna.
 */
export type CampaignDraft = {
  publicationIds: string[];
  campaign: string;
  name: string;
  action: 'join' | 'leave';
  price: number | null;
  problem: string | null;
};

const STATUS: Record<'active' | 'scheduled' | 'invited' | 'none', string> = {
  active: 'bg-emerald-100 text-emerald-900',
  scheduled: 'bg-sky-100 text-sky-900',
  invited: 'bg-amber-100 text-amber-900',
  none: 'bg-muted text-muted-foreground',
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

/** La campaña de la medida que se mira: la primera de la pestaña que la tiene, si no, cualquiera. */
function leadOf(g: FamilyCampaign, tabIds: string[]): ChannelCampaign {
  return (g.members.find((m) => tabIds.includes(m.publicationId) && m.campaign) ?? g.members.find((m) => m.campaign))!.campaign!;
}

/** Lo que se puede hacer con la campaña: sumar las medidas que faltan, sacar las que están. */
function actionsOf(g: FamilyCampaign): { join: boolean; leave: boolean } {
  return {
    join: g.members.some((m) => m.campaign && !isIn(m.campaign) && m.campaign.join !== null),
    leave: g.members.some((m) => isIn(m.campaign) && m.campaign!.canLeave),
  };
}

/** Lo que se pide con la campaña abierta y el precio escrito, y por qué no puede ninguna medida. */
function draftOf(g: FamilyCampaign, tabIds: string[], action: 'join' | 'leave', priceText: string, channelName: string): { draft: CampaignDraft; plans: MemberPlan[] } {
  const withPrice = action === 'join' && g.members.some((m) => m.campaign?.join === 'price');
  const typed = parsePrice(priceText);
  const price = withPrice ? (typeof typed === 'number' ? typed : null) : null;
  const plans = planFamilyAction(g, { action, price, samePrice: tabIds, channelName });
  const any = plans.some((p) => p.outcome === 'do');
  return {
    plans,
    draft: {
      publicationIds: tabIds,
      campaign: g.key,
      name: g.name,
      action,
      price: withPrice ? (plans.find((p) => p.outcome === 'do')?.price ?? price) : null,
      problem: any ? null : (plans.find((p) => p.outcome === 'skip' || p.outcome === 'elsewhere')?.message ?? 'Ninguna medida tiene algo para cambiar.'),
    },
  };
}

export function CampaignList({
  accountSlug,
  reads,
  family = [],
  pending,
  mode,
  channelName,
  margin,
  timeZone,
  onChanged,
  onDraft,
}: {
  accountSlug: string;
  // Las medidas que comparten el precio que se mira (la pestaña, o la publicación).
  reads: PromotionsRead[];
  // Las demás medidas de la familia.
  family?: PromotionsRead[];
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
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; lines: string[] } | null>(null);
  const measures = [...reads, ...family];
  const groups = familyCampaigns(measures.map((m) => ({ publicationId: m.publicationId, label: m.label, campaigns: m.promotions.campaigns })));
  const tabIds = reads.map((r) => r.publicationId);
  const several = measures.length > 1;
  if (groups.length === 0) return <p className="text-sm text-muted-foreground">No está en ninguna campaña y no la invitan a ninguna.</p>;
  const split = groups.filter((g) => g.split);
  return (
    <div className="space-y-2">
      {split.length > 0 ? (
        <div className="space-y-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Familia partida: no todas las medidas están en la misma campaña.
          </p>
          <ul className="list-disc pl-5 text-xs">
            {split.map((g) => (
              <li key={g.key}>{splitText(g)}.</li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className="divide-y rounded-md border text-sm">
        {groups.map((g) => (
          <CampaignRow
            key={g.key}
            accountSlug={accountSlug}
            group={g}
            tabIds={tabIds}
            several={several}
            queued={pending.filter((p) => g.members.some((m) => m.publicationId === p.publicationId && (m.campaign?.ref === p.ref || (p.name === g.name && p.kind === g.kind))))}
            mode={mode}
            channelName={channelName}
            margin={margin}
            timeZone={timeZone}
            openAction={open?.startsWith(`${g.key}|`) ? (open.split('|').pop() as 'join' | 'leave') : null}
            onOpen={(action) => {
              setOpen(action ? `${g.key}|${action}` : null);
              setNotice(null);
              if (!action) onDraft?.(null);
            }}
            onDraft={onDraft}
            onDone={(lines, ok) => {
              setOpen(null);
              setNotice({ kind: ok ? 'ok' : 'error', lines });
              onDraft?.(null);
              onChanged();
            }}
            onError={(text) => setNotice({ kind: 'error', lines: [text] })}
          />
        ))}
      </ul>
      {notice ? (
        <div className={cn('space-y-0.5 text-sm', notice.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
          {notice.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {mode === 'queue'
          ? `Sumarse o salir queda en Por subir y se manda a ${channelName} con los demás cambios.`
          : `Sumarse o salir se manda a ${channelName} en el momento.`}{' '}
        {several ? 'En una familia se pide para todas las medidas a la vez. ' : ''}
        Oferta del día, relámpago y por volumen se manejan en {channelName}.
      </p>
    </div>
  );
}

function CampaignRow({
  accountSlug,
  group: g,
  tabIds,
  several,
  queued,
  mode,
  channelName,
  margin,
  timeZone,
  openAction,
  onOpen,
  onDraft,
  onDone,
  onError,
}: {
  accountSlug: string;
  group: FamilyCampaign;
  tabIds: string[];
  several: boolean;
  queued: PendingCampaign[];
  mode: 'queue' | 'now';
  channelName: string;
  margin: MarginContext | null;
  timeZone: string;
  openAction: 'join' | 'leave' | null;
  onOpen: (action: 'join' | 'leave' | null) => void;
  onDraft?: (draft: CampaignDraft | null) => void;
  onDone: (lines: string[], ok: boolean) => void;
  onError: (text: string) => void;
}) {
  const router = useRouter();
  const c = leadOf(g, tabIds);
  const [pending, setPending] = useState(false);
  const facts = [
    c.price !== null ? `El comprador paga ${formatPrice(c.price)}` : null,
    c.channelPct ? `${channelName} pone ${formatPercent(c.channelPct)}${c.sellerPct !== null ? ` y la tienda ${formatPercent(c.sellerPct)}` : ''}` : null,
    datesText(c.start, c.finish, timeZone),
  ].filter(Boolean);
  const can = actionsOf(g);
  const labelOf = (id: string) => g.members.find((m) => m.publicationId === id)?.label ?? '';

  async function cancel() {
    setPending(true);
    for (const q of queued) {
      const r = await cancelCampaignAction(accountSlug, q.id).catch(() => null);
      if (!r || !r.ok) {
        setPending(false);
        return onError(r ? r.error : 'Se cortó la conexión con la app. Probá de nuevo.');
      }
    }
    setPending(false);
    router.refresh();
    onDone([`Se sacó de Por subir lo pedido para ${g.name}.`], true);
  }

  const open = (action: 'join' | 'leave') => {
    onOpen(action);
    onDraft?.(draftOf(g, tabIds, action, amountText(c.range?.suggestedPrice ?? c.range?.maxPrice ?? null), channelName).draft);
  };

  return (
    <li className="space-y-2 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <span className="font-medium">{g.name}</span>
          <div className="flex flex-wrap gap-1">
            {g.members.map((m) => (
              <span key={m.publicationId} className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS[m.campaign?.status ?? 'none'])}>
                {several ? `${m.label}: ` : ''}
                {memberStateText(m.campaign)}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {g.name !== g.kind ? `${g.kind}. ` : ''}
            {facts.length > 0 ? `${facts.join(', ')}.` : null}
          </p>
        </div>
        {queued.length > 0 || openAction ? null : can.join || can.leave ? (
          <div className="flex flex-wrap gap-1.5">
            {can.join ? (
              <Button access={mode === 'now' ? 'subir' : undefined} size="sm" variant="outline" onClick={() => open('join')}>
                {several ? 'Sumar todas las medidas' : 'Sumarse'}
              </Button>
            ) : null}
            {can.leave ? (
              <Button access={mode === 'now' ? 'subir' : undefined} size="sm" variant="outline" onClick={() => open('leave')}>
                {several ? 'Sacar todas' : 'Salir'}
              </Button>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Se maneja en {channelName}</span>
        )}
      </div>
      {queued.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
          <span>
            En Por subir:{' '}
            {queued
              .map((q) => `${several ? `${labelOf(q.publicationId)}, ` : ''}${q.action === 'join' ? `sumarse${q.price !== null ? ` con ${formatPrice(q.price)}` : ''}` : 'salir'}`)
              .join(' · ')}
            {queued
              .filter((q) => q.rejection)
              .map((q) => (
                <span key={q.id} className="block text-destructive">
                  No se pudo la última vez{several ? ` (${labelOf(q.publicationId)})` : ''}: {q.rejection}
                </span>
              ))}
          </span>
          <Button size="sm" variant="ghost" onClick={cancel} disabled={pending} pending={pending}>
            Sacar de Por subir
          </Button>
        </div>
      ) : null}
      {openAction && queued.length === 0 ? (
        <ChoicePanel
          accountSlug={accountSlug}
          group={g}
          tabIds={tabIds}
          several={several}
          action={openAction}
          mode={mode}
          channelName={channelName}
          margin={margin}
          onCancel={() => onOpen(null)}
          onPrice={(text) => onDraft?.(draftOf(g, tabIds, openAction, text, channelName).draft)}
          onDone={onDone}
          onError={onError}
        />
      ) : null}
    </li>
  );
}

const PLAN_CLASS: Record<MemberPlan['outcome'], string> = {
  do: 'text-foreground',
  already: 'text-muted-foreground',
  skip: 'text-destructive',
  elsewhere: 'text-amber-700',
};

/** Lo que pasó con cada medida, en una línea. */
function resultLines(r: Extract<FamilyCampaignActionResult, { ok: true }>, action: 'join' | 'leave', mode: 'queue' | 'now', channelName: string, several: boolean): string[] {
  return r.results.map((x) => {
    const who = several ? `${x.label}: ` : '';
    if (x.result === 'pedido') return `${who}quedó en Por subir ${action === 'join' ? `sumarse a ${r.name}` : `salir de ${r.name}`}.`;
    if (x.result === 'hecho') return `${who}${action === 'join' ? `se sumó a ${r.name}` : `salió de ${r.name}`} en ${channelName}.`;
    return x.message ?? `${who}no se pudo.`;
  });
}

function ChoicePanel({
  accountSlug,
  group: g,
  tabIds,
  several,
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
  group: FamilyCampaign;
  tabIds: string[];
  several: boolean;
  action: 'join' | 'leave';
  mode: 'queue' | 'now';
  channelName: string;
  margin: MarginContext | null;
  onCancel: () => void;
  // Cada vez que cambia el precio escrito.
  onPrice: (text: string) => void;
  onDone: (lines: string[], ok: boolean) => void;
  onError: (text: string) => void;
}) {
  const router = useRouter();
  const c = leadOf(g, tabIds);
  const withPrice = action === 'join' && g.members.some((m) => m.campaign?.join === 'price');
  const [priceText, setPriceText] = useState(amountText(c.range?.suggestedPrice ?? c.range?.maxPrice ?? null));
  const [pending, setPending] = useState(false);
  const { draft, plans } = draftOf(g, tabIds, action, priceText, channelName);
  const typed = parsePrice(priceText);
  const price = withPrice ? (typeof typed === 'number' ? typed : null) : c.price;
  // El margen: con lo que recibe la tienda, que suma la parte que pone el canal.
  const revenue = action === 'join' && price !== null ? campaignRevenue({ price, channelPct: c.channelPct, listPrice: c.listPrice }) : null;
  const marginPct = revenue !== null && margin?.cost ? marginOf(revenue, margin.cost, margin.params, margin.plan) : null;
  const level = marginPct !== null && margin ? marginLevel(marginPct, margin.params) : null;
  // Los rangos que acepta cada medida que comparte el precio, si no son todos iguales.
  const ranges = g.members.filter((m) => tabIds.includes(m.publicationId) && m.campaign?.range).map((m) => ({ label: m.label, text: rangeText(m.campaign!) }));
  const sameRange = new Set(ranges.map((r) => r.text)).size <= 1;

  async function confirm() {
    setPending(true);
    const input = { publicationIds: tabIds, campaign: g.key, action, price: draft.price };
    const r = await (mode === 'queue' ? queueFamilyCampaignAction(accountSlug, input) : sendFamilyCampaignNowAction(accountSlug, input)).catch(() => null);
    setPending(false);
    if (!r) return onError('Se cortó la conexión con la app. Probá de nuevo.');
    if (!r.ok) return onError(r.error);
    router.refresh();
    const ok = r.results.every((x) => x.result === 'pedido' || x.result === 'hecho' || x.result === 'ya_estaba');
    onDone(resultLines(r, action, mode, channelName, several), ok);
  }

  return (
    <div className="space-y-2 rounded-md border bg-background px-3 py-2.5">
      {action === 'join' ? (
        <>
          {withPrice ? (
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor={`precio-${g.key}`}>
                Precio para el comprador en la campaña
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  id={`precio-${g.key}`}
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
                {ranges.length === 0
                  ? `${channelName} no informó el rango.`
                  : sameRange
                    ? `${channelName} acepta ${ranges[0].text}.`
                    : `${channelName} acepta ${ranges.map((r) => `${r.label} ${r.text}`).join(', ')}.`}
                {c.range?.suggestedPrice ? ` Sugiere ${formatPrice(c.range.suggestedPrice)}.` : ''}
                {c.listPrice && price ? ` Es ${formatPercent((1 - price / c.listPrice) * 100)} menos que ${formatPrice(c.listPrice)}.` : ''}
              </p>
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
          {c.pausesOwnDiscount ? <p className="text-xs text-amber-700">Mientras esté en esta campaña, {channelName} frena el descuento propio.</p> : null}
        </>
      ) : (
        <p className="text-sm">Sale de {g.name} y el comprador vuelve a pagar el precio de siempre, con el descuento propio si tiene.</p>
      )}
      {several ? (
        <ul className="space-y-0.5 text-xs">
          {plans.map((p) => (
            <li key={p.publicationId} className={PLAN_CLASS[p.outcome]}>
              {p.outcome === 'do' ? `${p.label}: ${action === 'join' ? 'se suma' : 'sale'}${p.price !== null ? ` con ${formatPrice(p.price)}` : ''}.` : p.message}
            </li>
          ))}
        </ul>
      ) : draft.problem ? (
        <p className="text-xs text-destructive">{draft.problem}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button access={mode === 'now' ? 'subir' : undefined} size="sm" onClick={confirm} disabled={pending || draft.problem !== null} pending={pending}>
          {mode === 'queue' ? 'Dejar en Por subir' : action === 'join' ? 'Sumarse ahora' : 'Salir ahora'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
