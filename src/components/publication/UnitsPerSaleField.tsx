'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { READ_ONLY_HINT, useReadOnly } from '@/components/access/AccessProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusText } from '@/components/pipeline/StatusText';
import { setUnitsPerSaleAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';

// Las unidades por venta de una publicación: de a cuántas unidades del stock
// del producto vende. Se guarda en toda su familia y sus opciones de venta, y
// sube la cantidad nueva.
export function UnitsPerSaleField({
  accountSlug,
  publicationId,
  units,
  summary,
  shared,
}: {
  accountSlug: string;
  publicationId: string;
  units: number;
  // "22 juegos (88 unidades)", si el producto lleva stock en la app.
  summary: string | null;
  // Cuántas publicaciones llevan el mismo valor: la familia y sus opciones de venta.
  shared: number;
}) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [value, setValue] = useState(String(units));
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = value.trim() !== String(units) && /^\d+$/.test(value.trim()) && Number(value) >= 1;

  return (
    <div className="space-y-1.5 text-sm">
      <p>
        <span className="font-medium">Vende de a {units}.</span>{' '}
        <span className="text-muted-foreground">
          {units > 1
            ? `Cada venta descuenta ${units} unidades del stock del producto, y el costo en el paso Precio es el de ${units}.`
            : 'Cada venta descuenta una unidad del stock del producto.'}
          {summary ? ` Hoy: ${summary}.` : ''}
        </span>
      </p>
      <form
        className="flex flex-wrap items-center gap-2"
        title={readOnly ? READ_ONLY_HINT : undefined}
        onSubmit={(e) => {
          e.preventDefault();
          setStatus(null);
          startTransition(async () => {
            const r = await setUnitsPerSaleAction(accountSlug, publicationId, Number(value)).catch(() => null);
            if (!r) return setStatus({ kind: 'error', text: 'Se cortó la conexión con la app.' });
            setStatus(r.ok ? { kind: 'ok', text: r.message } : { kind: 'error', text: r.error });
            router.refresh();
          });
        }}
      >
        <label htmlFor={`unidades-por-venta-${publicationId}`} className="text-muted-foreground">
          Unidades por venta
        </label>
        <Input
          id={`unidades-por-venta-${publicationId}`}
          inputMode="numeric"
          className="w-20"
          value={value}
          disabled={pending || readOnly}
          onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ''))}
        />
        <Button type="submit" size="sm" variant="outline" pending={pending} disabled={pending || readOnly || !changed}>
          Guardar y subir la cantidad
        </Button>
        {shared > 1 ? <span className="text-xs text-muted-foreground">Se guarda en las {shared} publicaciones de la familia y sus opciones de venta.</span> : null}
      </form>
      <StatusText status={status} />
    </div>
  );
}
