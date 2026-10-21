import { prisma } from '@/lib/db';
import { getChannelAdapter } from '@/channels';
import { getChannelPublisher, PUBLISH_FIELDS } from '@/channels/publish';
import { loadCatalogData } from '@/lib/catalog-data';
import {
  attributeDiff,
  channelFaceValues,
  FACE_FIELDS,
  faceSummary,
  faceValues,
  fieldState,
  fingerprintsOf,
  parseFingerprints,
  type FaceField,
  type FieldState,
} from '@/domain/channel-sync';
import { LATEST_MEASUREMENTS, latestMetrics } from '@/domain/measurements';
import { resolveTitleLock } from '@/domain/title-lock';

// La página de una publicación: sus dos caras, lo que está en el canal y el
// borrador de la app, dato por dato, con lo que se puede hacer con cada uno.

const HISTORY = 30;

export async function loadPublicationFaces(accountId: string, publicationId: string) {
  const p = await prisma.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    select: {
      id: true,
      title: true,
      description: true,
      attributes: true,
      media: true,
      externalId: true,
      url: true,
      price: true,
      channelStatus: true,
      pipelineStatus: true,
      pipelineStep: true,
      pipelineRemoval: true,
      titleLockedManual: true,
      product: { select: { id: true, name: true, kind: true } },
      store: { select: { name: true, channel: { select: { kind: true, name: true } }, connection: { select: { status: true } } } },
      measurements: { orderBy: { takenAt: 'desc' }, take: LATEST_MEASUREMENTS, select: { metrics: true } },
      channelCopy: true,
      syncChanges: { orderBy: { createdAt: 'desc' }, take: HISTORY, include: { user: { select: { name: true } } } },
    },
  });
  if (!p) return null;

  const adapter = getChannelAdapter(p.store.channel.kind, p.store.channel.name);
  const metrics = latestMetrics(p.measurements);
  const copy = p.channelCopy && !p.channelCopy.missingSince ? p.channelCopy : null;
  const app = faceValues(p);
  const channel = copy ? channelFaceValues(copy) : null;
  const appPrints = fingerprintsOf(app);
  const summary = faceSummary(appPrints, copy);
  const channelPrints = parseFingerprints(copy?.fingerprints);
  const agreed = parseFingerprints(copy?.agreed);
  const states = Object.fromEntries(
    FACE_FIELDS.map((f) => [f, copy ? fieldState(appPrints[f], channelPrints[f] ?? '', agreed[f]) : 'unread']),
  ) as Record<FaceField, FieldState | 'unread'>;

  const connected = p.store.connection?.status === 'ACTIVE';
  // El formulario de datos de catálogo, para editarlos sin pasar por el pipeline.
  const catalog = await loadCatalogData(prisma, p.id);
  const channelCategoryId = copy?.categoryId ?? null;
  const details = (copy?.details ?? {}) as { categoryName?: unknown };
  const channelCategory = channelCategoryId
    ? (adapter.catalog?.category(channelCategoryId)?.name ?? (typeof details.categoryName === 'string' ? details.categoryName : channelCategoryId))
    : null;
  return {
    publication: p,
    channelName: adapter.name,
    app,
    channel,
    copy: p.channelCopy,
    missing: Boolean(p.channelCopy?.missingSince),
    states,
    summary,
    metrics,
    titleLock: resolveTitleLock(adapter.titleLock(metrics), p.titleLockedManual, Boolean(p.externalId)),
    // Lo que se puede subir desde la app y por qué no, si no se puede.
    canRead: connected && Boolean(p.externalId),
    pushBlocked: !p.externalId
      ? `Todavía no está publicada en ${adapter.name}.`
      : !getChannelPublisher(p.store.channel.kind)
        ? `Todavía no se pueden subir cambios a ${adapter.name}.`
        : !connected
          ? `La tienda no está conectada con ${adapter.name}.`
          : !copy
            ? `Primero hay que leerla de ${adapter.name}.`
            : null,
    publishable: PUBLISH_FIELDS as FaceField[],
    catalog,
    // Qué datos de catálogo cambian al subir.
    attributeDiff: channel ? attributeDiff(app.attributes, channel.attributes) : null,
    // Si la categoría de la app no es la del canal: los datos se suben a los campos de la del canal.
    categoryMismatch:
      catalog?.category && channelCategoryId && catalog.category.id !== channelCategoryId
        ? { app: catalog.category.name, channel: channelCategory! }
        : null,
  };
}

export type PublicationFaces = NonNullable<Awaited<ReturnType<typeof loadPublicationFaces>>>;
