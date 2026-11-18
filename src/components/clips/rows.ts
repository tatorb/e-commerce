import type { ClipUpload } from '@/lib/clip-uploads';
import type { ClipUploadRow } from './ClipUploadList';

/** Lo que la lista de clips necesita de cada subida pendiente. */
export function clipRows(clips: ClipUpload[]): ClipUploadRow[] {
  return clips.map((c) => ({
    publicationId: c.publicationId,
    videoId: c.videoId,
    title: c.title,
    product: c.product,
    externalId: c.externalId,
    publications: c.publications,
    allMeasures: c.allMeasures,
    measure: c.measure,
    channelLink: c.channelLink,
    fileName: c.fileName,
    mimeType: c.mimeType,
    downloadLink: c.downloadLink,
    durationMs: c.durationMs,
    size: c.size,
    queued: c.queuedAt !== null,
    error: c.error,
  }));
}
