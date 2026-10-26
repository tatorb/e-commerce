'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ArrowRight, Clapperboard, ImageOff, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/section-card';
import { photoKey, photoVariants, variantPhotos, withMarks, type PhotoRef } from '@/domain/media';
import { ClipCheckLine, VideoFacts, VideoPlayer, VideoThumb } from '@/components/pipeline/videos/VideoCard';
import type { MediaItem, MediaSources, Measure } from '@/lib/media';
import { cn } from '@/lib/utils/cn';
import { saveMediaAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';
import { SharedPhotosNote } from './SharedPhotosNote';

// Organización de multimedia. Arriba, todas las fotos y los videos que se
// pueden usar, y en cada uno dónde va: en todas las medidas, en algunas o en
// ninguna. Abajo se arma una ventana por medida, o una sola si el producto no
// tiene medidas, y ahí se ordena lo de cada una. Los videos que van son los
// clips: en el canal tienen un solo orden para toda la publicación. Lo que se
// guarda queda en el borrador hasta que se sube; los clips se suben a mano.

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

/** Dónde va: null no va; vacío va en todas las medidas; si no, en esas. */
type Use = string[] | null;

// Sin medidas, una sola ventana.
const ALL = '';

const goesIn = (use: Use | undefined, w: string) => use !== null && use !== undefined && (w === ALL || use.length === 0 || use.includes(w));

/** Todas, algunas medidas o ninguna. Sin medidas, va o no va. Marcar todas es lo mismo que Todas. */
function UsePicker({
  measures,
  value,
  onChange,
  disabled,
  label,
}: {
  measures: Measure[];
  value: Use;
  onChange: (use: Use) => void;
  disabled: boolean;
  label: string;
}) {
  const chip = (on: boolean) =>
    cn(
      'rounded-md border px-1.5 py-0.5 text-[11px] leading-4 disabled:opacity-50',
      on ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
    );
  if (measures.length < 2) {
    return (
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        <button type="button" className={chip(value !== null)} aria-pressed={value !== null} disabled={disabled} onClick={() => onChange(value === null ? [] : null)}>
          {value !== null ? 'Va' : 'Usar'}
        </button>
      </div>
    );
  }
  const toggle = (key: string) => {
    if (value === null || value.length === 0) return onChange([key]);
    if (value.includes(key)) {
      const rest = value.filter((k) => k !== key);
      return onChange(rest.length > 0 ? rest : null);
    }
    const next = [...value, key];
    onChange(next.length >= measures.length ? [] : next);
  };
  const all = value !== null && value.length === 0;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      <button type="button" className={chip(all)} aria-pressed={all} disabled={disabled} onClick={() => onChange(all ? null : [])}>
        Todas
      </button>
      {measures.map((m) => {
        const on = value !== null && value.includes(m.key);
        return (
          <button key={m.key} type="button" className={chip(on)} aria-pressed={on} disabled={disabled} onClick={() => toggle(m.key)}>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

type Video = MediaSources['videos'][number];
type State = { uses: Record<string, Use>; order: Record<string, string[]>; clips: string[] };
const videoKey = (id: string) => `video:${id}`;

export function MediaOrganizer({ accountSlug, publicationId, sources }: { accountSlug: string; publicationId: string; sources: MediaSources }) {
  const router = useRouter();
  const { channelName, measures, clip } = sources;
  const withMeasures = measures.length >= 2;
  const windows = withMeasures ? measures.map((m) => m.key) : [ALL];
  const labelOf = (keys: string[]) => measures.filter((m) => keys.includes(m.key)).map((m) => m.label);

  // Todo lo que se puede usar, en grupos. Las elegidas que ya no están disponibles también, para poder sacarlas.
  const available = [...sources.available.corrected, ...sources.available.channel, ...sources.available.assets];
  const gone = sources.current.filter((m) => !available.some((a) => a.key === m.key));
  const groups = [
    { title: 'Del paso Imágenes', items: sources.available.corrected },
    { title: `En ${channelName}`, items: sources.available.channel },
    { title: 'Otras fotos del producto', items: sources.available.assets },
    { title: 'Ya no disponibles', items: gone },
  ].filter((g) => g.items.length > 0);
  const photos = new Map([...available, ...gone].map((m) => [m.key, m]));
  const photoKeys = [...photos.keys()];
  const videos = new Map(sources.videos.map((v) => [v.id, v]));

  /** Acomoda las ventanas: saca lo que ya no va y suma al final lo nuevo. */
  function arrange(uses: Record<string, Use>, order: Record<string, string[]>, clips: string[]): State {
    const next: Record<string, string[]> = {};
    for (const w of windows) {
      const keep = (order[w] ?? []).filter((k) => goesIn(uses[k], w));
      next[w] = [...keep, ...photoKeys.filter((k) => goesIn(uses[k], w) && !keep.includes(k))];
    }
    const keptClips = clips.filter((id) => uses[videoKey(id)] != null);
    const newClips = sources.videos.filter((v) => uses[videoKey(v.id)] != null && !keptClips.includes(v.id)).map((v) => v.id);
    return { uses, order: next, clips: [...keptClips, ...newClips] };
  }

  function initial(): State {
    const uses: Record<string, Use> = {};
    for (const m of sources.current) uses[m.key] = photoVariants(m.ref);
    for (const v of sources.videos) uses[videoKey(v.id)] = sources.clipIds.includes(v.id) ? v.variants : null;
    const refs = sources.current.map((m) => m.ref);
    const order = Object.fromEntries(windows.map((w) => [w, w === ALL ? sources.current.map((m) => m.key) : variantPhotos(refs, w).map(photoKey)]));
    return arrange(uses, order, sources.clipIds);
  }

  const [state, setState] = useState<State>(initial);
  // Después de guardar llega lo guardado: la pantalla arranca de ahí.
  const [loaded, setLoaded] = useState(sources);
  if (loaded !== sources) {
    setLoaded(sources);
    setState(initial());
  }
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const start = initial();
  const photoSig = (st: State) => JSON.stringify([photoKeys.map((k) => [k, st.uses[k] ?? null]), windows.map((w) => st.order[w])]);
  const videoSig = (st: State) => JSON.stringify([sources.videos.map((v) => [v.id, st.uses[videoKey(v.id)] ?? null]), st.clips]);
  const photosDirty = photoSig(state) !== photoSig(start);
  const videosDirty = videoSig(state) !== videoSig(start);
  const dirty = photosDirty || videosDirty;

  function setUse(key: string, use: Use) {
    setState((st) => arrange({ ...st.uses, [key]: use }, st.order, st.clips));
  }

  /** Saca algo de una ventana: de una medida sola, o de la publicación si no hay medidas. */
  function removeFrom(key: string, w: string) {
    const use = state.uses[key];
    if (use == null) return;
    if (w === ALL) return setUse(key, null);
    const rest = (use.length === 0 ? measures.map((m) => m.key) : use).filter((k) => k !== w);
    setUse(key, rest.length > 0 ? rest : null);
  }

  function movePhoto(w: string, i: number, by: number) {
    setState((st) => {
      const list = [...st.order[w]];
      const [k] = list.splice(i, 1);
      list.splice(Math.max(0, Math.min(list.length, i + by)), 0, k);
      return { ...st, order: { ...st.order, [w]: list } };
    });
  }

  function moveClip(id: string, by: number) {
    setState((st) => {
      const list = [...st.clips];
      const i = list.indexOf(id);
      list.splice(i, 1);
      list.splice(Math.max(0, Math.min(list.length, i + by)), 0, id);
      return { ...st, clips: list };
    });
  }

  async function save(input: Parameters<typeof saveMediaAction>[2], key: string, ok: string) {
    setBusy(key);
    setMessage(null);
    const r = await saveMediaAction(accountSlug, publicationId, input).catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setMessage({ kind: 'ok', text: ok });
    router.refresh();
  }

  function saveAll() {
    // Todas las fotos que van, con sus medidas y su lugar en cada ventana.
    const pool = [...new Set(windows.flatMap((w) => state.order[w]))];
    const refs: PhotoRef[] = pool.map((k) => {
      const item = photos.get(k)!;
      const positions = withMeasures ? Object.fromEntries(windows.flatMap((w) => (state.order[w].includes(k) ? [[w, state.order[w].indexOf(k)]] : []))) : {};
      return withMarks(item.ref, { ...item.ref, variants: state.uses[k] ?? [], positions });
    });
    const used = sources.videos.filter((v) => state.uses[videoKey(v.id)] != null);
    save(
      {
        refs: photosDirty ? refs : undefined,
        videos: videosDirty ? Object.fromEntries(used.map((v) => [v.id, state.uses[videoKey(v.id)] ?? []])) : undefined,
        clips: videosDirty ? state.clips : undefined,
      },
      'save',
      `Guardado. Las fotos quedan en el borrador y se suben a ${channelName} desde la publicación o desde Por subir.${videosDirty && clip ? ` Los ${clip.name}s se suben a mano, desde el paso Videos.` : ''}`,
    );
  }

  const clipLabel = clip ? `${clip.name[0].toUpperCase()}${clip.name.slice(1)}` : 'Video';
  const warnings = [
    ...(withMeasures ? measures.filter((m) => state.order[m.key].length === 0).map((m) => `La medida ${m.label} se queda sin fotos.`) : []),
    ...(withMeasures && clip && !clip.perVariant
      ? state.clips
          .filter((id) => (state.uses[videoKey(id)] ?? []).length > 0)
          .map((id) => `El ${clip.name} ${videos.get(id)?.name ?? ''} es de ${labelOf(state.uses[videoKey(id)] ?? []).join(' y ')}, pero en ${channelName} se ve en todas las medidas.`)
      : []),
    ...(withMeasures && sources.channelWithoutVariants ? [`En ${channelName} esta publicación no tiene medidas: todas las fotos se ven juntas.`] : []),
  ];

  const photoCard = (m: MediaItem) => {
    const use = state.uses[m.key] ?? null;
    return (
      <li key={m.key} className={cn('space-y-1.5 rounded-lg border p-2', use !== null && 'border-foreground/60 bg-muted/40')}>
        <PhotoThumb item={m} />
        <p className="truncate text-xs">{m.label}</p>
        {m.note ? <p className={cn('text-[11px]', m.blocked ? 'text-destructive' : 'truncate text-muted-foreground')}>{m.note}</p> : null}
        <UsePicker
          measures={measures}
          value={use}
          onChange={(u) => setUse(m.key, u)}
          disabled={busy !== null || (Boolean(m.blocked) && use === null)}
          label={`Dónde va ${m.label}`}
        />
      </li>
    );
  };

  const videoCard = (v: Video) => {
    const use = state.uses[videoKey(v.id)] ?? null;
    const open = playing === v.id;
    // Solo se puede sumar como clip si sirve; si ya era clip, se puede dejar.
    const unusable = clip !== null && v.check !== null && (v.check.pending || v.check.problems.length > 0);
    return (
      <li key={v.id} className={cn('space-y-2 rounded-lg border p-2', use !== null && 'border-foreground/60 bg-muted/40', open && 'sm:col-span-2')}>
        <div className="flex gap-3">
          <VideoThumb videoId={v.id} className="h-24 w-14" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="break-all text-xs font-medium">{v.name}</p>
            <VideoFacts video={v} />
            {v.check && clip && (unusable || v.check.notes.length > 0) ? <ClipCheckLine check={v.check} clipName={clip.name} /> : null}
            <Button access="view" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPlaying(open ? null : v.id)}>
              <Play />
              {open ? 'Cerrar' : 'Ver'}
            </Button>
          </div>
        </div>
        {open ? <VideoPlayer accountSlug={accountSlug} video={v} /> : null}
        <UsePicker
          measures={measures}
          value={use}
          onChange={(u) => setUse(videoKey(v.id), u)}
          disabled={busy !== null || (unusable && use === null)}
          label={`Dónde va ${v.name}`}
        />
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <SharedPhotosNote sources={sources} />
      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Fotos y videos</h3>
          <p className="text-xs text-muted-foreground">
            {withMeasures
              ? 'Marcá dónde va cada foto y cada video: Todas, o las medidas que correspondan. Lo que no marcás no va. Abajo se arma cada medida y ahí lo ordenás.'
              : 'Tocá Usar en cada foto y cada video que va en la publicación. Abajo lo ordenás.'}
            {clip ? ` Los videos que van son los ${clip.name}s.` : ''}
          </p>
          {sources.following && !dirty ? <p className="text-xs text-muted-foreground">Ahora están las que tiene en {channelName}.</p> : null}
        </div>
        {groups.map((g) => (
          <div key={g.title} className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">{g.title}</h4>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{g.items.map(photoCard)}</ul>
          </div>
        ))}
        {sources.videos.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">Videos del producto</h4>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sources.videos.map(videoCard)}</ul>
          </div>
        ) : null}
        {groups.length === 0 && sources.videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay fotos ni videos para usar. Se suman en los pasos Imágenes y Videos.</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{withMeasures ? 'Lo que ve el comprador en cada medida' : 'Lo que ve el comprador'}</h3>
          <p className="text-xs text-muted-foreground">
            Ordená con las flechas: la primera foto es la portada.
            {clip && state.clips.length > 0 ? ` Los ${clip.name}s tienen un solo orden en ${channelName}: si movés uno, se mueve en todas las medidas. El primero es el que se muestra antes.` : ''}
          </p>
        </div>
        <div className={cn('grid gap-4', windows.length > 1 && 'xl:grid-cols-2')}>
          {windows.map((w) => {
            const title = w === ALL ? 'Publicación' : measures.find((m) => m.key === w)!.label;
            const keys = state.order[w];
            const clips = state.clips.filter((id) => goesIn(state.uses[videoKey(id)], w));
            return (
              <div key={w || 'todas'} className="space-y-3 rounded-lg border p-3" aria-label={`Lo que va en ${title}`}>
                <p className="text-sm font-medium">
                  {title}{' '}
                  <span className="font-normal text-muted-foreground">
                    · {keys.length === 1 ? '1 foto' : `${keys.length} fotos`}
                    {clip ? ` · ${clips.length === 1 ? `1 ${clip.name}` : `${clips.length} ${clip.name}s`}` : ''}
                  </span>
                </p>
                {keys.length === 0 && clips.length === 0 ? (
                  <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Nada todavía. Marcalo arriba.</p>
                ) : null}
                {keys.length > 0 ? (
                  <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                    {keys.map((k, i) => {
                      const m = photos.get(k)!;
                      return (
                        <li key={k} className="space-y-1">
                          <div className="relative">
                            <PhotoThumb item={m} />
                            <span className="absolute left-1 top-1 rounded bg-foreground/80 px-1.5 text-[11px] tabular-nums text-background">
                              {i === 0 ? '1 · portada' : i + 1}
                            </span>
                          </div>
                          <p className="truncate text-[11px]">{m.label}</p>
                          <div className="flex items-center gap-0.5">
                            <IconButton label="Antes" onClick={() => movePhoto(w, i, -1)} disabled={i === 0 || busy !== null}>
                              <ArrowLeft className="h-3.5 w-3.5" />
                            </IconButton>
                            <IconButton label="Después" onClick={() => movePhoto(w, i, 1)} disabled={i === keys.length - 1 || busy !== null}>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </IconButton>
                            <IconButton label={w === ALL ? 'Sacar' : `Sacar de ${title}`} onClick={() => removeFrom(k, w)} disabled={busy !== null} className="ml-auto">
                              <X className="h-3.5 w-3.5" />
                            </IconButton>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
                {clips.length > 0 ? (
                  <ol className="space-y-2">
                    {clips.map((id) => {
                      const v = videos.get(id);
                      const at = state.clips.indexOf(id);
                      return (
                        <li key={id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                          <VideoThumb videoId={id} className="h-12 w-8" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clapperboard className="h-3 w-3" aria-hidden />
                              {clipLabel} {at + 1}
                            </span>
                            <span className="block truncate text-xs">{v?.name ?? 'Video'}</span>
                          </span>
                          <IconButton label="Antes" onClick={() => moveClip(id, -1)} disabled={at === 0 || busy !== null}>
                            <ArrowLeft className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton label="Después" onClick={() => moveClip(id, 1)} disabled={at === state.clips.length - 1 || busy !== null}>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton label={w === ALL ? 'Sacar' : `Sacar de ${title}`} onClick={() => removeFrom(videoKey(id), w)} disabled={busy !== null}>
                            <X className="h-3.5 w-3.5" />
                          </IconButton>
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {warnings.length > 0 ? (
        <ul className="space-y-1 rounded-md bg-alert/10 px-3 py-2 text-sm">
          {warnings.map((t) => (
            <li key={t} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!dirty || busy !== null} pending={busy === 'save'} onClick={saveAll}>
          Guardar
        </Button>
        {dirty ? (
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setState(initial())}>
            Deshacer cambios
          </Button>
        ) : null}
        {!sources.following ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            pending={busy === 'follow'}
            onClick={() => save({ refs: null }, 'follow', `Listo: vuelve a usar las fotos de ${channelName}.`)}
          >
            Volver a las fotos de {channelName}
          </Button>
        ) : null}
        {dirty ? <span className="text-xs text-muted-foreground">Hay cambios sin guardar.</span> : null}
      </div>
      {message ? (
        <p className={cn('text-sm', message.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
