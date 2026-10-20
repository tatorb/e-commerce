'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startSyncAction, syncStepAction } from '@/app/a/[cuenta]/sincronizacion/actions';

// Si la lectura está ocupada o el canal pide esperar, se vuelve a probar en un rato.
const WAIT_MS = 15_000;
const MAX_WAITS = 8;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// "Leer ahora": lee la tienda por tandas desde la pantalla, mostrando el
// avance. Si se cierra la pantalla, la tarea programada sigue donde quedó.
export function SyncNowButton({ accountSlug, storeId, resume = false }: { accountSlug: string; storeId: string; resume?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function read() {
    setError(null);
    setStatus({ done: 0, total: 0 });
    const start = await startSyncAction(accountSlug, storeId).catch(() => null);
    if (!start?.ok) {
      setError(start ? start.error : 'Se cortó la conexión con la app. Probá de nuevo.');
      setStatus(null);
      return;
    }
    let waits = 0;
    while (alive.current) {
      const r = await syncStepAction(accountSlug, start.runId).catch(() => null);
      if (!r) {
        setError('Se cortó la conexión con la app. La lectura sigue sola en la próxima pasada.');
        break;
      }
      if (!r.ok) {
        setError(r.error);
        break;
      }
      const p = r.progress;
      setStatus({ done: p.position, total: p.total });
      if (p.status === 'FAILED') setError('La lectura no pudo terminar. El motivo está en Últimas lecturas.');
      if (p.status !== 'RUNNING') break;
      if (p.busy) {
        if (++waits > MAX_WAITS) {
          setError('El canal pidió esperar varias veces. La lectura sigue sola en la próxima pasada.');
          break;
        }
        await sleep(WAIT_MS);
      }
    }
    if (!alive.current) return;
    setStatus(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={read} pending={status !== null} disabled={status !== null}>
        <RefreshCw />
        {resume ? 'Seguir leyendo' : 'Leer ahora'}
      </Button>
      {status ? (
        <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {status.total > 0 ? `Leyendo ${status.done} de ${status.total}` : 'Empezando…'}
        </p>
      ) : null}
      {error ? <p className="max-w-xs text-right text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
