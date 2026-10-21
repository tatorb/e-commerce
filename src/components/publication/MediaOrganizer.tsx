'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, ImageOff, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/section-card';
import type { MediaItem, MediaSources } from '@/lib/media';
import { cn } from '@/lib/utils/cn';
import { saveMediaAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';

// Elegir y ordenar las fotos de una publicación: las que ya están en el canal,
// las corregidas en el paso Imágenes y las demás del producto. Lo que se
// guarda queda en el borrador hasta que se sube.

export function PhotoThumb({ item, className }: { item: Pick<MediaItem, 'thumb' | 'label'>; className?: string }) {
  return item.thumb ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.thumb} alt={item.label} loading="lazy" className={cn('aspect-square w-full rounded-md border bg-white object-contain', className)} />
  ) : (
    <div className={cn('flex aspect-square w-full items-center justify-center rounded-md border bg-muted text-muted-foreground', className)}>
      <ImageOff className="h-5 w-5" aria-hidden />
    </div>
  );
}

/** Las fotos en fila, para ver sin editar. */
export function PhotoStrip({ items, empty = 'Sin fotos' }: { items: Pick<MediaItem, 'key' | 'thumb' | 'label'>[]; empty?: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {items.map((m, i) => (
        <li key={m.key} className="relative">
          <PhotoThumb item={m} />
          <span className="absolute left-1 top-1 rounded bg-foreground/80 px-1.5 text-[11px] tabular-nums text-background">{i + 1}</span>
        </li>
      ))}
    </ol>
  );
}

export function MediaOrganizer({ accountSlug, publicationId, sources }: { accountSlug: string; publicationId: string; sources: MediaSources }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<MediaItem[]>(sources.current);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const initial = sources.current.map((m) => m.key).join('|');
  const dirty = chosen.map((m) => m.key).join('|') !== initial;
  const full = chosen.length >= sources.max;
  const { channelName } = sources;

  function move(i: number, by: number) {
    setChosen((list) => {
      const next = [...list];
      const [item] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, item);
      return next;
    });
  }

  async function save(refs: MediaItem['ref'][] | null, key: string) {
    setBusy(key);
    setMessage(null);
    const r = await saveMediaAction(accountSlug, publicationId, refs).catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setMessage({ kind: 'ok', text: refs ? `Guardado en el borrador. Se sube a ${channelName} desde la publicación o desde Por subir.` : `Listo: vuelve a usar las fotos de ${channelName}.` });
    router.refresh();
  }

  const taken = new Set(chosen.map((m) => m.key));
  const groups = [
    { title: 'Corregidas en el paso Imágenes', items: sources.available.corrected },
    { title: `En ${channelName}`, items: sources.available.channel },
    { title: 'Otras fotos del producto', items: sources.available.assets },
  ]
    .map((g) => ({ ...g, items: g.items.filter((m) => !taken.has(m.key)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">
            Elegidas{' '}
            <span className="font-normal tabular-nums text-muted-foreground">
              {chosen.length} de {sources.max}
            </span>
          </h3>
          {sources.following && !dirty ? <p className="text-xs text-muted-foreground">Son las que tiene en {channelName}.</p> : null}
        </div>
        {chosen.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Sin fotos. Agregalas desde abajo.</p>
        ) : (
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {chosen.map((m, i) => (
              <li key={m.key} className="space-y-1">
                <div className="relative">
                  <PhotoThumb item={m} />
                  <span className="absolute left-1 top-1 rounded bg-foreground/80 px-1.5 text-[11px] tabular-nums text-background">
                    {i === 0 ? '1 · portada' : i + 1}
                  </span>
                </div>
                <p className="truncate text-xs">{m.label}</p>
                {m.note ? <p className="truncate text-[11px] text-muted-foreground">{m.note}</p> : null}
                <div className="flex items-center gap-0.5">
                  <IconButton label="Antes" onClick={() => move(i, -1)} disabled={i === 0 || busy !== null}>
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton label="Después" onClick={() => move(i, 1)} disabled={i === chosen.length - 1 || busy !== null}>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton label="Sacar" onClick={() => setChosen((list) => list.filter((x) => x.key !== m.key))} disabled={busy !== null} className="ml-auto">
                    <X className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {groups.map((g) => (
        <div key={g.title} className="space-y-2">
          <h3 className="text-sm font-semibold">{g.title}</h3>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            {g.items.map((m) => (
              <li key={m.key} className="space-y-1">
                <PhotoThumb item={m} className="opacity-90" />
                {m.note ? <p className="truncate text-[11px] text-muted-foreground">{m.note}</p> : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-full px-2 text-xs"
                  disabled={full || busy !== null}
                  onClick={() => setChosen((list) => [...list, m])}
                  title={full ? `Hasta ${sources.max} fotos` : undefined}
                >
                  <Plus />
                  Agregar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!dirty || chosen.length === 0 || busy !== null} pending={busy === 'save'} onClick={() => save(chosen.map((m) => m.ref), 'save')}>
          Guardar en el borrador
        </Button>
        {dirty ? (
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setChosen(sources.current)}>
            Deshacer cambios
          </Button>
        ) : null}
        {!sources.following ? (
          <Button size="sm" variant="outline" disabled={busy !== null} pending={busy === 'follow'} onClick={() => save(null, 'follow')}>
            Volver a las de {channelName}
          </Button>
        ) : null}
      </div>
      {message ? (
        <p className={cn('text-sm', message.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
