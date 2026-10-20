import Link from 'next/link';
import { Check, Download } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { Button } from '@/components/ui/button';
import { BlobSetup } from '@/components/pipeline/info/BlobSetup';
import { withSharedNote } from '@/components/pipeline/info/SharedNote';
import { cn } from '@/lib/utils/cn';
import type { WorkerState } from '@/lib/image-worker';
import type { loadPhotoLine } from '@/lib/photos';
import { AutoRefresh } from './AutoRefresh';
import { buildPhotoView } from './build-views';
import { photosHref, toggledPhotos } from './open-photos';
import { PhotoLine } from './PhotoLine';
import { PhotoUploader } from './PhotoUploader';
import { ArchivePhotoButton, ChannelPhotosButton } from './PhotoListActions';
import { WorkerStatusLine } from './WorkerStatusLine';
import { BrandMark } from '@/components/ui/brand-loader';

// El paso Imágenes: las fotos del producto, cada una con su línea de
// corrección. El trabajador de la Mac procesa cada paso; acá se aprueba.
// Se pueden abrir varias fotos juntas, una debajo de otra, para revisarlas
// sin ir y volver.

export function ImagesStep({
  accountSlug,
  publicationId,
  productId,
  pageHref,
  timeZone,
  edits,
  openIds,
  worker,
  channelPhotos,
  channelName,
  sharedWith,
  blobReady,
}: {
  accountSlug: string;
  publicationId: string;
  productId: string;
  // La dirección del paso, sin las fotos abiertas.
  pageHref: string;
  timeZone: string;
  edits: Awaited<ReturnType<typeof loadPhotoLine>>;
  // Las fotos abiertas, en el orden en que se abrieron.
  openIds: string[];
  worker: WorkerState;
  channelPhotos: number;
  channelName: string;
  sharedWith: number;
  blobReady: boolean;
}) {
  const now = new Date();
  const photos = edits.map((e) => buildPhotoView(e, timeZone));
  // Las abiertas, en el orden de la lista.
  const open = photos.filter((p) => openIds.includes(p.id));
  const openNow = open.map((p) => p.id);
  const inReview = photos.filter((p) => p.progress.kind === 'open' && p.progress.status === 'REVIEW').map((p) => p.id);
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
          'La Mac le hace a cada foto los 8 ajustes de corrido, de la lente a la exportación, y espera tu aprobación. Si querés cambiar algo, cambiás los valores que quieras y se rehace todo junto. Solo se corrige la foto original: nada se genera ni se inventa, y el original no se toca.',
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

          {photos.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-1 text-sm text-muted-foreground">Tocá las fotos que quieras revisar: se abren juntas.</p>
              {inReview.length > 0 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={photosHref(pageHref, inReview)} scroll={false}>
                    Abrir las que esperan tu aprobación ({inReview.length})
                  </Link>
                </Button>
              ) : null}
              {openNow.length < photos.length ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={photosHref(pageHref, photos.map((p) => p.id))} scroll={false}>
                    Abrir todas
                  </Link>
                </Button>
              ) : null}
              {openNow.length > 0 ? (
                <Button asChild size="sm" variant="ghost">
                  <Link href={pageHref} scroll={false}>
                    Cerrar todas
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}

          {photos.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((p) => {
                const isOpen = openNow.includes(p.id);
                return (
                  <li key={p.id}>
                    <Link
                      href={photosHref(pageHref, toggledPhotos(openNow, p.id))}
                      scroll={false}
                      aria-current={isOpen ? 'true' : undefined}
                      className={cn(
                        'relative flex gap-3 rounded-lg border p-2 transition-colors hover:bg-muted/50',
                        isOpen && 'border-foreground bg-muted/50',
                      )}
                    >
                      {/* Tocar la foto la abre o la cierra: la marca muestra cuáles están abiertas. */}
                      <span
                        aria-hidden
                        className={cn(
                          'absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded border',
                          isOpen ? 'border-foreground bg-foreground text-background' : 'bg-background',
                        )}
                      >
                        {isOpen ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      {p.thumbHref ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumbHref} alt="" className="h-16 w-16 shrink-0 rounded border bg-muted object-contain" />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded border bg-muted text-center text-[10px] leading-tight text-muted-foreground">
                          <BrandMark />
                          Preparando
                        </div>
                      )}
                      <div className="min-w-0 space-y-0.5 pr-7">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className={cn('text-xs', p.progress.kind === 'done' ? 'text-emerald-700' : 'text-muted-foreground')}>
                          {p.progressText}
                        </p>
                        <p className="text-xs text-muted-foreground">{p.source === 'CHANNEL' ? `Publicada en ${channelName}` : 'Original subido'}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no hay fotos en la línea.</p>
          )}
        </div>
      </SectionCard>

      {open.map((photo) => (
        <SectionCard
          key={photo.id}
          // Recorta sin volverse una caja con scroll propio, así los botones de la foto quedan fijos abajo al bajar.
          className="overflow-clip"
          title={photo.name}
          description={[photo.size, photo.camera].filter(Boolean).join(' · ') || 'El trabajador anota el tamaño y la cámara al preparar la foto.'}
          action={
            <div className="flex flex-wrap items-center gap-1">
              <Button asChild size="sm" variant="ghost">
                <a href={photo.originalHref}>
                  <Download className="h-4 w-4" />
                  Original
                </a>
              </Button>
              <ArchivePhotoButton accountSlug={accountSlug} editId={photo.id} />
              {open.length > 1 ? (
                <Button asChild size="sm" variant="ghost">
                  <Link href={photosHref(pageHref, toggledPhotos(openNow, photo.id))} scroll={false}>
                    Cerrar
                  </Link>
                </Button>
              ) : null}
            </div>
          }
        >
          <div className="p-4">
            <PhotoLine accountSlug={accountSlug} photo={photo} compact={open.length > 1} />
          </div>
        </SectionCard>
      ))}
      {open.length === 0 && photos.length > 0 ? (
        <p className="text-sm text-muted-foreground">Tocá una o varias fotos para revisarlas.</p>
      ) : null}

      {pending > 0 ? (
        <p className="text-sm text-muted-foreground">
          {pending === 1 ? 'Queda 1 foto sin terminar.' : `Quedan ${pending} fotos sin terminar.`} Podés avanzar a Videos igual.
        </p>
      ) : null}
    </div>
  );
}
