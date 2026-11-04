'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { applyAccountWarrantyAction } from '@/app/a/[cuenta]/garantia/actions';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

// Cargar la garantía de la cuenta en todas sus publicaciones. Primero dice
// cuántas cambian, sin tocar nada; recién al confirmar las carga. Quedan en
// Por subir: nada se manda al canal desde acá.

type Plan = { warranty: string; total: number; changing: number; same: number; unpublished: number };

export function ApplyWarrantyCard({ accountSlug, channelName }: { accountSlug: string; channelName: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [pending, setPending] = useState<'count' | 'apply' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(dryRun: boolean) {
    setPending(dryRun ? 'count' : 'apply');
    setMessage(null);
    const r = await applyAccountWarrantyAction(accountSlug, dryRun).catch(() => null);
    setPending(null);
    if (!r) return setMessage({ ok: false, text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ ok: false, text: r.error });
    if (dryRun) return setPlan(r.plan);
    setPlan(null);
    setMessage({
      ok: true,
      text:
        r.plan.changing === 0
          ? 'No había nada para cambiar: todas ya tienen esa garantía.'
          : `Listo: ${plural(r.plan.changing, 'publicación quedó', 'publicaciones quedaron')} con la garantía nueva en Por subir. Subilas desde ahí a ${channelName}.`,
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {plan ? (
        <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
          <p>
            <strong>{plan.warranty}</strong>: de {plural(plan.total, 'publicación', 'publicaciones')},{' '}
            {plan.changing === 0 ? 'ninguna cambia' : `${plural(plan.changing, 'cambia', 'cambian')}`} y {plan.same} ya la {plan.same === 1 ? 'tiene' : 'tienen'}.
            {plan.unpublished > 0 ? ` ${plural(plan.unpublished, 'todavía no está', 'todavía no están')} en ${channelName}: la usan al crearse.` : ''}
          </p>
          {plan.changing > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => run(false)} disabled={pending !== null} pending={pending === 'apply'}>
                Cargarla en {plural(plan.changing, 'publicación', 'publicaciones')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPlan(null)} disabled={pending !== null}>
                Cancelar
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => run(true)} disabled={pending !== null} pending={pending === 'count'}>
          Ver cuántas publicaciones cambian
        </Button>
      )}
      {message ? (
        <p role="status" className={cn('text-sm', message.ok ? 'text-emerald-700' : 'text-destructive')}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
