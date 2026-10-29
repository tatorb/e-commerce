'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';
import { StatusText } from '@/components/pipeline/StatusText';
import { dropOrphanStockAction, markStockReviewedAction, setProductStockAction, setShowMoreAction } from '@/app/a/[cuenta]/productos/stock-actions';

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

/** Borrar el stock de una medida que ya no está en la ficha, con una confirmación. */
export function DropOrphanStockButton({ accountSlug, productId, stockKey, label }: { accountSlug: string; productId: string; stockKey: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!asking) {
    return (
      <Button size="sm" variant="ghost" access="productos" onClick={() => setAsking(true)}>
        <Trash2 className="h-4 w-4" />
        Borrar
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm">
      ¿Borrar el stock de «{label}»?
      <Button
        size="sm"
        variant="destructive"
        access="productos"
        pending={pending}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await dropOrphanStockAction(accountSlug, productId, stockKey);
            if (r.ok) router.refresh();
            else setError(r.error);
          })
        }
      >
        Sí, borrar
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setAsking(false)}>
        No
      </Button>
      {error ? <span className="text-destructive">{error}</span> : null}
    </span>
  );
}

/** El interruptor de "Mostrar más de 5": prendido, los canales muestran 6 aunque haya de 1 a 5. */
export function ShowMoreSwitch({ accountSlug, productId, on, readOnly }: { accountSlug: string; productId: string; on: boolean; readOnly: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        id="mostrar-mas-de-5"
        type="button"
        role="switch"
        aria-checked={on}
        disabled={readOnly || pending}
        onClick={() =>
          startTransition(async () => {
            setStatus(null);
            const r = await setShowMoreAction(accountSlug, productId, !on);
            setStatus(r.ok ? { kind: 'ok', text: r.message } : { kind: 'error', text: r.error });
            if (r.ok) router.refresh();
          })
        }
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
          on ? 'bg-primary' : 'bg-input',
        )}
      >
        <span className={cn('inline-block h-5 w-5 rounded-full bg-background shadow transition-transform', on ? 'translate-x-5' : 'translate-x-0.5')} />
      </button>
      <Label htmlFor="mostrar-mas-de-5" className="text-sm font-medium">
        Mostrar más de 5
      </Label>
      <StatusText status={status} />
    </div>
  );
}
