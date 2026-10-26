'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { READ_ONLY_HINT, useReadOnly } from '@/components/access/AccessProvider';
import { StatusText } from '@/components/pipeline/StatusText';
import { setFollowsStockAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';

// La cantidad automática de una publicación: si la cantidad en el canal se
// actualiza sola con el stock del producto. Prendida de entrada.
export function FollowStockSwitch({ accountSlug, publicationId, on }: { accountSlug: string; publicationId: string; on: boolean }) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [wanted, setWanted] = useState(on);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setWanted(next);
    setStatus(null);
    startTransition(async () => {
      const r = await setFollowsStockAction(accountSlug, publicationId, next).catch(() => null);
      if (!r) return setStatus({ kind: 'error', text: 'Se cortó la conexión con la app.' });
      setStatus(r.ok ? { kind: 'ok', text: r.message } : { kind: 'error', text: r.error });
      router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <label className="flex items-start gap-2 text-sm" title={readOnly ? READ_ONLY_HINT : undefined}>
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={pending ? wanted : on}
          disabled={pending || readOnly}
          onChange={(e) => change(e.target.checked)}
        />
        <span>
          <span className="font-medium">Actualizar la cantidad sola con el stock del producto.</span>{' '}
          <span className="text-muted-foreground">
            Cada venta y cada cambio de stock se suben solos al canal. Apagada, la cantidad se cambia a mano en esta publicación; sus ventas igual
            descuentan del stock del producto.
          </span>
        </span>
      </label>
      <StatusText status={status} />
    </div>
  );
}
