'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BrandMark } from '@/components/ui/brand-loader';
import type { LiveEdits, MacPart } from '@/domain/photo-live';
import { cn } from '@/lib/utils/cn';
import type { WorkerIn, WorkerOut } from './live.worker';
import { TURN_TEXT, TurnButtons } from './TurnButtons';

// La foto en vivo. Las cuentas las hace live.worker.ts, aparte de la
// pantalla; acá se le mandan los valores y se muestra lo que devuelve. Se
// puede pasar a lo que hizo la Mac para comparar, y girar de a 90°.

export function LivePreview({
  href,
  macHref,
  parts,
  background,
  edits,
  turn,
  turnHint,
}: {
  href: string;
  macHref: string | null;
  parts: MacPart[];
  background: string;
  edits: LiveEdits;
  // Los botones de girar 90°, si la Mac sabe hacerlo.
  turn?: { quarters: number; onTurn: (by: 1 | -1) => void; disabled: boolean } | null;
  // Por qué no hay botones de girar, si no los hay.
  turnHint?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'live' | 'mac'>('live');
  const [notes, setNotes] = useState<string[]>([]);
  const [drawn, setDrawn] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const worker = useRef<Worker | null>(null);
  const sent = useRef('');
  // Como texto: la pantalla se actualiza sola mientras otras fotos se procesan y no hay que volver a empezar si no cambió nada.
  const mac = JSON.stringify({ parts, background });
  const values = JSON.stringify(edits);

  // Uno por foto: baja el paquete y queda esperando valores.
  useEffect(() => {
    const w = new Worker(new URL('./live.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      if (m.kind === 'error') {
        setError(m.message);
        return;
      }
      const c = canvas.current;
      if (!c) return;
      c.width = m.w;
      c.height = m.h;
      c.getContext('2d')?.putImageData(new ImageData(m.rgba, m.w, m.h), 0, 0);
      setDrawn(true);
      setNotes((prev) => (prev.join('\n') === m.notes.join('\n') ? prev : m.notes));
    };
    w.onerror = () => setError('No se pudo abrir la foto para editar en vivo. Probá de nuevo en un rato.');
    w.postMessage({ kind: 'open', href, mac: JSON.parse(mac) } satisfies WorkerIn);
    sent.current = '';
    return () => {
      w.terminate();
      worker.current = null;
    };
  }, [href, mac]);

  useEffect(() => {
    if (!worker.current || sent.current === values) return;
    sent.current = values;
    worker.current.postMessage({ kind: 'edits', edits: JSON.parse(values) } satisfies WorkerIn);
  }, [values, href, mac]);

  if (error) {
    return (
      <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Qué foto ver" className="inline-flex rounded-md border p-0.5 text-xs">
          {(
            [
              ['live', 'En vivo'],
              ['mac', 'Lo de la Mac'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn('rounded px-2.5 py-1', view === v ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')}
            >
              {label}
            </button>
          ))}
        </div>
        {turn ? (
          <div className="flex items-center gap-2">
            {turn.quarters ? <span className="text-xs text-muted-foreground">{TURN_TEXT[turn.quarters]}</span> : null}
            <TurnButtons onTurn={turn.onTurn} disabled={turn.disabled} />
          </div>
        ) : turnHint ? (
          <span className="text-xs text-muted-foreground">{turnHint}</span>
        ) : null}
      </div>
      <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-md border bg-muted">
        {/* Mientras se mueve un valor llega una copia a la mitad: el tamaño en pantalla lo fija el alto, no los píxeles. */}
        <canvas
          ref={canvas}
          aria-label="La foto con los valores de abajo"
          className={cn('block h-[30vh] w-auto max-w-full object-contain sm:h-[46vh]', (view !== 'live' || !drawn) && 'hidden')}
        />
        {view === 'mac' && macHref ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={macHref} alt="Lo que hizo la Mac" className="block h-[30vh] w-auto max-w-full object-contain sm:h-[46vh]" />
        ) : null}
        {view === 'live' && !drawn ? (
          <div className="flex h-48 w-72 max-w-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <BrandMark className="h-6 w-6" />
            Preparando la foto para editar en vivo…
          </div>
        ) : null}
      </div>
      {notes.map((n) => (
        <p key={n} className="text-xs text-amber-700">
          {n}
        </p>
      ))}
      <p className="text-xs text-muted-foreground">Vista previa: la foto final la hace la Mac al aplicar.</p>
    </div>
  );
}
