'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusText } from '@/components/pipeline/StatusText';
import { setProductCostsAction } from '@/app/a/[cuenta]/productos/stock-actions';

// El costo de reposición sin IVA del producto, uno por medida. Lo heredan sus
// publicaciones en el paso Precio. Guardarlo no sube nada al canal.

// Un monto como se escribe: "99.627,5".
const amountText = (n: number | null) => (n === null ? '' : new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n));

export function CostForm({
  accountSlug,
  productId,
  lines,
}: {
  accountSlug: string;
  productId: string;
  lines: { key: string; label: string; cost: number | null }[];
}) {
  const router = useRouter();
  const start = Object.fromEntries(lines.map((l) => [l.key, amountText(l.cost)]));
  const [values, setValues] = useState<Record<string, string>>(start);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = lines.some((l) => (values[l.key] ?? '').trim() !== start[l.key]);
  const single = lines.length === 1;

  function save() {
    setStatus(null);
    startTransition(async () => {
      const r = await setProductCostsAction(accountSlug, productId, values);
      if (!r.ok) return setStatus({ kind: 'error', text: r.error });
      setStatus({ kind: 'ok', text: r.message });
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className={single ? 'max-w-56' : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'}>
        {lines.map((l, i) => (
          <div key={l.key} className="space-y-1.5">
            <Label htmlFor={`cost-${i}`}>{single ? 'Costo sin IVA' : l.label || 'Sin medida'}</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                id={`cost-${i}`}
                aria-label={single ? 'Costo sin IVA' : `Costo sin IVA de ${l.label || 'la medida'}`}
                inputMode="decimal"
                placeholder="99.627,50"
                value={values[l.key] ?? ''}
                disabled={pending}
                onChange={(e) => setValues((v) => ({ ...v, [l.key]: e.target.value }))}
                className="tabular-nums"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" access="productos" pending={pending} disabled={pending || !changed}>
          Guardar costo
        </Button>
        <StatusText status={status} />
      </div>
    </form>
  );
}
