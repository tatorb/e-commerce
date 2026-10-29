import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { getChannelPublisher, PublishError, type ChannelPromotions } from '@/channels/publish';
import { ConnectError } from '@/channels/connect';
import { withAccessToken } from '@/lib/connections';
import { CryptoError } from '@/lib/crypto';
import { pendingCampaigns, type PendingCampaign } from '@/lib/channel-campaigns';

// Lo que el canal deja hacer hoy con los descuentos de unas publicaciones: el
// rango de precio con descuento que acepta, el descuento propio que tienen y
// las campañas. Se pregunta en el momento y no se guarda. Recibe la base por
// parámetro para poder probarlo.

export type PromotionsRead = { publicationId: string; externalId: string; promotions: ChannelPromotions };

export type PromotionsResult =
  | {
      ok: true;
      channelName: string;
      // Las publicadas, en el orden en que se pidieron.
      read: PromotionsRead[];
      // Cuántas todavía no están en el canal.
      unpublished: number;
      // Sumarse o salir de una campaña, pedido desde el Pipeline y todavía en Por subir.
      pending: PendingCampaign[];
    }
  | { ok: false; error: string };

export async function readPromotions(db: PrismaClient, args: { accountId: string; publicationIds: string[] }): Promise<PromotionsResult> {
  const ids = [...new Set(args.publicationIds)];
  const pubs = await db.publication.findMany({
    where: { id: { in: ids }, store: { accountId: args.accountId } },
    select: { id: true, externalId: true, store: { select: { id: true, channel: { select: { kind: true, name: true } } } } },
  });
  if (ids.length === 0 || pubs.length !== ids.length) return { ok: false, error: 'La publicación no es de esta cuenta.' };
  const { store } = pubs[0];
  const channelName = getChannelAdapter(store.channel.kind, store.channel.name).name;
  const publisher = getChannelPublisher(store.channel.kind);
  if (!publisher?.readPromotions) return { ok: false, error: `${channelName} no informa sus promociones.` };
  const byId = new Map(pubs.map((p) => [p.id, p]));
  // Las de la misma tienda, publicadas, en el orden pedido.
  const published = ids.map((id) => byId.get(id)!).filter((p) => p.externalId && p.store.id === store.id);
  if (published.length === 0) return { ok: true, channelName, read: [], unpublished: pubs.length, pending: [] };
  const pending = await pendingCampaigns(db, published.map((p) => p.id));
  try {
    const read = await withAccessToken(db, store.id, async (token) => {
      const out: PromotionsRead[] = [];
      for (const p of published) out.push({ publicationId: p.id, externalId: p.externalId!, promotions: await publisher.readPromotions!(token, p.externalId!) });
      return out;
    });
    return { ok: true, channelName, read, unpublished: pubs.length - published.length, pending };
  } catch (e) {
    if (e instanceof PublishError || e instanceof ConnectError || e instanceof CryptoError) return { ok: false, error: e.message };
    // Solo se lee: un error inesperado no corta la pantalla ni lo que pidió Claude.
    console.error('No se pudieron leer las promociones del canal.', e);
    return { ok: false, error: `No se pudo consultar a ${channelName}. Probá de nuevo.` };
  }
}
