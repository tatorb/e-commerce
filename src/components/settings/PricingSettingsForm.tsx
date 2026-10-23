'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AMOUNT_KEYS, PRICING_DEFAULTS, PRICING_LABEL, pricingText, type PricingKey, type PricingParams } from '@/domain/pricing';
import { savePricingSettingsAction } from '@/app/a/[cuenta]/pipeline/price-actions';

// Los parámetros del precio de la cuenta. Cada casillero vacío toma el valor
// de partida, que se ve de fondo. Los costos de 9 y 12 cuotas arrancan sin
// cargar: hasta que se carguen, esos planes no se pueden elegir.

const GROUPS: { title: string; keys: PricingKey[] }[] = [
  { title: 'Cargos e impuestos', keys: ['channelFeePct', 'taxesPct', 'vatRatePct'] },
  { title: 'Cuotas sin interés', keys: ['installments3Pct', 'installments6Pct', 'installments9Pct', 'installments12Pct'] },
  { title: 'Otros costos por venta', keys: ['adsPct', 'returnsPct', 'shipping', 'packaging'] },
  { title: 'Márgenes sobre el costo', keys: ['minMarginPct', 'targetMarginPct'] },
];

const HINT: Partial<Record<PricingKey, string>> = {
  channelFeePct: 'Lo que cobra el canal por cada venta, en % del precio.',
  vatRatePct: 'La tasa. El precio publicado la incluye; el costo, no.',
  shipping: 'En pesos, por venta.',
  packaging: 'En pesos, por venta.',
};

export function PricingSettingsForm({ accountSlug, initial }: { accountSlug: string; initial: Partial<PricingParams> }) {
  const router = useRouter();
  const start = Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, pricingText(k as PricingKey, v as number | null)])) as Record<string, string>;
  const [values, setValues] = useState<Record<string, string>>(start);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const changed = JSON.stringify(Object.entries(values).filter(([, v]) => v.trim())) !== JSON.stringify(Object.entries(start).filter(([, v]) => v.trim()));

  async function save() {
    setPending(true);
    setMessage(null);
    const r = await savePricingSettingsAction(accountSlug, values).catch(() => null);
    setPending(false);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setMessage({ kind: 'ok', text: 'Guardado. El paso Precio ya usa estos valores.' });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {GROUPS.map((g) => (
        <fieldset key={g.title} className="space-y-3">
          <legend className="text-sm font-medium">{g.title}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {g.keys.map((key) => {
              const amount = AMOUNT_KEYS.includes(key);
              const fallback = PRICING_DEFAULTS[key];
              return (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`p-${key}`}>{PRICING_LABEL[key]}</Label>
                  <div className="flex items-center gap-2">
                    {amount ? <span className="text-sm text-muted-foreground">$</span> : null}
                    <Input
                      id={`p-${key}`}
                      inputMode="decimal"
                      value={values[key] ?? ''}
                      placeholder={fallback === null ? 'Sin cargar' : pricingText(key, fallback)}
                      onChange={(e) => {
                        setValues((v) => ({ ...v, [key]: e.target.value }));
                        setMessage(null);
                      }}
                      className="max-w-40"
                    />
                    {amount ? null : <span className="text-sm text-muted-foreground">%</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {HINT[key] ? `${HINT[key]} ` : ''}
                    {fallback === null ? 'Sin cargar, ese plan no se puede elegir.' : `Vacío es ${pricingText(key, fallback)}${amount ? '' : ' %'}.`}
                  </p>
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} pending={pending} disabled={pending || !changed}>
          Guardar
        </Button>
        {message ? (
          <p className={`text-sm ${message.kind === 'error' ? 'text-destructive' : 'text-foreground'}`} role="status">
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
