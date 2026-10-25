'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Clapperboard, ExternalLink, Film, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils/cn';
import { formatSeconds, type ClipCheck } from '@/domain/videos';
import { chooseClipAction, saveVideoMeasureAction, trashVideoAction } from '@/app/a/[cuenta]/pipeline/video-actions';
import type { VideoRow } from '@/lib/videos';

// Un video del producto: su miniatura, sus medidas, si sirve como clip y lo
// que se puede hacer con él. Se puede ver en la app aunque no se tenga el Drive.

export function formatBytes(bytes: number): string {
  const mb = bytes / 1024 ** 2;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1).replace('.', ',')} GB`;
  return mb < 10 ? `${mb.toFixed(1).replace('.', ',')} MB` : `${Math.round(mb)} MB`;
}

export function VideoThumb({ videoId, className }: { videoId: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted', className)}>
      {failed ? (
        <Film className="h-6 w-6 text-muted-foreground" aria-hidden />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/drive/videos/${videoId}/miniatura`} alt="" className="h-full w-full object-contain" onError={() => setFailed(true)} />
      )}
    </div>
  );
}

export function VideoFacts({ video }: { video: Pick<VideoRow, 'durationMs' | 'width' | 'height' | 'size'> }) {
  const facts = [
    video.durationMs !== null ? formatSeconds(video.durationMs) : null,
    video.width && video.height ? `${video.width} × ${video.height}` : null,
    video.size !== null ? formatBytes(video.size) : null,
  ].filter(Boolean);
  return <p className="text-xs text-muted-foreground">{facts.length > 0 ? facts.join(' · ') : 'Sin medidas todavía'}</p>;
}

export function ClipCheckLine({ check, clipName }: { check: ClipCheck; clipName: string }) {
  if (check.problems.length > 0) {
    return (
      <ul className="space-y-0.5 text-xs text-destructive">
        {check.problems.map((p) => (
          <li key={p} className="flex items-start gap-1">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {p}
          </li>
        ))}
      </ul>
    );
  }
  if (check.pending) {
    return <p className="text-xs text-muted-foreground">Todavía no se sabe si sirve como {clipName}: falta medirlo. Tocá Ver para medirlo.</p>;
  }
  return (
    <div className="space-y-0.5 text-xs">
      <p className="flex items-center gap-1 text-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Sirve como {clipName}.
      </p>
      {check.notes.map((n) => (
        <p key={n} className="text-muted-foreground">
          {n}
        </p>
      ))}
    </div>
  );
}

/**
 * El video para mirarlo en la app. Al abrirlo, el navegador lo mide: si da
 * otras medidas que las guardadas, se guardan.
 */
export function VideoPlayer({
  accountSlug,
  video,
}: {
  accountSlug: string;
  video: Pick<VideoRow, 'id' | 'width' | 'height' | 'durationMs' | 'measuredByBrowser'>;
}) {
  const router = useRouter();
  async function measured(e: React.SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget;
    if (!(v.videoWidth > 0 && v.videoHeight > 0 && Number.isFinite(v.duration))) return;
    const measure = { width: v.videoWidth, height: v.videoHeight, durationMs: Math.round(v.duration * 1000) };
    if (video.measuredByBrowser && measure.width === video.width && measure.height === video.height && measure.durationMs === video.durationMs) return;
    const r = await saveVideoMeasureAction(accountSlug, video.id, measure).catch(() => null);
    if (r?.ok && r.changed) router.refresh();
  }
  return (
    <video
      controls
      playsInline
      preload="metadata"
      src={`/api/drive/videos/${video.id}`}
      onLoadedMetadata={measured}
      className="max-h-[70vh] w-full rounded-md bg-black"
    />
  );
}

export function VideoCard({
  accountSlug,
  publicationId,
  video,
  check,
  clipName,
  isClip,
  timeLabel,
}: {
  accountSlug: string;
  publicationId: string;
  video: VideoRow;
  // Null si el canal no tiene clips.
  check: ClipCheck | null;
  clipName: string;
  isClip: boolean;
  timeLabel: string;
}) {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [which, setWhich] = useState<'clip' | 'trash' | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(key: 'clip' | 'trash', action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    setWhich(key);
    startTransition(async () => {
      const r = await action().catch(() => ({ ok: false as const, error: 'Se cortó la conexión con la app. Probá de nuevo.' }));
      if (!r.ok) setError(r.error);
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <li className={cn('space-y-3 rounded-lg border p-3', isClip && 'border-foreground/60')}>
      <div className="flex gap-3">
        <VideoThumb videoId={video.id} className="h-32 w-20" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
            <span className="break-all">{video.name}</span>
            {isClip ? (
              <span className="inline-flex items-center gap-1 rounded bg-foreground px-1.5 py-0.5 text-[11px] font-medium text-background">
                <Clapperboard className="h-3 w-3" aria-hidden />
                {clipName[0].toUpperCase()}
                {clipName.slice(1)} de esta publicación
              </span>
            ) : null}
          </p>
          <VideoFacts video={video} />
          <p className="text-xs text-muted-foreground">
            {video.origin === 'APP' ? `Subido desde la app${video.uploadedBy ? ` por ${video.uploadedBy}` : ''}` : 'Agregado desde el Drive'}, {timeLabel}
          </p>
          {video.gone ? (
            <p className="text-xs text-destructive">Ya no está en la carpeta del Drive: se borró o se movió.</p>
          ) : check ? (
            <ClipCheckLine check={check} clipName={clipName} />
          ) : null}
        </div>
      </div>

      {playing ? <VideoPlayer accountSlug={accountSlug} video={video} /> : null}

      {!video.gone ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button access="view" size="sm" variant="outline" onClick={() => setPlaying((p) => !p)}>
            <Play />
            {playing ? 'Cerrar' : 'Ver'}
          </Button>
          {check && !isClip ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => run('clip', () => chooseClipAction(accountSlug, publicationId, video.id))}
              pending={pending && which === 'clip'}
              disabled={pending || check.problems.length > 0 || check.pending}
            >
              <Clapperboard />
              Usar como {clipName}
            </Button>
          ) : null}
          {video.webViewLink ? (
            <Button size="sm" variant="ghost" asChild>
              <a href={video.webViewLink} target="_blank" rel="noreferrer">
                <ExternalLink />
                Abrir en el Drive
              </a>
            </Button>
          ) : null}
          <Popover open={confirming} onOpenChange={setConfirming}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" disabled={pending}>
                <Trash2 />
                Mandar a la papelera
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4">
              <p className="text-sm">
                El video va a la papelera del Drive y sale de la lista de todas las publicaciones del producto. Se puede
                recuperar desde la papelera durante 30 días.
              </p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  pending={pending && which === 'trash'}
                  disabled={pending}
                  onClick={() => run('trash', () => trashVideoAction(accountSlug, video.id))}
                >
                  Mandar a la papelera
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
      {error ? (
        <p role="status" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
