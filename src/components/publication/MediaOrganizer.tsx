'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ArrowRight, Clapperboard, ImageOff, Play, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/section-card';
import { MAX_PHOTOS, mediaWarnings, overfullMeasures, photoVariants, variantPhotos, withVariants } from '@/domain/media';
import { ClipCheckLine, VideoFacts, VideoPlayer, VideoThumb } from '@/components/pipeline/videos/VideoCard';
import type { MediaItem, MediaSources, Measure } from '@/lib/media';
import { cn } from '@/lib/utils/cn';
import { saveMediaAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';
import { chooseClipAction } from '@/app/a/[cuenta]/pipeline/video-actions';

// Elegir y ordenar las fotos de una publicación: las que ya están en el canal,
// las del paso Imágenes, corregidas o tal cual, y las demás del producto. Si el producto
// tiene varias medidas, también de cuáles es cada foto y cada video, a mano.
// Lo que se guarda queda en el borrador hasta que se sube.

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

/** Todas, o las medidas que se marquen. Marcar todas es lo mismo que Todas. */
function MeasurePicker({
  measures,
  value,
  onChange,
  disabled,
  label,
}: {
  measures: Measure[];
  value: string[];
  onChange: (keys: string[]) => void;
  disabled: boolean;
  label: string;
}) {
  const toggle = (key: string) => {
    const next = value.includes(key) ? value.filter((k) => k !== key) : [...value, key];
    onChange(next.length >= measures.length ? [] : next);
  };
  const chip = (on: boolean) =>
    cn(
      'rounded-md border px-1.5 py-0.5 text-[11px] leading-4',
      on ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
    );
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      <button type="button" className={chip(value.length === 0)} aria-pressed={value.length === 0} disabled={disabled} onClick={() => onChange([])}>
        Todas
      </button>
      {measures.map((m) => (
        <button key={m.key} type="button" className={chip(value.includes(m.key))} aria-pressed={value.includes(m.key)} disabled={disabled} onClick={() => toggle(m.key)}>
          {m.label}
        </button>
      ))}
    </div>
  );
}

const photosSignature = (list: MediaItem[]) => list.map((m) => `${m.key}@${photoVariants(m.ref).join(',')}`).join('|');
const marksSignature = (marks: Record<string, string[]>) =>
  Object.entries(marks)
    .filter(([, keys]) => keys.length > 0)
    .map(([id, keys]) => `${id}@${[...keys].sort().join(',')}`)
    .sort()
    .join('|');

export function MediaOrganizer({ accountSlug, publicationId, sources }: { accountSlug: string; publicationId: string; sources: MediaSources }) {
  const router = useRouter();
  const initialMarks = () => Object.fromEntries(sources.videos.map((v) => [v.id, v.variants]));
  const [chosen, setChosen] = useState<MediaItem[]>(sources.current);
  const [videoMarks, setVideoMarks] = useState<Record<string, string[]>>(initialMarks);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const { channelName, measures, clip } = sources;
  const [viewing, setViewing] = useState<string | null>(measures[0]?.key ?? null);
  // El video que se está mirando.
  const [playing, setPlaying] = useState<string | null>(null);
  const photosDirty = photosSignature(chosen) !== photosSignature(sources.current);
  const videosDirty = marksSignature(videoMarks) !== marksSignature(initialMarks());
  const dirty = photosDirty || videosDirty;
  const full = chosen.length >= sources.max;
  // Una medida con más fotos de las que se muestran no se puede guardar: lo dicen los avisos.
  const overfull =
    overfullMeasures(
      chosen.map((m) => m.ref),
      measures,
    ).length > 0;
  const withMeasures = measures.length >= 2;
  const labelOf = (keys: string[]) => measures.filter((m) => keys.includes(m.key)).map((m) => m.label);

  function move(i: number, by: number) {
    setChosen((list) => {
      const next = [...list];
      const [item] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, item);
      return next;
    });
  }

  function mark(key: string, keys: string[]) {
    setChosen((list) => list.map((m) => (m.key === key ? { ...m, ref: withVariants(m.ref, keys) } : m)));
  }

  async function save(input: { refs?: MediaItem['ref'][] | null; videos?: Record<string, string[]> }, key: string) {
    setBusy(key);
    setMessage(null);
    const r = await saveMediaAction(accountSlug, publicationId, input).catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setMessage({
      kind: 'ok',
      text: input.refs === null ? `Listo: vuelve a usar las fotos de ${channelName}.` : `Guardado en el borrador. Se sube a ${channelName} desde la publicación o desde Por subir.`,
    });
    router.refresh();
  }

  // El clip se elige al tocar: no espera a Guardar en el borrador, como en el paso Videos.
  async function chooseClip(videoId: string) {
    setBusy(`clip:${videoId}`);
    setMessage(null);
    const r = await chooseClipAction(accountSlug, publicationId, videoId).catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setMessage({ kind: 'ok', text: clip ? `Listo: es el ${clip.name} de esta publicación. Se sube a mano a ${channelName}, desde el paso Videos.` : 'Listo.' });
    router.refresh();
  }

  const taken = new Set(chosen.map((m) => m.key));
  const groups = [
    { title: 'Del paso Imágenes', items: sources.available.corrected },
    { title: `En ${channelName}`, items: sources.available.channel },
    { title: 'Otras fotos del producto', items: sources.available.assets },
  ]
    .map((g) => ({ ...g, items: g.items.filter((m) => !taken.has(m.key)) }))
    .filter((g) => g.items.length > 0);

  // Lo que ve el comprador en la medida elegida: primero sus fotos y después las de todas.
  const shown = viewing ? variantPhotos(chosen.map((m, at) => ({ ...m.ref, at })), viewing).map((r) => chosen[r.at]) : [];
  const clipVideo = clip?.videoId ? sources.videos.find((v) => v.id === clip.videoId) : undefined;
  const clipMarks = clipVideo ? (videoMarks[clipVideo.id] ?? []) : [];
  const warnings = withMeasures
    ? [
        ...mediaWarnings(
          chosen.map((m) => m.ref),
          measures,
        ),
        ...(clip && clipVideo && !clip.perVariant && clipMarks.length > 0
          ? [`El ${clip.name} es de ${labelOf(clipMarks).join(' y ')}, pero en ${channelName} se ve en todas las medidas.`]
          : []),
        ...(sources.channelWithoutVariants ? [`En ${channelName} esta publicación no tiene medidas: todas las fotos se ven juntas.`] : []),
      ]
    : [];

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
        {withMeasures ? (
          <p className="text-xs text-muted-foreground">
            Marcá de qué medida es cada foto. Las de Todas se ven en todas las medidas. Cada medida muestra hasta {MAX_PHOTOS}, contando las de Todas.
          </p>
        ) : null}
        {chosen.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Sin fotos. Agregalas desde abajo.</p>
        ) : (
          <ol className={cn('grid gap-3', withMeasures ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6')}>
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
                {withMeasures ? (
                  <MeasurePicker
                    measures={measures}
                    value={photoVariants(m.ref)}
                    onChange={(keys) => mark(m.key, keys)}
                    disabled={busy !== null}
                    label={`Medidas de la foto ${i + 1}`}
                  />
                ) : null}
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

      {sources.videos.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Videos del producto</h3>
          <p className="text-xs text-muted-foreground">
            {clip ? `Tocá Ver para mirarlo y elegí cuál va como ${clip.name}. También se elige en el paso Videos.` : 'Tocá Ver para mirarlo.'}
            {withMeasures ? ' Marcá de qué medida es cada video.' : ''}
            {clip && !clip.perVariant && withMeasures ? ` En ${channelName} se ve un solo ${clip.name} por publicación, en todas sus medidas.` : ''}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {sources.videos.map((v) => {
              const isClip = clip?.videoId === v.id;
              const open = playing === v.id;
              return (
                <li key={v.id} className={cn('space-y-3 rounded-lg border p-3', isClip && 'border-foreground/60', open && 'sm:col-span-2')}>
                  <div className="flex gap-3">
                    <VideoThumb videoId={v.id} className="h-28 w-16" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                        <span className="break-all">{v.name}</span>
                        {isClip && clip ? (
                          <span className="inline-flex items-center gap-1 rounded bg-foreground px-1.5 py-0.5 text-[11px] font-medium text-background">
                            <Clapperboard className="h-3 w-3" aria-hidden />
                            {`${clip.name[0].toUpperCase()}${clip.name.slice(1)} de esta publicación`}
                          </span>
                        ) : null}
                      </p>
                      <VideoFacts video={v} />
                      {v.check && clip && !isClip ? <ClipCheckLine check={v.check} clipName={clip.name} /> : null}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => setPlaying(open ? null : v.id)}>
                          <Play />
                          {open ? 'Cerrar' : 'Ver'}
                        </Button>
                        {clip && v.check && !isClip ? (
                          <Button
                            size="sm"
                            variant="outline"
                            pending={busy === `clip:${v.id}`}
                            disabled={busy !== null || v.check.pending || v.check.problems.length > 0}
                            onClick={() => chooseClip(v.id)}
                          >
                            <Clapperboard />
                            Usar como {clip.name}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {open ? <VideoPlayer accountSlug={accountSlug} video={v} /> : null}
                  {withMeasures ? (
                    <MeasurePicker
                      measures={measures}
                      value={videoMarks[v.id] ?? []}
                      onChange={(keys) => setVideoMarks((marks) => ({ ...marks, [v.id]: keys }))}
                      disabled={busy !== null}
                      label={`Medidas del video ${v.name}`}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {withMeasures && chosen.length > 0 ? (
        <div className="space-y-2 rounded-md border p-3">
          <h3 className="text-sm font-semibold">Así lo ve el comprador</h3>
          <div role="tablist" aria-label="Medida que elige el comprador" className="flex flex-wrap gap-1">
            {measures.map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={viewing === m.key}
                onClick={() => setViewing(m.key)}
                className={cn('rounded-md border px-2.5 py-1 text-xs', viewing === m.key ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')}
              >
                {m.label}
              </button>
            ))}
          </div>
          <PhotoStrip items={shown} empty="Esta medida se queda sin fotos." />
          {clip ? (
            <p className="text-xs text-muted-foreground">
              {clipVideo ? `${clip.name[0].toUpperCase()}${clip.name.slice(1)}: ${clipVideo.name}` : `Sin ${clip.name}: se elige en el paso Videos.`}
            </p>
          ) : null}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <ul className="space-y-1 rounded-md bg-alert/10 px-3 py-2 text-sm">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      ) : null}

      {groups.map((g) => (
        <div key={g.title} className="space-y-2">
          <h3 className="text-sm font-semibold">{g.title}</h3>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            {g.items.map((m) => (
              <li key={m.key} className="space-y-1">
                <PhotoThumb item={m} className="opacity-90" />
                <p className="truncate text-[11px]">{m.label}</p>
                {m.note ? <p className={cn('text-[11px]', m.blocked ? 'text-destructive' : 'truncate text-muted-foreground')}>{m.note}</p> : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-full px-2 text-xs"
                  disabled={full || busy !== null || Boolean(m.blocked)}
                  onClick={() => setChosen((list) => [...list, m])}
                  title={m.blocked ?? (full ? `Hasta ${sources.max} fotos` : undefined)}
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
        <Button
          size="sm"
          disabled={!dirty || chosen.length === 0 || busy !== null || overfull}
          pending={busy === 'save'}
          onClick={() => save({ refs: photosDirty ? chosen.map((m) => m.ref) : undefined, videos: videosDirty ? videoMarks : undefined }, 'save')}
        >
          Guardar en el borrador
        </Button>
        {dirty ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => {
              setChosen(sources.current);
              setVideoMarks(initialMarks());
            }}
          >
            Deshacer cambios
          </Button>
        ) : null}
        {!sources.following ? (
          <Button size="sm" variant="outline" disabled={busy !== null} pending={busy === 'follow'} onClick={() => save({ refs: null }, 'follow')}>
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
