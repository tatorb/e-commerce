'use client';

import { ArrowDown, ArrowUp, CheckCircle2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import type { ClipCheck, ClipRules } from '@/domain/videos';
import type { VideoRow } from '@/lib/videos';
import { markClipUploadedAction, moveClipAction, removeClipAction } from '@/app/a/[cuenta]/pipeline/video-actions';
import { ClipCheckLine, VideoFacts, VideoThumb } from './VideoCard';

// Un clip elegido para la publicación, en su lugar de la lista. El canal no
// deja subirlo por API: se sube a mano y se marca acá, cada uno por separado.

export function ClipCard({
  accountSlug,
  publicationId,
  video,
  check,
  rules,
  channelName,
  uploadedLabel,
  index,
  count,
}: {
  accountSlug: string;
  publicationId: string;
  video: VideoRow;
  check: ClipCheck;
  rules: ClipRules;
  channelName: string;
  // "el 21/10 a las 15:30 por Juani", si ya se subió.
  uploadedLabel: string | null;
  // Su lugar en la lista, desde 0, y cuántos clips hay.
  index: number;
  count: number;
}) {
  const action = useStepAction();

  return (
    <li className="space-y-3 rounded-lg border p-3">
      <div className="flex gap-3">
        <div className="relative">
          <VideoThumb videoId={video.id} className="h-28 w-16" />
          <span className="absolute left-1 top-1 rounded bg-foreground/80 px-1.5 text-[11px] tabular-nums text-background">{index + 1}</span>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="break-all text-sm font-medium">{video.name}</p>
          <VideoFacts video={video} />
          {video.gone ? (
            <p className="text-xs text-destructive">Ya no está en la carpeta del Drive. Sacalo o elegí otro.</p>
          ) : (
            <ClipCheckLine check={check} clipName={rules.name} />
          )}
          {uploadedLabel ? (
            <p className="flex items-start gap-1 text-xs">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Subido a {channelName} {uploadedLabel}.
            </p>
          ) : (
            <p className="text-xs font-medium text-amber-700">Falta subirlo a {channelName}.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <IconButton
          label="Antes"
          onClick={() => action.run(() => moveClipAction(accountSlug, publicationId, video.id, -1), undefined, 'up')}
          disabled={action.pending || index === 0}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          label="Después"
          onClick={() => action.run(() => moveClipAction(accountSlug, publicationId, video.id, 1), undefined, 'down')}
          disabled={action.pending || index === count - 1}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </IconButton>
        {uploadedLabel ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => action.run(() => markClipUploadedAction(accountSlug, publicationId, video.id, false), undefined, 'undo')}
            pending={action.running('undo')}
            disabled={action.pending}
          >
            Desmarcar
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => action.run(() => markClipUploadedAction(accountSlug, publicationId, video.id, true), undefined, 'done')}
            pending={action.running('done')}
            disabled={action.pending || video.gone}
          >
            <Upload />
            Ya lo subí
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => action.run(() => removeClipAction(accountSlug, publicationId, video.id), undefined, 'clear')}
          pending={action.running('clear')}
          disabled={action.pending}
        >
          <X />
          Sacar de los {rules.name}s
        </Button>
        <StatusText status={action.status} />
      </div>
    </li>
  );
}
