import type { PrismaClient } from '@/generated/prisma/client';
import { ConnectError } from '@/channels/connect';
import { getChannelVolume, VolumeError, type ChannelVolume, type VolumeCampaign, type VolumeCampaignInput, type VolumeItems } from '@/channels/volume';
import { withAccessToken } from '@/lib/connections';

// Campañas de descuento por cantidad desde la app: crearlas, verlas, sumarles
// y sacarles publicaciones, y borrarlas. Todo lo decide una persona. Lo que se
// suma o se saca queda en el registro de cada publicación. Recibe la base por
// parámetro para poder probarlo.

type Db = PrismaClient;

export { VolumeError };

/** La tienda conectada de la cuenta en un canal con campañas por cantidad. */
async function storeOf(db: Db, accountId: string): Promise<{ id: string; name: string; channelName: string; volume: ChannelVolume }> {
  const stores = await db.store.findMany({
    where: { accountId, connection: { status: 'ACTIVE' } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, channel: { select: { kind: true, name: true } } },
  });
  for (const s of stores) {
    const volume = getChannelVolume(s.channel.kind);
    if (volume) return { id: s.id, name: s.name, channelName: s.channel.name, volume };
  }
  throw new VolumeError('La cuenta no tiene una tienda conectada a un canal con campañas por cantidad.');
}

export async function listVolumeCampaigns(db: Db, accountId: string): Promise<VolumeCampaign[]> {
  const s = await storeOf(db, accountId);
  return withAccessToken(db, s.id, (token, userId) => s.volume.list(token, userId));
}

export async function createVolumeCampaign(db: Db, accountId: string, input: VolumeCampaignInput): Promise<VolumeCampaign> {
  const s = await storeOf(db, accountId);
  return withAccessToken(db, s.id, (token) => s.volume.create(token, input));
}

/** La campaña con sus publicaciones candidatas y participantes. */
export async function getVolumeCampaign(
  db: Db,
  accountId: string,
  campaignId: string,
  opts: { externalId?: string; limit?: number } = {},
): Promise<{ campaign: VolumeCampaign; items: VolumeItems }> {
  const s = await storeOf(db, accountId);
  return withAccessToken(db, s.id, async (token) => ({
    campaign: await s.volume.get(token, campaignId),
    items: await s.volume.items(token, campaignId, opts),
  }));
}

export async function deleteVolumeCampaign(db: Db, accountId: string, campaignId: string): Promise<void> {
  const s = await storeOf(db, accountId);
  await withAccessToken(db, s.id, (token) => s.volume.remove(token, campaignId));
}

export type VolumeChange = {
  done: { id: string; externalId: string; title: string | null; offerId?: string | null; price?: number | null; originalPrice?: number | null; raw?: unknown }[];
  failed: { id: string; externalId: string | null; title: string | null; message: string }[];
};

/**
 * Suma o saca esas publicaciones de la campaña, de a una. Lo que no se pudo
 * vuelve con el motivo, y todo queda en el registro de la publicación.
 */
export async function changeVolumeItems(
  db: Db,
  args: { accountId: string; campaignId: string; publicationIds: string[]; join: boolean; userId: string | null },
): Promise<VolumeChange> {
  const s = await storeOf(db, args.accountId);
  const pubs = await db.publication.findMany({
    where: { id: { in: [...new Set(args.publicationIds)] }, storeId: s.id, product: { accountId: args.accountId } },
    select: { id: true, externalId: true, title: true },
  });
  const out: VolumeChange = { done: [], failed: [] };
  const found = new Set(pubs.map((p) => p.id));
  for (const id of args.publicationIds) {
    if (!found.has(id)) out.failed.push({ id, externalId: null, title: null, message: 'La publicación no está en la tienda de la cuenta.' });
  }
  const what = `Campaña por cantidad ${args.campaignId}`;
  for (const p of pubs) {
    if (!p.externalId) {
      out.failed.push({ id: p.id, externalId: null, title: p.title, message: `Todavía no está publicada en ${s.channelName}.` });
      continue;
    }
    const externalId = p.externalId;
    try {
      if (args.join) {
        const r = await withAccessToken(db, s.id, (token) => s.volume.join(token, args.campaignId, externalId));
        out.done.push({ id: p.id, externalId, title: p.title, ...r });
      } else {
        await withAccessToken(db, s.id, (token) => s.volume.leave(token, args.campaignId, externalId));
        out.done.push({ id: p.id, externalId, title: p.title });
      }
      await db.channelSyncChange.create({
        data: { publicationId: p.id, field: 'campaign', kind: 'SENT', after: args.join ? `${what}: se sumó` : `${what}: salió`, userId: args.userId },
      });
    } catch (e) {
      if (!(e instanceof VolumeError) && !(e instanceof ConnectError)) throw e;
      out.failed.push({ id: p.id, externalId, title: p.title, message: e.message });
      await db.channelSyncChange.create({
        data: { publicationId: p.id, field: 'campaign', kind: 'REJECTED', after: args.join ? `${what}: sumarse` : `${what}: salir`, message: e.message, userId: args.userId },
      });
    }
  }
  return out;
}

/** Todo lo que el canal informa de las promociones de una publicación, sin interpretar. */
export async function rawPromotions(db: Db, accountId: string, publicationId: string): Promise<{ externalId: string; promotions: unknown }> {
  const s = await storeOf(db, accountId);
  const p = await db.publication.findFirst({ where: { id: publicationId, storeId: s.id, product: { accountId } }, select: { externalId: true } });
  if (!p?.externalId) throw new VolumeError('La publicación no está publicada en la tienda de la cuenta.');
  const externalId = p.externalId;
  return { externalId, promotions: await withAccessToken(db, s.id, (token) => s.volume.promotionsOf(token, externalId)) };
}
