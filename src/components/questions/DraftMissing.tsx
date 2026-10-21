'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { draftMissingAction } from '@/app/a/[cuenta]/preguntas/answer-actions';

// Tope de pedidos seguidos al abrir la pantalla.
const MAX_STEPS = 10;

// Al abrir Preguntas, Claude propone las respuestas que todavía no tienen
// propuesta. Las que llegan con el aviso del canal ya vienen propuestas.
export function DraftMissing({ accountSlug, count }: { accountSlug: string; count: number }) {
  const router = useRouter();
  const [state, setState] = useState<{ kind: 'working' | 'error'; text: string } | null>(null);
  const started = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    // Una sola vez por pantalla, aunque el efecto corra dos veces.
    if (started.current || count === 0) return;
    started.current = true;
    const show = (s: typeof state) => mounted.current && setState(s);
    (async () => {
      show({ kind: 'working', text: count === 1 ? 'Claude está preparando la respuesta…' : `Claude está preparando ${count} respuestas…` });
      for (let step = 0; step < MAX_STEPS; step++) {
        const r = await draftMissingAction(accountSlug).catch(() => null);
        if (!mounted.current) return;
        if (!r || !r.ok) {
          show({ kind: 'error', text: r ? r.error : 'Se cortó la conexión con la app. Recargá la pantalla para seguir.' });
          return;
        }
        if (r.drafted > 0) router.refresh();
        if (!r.pending) break;
      }
      show(null);
    })();
  }, [accountSlug, count, router]);

  if (!state) return null;
  return (
    <p className={`flex items-center gap-2 text-sm ${state.kind === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} role="status">
      <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
      {state.text}
    </p>
  );
}
