'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusText } from '@/components/pipeline/StatusText';
import { markStockReviewedAction, setProductStockAction } from '@/app/a/[cuenta]/productos/stock-actions';

// Cambiar a mano el stock del producto, uno por medida. Al guardar se sube
// solo a todas sus publicaciones.

export function StockForm({
  accountSlug,
  productId,
  lines,
  managed,
}: {
  accountSlug: string;
  productId: string;
  lines: { key: string; label: string; quantity: number | null }[];
  managed: boolean;
}) {
  const router = useRouter();
  const start = Object.fromEntries(lines.map((l) => [l.key, l.quantity === null ? '' : String(l.quantity)]));
  const [values, setValues] = useState<Record<string, string>>(start);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = lines.some((l) => (values[l.key] ?? '').trim() !== (l.quantity === null ? '' : String(l.quantity)));
  const empty = lines.some((l) => !(values[l.key] ?? '').trim());
  const single = lines.length === 1;

  function save() {
    setStatus(null);
    startTransition(async () => {
      const r = await setProductStockAction(accountSlug, productId, values);
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
      <div className={single ? 'max-w-40' : 'grid grid-cols-2 gap-3 sm:grid-cols-4'}>
        {lines.map((l, i) => (
          <div key={l.key} className="space-y-1.5">
            <Label htmlFor={`stock-${i}`}>{single ? 'Unidades' : l.label || 'Sin medida'}</Label>
            <Input
              id={`stock-${i}`}
              inputMode="numeric"
              value={values[l.key] ?? ''}
              disabled={pending}
              onChange={(e) => setValues((v) => ({ ...v, [l.key]: e.target.value.replace(/[^\d]/g, '') }))}
              className={l.quantity !== null && l.quantity < 0 ? 'border-destructive' : undefined}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" access="productos" pending={pending} disabled={pending || !changed || empty}>
          {managed ? 'Guardar y subir' : 'Empezar a llevar el stock'}
        </Button>
        <StatusText status={status} />
      </div>
    </form>
  );
}

/** Lo que había para revisar del stock ya se revisó. */
export function StockReviewedButton({ accountSlug, productId }: { accountSlug: string; productId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      access="productos"
      pending={pending}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await markStockReviewedAction(accountSlug, productId);
          if (r.ok) router.refresh();
        })
      }
    >
      <CheckCircle2 className="h-4 w-4" />
      Ya lo revisé
    </Button>
  );
}
