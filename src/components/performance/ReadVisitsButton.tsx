'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { readVisitsNowAction } from '@/app/a/[cuenta]/rendimiento/actions';
import { plural } from '@/lib/format';

// Leer las visitas por día de toda la cuenta ahora, de a vueltas, mostrando
// cuántas lleva. Si el canal las rechaza, muestra el motivo.

type Failure = { externalId: string; message: string };

export function ReadVisitsButton({ accountSlug }: { accountSlug: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<Failure[]>([]);

  async function run() {
    setRunning(true);
    setErrors([]);
    let total = 0;
    const seen = new Map<string, Failure>();
    for (;;) {
      setStatus(total > 0 ? `Leyendo... van ${plural(total, 'publicación', 'publicaciones')}.` : 'Leyendo...');
      const r = await readVisitsNowAction(accountSlug).catch(() => null);
      if (!r) {
        setStatus('Se cortó la conexión con la app. Probá de nuevo.');
        break;
      }
      if (!r.ok) {
        setStatus(r.error);
        break;
      }
      total += r.read;
      for (const e of r.errors) if (!seen.has(e.message)) seen.set(e.message, e);
      setErrors([...seen.values()]);
      // Terminó, o en esta vuelta no se pudo leer ninguna: seguir no cambiaría nada.
      if (r.left === 0 || r.read === 0) {
        const done = `Listo: se leyeron ${plural(total, 'publicación', 'publicaciones')}.`;
        setStatus(r.left === 0 ? done : `${done} ${plural(r.left, 'quedó sin leer', 'quedaron sin leer')}${seen.size > 0 ? ', por lo que respondió el canal' : ''}.`);
        break;
      }
    }
    setRunning(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={run} disabled={running} pending={running}>
        Leer visitas ahora
      </Button>
      {status ? (
        <p role="status" className="text-xs text-muted-foreground">
          {status}
        </p>
      ) : null}
      {errors.length > 0 ? (
        <div className="space-y-1 text-xs text-destructive">
          <p>Lo que respondió el canal:</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {errors.map((e) => (
              <li key={e.message}>
                {e.externalId ? `${e.externalId}: ` : ''}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
