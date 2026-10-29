import type { PrismaClient } from '@/generated/prisma/client';
import { campaignText } from '@/lib/channel-campaigns';
import { prisma } from '@/lib/db';
import { photoVariants } from '@/domain/media';
import { channelFaceValues, faceSummary, faceValues, fingerprintsOf, priceFaceText, type FaceField, type FaceValues } from '@/domain/channel-sync';
import { quantityText, type QuantityLine } from '@/domain/quantities';
import type { NameValue } from '@/domain/name-value';
import { getChannelListings } from '@/channels/listings';
import { getChannelPublisher } from '@/channels/publish';
import type { PipelineRemoval, PipelineStatus, PipelineStep } from '@/generated/prisma/enums';

// Lo que muestra la pantalla Sincronización: cómo va la lectura de cada
// tienda, lo que hay que elegir y lo último que llegó del canal.

const RECENT_RUNS = 12;
const RECENT_CHANGES = 40;

export type ChoiceRow = {
  id: string;
  externalId: string | null;
  storeName: string;
  channelName: string;
  title: string | null;
  worked: boolean;
  fields: { field: FaceField; app: string; channel: string }[];
};

function preview(field: FaceField, value: FaceValues[FaceField], other: FaceValues[FaceField]): string {
  if (field === 'photos') {
    const refs = (value as FaceValues['photos']) ?? [];
    const marked = refs.filter((r) => photoVariants(r).length > 0).length;
    const text = refs.length === 1 ? '1 foto' : `${refs.length} fotos`;
    return marked > 0 ? `${text}, ${marked} con medida propia` : text;
  }
  if (field === 'price' || field === 'installments' || field === 'discount') return priceFaceText(field, value as string | null);
  if (field === 'quantity') return quantityText(value as QuantityLine[] | null);
  if (field !== 'attributes') return ((value as string | null) ?? '').trim();
  // De los datos de catálogo, solo los que no coinciden.
  const theirs = new Map((other as NameValue[]).map((a) => [a.name.trim().toLowerCase(), a.value.trim()]));
  return (value as NameValue[])
    .filter((a) => theirs.get(a.name.trim().toLowerCase()) !== a.value.trim())
    .map((a) => `${a.name}: ${a.value}`)
    .join('\n');
}

export async function loadSyncOverview(accountId: string) {
  const [stores, runs, publications, changes] = await Promise.all([
    // Las que tienen conexión, aunque haya que volver a conectarlas.
    prisma.store.findMany({
      where: { accountId, connection: { isNot: null } },
      select: { id: true, name: true, channel: { select: { kind: true, name: true } }, connection: { select: { status: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.channelSync.findMany({
      where: { store: { accountId } },
      orderBy: { startedAt: 'desc' },
      take: RECENT_RUNS,
      include: { user: { select: { name: true } }, store: { select: { name: true } } },
    }),
    prisma.publication.findMany({
      where: { product: { accountId }, channelCopy: { isNot: null } },
      select: {
        id: true,
        externalId: true,
        title: true,
        description: true,
        attributes: true,
        media: true,
        price: true,
        installments: true,
        discount: true,
        quantities: true,
        pipelineStatus: true,
        store: { select: { name: true, channel: { select: { name: true } } } },
        channelCopy: {
          select: { title: true, description: true, attributes: true, photos: true, photoIds: true, variations: true, price: true, installments: true, discount: true, quantity: true, fingerprints: true, agreed: true, missingSince: true },
        },
      },
      orderBy: { externalId: 'asc' },
    }),
    prisma.channelSyncChange.findMany({
      where: { publication: { product: { accountId } } },
      orderBy: { createdAt: 'desc' },
      take: RECENT_CHANGES,
      include: { publication: { select: { id: true, title: true, externalId: true } }, user: { select: { name: true } } },
    }),
  ]);

  const toChoose: ChoiceRow[] = [];
  let drafts = 0;
  let upToDate = 0;
  for (const p of publications) {
    const copy = p.channelCopy!;
    if (copy.missingSince) continue;
    const app = faceValues(p);
    const channel = channelFaceValues(copy);
    const summary = faceSummary(fingerprintsOf(app), copy);
    if (summary.draft.length > 0) drafts++;
    if (summary.draft.length === 0 && summary.choose.length === 0) upToDate++;
    if (summary.choose.length === 0) continue;
    toChoose.push({
      id: p.id,
      externalId: p.externalId,
      storeName: p.store.name,
      channelName: p.store.channel.name,
      title: p.title,
      worked: p.pipelineStatus !== 'UNTOUCHED',
      fields: summary.choose.map((field) => ({
        field,
        app: preview(field, app[field], channel[field]),
        channel: preview(field, channel[field], app[field]),
      })),
    });
  }

  return {
    stores: stores
      .filter((s) => getChannelListings(s.channel.kind) !== null)
      .map((s) => {
        const storeRuns = runs.filter((r) => r.storeId === s.id);
        return {
          id: s.id,
          name: s.name,
          channelName: s.channel.name,
          connected: s.connection?.status === 'ACTIVE',
          running: storeRuns.find((r) => r.status === 'RUNNING') ?? null,
          last: storeRuns.find((r) => r.status !== 'RUNNING') ?? null,
        };
      }),
    runs,
    toChoose,
    drafts,
    upToDate,
    copies: publications.length,
    changes,
  };
}

export type SyncOverview = Awaited<ReturnType<typeof loadSyncOverview>>;

export type ToPushRow = {
  id: string;
  externalId: string | null;
  title: string | null;
  storeName: string;
  channelName: string;
  draft: FaceField[];
  choose: FaceField[];
  rejected: { field: FaceField; message: string }[];
  // Sumarse a una campaña o salir, pedido desde el Pipeline, y por qué no se pudo la última vez.
  campaigns: { text: string; rejection: string | null }[];
  // Por qué no se puede subir desde la app, si no se puede.
  blocked: string | null;
  pipeline: { pipelineStatus: PipelineStatus; pipelineStep: PipelineStep | null; pipelineRemoval: PipelineRemoval | null };
};

/** Las publicaciones con cambios de la app sin subir al canal, o con datos para elegir. */
export async function listToPush(accountId: string, db: PrismaClient = prisma): Promise<ToPushRow[]> {
  const publications = await db.publication.findMany({
    where: { product: { accountId }, channelCopy: { is: { missingSince: null } } },
    select: {
      id: true,
      externalId: true,
      title: true,
      description: true,
      attributes: true,
      media: true,
      price: true,
      installments: true,
      discount: true,
      quantities: true,
      pipelineStatus: true,
      pipelineStep: true,
      pipelineRemoval: true,
      store: { select: { name: true, channel: { select: { kind: true, name: true } }, connection: { select: { status: true } } } },
      channelCopy: { select: { fingerprints: true, agreed: true, rejections: true, price: true, installments: true, discount: true } },
      campaignRequests: { orderBy: { createdAt: 'asc' }, select: { action: true, name: true, kind: true, price: true, rejection: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  const rows: ToPushRow[] = [];
  for (const p of publications) {
    const summary = faceSummary(fingerprintsOf(faceValues(p)), p.channelCopy);
    if (summary.draft.length === 0 && summary.choose.length === 0 && p.campaignRequests.length === 0) continue;
    const channelName = p.store.channel.name;
    rows.push({
      id: p.id,
      externalId: p.externalId,
      title: p.title,
      storeName: p.store.name,
      channelName,
      draft: summary.draft,
      choose: summary.choose,
      rejected: summary.rejected.map(({ field, message }) => ({ field, message })),
      campaigns: p.campaignRequests.map((c) => ({
        text: campaignText({ action: c.action === 'JOIN' ? 'join' : 'leave', name: c.name, kind: c.kind, price: c.price === null ? null : Number(c.price) }),
        rejection: c.rejection,
      })),
      blocked: !getChannelPublisher(p.store.channel.kind)
        ? `Todavía no se pueden subir cambios a ${channelName}.`
        : p.store.connection?.status !== 'ACTIVE'
          ? `La tienda no está conectada con ${channelName}.`
          : null,
      pipeline: { pipelineStatus: p.pipelineStatus, pipelineStep: p.pipelineStep, pipelineRemoval: p.pipelineRemoval },
    });
  }
  return rows;
}
