import { prisma } from '@/lib/db';
import { faceSummary, fingerprintsOf, type FaceField } from '@/domain/channel-sync';
import { parseNameValueList, type NameValue } from '@/domain/name-value';
import { getChannelListings } from '@/channels/listings';

// Lo que muestra la pantalla Sincronización: cómo va la lectura de cada
// tienda, lo que hay que elegir y lo último que llegó del canal.

const RECENT_RUNS = 12;
const RECENT_CHANGES = 40;

export type ChoiceRow = {
  id: string;
  productId: string;
  externalId: string | null;
  storeName: string;
  channelName: string;
  title: string | null;
  worked: boolean;
  fields: { field: FaceField; app: string; channel: string }[];
};

function preview(field: FaceField, value: string | null | NameValue[], other: string | null | NameValue[]): string {
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
        productId: true,
        externalId: true,
        title: true,
        description: true,
        attributes: true,
        pipelineStatus: true,
        store: { select: { name: true, channel: { select: { name: true } } } },
        channelCopy: { select: { title: true, description: true, attributes: true, fingerprints: true, agreed: true, missingSince: true } },
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
    const app = { title: p.title, description: p.description, attributes: parseNameValueList(p.attributes) };
    const channel = { title: copy.title, description: copy.description, attributes: parseNameValueList(copy.attributes) };
    const summary = faceSummary(fingerprintsOf(app), copy);
    if (summary.draft.length > 0) drafts++;
    if (summary.draft.length === 0 && summary.choose.length === 0) upToDate++;
    if (summary.choose.length === 0) continue;
    toChoose.push({
      id: p.id,
      productId: p.productId,
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
