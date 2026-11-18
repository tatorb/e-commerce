'use client';

import Link from 'next/link';
import { Download, ExternalLink, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { VideoFacts, VideoThumb } from '@/components/pipeline/videos/VideoCard';
import { markClipUploadedAction } from '@/app/a/[cuenta]/pipeline/video-actions';

// La lista de clips que falta subir a mano al canal: de cada uno, el archivo,
// la publicación en el listado del vendedor y el botón para anotarlo.

export type ClipUploadRow = {
  publicationId: string;
  videoId: string;
  title: string | null;
  product: string;
  externalId: string;
  channelLink: string;
  fileName: string;
  downloadLink: string;
  durationMs: number | null;
  size: number | null;
};

export function ClipUploadList({ accountSlug, clips }: { accountSlug: string; clips: ClipUploadRow[] }) {
  if (clips.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No hay clips por subir. Cuando apruebes un clip, aparece acá.</p>;
  }
  return (
    <ul className="space-y-3">
      {clips.map((c) => (
        <Row key={`${c.publicationId}:${c.videoId}`} accountSlug={accountSlug} clip={c} />
      ))}
    </ul>
  );
}

function Row({ accountSlug, clip }: { accountSlug: string; clip: ClipUploadRow }) {
  const action = useStepAction();
  return (
    <li className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row">
      <VideoThumb videoId={clip.videoId} className="h-28 w-16" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-0.5">
          <Link href={`/a/${accountSlug}/pipeline/${clip.publicationId}`} className="text-sm font-medium underline-offset-4 hover:underline">
            {clip.title ?? clip.product}
          </Link>
          <p className="text-xs text-muted-foreground">
            {clip.externalId} · {clip.product}
          </p>
          <p className="break-all text-xs text-muted-foreground">{clip.fileName}</p>
          <VideoFacts video={{ durationMs: clip.durationMs, width: null, height: null, size: clip.size }} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={clip.downloadLink} target="_blank" rel="noreferrer">
              <Download />
              1. Bajar el clip
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={clip.channelLink} target="_blank" rel="noreferrer">
              <ExternalLink />
              2. Abrir en Mercado Libre
            </a>
          </Button>
          <Button
            size="sm"
            onClick={() => action.run(() => markClipUploadedAction(accountSlug, clip.publicationId, clip.videoId, true), undefined, 'done')}
            pending={action.running('done')}
            disabled={action.pending}
          >
            <Upload />
            3. Ya lo subí
          </Button>
          <StatusText status={action.status} />
        </div>
      </div>
    </li>
  );
}
