import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { buildPhotoView } from '@/components/pipeline/images/build-views';
import { PHOTO_TONE } from '@/components/pipeline/images/tone';
import { VideoThumb } from '@/components/pipeline/videos/VideoCard';
import { photoTone, type PhotoTone } from '@/domain/photo-steps';
import type { loadPhotoLine } from '@/lib/photos';
import { cn } from '@/lib/utils/cn';

// Las fotos y los videos del producto, para verlos de un vistazo: cada foto
// con el color de su estado y los videos que tiene. Son del producto y los
// comparten todas sus publicaciones; se trabajan en los pasos Imágenes y Videos.

type Photos = Awaited<ReturnType<typeof loadPhotoLine>>;

const seconds = (ms: number | null) => (ms === null ? null : `${Math.round(ms / 1000)} s`);

export function ProductMediaPanel({
  photos,
  videos,
  timeZone,
  stepHref,
}: {
  photos: Photos;
  videos: { id: string; name: string; durationMs: number | null; width: number | null; height: number | null }[];
  timeZone: string;
  // El paso de una de sus publicaciones, para ir a trabajarlas. Null si no tiene publicaciones.
  stepHref: ((step: 'imagenes' | 'videos') => string) | null;
}) {
  const views = photos.map((p) => buildPhotoView(p, timeZone));
  const tones = views.map((v) => photoTone(v.progress));
  const counts = (Object.keys(PHOTO_TONE) as PhotoTone[]).map((t) => ({ tone: t, n: tones.filter((x) => x === t).length })).filter((c) => c.n > 0);
  return (
    <>
      <SectionCard title="Fotos" count={views.length} description="Los originales y cómo va la corrección de cada una.">
        <SectionBody className="space-y-3">
          {views.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no tiene fotos.</p> : null}
          {counts.length > 0 ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {counts.map((c) => (
                <span key={c.tone} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={cn('h-2.5 w-2.5 rounded-full', PHOTO_TONE[c.tone].dot)} />
                  {PHOTO_TONE[c.tone].label} <span className="tabular-nums text-muted-foreground">{c.n}</span>
                </span>
              ))}
            </div>
          ) : null}
          {views.length > 0 ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {views.map((v, i) => (
                <li key={v.id} className={cn('space-y-1 rounded-md border-2 p-1', PHOTO_TONE[tones[i]].card)}>
                  {v.thumbHref ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbHref} alt={v.name} className="aspect-square w-full rounded object-contain bg-muted" loading="lazy" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded bg-muted text-[11px] text-muted-foreground">Sin vista</div>
                  )}
                  <p className="truncate text-[11px]" title={v.name}>
                    {v.name}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{v.progressText}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {stepHref ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={stepHref('imagenes')}>
                Trabajarlas en el paso Imágenes
                <ArrowRight />
              </Link>
            </Button>
          ) : null}
        </SectionBody>
      </SectionCard>
      <SectionCard title="Videos" count={videos.length} description="Los videos del producto. Los que van en cada publicación se eligen en Organización de multimedia.">
        <SectionBody className="space-y-3">
          {videos.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no tiene videos.</p> : null}
          {videos.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {videos.map((v) => (
                <li key={v.id} className="flex items-center gap-3 rounded-md border p-2">
                  <VideoThumb videoId={v.id} className="h-16 w-10" />
                  <div className="min-w-0 text-sm">
                    <p className="break-all">{v.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[v.width && v.height ? (v.height > v.width ? 'Vertical' : 'Horizontal') : null, seconds(v.durationMs)].filter(Boolean).join(' · ') || 'Sin medir'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {stepHref ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={stepHref('videos')}>
                Trabajarlos en el paso Videos
                <ArrowRight />
              </Link>
            </Button>
          ) : null}
        </SectionBody>
      </SectionCard>
    </>
  );
}
