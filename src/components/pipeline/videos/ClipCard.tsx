'use client';

import { CheckCircle2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import type { ClipCheck, ClipRules } from '@/domain/videos';
import type { VideoRow } from '@/lib/videos';
import { clearClipAction, markClipUploadedAction } from '@/app/a/[cuenta]/pipeline/video-actions';
import { ClipCheckLine, VideoFacts, VideoThumb } from './VideoCard';

// El clip elegido para la publicación y cómo subirlo a mano al canal, que no
// deja subirlo por API. Cuando se sube, se marca acá.

export function ClipCard({
  accountSlug,
  publicationId,
  video,
  check,
  rules,
  channelName,
  uploadedLabel,
}: {
  accountSlug: string;
  publicationId: string;
  video: VideoRow;
  check: ClipCheck;
  rules: ClipRules;
  channelName: string;
  // "el 21/10 a las 15:30 por Juani", si ya se subió.
  uploadedLabel: string | null;
}) {
  const action = useStepAction();

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <VideoThumb videoId={video.id} className="h-32 w-20" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="break-all text-sm font-medium">{video.name}</p>
          <VideoFacts video={video} />
          {video.gone ? (
            <p className="text-xs text-destructive">Ya no está en la carpeta del Drive. Elegí otro.</p>
          ) : (
            <ClipCheckLine check={check} clipName={rules.name} />
          )}
        </div>
      </div>

      {uploadedLabel ? (
        <p className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Subido a {channelName} {uploadedLabel}.
          </span>
        </p>
      ) : (
        <div className="space-y-2 rounded-md border px-3 py-3 text-sm">
          <p className="font-medium">Falta subirlo a {channelName}</p>
          <ol className="list-decimal space-y-1 pl-5">
            {rules.guide.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {uploadedLabel ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => action.run(() => markClipUploadedAction(accountSlug, publicationId, false), undefined, 'undo')}
            pending={action.running('undo')}
            disabled={action.pending}
          >
            Desmarcar
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => action.run(() => markClipUploadedAction(accountSlug, publicationId, true), undefined, 'done')}
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
          onClick={() => action.run(() => clearClipAction(accountSlug, publicationId), undefined, 'clear')}
          pending={action.running('clear')}
          disabled={action.pending}
        >
          <X />
          Sacar el clip
        </Button>
        <StatusText status={action.status} />
      </div>
    </div>
  );
}
