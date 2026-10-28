'use client';

import { useState } from 'react';
import { ImageOff, Video } from 'lucide-react';
import { SHOOT_KIND_LABEL, type ShootKind } from '@/domain/shoot';
import { cn } from '@/lib/utils/cn';
import { ShootKindIcon } from './ShootKindIcon';

// Lo que ya quedó guardado de un paso, para revisarlo: lo último grande y el
// resto en una fila de miniaturas. Sale de lo guardado en la app, así sigue
// ahí al ir y volver entre pasos, cerrar la pantalla o abrirlo otro día.

/** Una foto, un video o un Listo ya registrado, como lo muestra el celular. */
export type SessionShot = {
  id: string;
  kind: ShootKind;
  stepId: string | null;
  variantKey: string | null;
  variantLabel: string | null;
  // Dónde se ve: la miniatura y el archivo para agrandar. Null en un Listo.
  thumb: string | null;
  src: string | null;
  by: string | null;
  // Cuándo, ya dicho en la hora de la cuenta.
  when: string;
};

/** Para qué medida, si el producto tiene varias, quién y cuándo. */
export function shotByline(s: SessionShot, withMeasure: boolean): string {
  return [withMeasure ? (s.variantLabel ? `Medida ${s.variantLabel}` : 'Todas las medidas') : null, s.by, s.when].filter(Boolean).join(' · ');
}

export function ShotViewer({ title, items, withMeasure }: { title: string; items: SessionShot[]; withMeasure: boolean }) {
  // La que se eligió en la fila, mientras no llegue una nueva: la nueva se muestra sola.
  const [picked, setPicked] = useState<{ id: string; newest: string } | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  if (items.length === 0) return null;
  const newest = items[0].id;
  const current = (picked?.newest === newest ? items.find((i) => i.id === picked.id) : null) ?? items[0];
  return (
    <section className="space-y-2" aria-label={title}>
      <p className="text-sm font-medium">
        {title} ({items.length})
      </p>
      <div className="overflow-hidden rounded-lg border bg-black">
        {current.kind === 'VIDEO' ? (
          <video key={current.id} src={current.src ?? undefined} controls playsInline preload="metadata" className="mx-auto max-h-[60vh] w-full" />
        ) : failed.has(current.id) ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white/80">
            <ImageOff className="h-6 w-6" />
            La foto quedó guardada, pero este navegador no la puede mostrar. En el celular que la sacó se ve.
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.id}
            src={current.src ?? undefined}
            alt="La foto registrada"
            className="mx-auto max-h-[60vh] w-full object-contain"
            onError={() => setFailed((s) => new Set(s).add(current.id))}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {SHOOT_KIND_LABEL[current.kind]} · {shotByline(current, withMeasure)}
      </p>
      {items.length > 1 ? (
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {items.map((s) => (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setPicked({ id: s.id, newest })}
                aria-pressed={s.id === current.id}
                aria-label={`Ver ${s.kind === 'VIDEO' ? 'el video' : 'la foto'} de ${s.when}`}
                className={cn('block rounded-md ring-offset-2 ring-offset-background', s.id === current.id ? 'ring-2 ring-foreground' : 'opacity-80 hover:opacity-100')}
              >
                <ShotThumb shot={s} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** La miniatura de una foto o un video. Si no se puede mostrar, su ícono. */
export function ShotThumb({ shot, className }: { shot: SessionShot; className?: string }) {
  const [failed, setFailed] = useState(false);
  const shown = Boolean(shot.thumb) && !failed;
  return (
    <span className={cn('relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground', className)}>
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shot.thumb!} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <ShootKindIcon kind={shot.kind} className="h-5 w-5" />
      )}
      {shown && shot.kind === 'VIDEO' ? (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 p-0.5 text-white">
          <Video className="h-3 w-3" />
        </span>
      ) : null}
    </span>
  );
}
