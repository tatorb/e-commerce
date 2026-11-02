import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { getChannelPublisher, PublishError, type ChannelPromotions } from '@/channels/publish';
import { ConnectError } from '@/channels/connect';
import { withAccessToken } from '@/lib/connections';
import { CryptoError } from '@/lib/crypto';
import { pendingCampaigns, type PendingCampaign } from '@/lib/channel-campaigns';
import { measuresOf } from '@/lib/media';

// Lo que el canal deja hacer hoy con los descuentos de unas publicaciones: el
// rango de precio con descuento que acepta, el descuento propio que tienen y
// las campañas. Se pregunta en el momento y no se guarda. Recibe la base por
// parámetro para poder probarlo.

// label: la medida, en una familia; si no, el código en el canal.
export type PromotionsRead = { publicationId: string; externalId: string; label: string; promotions: ChannelPromotions };

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
      // Con family: las demás medidas de sus familias, para ver cada campaña en todas.
      family: PromotionsRead[];
    }
  | { ok: false; error: string };

export async function readPromotions(
  db: PrismaClient,
  // light: solo el estado de cada campaña, para confirmar después de subir.
  // family: también las demás medidas de sus familias.
  args: { accountId: string; publicationIds: string[]; light?: boolean; family?: boolean },
): Promise<PromotionsResult> {
  const ids = [...new Set(args.publicationIds)];
  const select = {
    id: true,
    externalId: true,
    variantKey: true,
    familyId: true,
    product: { select: { variants: { orderBy: { position: 'asc' as const }, select: { sku: true, measure: true } } } },
    store: { select: { id: true, channel: { select: { kind: true, name: true } } } },
  };
  const pubs = await db.publication.findMany({ where: { id: { in: ids }, store: { accountId: args.accountId } }, select });
  if (ids.length === 0 || pubs.length !== ids.length) return { ok: false, error: 'La publicación no es de esta cuenta.' };
  // Las demás medidas de sus familias, en el orden de las medidas de la ficha.
  const familyIds = args.family ? [...new Set(pubs.flatMap((p) => (p.familyId ? [p.familyId] : [])))] : [];
  const others = familyIds.length
    ? (await db.publication.findMany({ where: { familyId: { in: familyIds }, id: { notIn: ids }, store: { accountId: args.accountId } }, select })).sort(
        (a, b) => measureIndex(a) - measureIndex(b),
      )
    : [];
  const { store } = pubs[0];
  const channelName = getChannelAdapter(store.channel.kind, store.channel.name).name;
  const publisher = getChannelPublisher(store.channel.kind);
  if (!publisher?.readPromotions) return { ok: false, error: `${channelName} no informa sus promociones.` };
  const byId = new Map(pubs.map((p) => [p.id, p]));
  // Las de la misma tienda, publicadas, en el orden pedido.
  const published = ids.map((id) => byId.get(id)!).filter((p) => p.externalId && p.store.id === store.id);
  const extra = others.filter((p) => p.externalId && p.store.id === store.id);
  if (published.length === 0) return { ok: true, channelName, read: [], unpublished: pubs.length, pending: [], family: [] };
  const pending = await pendingCampaigns(db, [...published, ...extra].map((p) => p.id));
  try {
    const [read, family] = await withAccessToken(db, store.id, async (token) => {
      const ask = async (list: typeof published) => {
        const out: PromotionsRead[] = [];
        for (const p of list) {
          out.push({ publicationId: p.id, externalId: p.externalId!, label: labelOf(p), promotions: await publisher.readPromotions!(token, p.externalId!, { details: !args.light }) });
        }
        return out;
      };
      return [await ask(published), await ask(extra)] as const;
    });
    return { ok: true, channelName, read, unpublished: pubs.length - published.length, pending, family };
  } catch (e) {
    if (e instanceof PublishError || e instanceof ConnectError || e instanceof CryptoError) return { ok: false, error: e.message };
    // Solo se lee: un error inesperado no corta la pantalla ni lo que pidió Claude.
    console.error('No se pudieron leer las promociones del canal.', e);
    return { ok: false, error: `No se pudo consultar a ${channelName}. Probá de nuevo.` };
  }
}

type LabelRow = { externalId: string | null; variantKey: string | null; familyId: string | null; product: { variants: { sku: string | null; measure: string | null }[] } };

/** La medida que vende, en una familia; si no, el código en el canal. */
function labelOf(p: LabelRow): string {
  const measure = p.familyId && p.variantKey ? measuresOf(p.product.variants).find((m) => m.key === p.variantKey)?.label : null;
  return measure ?? p.externalId ?? 'Sin código';
}

function measureIndex(p: LabelRow): number {
  const i = p.variantKey ? measuresOf(p.product.variants).findIndex((m) => m.key === p.variantKey) : -1;
  return i < 0 ? 999 : i;
}
