'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, ExternalLink, Puzzle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { VideoFacts, VideoThumb } from '@/components/pipeline/videos/VideoCard';
import { markClipUploadedAction } from '@/app/a/[cuenta]/pipeline/video-actions';
import { askClipUpload, uploadKey, useClipUploader } from './clip-uploader';
import { ClipUploadStatus } from './ClipUploadStatus';

// La lista de clips que falta subir al canal. Con la extensión de Chrome de
// Studio MRB, un botón abre la publicación en Mercado Libre y carga el archivo
// solo; la persona confirma allá y lo marca acá. Sin la extensión, están el
// archivo y la publicación a un clic.

export type ClipUploadRow = {
  publicationId: string;
  videoId: string;
  title: string | null;
  product: string;
  externalId: string;
  publications: number;
  allMeasures: boolean;
  measure: string | null;
  channelLink: string;
  fileName: string;
  mimeType: string;
  downloadLink: string;
  durationMs: number | null;
  size: number | null;
};

export function ClipUploadList({ accountSlug, clips }: { accountSlug: string; clips: ClipUploadRow[] }) {
  const router = useRouter();
  const { extension, progress } = useClipUploader();

  if (clips.length === 0) {
    return null;
  }
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-lg border p-3 text-sm">
        <Puzzle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {extension
          ? `La extensión de Studio MRB está instalada en este Chrome (versión ${extension}). Tenés que tener la sesión de Mercado Libre iniciada.`
          : 'La extensión de Studio MRB no está instalada en este navegador. Con ella, un botón abre la publicación y carga el clip solo. Mientras tanto, se sube a mano con los botones de cada clip.'}
      </p>
      <ul className="space-y-3">
        {clips.map((c) => {
          const p = progress[uploadKey(c)];
          return (
            <Row
              key={uploadKey(c)}
              accountSlug={accountSlug}
              clip={c}
              extension={extension !== null}
              working={p !== undefined && !p.done && !p.error}
              onUpload={() => askClipUpload(accountSlug, { publicationId: c.publicationId, videoId: c.videoId, externalId: c.externalId, fileName: c.fileName, mimeType: c.mimeType, allMeasures: c.allMeasures }, () => router.refresh())}
            />
          );
        })}
      </ul>
    </div>
  );
}

function Row({ accountSlug, clip, extension, working, onUpload }: { accountSlug: string; clip: ClipUploadRow; extension: boolean; working: boolean; onUpload: () => void }) {
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
            {clip.allMeasures ? (clip.publications > 1 ? ' · se ve en todas sus medidas' : '') : ` · solo en la medida ${clip.measure ?? 'de esta publicación'}`}
          </p>
          <p className="break-all text-xs text-muted-foreground">{clip.fileName}</p>
          <VideoFacts video={{ durationMs: clip.durationMs, width: null, height: null, size: clip.size }} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extension ? (
            <Button size="sm" onClick={onUpload} pending={working} disabled={working}>
              <Upload />
              Subir a Mercado Libre
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <a href={clip.downloadLink} target="_blank" rel="noreferrer">
              <Download />
              Bajar el clip
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={clip.channelLink} target="_blank" rel="noreferrer">
              <ExternalLink />
              Abrir en Mercado Libre
            </a>
          </Button>
          <Button
            size="sm"
            variant={extension ? 'outline' : 'default'}
            onClick={() => action.run(() => markClipUploadedAction(accountSlug, clip.publicationId, clip.videoId, true, !clip.allMeasures), undefined, 'done')}
            pending={action.running('done')}
            disabled={action.pending}
          >
            Ya lo subí
          </Button>
          <StatusText status={action.status} />
        </div>
        <ClipUploadStatus uploadKey={uploadKey(clip)} />
      </div>
    </li>
  );
}
