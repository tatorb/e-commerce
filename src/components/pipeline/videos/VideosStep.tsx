import { SectionCard } from '@/components/ui/section-card';
import { withSharedNote } from '@/components/pipeline/info/SharedNote';
import { checkClip, type ClipRules } from '@/domain/videos';
import { formatDateTime, formatRelativeDate } from '@/lib/format';
import type { VideosStepData } from '@/lib/videos';
import { AutoMeasure } from './AutoMeasure';
import { ClipCard } from './ClipCard';
import { DriveSync } from '@/components/drive/DriveSync';
import { DriveMissing } from '@/components/drive/DriveMissing';
import { VideoCard } from './VideoCard';
import { VideoUploader } from './VideoUploader';

// El paso Videos: los videos del producto, guardados en su carpeta del Drive,
// y el clip de esta publicación. Los videos se suben desde acá o se copian a
// la carpeta desde la Mac.

export function VideosStep({
  accountSlug,
  publicationId,
  timeZone,
  data,
  clipRules,
}: {
  accountSlug: string;
  publicationId: string;
  timeZone: string;
  data: VideosStepData;
  // Null si el canal no tiene clips.
  clipRules: ClipRules | null;
}) {
  const channelName = data.channel.name;
  const checks = new Map(data.videos.map((v) => [v.id, clipRules ? checkClip(v, clipRules) : null]));
  const clipVideo = data.clip ? (data.videos.find((v) => v.id === data.clip!.videoId) ?? null) : null;
  const active = data.videos.filter((v) => !v.gone);
  const usable = active.filter((v) => {
    const c = checks.get(v.id);
    return c && !c.pending && c.problems.length === 0;
  });
  const toMeasure = active.filter((v) => !v.measuredByBrowser).map((v) => v.id);

  if (!data.driveEmail) {
    return (
      <SectionCard title="Videos">
        <div className="p-4">
          <DriveMissing what="Los videos de cada producto" />
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      {clipRules ? (
        <SectionCard
          title={`Clip para ${channelName}`}
          description={`Un video vertical de ${clipRules.minSeconds} a ${clipRules.maxSeconds} segundos que se ve en la publicación y en el feed de videos. ${channelName} no deja subirlo desde la app: se sube a mano y se marca acá.`}
        >
          <div className="space-y-3 p-4">
            {data.clip && clipVideo ? (
              <ClipCard
                accountSlug={accountSlug}
                publicationId={publicationId}
                video={clipVideo}
                check={checks.get(clipVideo.id)!}
                rules={clipRules}
                channelName={channelName}
                uploadedLabel={
                  data.clip.uploadedAt
                    ? `el ${formatDateTime(data.clip.uploadedAt, timeZone)}${data.clip.uploadedBy ? `, por ${data.clip.uploadedBy}` : ''}`
                    : null
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {usable.length > 0
                  ? `Todavía no elegiste el ${clipRules.name}. Elegilo entre los videos de abajo, con Usar como ${clipRules.name}.`
                  : active.length > 0
                    ? `Ninguno de los videos del producto sirve como ${clipRules.name} todavía.`
                    : `Primero subí un video del producto.`}
              </p>
            )}
            {data.channelHasVideo !== null ? (
              <p className="text-xs text-muted-foreground">
                {data.channelHasVideo
                  ? `Según la última lectura, ${channelName} informa que la publicación tiene video.`
                  : `Según la última lectura, ${channelName} no informa video en la publicación. Puede que no informe los ${clipRules.name}s.`}
              </p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Videos del producto"
        count={active.length}
        description={withSharedNote(
          'Se guardan en la carpeta del producto en el Google Drive del estudio. Lo que copies o borres en esa carpeta desde la Mac aparece acá.',
          data.sharedWith,
        )}
      >
        <div className="space-y-4 p-4">
          <DriveSync
            accountSlug={accountSlug}
            target={{ kind: 'videos', productId: data.productId }}
            folderUrl={data.folderUrl}
            label="Abrir la carpeta en el Drive"
          />
          <VideoUploader accountSlug={accountSlug} productId={data.productId} />
          {toMeasure.length > 0 ? <AutoMeasure accountSlug={accountSlug} videoIds={toMeasure} /> : null}
          {data.videos.length > 0 ? (
            <ul className="space-y-3">
              {data.videos.map((v) => (
                <VideoCard
                  key={v.id}
                  accountSlug={accountSlug}
                  publicationId={publicationId}
                  video={v}
                  check={checks.get(v.id) ?? null}
                  clipName={clipRules?.name ?? 'clip'}
                  isClip={data.clip?.videoId === v.id}
                  timeLabel={formatRelativeDate(v.createdAt, timeZone)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">El producto todavía no tiene videos.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
