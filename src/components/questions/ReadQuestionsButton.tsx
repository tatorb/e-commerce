'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { readQuestionsAction } from '@/app/a/[cuenta]/preguntas/actions';

// Si otra lectura está en curso, se vuelve a probar en un rato.
const WAIT_MS = 10_000;
// Tope de pedidos seguidos: lo que quede lo sigue la lectura de cada hora.
const MAX_STEPS = 30;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// "Leer ahora": trae las preguntas nuevas y, la primera vez, las anteriores
// por tandas, mostrando cuántas llegaron.
export function ReadQuestionsButton({ accountSlug }: { accountSlug: string }) {
  const router = useRouter();
  const [added, setAdded] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function read() {
    setMessage(null);
    setAdded(0);
    let total = 0;
    for (let step = 0; alive.current && step < MAX_STEPS; step++) {
      const r = await readQuestionsAction(accountSlug).catch(() => null);
      if (!r) {
        setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. La lectura sigue sola en la próxima pasada.' });
        break;
      }
      if (!r.ok) {
        setMessage({ kind: 'error', text: r.error });
        break;
      }
      total += r.added;
      setAdded(total);
      if (r.busy) await sleep(WAIT_MS);
      else if (!r.pending) {
        setMessage({ kind: 'ok', text: total === 0 ? 'No llegó nada nuevo.' : total === 1 ? 'Llegó 1 pregunta nueva.' : `Llegaron ${total} preguntas nuevas.` });
        break;
      }
    }
    if (!alive.current) return;
    setAdded(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={read} pending={added !== null} disabled={added !== null}>
        <RefreshCw />
        Leer ahora
      </Button>
      {added !== null ? (
        <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {added > 0 ? `Leyendo, ${added} nuevas` : 'Leyendo…'}
        </p>
      ) : null}
      {message ? (
        <p className={`max-w-xs text-right text-xs ${message.kind === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} role="status">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
