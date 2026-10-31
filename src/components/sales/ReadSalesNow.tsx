'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/pipeline/StatusText';
import { readSalesNowAction } from '@/app/a/[cuenta]/ventas/actions';

// Trae las ventas ahora: las nuevas, el historial y el envío y el pago de cada
// una. Sigue pidiendo por tandas mientras quede algo, hasta un tope, y se
// puede frenar.

const MAX_ROUNDS = 40;

export function ReadSalesNow({ accountSlug }: { accountSlug: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const stop = useRef(false);
  const run = () =>
    startTransition(async () => {
      stop.current = false;
      setStatus(null);
      let read = 0;
      let completed = 0;
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const r = await readSalesNowAction(accountSlug);
        if (!r.ok) {
          setStatus({ kind: 'error', text: r.error });
          break;
        }
        read += r.read;
        completed += r.completed;
        const totals = `Leídas ${read}, completadas ${completed}.`;
        setStatus({ kind: 'ok', text: `${r.message} ${totals}` });
        router.refresh();
        if (!r.pending || stop.current) break;
      }
    });
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="outline" pending={pending} disabled={pending} onClick={run}>
        <RefreshCw className="h-4 w-4" />
        {pending ? 'Trayendo…' : 'Traer ventas ahora'}
      </Button>
      {pending ? (
        <Button variant="ghost" size="sm" onClick={() => (stop.current = true)}>
          Frenar
        </Button>
      ) : null}
      <StatusText status={status} />
    </span>
  );
}
