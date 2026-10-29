'use client';

import { BREAKDOWN_PARTS, type BreakdownPart, type MarginLevel } from '@/domain/pricing';
import { formatPercent, formatPrice } from '@/domain/money';
import { cn } from '@/lib/utils/cn';

// Las piezas que se ven en el paso Precio: el semáforo del margen, la barra
// con la composición del precio y la perilla de ganancia.

export const LEVEL: Record<MarginLevel, { label: string; dot: string; box: string; text: string }> = {
  target: { label: 'En el objetivo', dot: 'bg-emerald-500', box: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-800' },
  between: { label: 'Entre el mínimo y el objetivo', dot: 'bg-amber-500', box: 'border-amber-200 bg-amber-50', text: 'text-amber-800' },
  below: { label: 'Debajo del mínimo', dot: 'bg-red-500', box: 'border-red-200 bg-red-50', text: 'text-red-800' },
};

export function MarginBadge({ level }: { level: MarginLevel }) {
  const l = LEVEL[level];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium', l.box, l.text)}>
      <span aria-hidden className={cn('h-2 w-2 rounded-full', l.dot)} />
      {l.label}
    </span>
  );
}

export const PART: Record<BreakdownPart, { label: string; color: string }> = {
  cost: { label: 'Costo', color: 'bg-slate-500' },
  vat: { label: 'IVA', color: 'bg-amber-400' },
  channelFee: { label: 'Cargo del canal', color: 'bg-yellow-300' },
  installments: { label: 'Cuotas', color: 'bg-violet-400' },
  taxes: { label: 'Impuestos', color: 'bg-orange-400' },
  adsReturns: { label: 'Publicidad y devoluciones', color: 'bg-pink-400' },
  shippingPackaging: { label: 'Envío y embalaje', color: 'bg-sky-400' },
  profit: { label: 'Ganancia', color: 'bg-emerald-500' },
};

/** La barra con de qué se compone el precio final. Una ganancia negativa no ocupa lugar: se avisa abajo. */
export function CompositionBar({ parts, finalPrice }: { parts: Record<BreakdownPart, number>; finalPrice: number }) {
  const shown = BREAKDOWN_PARTS.filter((k) => parts[k] > 0.005);
  const total = shown.reduce((sum, k) => sum + parts[k], 0);
  return (
    <div className="space-y-3">
      <div className="flex h-7 w-full overflow-hidden rounded-md border" role="img" aria-label="Composición del precio final">
        {shown.map((k) => (
          <div
            key={k}
            className={cn('h-full', PART[k].color)}
            style={{ width: `${(parts[k] / total) * 100}%` }}
            title={`${PART[k].label}: ${formatPrice(Math.round(parts[k]))}`}
          />
        ))}
      </div>
      {/* En cuatro columnas solo cuando la tarjeta ocupa todo el ancho; en la computadora va a media pantalla. */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4 lg:grid-cols-2">
        {BREAKDOWN_PARTS.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span aria-hidden className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', PART[k].color)} />
            <span className="min-w-0 leading-tight">{PART[k].label}</span>
            <span className={cn('ml-auto shrink-0 whitespace-nowrap tabular-nums', parts[k] < 0 ? 'text-red-700' : 'text-muted-foreground')}>
              {finalPrice > 0 ? formatPercent((parts[k] / finalPrice) * 100) : '—'}
            </span>
          </li>
        ))}
      </ul>
      {parts.profit < 0 ? <p className="text-sm text-red-700">A este precio se pierde {formatPrice(Math.round(-parts.profit))} por venta.</p> : null}
    </div>
  );
}

const KNOB = { min: -20, max: 100 };

/** La perilla de ganancia: arrastrarla cambia el precio publicado. Muestra dónde están el 0, el mínimo y el objetivo. */
export function ProfitKnob({
  marginPct,
  minPct,
  targetPct,
  onChange,
  disabled,
}: {
  marginPct: number;
  minPct: number;
  targetPct: number;
  onChange: (marginPct: number) => void;
  disabled?: boolean;
}) {
  const at = (v: number) => `${((Math.min(Math.max(v, KNOB.min), KNOB.max) - KNOB.min) / (KNOB.max - KNOB.min)) * 100}%`;
  const marks = [
    { value: 0, label: '0 %' },
    { value: minPct, label: `Mín. ${formatPercent(minPct, 0)}` },
    { value: targetPct, label: `Obj. ${formatPercent(targetPct, 0)}` },
  ];
  return (
    <div className="space-y-1">
      <div className="relative px-2">
        <input
          type="range"
          min={KNOB.min}
          max={KNOB.max}
          step={0.5}
          value={Math.min(Math.max(marginPct, KNOB.min), KNOB.max)}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          aria-label="Ganancia sobre el costo"
          className="w-full accent-emerald-600"
        />
        {/* El mínimo va un renglón más abajo, así no se pisa con los otros en el celular. */}
        <div aria-hidden className="relative h-11">
          {marks.map((m, i) => (
            <span key={m.label} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: at(m.value) }}>
              <span className={cn('mx-auto block w-px bg-foreground/40', i === 1 ? 'h-5' : 'h-2')} />
              <span className="block whitespace-nowrap text-[11px] text-muted-foreground">{m.label}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex justify-between px-2 text-[11px] text-muted-foreground">
        <span>{KNOB.min} %</span>
        <span>{KNOB.max} %</span>
      </div>
    </div>
  );
}
