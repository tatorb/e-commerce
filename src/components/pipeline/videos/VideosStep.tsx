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
// y los clips de esta publicación, en orden. Los videos se suben desde acá o se copian a
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
  // Los clips elegidos, en orden, con su video.
  const clips = data.clips.flatMap((c) => {
    const video = data.videos.find((v) => v.id === c.videoId);
    return video ? [{ ...c, video }] : [];
  });
  const clipIds = new Set(clips.map((c) => c.videoId));
  const missing = clips.filter((c) => !c.uploadedAt).length;
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
          title={`${clipRules.name[0].toUpperCase()}${clipRules.name.slice(1)}s para ${channelName}`}
          count={clips.length}
          description={`Videos verticales de ${clipRules.minSeconds} a ${clipRules.maxSeconds} segundos que se ven en la publicación y en el feed de videos. Podés elegir varios: el primero es el que ${channelName} muestra antes. ${channelName} no deja subirlos desde la app: se suben a mano y se marca cada uno.`}
        >
          <div className="space-y-3 p-4">
            {clips.length > 0 ? (
              <>
                <ol className="space-y-3">
                  {clips.map((c, i) => (
                    <ClipCard
                      key={c.videoId}
                      accountSlug={accountSlug}
                      publicationId={publicationId}
                      video={c.video}
                      check={checks.get(c.videoId)!}
                      rules={clipRules}
                      channelName={channelName}
                      uploadedLabel={c.uploadedAt ? `el ${formatDateTime(c.uploadedAt, timeZone)}${c.uploadedBy ? `, por ${c.uploadedBy}` : ''}` : null}
                      index={i}
                      count={clips.length}
                    />
                  ))}
                </ol>
                {missing > 0 ? (
                  <div className="space-y-2 rounded-md border px-3 py-3 text-sm">
                    <p className="font-medium">
                      {missing === 1 ? `Falta subir 1 ${clipRules.name}` : `Faltan subir ${missing} ${clipRules.name}s`} a {channelName}
                    </p>
                    <ol className="list-decimal space-y-1 pl-5">
                      {clipRules.guide.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {usable.length > 0
                  ? `Todavía no elegiste ningún ${clipRules.name}. Elegilos entre los videos de abajo, con Usar como ${clipRules.name}.`
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
                  isClip={clipIds.has(v.id)}
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
