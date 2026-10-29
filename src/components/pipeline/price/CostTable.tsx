'use client';

import { RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatPercent, formatPrice } from '@/domain/money';
import { installmentCostPct, LOW_INTEREST_PLAN, pricingText, vatShare, type InstallmentPlan, type PricingKey, type PricingParams } from '@/domain/pricing';
import { cn } from '@/lib/utils/cn';

// La lista de costos del precio final: concepto, % del precio y monto. En
// cada fila se escribe el dato que se conoce (el % para cargos e impuestos, el
// monto para envío y embalaje) y el otro se calcula. Lo que se cambia acá es
// solo para este producto; lo demás sigue a la cuenta. El costo de reposición
// no se escribe acá: sale de la pestaña Costo y Stock del producto.

type Row = {
  key: PricingKey | 'cost';
  label: string;
  // Qué columna se escribe.
  edit: 'pct' | 'amount';
  pct: number | null;
  amount: number | null;
  // Las cuotas que no están elegidas se ven pero no suman.
  counts: boolean;
  suffix?: string;
};

export type CostTotals = { costs: number; profit: number };

export function costRows(args: { params: PricingParams; plan: InstallmentPlan; finalPrice: number; cost: number | null }): { rows: Row[]; totals: CostTotals } {
  const { params, plan, finalPrice: f, cost } = args;
  const pctRow = (key: PricingKey, label: string, counts = true): Row => {
    const pct = params[key] as number | null;
    return { key, label, edit: 'pct', pct, amount: pct === null ? null : (f * pct) / 100, counts };
  };
  const amountRow = (key: PricingKey, label: string): Row => {
    const amount = params[key] as number;
    return { key, label, edit: 'amount', pct: f > 0 ? (amount / f) * 100 : null, amount, counts: true };
  };
  const vat = vatShare(params);
  const rows: Row[] = [
    { key: 'cost', label: 'Costo de reposición sin IVA', edit: 'amount', pct: cost !== null && f > 0 ? (cost / f) * 100 : null, amount: cost, counts: true },
    { key: 'vatRatePct', label: 'IVA', edit: 'pct', pct: vat * 100, amount: f * vat, counts: true, suffix: 'de tasa' },
    pctRow('channelFeePct', 'Cargo del canal'),
    pctRow('taxesPct', 'Impuestos (IIBB, débitos y créditos, SIRTAC)'),
    pctRow('installmentsLowPct', 'Cuota promocionada (3 a 12 cuotas con interés bajo)', plan === LOW_INTEREST_PLAN && installmentCostPct(params, LOW_INTEREST_PLAN) !== null),
    ...([3, 6, 9, 12] as const).map((n) =>
      pctRow(`installments${n}Pct` as PricingKey, `${n} cuotas sin interés`, plan === n && installmentCostPct(params, n) !== null),
    ),
    pctRow('adsPct', 'Publicidad'),
    pctRow('returnsPct', 'Devoluciones y garantías'),
    amountRow('shipping', 'Envío'),
    amountRow('packaging', 'Embalaje y preparación'),
  ];
  const costs = rows.filter((r) => r.counts).reduce((sum, r) => sum + (r.amount ?? 0), 0);
  return { rows, totals: { costs, profit: f - costs } };
}

export function CostTable({
  params,
  account,
  overrides,
  onOverride,
  plan,
  finalPrice,
  cost,
  disabled,
}: {
  params: PricingParams;
  account: PricingParams;
  overrides: Partial<Record<PricingKey, string>>;
  onOverride: (key: PricingKey, text: string | null) => void;
  plan: InstallmentPlan;
  finalPrice: number;
  cost: number | null;
  disabled?: boolean;
}) {
  const { rows, totals } = costRows({ params, plan, finalPrice, cost });
  const money = (n: number | null) => (n === null ? '—' : formatPrice(Math.round(n)));
  const pct = (n: number | null) => (n === null ? '—' : formatPercent(n, 2));
  return (
    <div className="text-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] gap-x-2 border-b px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(0,1fr)_9rem_9rem]">
        <span>Concepto</span>
        <span className="text-right">% del precio final</span>
        <span className="text-right">Monto</span>
      </div>
      <ul className="divide-y">
        {rows.map((r) => {
          const key = r.key;
          const own = key !== 'cost' && overrides[key] !== undefined;
          const value = key === 'cost' ? '' : (overrides[key] ?? pricingText(key, account[key] as number | null));
          const input = (
            <div className="flex items-center justify-end gap-1">
              {r.edit === 'amount' ? <span className="text-xs text-muted-foreground">$</span> : null}
              <Input
                aria-label={`${r.label}${r.edit === 'pct' ? ' en %' : ' en pesos'}`}
                inputMode="decimal"
                value={value}
                placeholder={key !== 'cost' && account[key] === null ? 'Sin cargar' : ''}
                onChange={(e) => key !== 'cost' && onOverride(key, e.target.value)}
                disabled={disabled}
                className="h-8 px-2 text-right tabular-nums"
              />
              {r.edit === 'pct' ? <span className="text-xs text-muted-foreground">%</span> : null}
            </div>
          );
          return (
            <li
              key={key}
              className={cn(
                'grid grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] items-center gap-x-2 px-4 py-1.5 sm:grid-cols-[minmax(0,1fr)_9rem_9rem]',
                !r.counts && 'text-muted-foreground',
              )}
            >
              <span className="min-w-0">
                <span className="block">{r.label}</span>
                {key === 'cost' ? <span className="block text-[11px] text-muted-foreground">Sale de Costo y Stock</span> : null}
                {key === 'vatRatePct' ? <span className="block text-[11px] text-muted-foreground">Tasa {pricingText('vatRatePct', params.vatRatePct)} %, como parte del precio</span> : null}
                {!r.counts ? <span className="block text-[11px]">No suma: {r.pct === null ? 'sin cargar' : 'no es el plan elegido'}</span> : null}
                {own ? (
                  <button
                    type="button"
                    onClick={() => onOverride(key as PricingKey, null)}
                    className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary underline-offset-4 hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden />
                    Propio de este producto. Volver al de la cuenta
                  </button>
                ) : null}
              </span>
              {r.edit === 'pct' ? (
                key === 'vatRatePct' ? (
                  <span className="space-y-0.5 text-right">
                    {input}
                    <span className="block text-[11px] tabular-nums text-muted-foreground">{pct(r.pct)} del precio</span>
                  </span>
                ) : (
                  input
                )
              ) : (
                <span className="text-right tabular-nums">{pct(r.pct)}</span>
              )}
              {key === 'cost' ? (
                <span className="pr-2 text-right tabular-nums">{money(r.amount)}</span>
              ) : r.edit === 'amount' ? (
                input
              ) : (
                <span className="text-right tabular-nums">{money(r.amount)}</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] gap-x-2 border-t bg-muted/40 px-4 py-2 font-medium sm:grid-cols-[minmax(0,1fr)_9rem_9rem]">
        <span>Total de costos</span>
        <span className="text-right tabular-nums">{finalPrice > 0 ? pct((totals.costs / finalPrice) * 100) : '—'}</span>
        <span className="text-right tabular-nums">{money(totals.costs)}</span>
        <span className={cn(totals.profit < 0 && 'text-red-700')}>Ganancia</span>
        <span className={cn('text-right tabular-nums', totals.profit < 0 && 'text-red-700')}>{finalPrice > 0 ? pct((totals.profit / finalPrice) * 100) : '—'}</span>
        <span className={cn('text-right tabular-nums', totals.profit < 0 && 'text-red-700')}>{money(totals.profit)}</span>
      </div>
    </div>
  );
}
