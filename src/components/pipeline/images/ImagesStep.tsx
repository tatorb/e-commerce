import Link from 'next/link';
import { Check, Download } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { Button } from '@/components/ui/button';
import { DriveMissing } from '@/components/drive/DriveMissing';
import { DriveSync } from '@/components/drive/DriveSync';
import { withSharedNote } from '@/components/pipeline/info/SharedNote';
import { cn } from '@/lib/utils/cn';
import type { WorkerState } from '@/lib/image-worker';
import type { loadPhotoLine } from '@/lib/photos';
import { AutoRefresh } from './AutoRefresh';
import { buildPhotoView } from './build-views';
import { photosHref, toggledPhotos } from './open-photos';
import { PhotoLine } from './PhotoLine';
import { PhotoUploader } from './PhotoUploader';
import { ArchivePhotoButton, AsIsButton, ChannelPhotosButton } from './PhotoListActions';
import { asIsProblem, type ChannelPhotoRules } from '@/domain/media';
import { photoTone, type PhotoTone } from '@/domain/photo-steps';
import { WorkerStatusLine } from './WorkerStatusLine';
import { BrandMark } from '@/components/ui/brand-loader';

// Cada foto de la lista lleva el color de su estado.
const TONE: Record<PhotoTone, { label: string; dot: string; pill: string; card: string }> = {
  approved: { label: 'Aprobadas', dot: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-800', card: 'border-emerald-200' },
  review: { label: 'Falta verificar', dot: 'bg-amber-400', pill: 'bg-amber-100 text-amber-900', card: 'border-amber-300' },
  pending: { label: 'Sin procesar', dot: 'bg-red-500', pill: 'bg-red-100 text-red-800', card: 'border-red-200' },
};

// El paso Imágenes: las fotos del producto, cada una con su línea de
// corrección. El trabajador de la Mac procesa cada paso; acá se aprueba. Una
// foto que ya viene editada se usa tal cual, sin pasar por la Mac.
// Se pueden abrir varias fotos juntas, una debajo de otra, para revisarlas
// sin ir y volver.

export function ImagesStep({
  accountSlug,
  publicationId,
  pageHref,
  timeZone,
  edits,
  openIds,
  worker,
  channelPhotos,
  channelName,
  photoRules,
  sharedWith,
  drive,
}: {
  accountSlug: string;
  publicationId: string;
  // La dirección del paso, sin las fotos abiertas.
  pageHref: string;
  timeZone: string;
  edits: Awaited<ReturnType<typeof loadPhotoLine>>;
  // Las fotos abiertas, en el orden en que se abrieron.
  openIds: string[];
  worker: WorkerState;
  channelPhotos: number;
  channelName: string;
  // Lo que acepta el canal tal como viene, para las fotos que se usan tal cual.
  photoRules: ChannelPhotoRules | null;
  sharedWith: number;
  // Si el Drive del estudio está conectado, y la carpeta Fotos del producto si ya se armó.
  drive: { ready: boolean; folderUrl: string | null };
}) {
  const now = new Date();
  const photos = edits.map((e) => buildPhotoView(e, timeZone));
  // Las abiertas, en el orden de la lista.
  const open = photos.filter((p) => openIds.includes(p.id));
  const openNow = open.map((p) => p.id);
  const inReview = photos.filter((p) => p.progress.kind === 'open' && p.progress.status === 'REVIEW').map((p) => p.id);
  const working = edits.some((e) => e.runs.some((r) => r.status === 'QUEUED' || r.status === 'PROCESSING'));
  const pending = photos.filter((p) => p.progress.kind !== 'done').length;
  const tones = photos.map((p) => photoTone(p.progress));
  const counts = (Object.keys(TONE) as PhotoTone[]).map((t) => ({ tone: t, n: tones.filter((x) => x === t).length })).filter((c) => c.n > 0);

  return (
    <div className="space-y-6">
      <AutoRefresh active={working} />
      <WorkerStatusLine state={worker} now={now} />

      <SectionCard
        title="Fotos"
        count={photos.length}
        description={withSharedNote(
          'La Mac le hace a cada foto los 9 ajustes de corrido, de la lente a la exportación, y espera tu aprobación. Si querés cambiar algo, cambiás los valores que quieras y se rehace todo junto. Solo se corrige la foto original: nada se genera ni se inventa, salvo una sombra suave sobre el fondo, y el original no se toca. Si una foto ya viene editada, usala tal cual: no se le cambia nada. Todo se guarda en la carpeta Fotos del producto en el Drive: lo que copies a Originales desde la Mac entra a la línea, y las aprobadas quedan en Corregidas.',
          sharedWith,
        )}
      >
        <div className="space-y-4 p-4">
          {!drive.ready ? (
            <DriveMissing what="Las fotos de cada producto" />
          ) : (
            <div className="space-y-3">
              <DriveSync
                accountSlug={accountSlug}
                target={{ kind: 'fotos', publicationId }}
                folderUrl={drive.folderUrl}
                label="Abrir la carpeta Fotos en el Drive"
              />
              <PhotoUploader accountSlug={accountSlug} publicationId={publicationId} photoRules={photoRules} channelName={channelName} />
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
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-label="Cuántas fotos hay en cada estado">
              {counts.map((c) => (
                <span key={c.tone} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={cn('h-2.5 w-2.5 rounded-full', TONE[c.tone].dot)} />
                  {TONE[c.tone].label} <span className="tabular-nums text-muted-foreground">{c.n}</span>
                </span>
              ))}
            </p>
          ) : null}

          {photos.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((p, i) => {
                const isOpen = openNow.includes(p.id);
                const tone = TONE[tones[i]];
                return (
                  <li key={p.id}>
                    <Link
                      href={photosHref(pageHref, toggledPhotos(openNow, p.id))}
                      scroll={false}
                      aria-current={isOpen ? 'true' : undefined}
                      className={cn(
                        'relative flex gap-3 overflow-hidden rounded-lg border py-2 pl-4 pr-2 transition-colors hover:bg-muted/50',
                        tone.card,
                        isOpen && 'border-foreground bg-muted/50',
                      )}
                    >
                      {/* El color de la izquierda dice en qué está: aprobada, falta verificar o sin procesar. */}
                      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1.5', tone.dot)} />
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
                        <p className={cn('inline-flex rounded px-1.5 py-0.5 text-xs font-medium', tone.pill)}>
                          <span className="sr-only">{tone.label}: </span>
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
              <AsIsButton
                accountSlug={accountSlug}
                publicationId={publicationId}
                editId={photo.id}
                asIs={photo.asIs}
                problem={asIsProblem({ type: photo.originalType, size: photo.originalSize }, photoRules, channelName)}
              />
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
            {photo.asIs ? (
              <div className="space-y-3">
                {photo.originalViewHref ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.originalViewHref}
                    alt={photo.name}
                    className="mx-auto block h-[30vh] w-auto max-w-full rounded-md border bg-muted object-contain sm:h-[46vh]"
                  />
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Se usa el original tal cual: la Mac no lo procesa, Claude no lo mira y no se le cambia nada. Se elige en Organización de multimedia y
                  va a {channelName} como está.
                </p>
              </div>
            ) : (
              <PhotoLine accountSlug={accountSlug} photo={photo} compact={open.length > 1} />
            )}
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
