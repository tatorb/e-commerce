'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { ZoomImage } from '@/components/ui/zoom-image';

// El antes y el después de un paso: lado a lado, o superpuestos con un
// deslizador. Los pasos que cambian el encuadre no calzan superpuestos, así
// que esos se ven solo lado a lado.

export function CompareView({
  before,
  after,
  canOverlay,
  beforeZoom,
  afterZoom,
}: {
  before: string | null;
  after: string | null;
  canOverlay: boolean;
  // Las mismas en su tamaño más grande, para la lupa de lado a lado.
  beforeZoom?: string | null;
  afterZoom?: string | null;
}) {
  const [mode, setMode] = useState<'side' | 'overlay'>(canOverlay ? 'overlay' : 'side');
  const [split, setSplit] = useState(50);
  const overlay = canOverlay && mode === 'overlay' && before && after;

  return (
    <div className="space-y-2">
      {canOverlay && before && after ? (
        <div role="tablist" aria-label="Cómo comparar" className="inline-flex rounded-md border p-0.5 text-xs">
          {(['overlay', 'side'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn('rounded px-2.5 py-1', mode === m ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')}
            >
              {m === 'overlay' ? 'Deslizador' : 'Lado a lado'}
            </button>
          ))}
        </div>
      ) : null}
      {overlay ? (
        <div className="space-y-1">
          {/* Del tamaño de la foto, sin pasar el alto de la pantalla: así los botones quedan a la vista. */}
          <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-md border bg-muted select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={after} alt="Después" className="block max-h-[65vh] w-auto max-w-full" draggable={false} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={before}
              alt="Antes"
              className="absolute inset-0 block h-full w-full object-contain"
              style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
              draggable={false}
            />
            <div aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${split}%` }} />
            <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">Antes</span>
            <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">Después</span>
            <input
              type="range"
              min={0}
              max={100}
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
              aria-label="Cuánto se ve del antes"
              className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            />
          </div>
          <p className="text-xs text-muted-foreground">Mové el deslizador para comparar.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { src: before, zoom: beforeZoom, label: 'Antes' },
            { src: after, zoom: afterZoom, label: 'Después' },
          ].map(({ src, zoom, label }) => (
            <figure key={label} className="space-y-1">
              {src ? (
                <ZoomImage src={src} zoomSrc={zoom} alt={label} className="mx-auto block max-h-[55vh] w-auto max-w-full rounded-md border bg-muted" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                  Sin vista
                </div>
              )}
              <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
