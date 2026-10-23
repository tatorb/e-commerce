'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { formatPercent, formatPrice, parsePrice } from '@/domain/money';
import { compare } from '@/domain/price-comparison';
import {
  availablePlans,
  breakdown,
  CUSHION,
  cushionListPrice,
  INSTALLMENT_PLANS,
  listPriceForMargin,
  LOW_INTEREST_PLAN,
  planLabel,
  maxDiscount,
  parsePricingText,
  PRICING_KEYS,
  pricingText,
  references,
  simulate,
  targetListPrice,
  wholeUp,
  type InstallmentPlan,
  type PricingKey,
  type PricingParams,
} from '@/domain/pricing';
import type { PriceStepData } from '@/lib/pricing';
import { savePriceDecisionAction } from '@/app/a/[cuenta]/pipeline/price-actions';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { CompetitionCard } from './CompetitionCard';
import { CostTable } from './CostTable';
import { CompositionBar, LEVEL, MarginBadge, ProfitKnob } from './parts';

// El paso Precio. Con el costo de reposición y los parámetros de la cuenta (o
// los propios del producto), el simulador muestra el precio final, el margen y
// de qué se compone el precio; la perilla mueve el precio hasta la ganancia
// que se quiere, y la competencia que se cargó en Información sirve para
// comparar. Al guardar, el precio queda para subir desde Por subir; el
// descuento y las cuotas se cargan a mano en el canal.

const MAX_DISCOUNT = 50;

type Overrides = Partial<Record<PricingKey, string>>;

// En el selector: la cuota promocionada con su nombre corto.
const planButton = (p: InstallmentPlan) => (p === 0 ? 'Apagadas' : p === LOW_INTEREST_PLAN ? 'Promocionada' : `${p} cuotas`);

// Un monto como se escribe: "99.627,5" o "221.304".
const amountText = (n: number | null) => (n === null ? '' : new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n));

/** Los parámetros escritos para este producto, sobre los de la cuenta. Lo que no se entiende no cuenta. */
function withOverrides(account: PricingParams, overrides: Overrides): { params: PricingParams; bad: PricingKey[] } {
  const params = { ...account };
  const bad: PricingKey[] = [];
  for (const key of PRICING_KEYS) {
    const text = overrides[key];
    if (text === undefined || text.trim() === '') continue;
    const n = parsePricingText(key, text);
    if (typeof n === 'number' && n >= 0) (params as Record<PricingKey, number | null>)[key] = n;
    else bad.push(key);
  }
  return { params, bad };
}

/** Los propios del producto que se guardan: solo los que no son iguales a la cuenta. */
function ownValues(account: PricingParams, overrides: Overrides): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of PRICING_KEYS) {
    const text = overrides[key];
    if (text === undefined || text.trim() === '') continue;
    const n = parsePricingText(key, text);
    if (n !== account[key]) out[key] = text;
  }
  return out;
}

export function PriceStep({
  accountSlug,
  data,
  today,
  timeZone,
  infoHref,
  settingsHref,
}: {
  accountSlug: string;
  data: PriceStepData;
  today: string;
  timeZone: string;
  infoHref: string;
  settingsHref: string;
}) {
  const router = useRouter();
  const account = data.account;
  const initialOverrides = Object.fromEntries(
    Object.entries(data.overrides).map(([k, v]) => [k, pricingText(k as PricingKey, v as number | null)]),
  ) as Overrides;
  const [overrides, setOverrides] = useState<Overrides>(initialOverrides);
  const [costText, setCostText] = useState(amountText(data.cost));
  const { params, bad } = withOverrides(account, overrides);
  const costParsed = parsePrice(costText);
  const cost = typeof costParsed === 'number' && costParsed > 0 ? costParsed : null;

  const start = data.decision ?? null;
  const [plan, setPlan] = useState<InstallmentPlan>((start?.installments as InstallmentPlan) ?? 0);
  const [discount, setDiscount] = useState(start?.discountPct ?? 0);
  const firstPrice = start?.listPrice ?? data.price ?? (cost ? targetListPrice(cost, params, 0, 0) : null) ?? 0;
  const [listText, setListText] = useState(firstPrice ? amountText(firstPrice) : '');
  const listParsed = parsePrice(listText);
  const listPrice = typeof listParsed === 'number' ? listParsed : 0;
  const setList = (n: number | null) => n !== null && setListText(amountText(Math.round(n)));

  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const plans = availablePlans(params);
  const sim = simulate({ listPrice, discountPct: discount, plan, cost: cost ?? 0, params });
  const parts = breakdown(sim.finalPrice, cost ?? 0, params, plan);
  const refs = cost ? references(listPrice, cost, params) : null;
  const comparison =
    data.competitors.length > 0 && listPrice > 0 ? compare({ mine: { listPrice, discountPct: discount, plan }, competitors: data.competitors, cost: cost ?? 0, params }) : null;
  const ready = cost !== null && listPrice > 0;
  const below = ready && sim.level === 'below';
  const own = ownValues(account, overrides);
  const saved = start ? start.listPrice === Math.round(listPrice) && start.discountPct === discount && start.installments === plan : false;
  const dirty =
    !saved || costText !== amountText(data.cost) || JSON.stringify(own) !== JSON.stringify(ownValues(account, initialOverrides));

  const change = (fn: () => void) => {
    fn();
    setMessage(null);
    setNote(null);
  };

  async function save() {
    setPending(true);
    setMessage(null);
    const r = await savePriceDecisionAction(accountSlug, data.publicationId, {
      listPrice: Math.round(listPrice),
      discountPct: discount,
      plan,
      cost: costText,
      overrides: own,
      confirmBelowMin: confirm,
    }).catch(() => null);
    setPending(false);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setMessage({
      kind: 'ok',
      text: data.channelPrice !== null ? `Precio guardado. Queda en Por subir para mandarlo a ${data.channelName}.` : 'Precio guardado. Va con la publicación cuando la crees en el canal.',
    });
    setConfirm(false);
    router.refresh();
  }

  const levelBox = ready ? LEVEL[sim.level] : null;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <SectionCard
          title="Simulador"
          description={`El costo es del producto${data.sharedWith > 0 ? ` y lo comparten sus ${data.sharedWith + 1} publicaciones` : ''}. El precio publicado incluye IVA.`}
        >
          <SectionBody>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="price-cost">Costo de reposición sin IVA</Label>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input id="price-cost" inputMode="decimal" value={costText} placeholder="99.627,50" onChange={(e) => change(() => setCostText(e.target.value))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price-list">Precio publicado</Label>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input id="price-list" inputMode="decimal" value={listText} placeholder="221.304" onChange={(e) => change(() => setListText(e.target.value))} />
                </div>
                {data.channelPrice !== null ? (
                  <p className="text-xs text-muted-foreground">
                    En {data.channelName} está a {formatPrice(data.channelPrice)}.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Cuotas</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cuotas">
                {INSTALLMENT_PLANS.map((p) => {
                  const enabled = plans.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={plan === p}
                      disabled={!enabled}
                      title={
                        !enabled
                          ? `Cargá el costo de ${planLabel(p).toLowerCase()} en Ajustes > Precios`
                          : p === LOW_INTEREST_PLAN
                            ? 'De 3 a 12 cuotas con interés bajo: el comprador paga parte del interés'
                            : undefined
                      }
                      onClick={() => change(() => setPlan(p))}
                      className={cn(
                        'rounded-full border px-3 py-1 text-sm transition-colors',
                        plan === p ? 'border-foreground bg-foreground text-background' : 'bg-background text-muted-foreground hover:text-foreground',
                        !enabled && 'cursor-not-allowed opacity-40 hover:text-muted-foreground',
                      )}
                    >
                      {planButton(p)}
                    </button>
                  );
                })}
              </div>
              {plans.length < INSTALLMENT_PLANS.length ? (
                <p className="text-xs text-muted-foreground">
                  Los planes sin costo cargado no se pueden elegir: se cargan en{' '}
                  <Link href={settingsHref} className="text-primary underline-offset-4 hover:underline">
                    Ajustes &gt; Precios
                  </Link>
                  .
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="price-discount">Descuento</Label>
                <span className="text-sm font-medium tabular-nums">{formatPercent(discount)}</span>
              </div>
              <input
                id="price-discount"
                type="range"
                min={0}
                max={MAX_DISCOUNT}
                step={0.5}
                value={discount}
                onChange={(e) => change(() => setDiscount(Number(e.target.value)))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>0 %</span>
                <span>{MAX_DISCOUNT} %</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!cost}
                onClick={() => change(() => setList(cost ? targetListPrice(cost, params, plan, discount) : null))}
              >
                Publicar al objetivo
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!cost || cushionListPrice(cost, params) === null}
                onClick={() =>
                  change(() => {
                    setList(cost ? cushionListPrice(cost, params) : null);
                    setNote(`Este precio aguanta ${CUSHION.plan} cuotas y ${CUSHION.discountPct} % de descuento sin bajar del margen mínimo.`);
                  })
                }
              >
                Objetivo + colchón {CUSHION.plan} cuotas y {CUSHION.discountPct} % off
              </Button>
            </div>
            {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
            {bad.length > 0 ? <p className="text-sm text-destructive">Hay parámetros que no se entienden en la lista de costos: no se usan.</p> : null}
          </SectionBody>
        </SectionCard>

        <SectionCard title="Resultado">
          <SectionBody>
            {!cost ? (
              <p className="text-sm text-muted-foreground">Cargá el costo de reposición sin IVA para ver el margen.</p>
            ) : null}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Precio final al comprador</p>
              <p className="text-3xl font-semibold tabular-nums">{listPrice > 0 ? formatPrice(Math.round(sim.finalPrice)) : '—'}</p>
              <p className="text-sm text-muted-foreground">
                {discount > 0 ? `Publicado a ${formatPrice(Math.round(listPrice))} con ${formatPercent(discount)} de descuento. ` : ''}
                {plan === LOW_INTEREST_PLAN
                  ? 'Cuota promocionada: de 3 a 12 cuotas con interés bajo.'
                  : plan > 0 && listPrice > 0
                    ? `${plan} cuotas sin interés de ${formatPrice(Math.round(sim.finalPrice / plan))}.`
                    : 'Sin cuotas.'}
              </p>
            </div>
            {ready && levelBox ? (
              <div className={cn('space-y-1 rounded-md border px-3 py-2', levelBox.box)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Margen sobre el costo</p>
                  <MarginBadge level={sim.level} />
                </div>
                <p className={cn('text-3xl font-semibold tabular-nums', levelBox.text)}>{formatPercent(sim.marginPct)}</p>
                <p className="text-sm">
                  Ganancia de {formatPrice(Math.round(sim.profit))} por venta, {formatPercent(sim.profitShareOfPrice)} del precio final.
                </p>
                <p className="text-xs text-muted-foreground">
                  Mínimo {formatPercent(params.minMarginPct)}, objetivo {formatPercent(params.targetMarginPct)}.
                </p>
              </div>
            ) : null}
          </SectionBody>
        </SectionCard>
      </div>

      <SectionCard title="Perilla de ganancia" description="Arrastrala para llevar la ganancia sobre el costo adonde quieras: el precio publicado se acomoda solo.">
        <SectionBody>
          {ready ? (
            <>
              <p className="text-sm">
                <span className="font-medium tabular-nums">{formatPercent(sim.marginPct)}</span> sobre el costo ·{' '}
                <span className="tabular-nums">{formatPercent(sim.profitShareOfPrice)}</span> del precio final ·{' '}
                <span className="tabular-nums">{formatPrice(Math.round(sim.profit))}</span>
              </p>
              <ProfitKnob
                marginPct={sim.marginPct}
                minPct={params.minMarginPct}
                targetPct={params.targetMarginPct}
                onChange={(m) => change(() => setList(listPriceForMargin({ marginPct: m, discountPct: discount, plan, cost: cost!, params })))}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Cargá el costo y el precio publicado para usarla.</p>
          )}
        </SectionBody>
      </SectionCard>

      <SectionCard title="De qué se compone el precio final">
        <SectionBody>
          {listPrice > 0 ? <CompositionBar parts={parts} finalPrice={sim.finalPrice} /> : <p className="text-sm text-muted-foreground">Cargá el precio publicado.</p>}
        </SectionBody>
      </SectionCard>

      <SectionCard
        title="Costos"
        description="En cada fila escribí lo que sabés: el % en los cargos e impuestos, el monto en el costo, el envío y el embalaje. Lo que cambies acá es solo para este producto."
      >
        <CostTable
          params={params}
          account={account}
          overrides={overrides}
          onOverride={(key, text) =>
            change(() =>
              setOverrides((o) => {
                const next = { ...o };
                if (text === null) delete next[key];
                else next[key] = text;
                return next;
              }),
            )
          }
          costText={costText}
          onCost={(text) => change(() => setCostText(text))}
          plan={plan}
          finalPrice={sim.finalPrice}
          cost={cost}
        />
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <SectionCard title="Precios de referencia" description="Sin cuotas ni descuento.">
          <SectionBody>
            {refs ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt>
                    Precio piso <span className="text-muted-foreground">(margen mínimo)</span>
                  </dt>
                  <dd className="font-medium tabular-nums">{refs.floor === null ? '—' : formatPrice(wholeUp(refs.floor))}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>
                    Precio objetivo <span className="text-muted-foreground">(margen objetivo)</span>
                  </dt>
                  <dd className="font-medium tabular-nums">{refs.target === null ? '—' : formatPrice(wholeUp(refs.target))}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>
                    Presupuesto de promo <span className="text-muted-foreground">(hasta el piso)</span>
                  </dt>
                  <dd className={cn('font-medium tabular-nums', refs.promoBudgetPct !== null && refs.promoBudgetPct < 0 && 'text-red-700')}>
                    {refs.promoBudgetPct === null ? '—' : formatPercent(refs.promoBudgetPct)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Cargá el costo para verlos.</p>
            )}
          </SectionBody>
        </SectionCard>
        <SectionCard title="Descuento máximo" description="El más grande que aguanta este precio publicado sin bajar del margen mínimo.">
          <SectionBody>
            {ready ? (
              <dl className="space-y-2 text-sm">
                {plans.map((p) => {
                  const d = maxDiscount(listPrice, cost!, params, p);
                  return (
                    <div key={p} className="flex justify-between gap-3">
                      <dt>{planLabel(p)}</dt>
                      <dd className={cn('font-medium tabular-nums', d === null && 'text-red-700')}>{d === null ? 'No entra' : formatPercent(d)}</dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Cargá el costo y el precio publicado para verlo.</p>
            )}
          </SectionBody>
        </SectionCard>
      </div>

      <CompetitionCard
        comparison={comparison}
        params={params}
        plan={plan}
        withoutPrice={data.competitorsWithoutPrice}
        infoHref={infoHref}
        today={today}
        onMatch={(d) => change(() => setDiscount(Math.ceil(d * 100) / 100))}
        onCopyPlan={(p) => change(() => setPlan(p))}
      />

      <SectionCard
        title="Guardar el precio"
        description={`El precio publicado pasa a Por subir y se manda a ${data.channelName} desde ahí. El descuento y las cuotas se cargan a mano allá: el paso Publicación te dice qué poner.`}
      >
        <SectionBody>
          {start ? (
            <p className="text-sm text-muted-foreground">
              Último guardado: {formatPrice(start.listPrice)}
              {start.discountPct > 0 ? ` con ${formatPercent(start.discountPct)} de descuento` : ''}, {planLabel(start.installments).toLowerCase()},
              margen {formatPercent(start.marginPct)}. El {formatDateTime(start.decidedAt, timeZone)}
              {start.decidedBy ? ` por ${start.decidedBy}` : ''}.
              {start.belowMinConfirmed ? ' Se confirmó debajo del mínimo.' : ''}
            </p>
          ) : null}
          {below && dirty ? (
            <label className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
              <span>
                El margen queda en {formatPercent(sim.marginPct)}, debajo del mínimo de {formatPercent(params.minMarginPct)}. Confirmo este precio igual.
              </span>
            </label>
          ) : null}
          <div className="hidden flex-wrap items-center gap-3 md:flex">
            <Button onClick={save} pending={pending} disabled={pending || !ready || (below && !confirm) || !dirty}>
              Guardar precio
            </Button>
            {message ? (
              <p className={cn('text-sm', message.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
                {message.text}
              </p>
            ) : !dirty && start ? (
              <p className="text-sm text-muted-foreground">Sin cambios desde el último guardado.</p>
            ) : null}
          </div>
        </SectionBody>
      </SectionCard>

      {/* En el celular, el resultado y Guardar quedan fijos abajo. */}
      <div className="sticky bottom-0 z-30 -mx-4 border-t bg-background/95 px-4 py-2 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tabular-nums">{listPrice > 0 ? formatPrice(Math.round(sim.finalPrice)) : '—'}</p>
            {ready ? (
              <p className={cn('flex items-center gap-1.5 text-xs', LEVEL[sim.level].text)}>
                <span aria-hidden className={cn('h-2 w-2 rounded-full', LEVEL[sim.level].dot)} />
                Margen {formatPercent(sim.marginPct)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Falta el costo</p>
            )}
          </div>
          <Button size="sm" onClick={save} pending={pending} disabled={pending || !ready || (below && !confirm) || !dirty}>
            Guardar precio
          </Button>
        </div>
        {message ? (
          <p className={cn('mt-1 text-xs', message.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
