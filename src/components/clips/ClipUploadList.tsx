'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClipboardCopy, Download, ExternalLink, Puzzle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { VideoFacts, VideoThumb } from '@/components/pipeline/videos/VideoCard';
import { markClipUploadedAction } from '@/app/a/[cuenta]/pipeline/video-actions';

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
  measure: string | null;
  channelLink: string;
  fileName: string;
  mimeType: string;
  downloadLink: string;
  durationMs: number | null;
  size: number | null;
};

// Lo que cuenta la extensión de una subida.
// Los informes se juntan: la pantalla al cargar el clip y lo que pasa después.
type Progress = { text: string | null; error: string | null; done: boolean; reports: unknown[] };
type FromExtension = { origen?: string; tipo?: string; version?: string; publicacion?: string; video?: string; texto?: string | null; error?: string | null; listo?: boolean; informe?: unknown };

const rowKey = (c: { publicationId: string; videoId: string }) => `${c.publicationId}:${c.videoId}`;

export function ClipUploadList({ accountSlug, clips }: { accountSlug: string; clips: ClipUploadRow[] }) {
  // La versión de la extensión, si está instalada en este Chrome.
  const [extension, setExtension] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>({});

  useEffect(() => {
    function hear(e: MessageEvent<FromExtension>) {
      if (e.source !== window || e.origin !== window.location.origin || e.data?.origen !== 'mrb-clips') return;
      const d = e.data;
      if (d.tipo === 'hola' && d.version) setExtension(d.version);
      if (d.tipo === 'avance' && d.publicacion && d.video) {
        const key = `${d.publicacion}:${d.video}`;
        setProgress((p) => ({ ...p, [key]: { text: d.texto ?? null, error: d.error ?? null, done: d.listo === true, reports: d.informe ? [...(p[key]?.reports ?? []), d.informe] : (p[key]?.reports ?? []) } }));
      }
    }
    window.addEventListener('message', hear);
    window.postMessage({ origen: 'mrb-app', tipo: 'hola' }, window.location.origin);
    return () => window.removeEventListener('message', hear);
  }, []);

  function upload(c: ClipUploadRow) {
    setProgress((p) => ({ ...p, [rowKey(c)]: { text: 'Pidiendo la subida a la extensión…', error: null, done: false, reports: [] } }));
    window.postMessage(
      { origen: 'mrb-app', tipo: 'subir', publicacion: c.publicationId, video: c.videoId, codigo: c.externalId, nombre: c.fileName, tipoDeArchivo: c.mimeType },
      window.location.origin,
    );
  }

  if (clips.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No hay clips por subir. Cuando apruebes un clip, aparece acá.</p>;
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
        {clips.map((c) => (
          <Row key={rowKey(c)} accountSlug={accountSlug} clip={c} extension={extension !== null} progress={progress[rowKey(c)] ?? null} onUpload={() => upload(c)} />
        ))}
      </ul>
    </div>
  );
}

function Row({ accountSlug, clip, extension, progress, onUpload }: { accountSlug: string; clip: ClipUploadRow; extension: boolean; progress: Progress | null; onUpload: () => void }) {
  const action = useStepAction();
  const [copied, setCopied] = useState(false);
  const working = progress !== null && !progress.done && !progress.error;

  async function copyReport() {
    await navigator.clipboard.writeText(JSON.stringify(progress?.reports, null, 2));
    setCopied(true);
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row">
      <VideoThumb videoId={clip.videoId} className="h-28 w-16" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-0.5">
          <Link href={`/a/${accountSlug}/pipeline/${clip.publicationId}`} className="text-sm font-medium underline-offset-4 hover:underline">
            {clip.title ?? clip.product}
          </Link>
          <p className="text-xs text-muted-foreground">
            {clip.externalId}
            {clip.measure ? ` · medida ${clip.measure}` : ''} · {clip.product}
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
            onClick={() => action.run(() => markClipUploadedAction(accountSlug, clip.publicationId, clip.videoId, true), undefined, 'done')}
            pending={action.running('done')}
            disabled={action.pending}
          >
            Ya lo subí
          </Button>
          <StatusText status={action.status} />
        </div>
        {progress ? (
          <div className="space-y-2">
            <p role="status" className={progress.error ? 'text-sm text-destructive' : progress.done ? 'text-sm font-medium' : 'text-sm text-muted-foreground'}>
              {progress.error ?? progress.text}
            </p>
            {progress.reports.length > 0 ? (
              <Button size="sm" variant="ghost" onClick={copyReport}>
                <ClipboardCopy />
                {copied ? 'Informe copiado' : `Copiar el informe de la pantalla (${progress.reports.length})`}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
