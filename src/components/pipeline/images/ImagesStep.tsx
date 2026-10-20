import Link from 'next/link';
import { Download } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { Button } from '@/components/ui/button';
import { BlobSetup } from '@/components/pipeline/info/BlobSetup';
import { withSharedNote } from '@/components/pipeline/info/SharedNote';
import { cn } from '@/lib/utils/cn';
import type { WorkerState } from '@/lib/image-worker';
import type { loadPhotoLine } from '@/lib/photos';
import { AutoRefresh } from './AutoRefresh';
import { buildPhotoView } from './build-views';
import { PhotoLine } from './PhotoLine';
import { PhotoUploader } from './PhotoUploader';
import { ArchivePhotoButton, ChannelPhotosButton } from './PhotoListActions';
import { WorkerStatusLine } from './WorkerStatusLine';

// El paso Imágenes: las fotos del producto, cada una con su línea de
// corrección. El trabajador de la Mac procesa cada paso; acá se aprueba.

export function ImagesStep({
  accountSlug,
  publicationId,
  productId,
  pageHref,
  timeZone,
  edits,
  selectedId,
  worker,
  channelPhotos,
  channelName,
  sharedWith,
  blobReady,
}: {
  accountSlug: string;
  publicationId: string;
  productId: string;
  // La dirección del paso, para abrir cada foto.
  pageHref: string;
  timeZone: string;
  edits: Awaited<ReturnType<typeof loadPhotoLine>>;
  selectedId: string | null;
  worker: WorkerState;
  channelPhotos: number;
  channelName: string;
  sharedWith: number;
  blobReady: boolean;
}) {
  const now = new Date();
  const photos = edits.map((e) => buildPhotoView(e, timeZone));
  const selected = photos.find((p) => p.id === selectedId) ?? null;
  const working = edits.some((e) => e.runs.some((r) => r.status === 'QUEUED' || r.status === 'PROCESSING'));
  const pending = photos.filter((p) => p.progress.kind !== 'done').length;

  return (
    <div className="space-y-6">
      <AutoRefresh active={working} />
      <WorkerStatusLine state={worker} now={now} />

      <SectionCard
        title="Fotos"
        count={photos.length}
        description={withSharedNote(
          'Cada foto pasa por 2 pasos: corregir la foto, y recortar y exportar. La Mac hace los ajustes de cada paso de corrido y espera tu aprobación. Solo se corrige la foto original: nada se genera ni se inventa, y el original no se toca.',
          sharedWith,
        )}
      >
        <div className="space-y-4 p-4">
          {!blobReady ? (
            <BlobSetup />
          ) : (
            <div className="space-y-3">
              <PhotoUploader accountSlug={accountSlug} publicationId={publicationId} productId={productId} />
              <ChannelPhotosButton accountSlug={accountSlug} publicationId={publicationId} count={channelPhotos} channelName={channelName} />
            </div>
          )}

          {photos.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`${pageHref}&foto=${p.id}`}
                    scroll={false}
                    aria-current={p.id === selectedId ? 'true' : undefined}
                    className={cn(
                      'flex gap-3 rounded-lg border p-2 transition-colors hover:bg-muted/50',
                      p.id === selectedId && 'border-foreground bg-muted/50',
                    )}
                  >
                    {p.thumbHref ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbHref} alt="" className="h-16 w-16 shrink-0 rounded border bg-muted object-contain" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border bg-muted text-center text-[10px] leading-tight text-muted-foreground">
                        Preparando
                      </div>
                    )}
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className={cn('text-xs', p.progress.kind === 'done' ? 'text-emerald-700' : 'text-muted-foreground')}>
                        {p.progressText}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.source === 'CHANNEL' ? `Publicada en ${channelName}` : 'Original subido'}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no hay fotos en la línea.</p>
          )}
        </div>
      </SectionCard>

      {selected ? (
        <SectionCard
          title={selected.name}
          description={[selected.size, selected.camera].filter(Boolean).join(' · ') || 'El trabajador anota el tamaño y la cámara al preparar la foto.'}
          action={
            <div className="flex flex-wrap items-center gap-1">
              <Button asChild size="sm" variant="ghost">
                <a href={selected.originalHref}>
                  <Download className="h-4 w-4" />
                  Original
                </a>
              </Button>
              <ArchivePhotoButton accountSlug={accountSlug} editId={selected.id} />
            </div>
          }
        >
          <div className="p-4">
            <PhotoLine accountSlug={accountSlug} photo={selected} />
          </div>
        </SectionCard>
      ) : photos.length > 0 ? (
        <p className="text-sm text-muted-foreground">Tocá una foto para ver su línea.</p>
      ) : null}

      {pending > 0 ? (
        <p className="text-sm text-muted-foreground">
          {pending === 1 ? 'Queda 1 foto sin terminar.' : `Quedan ${pending} fotos sin terminar.`} Podés avanzar a Videos igual.
        </p>
      ) : null}
    </div>
  );
}
