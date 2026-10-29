import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { getChannelPublisher, PublishError, type ChannelPublisher } from '@/channels/publish';
import { ConnectError } from '@/channels/connect';
import { formatPrice } from '@/domain/money';
import { withAccessToken } from '@/lib/connections';

// Sumarse a una campaña del canal o salir. Desde el Pipeline queda pedido y
// se manda con los demás cambios desde Por subir; desde la página de la
// publicación se manda en el momento. En los dos casos queda en el Registro
// de la publicación. Recibe la base por parámetro para poder probarlo.

export type CampaignAction = 'join' | 'leave';

/** Lo que se pide: la campaña por su ref del canal, cómo se llama y, al sumarse eligiendo el precio, el precio. */
export type CampaignChoice = {
  action: CampaignAction;
  ref: string;
  name: string;
  kind: string;
  price: number | null;
};

export type CampaignOutcome = { name: string; action: CampaignAction; ok: boolean; message?: string };

export type PendingCampaign = CampaignChoice & { id: string; publicationId: string; rejection: string | null; requestedBy: string | null; createdAt: Date };

export class CampaignError extends Error {}

const ACTION = { join: 'JOIN', leave: 'LEAVE' } as const;
const fromAction = (a: 'JOIN' | 'LEAVE'): CampaignAction => (a === 'JOIN' ? 'join' : 'leave');

/** Cómo queda en el Registro: qué se hizo con qué campaña. */
export function campaignText(c: Pick<CampaignChoice, 'action' | 'name' | 'kind' | 'price'>): string {
  const what = c.name === c.kind ? c.name : `${c.name} (${c.kind})`;
  if (c.action === 'leave') return `Salir de ${what}`;
  return `Sumarse a ${what}${c.price !== null ? `, el comprador paga ${formatPrice(c.price)}` : ''}`;
}

function cleanChoice(c: CampaignChoice): CampaignChoice {
  const ref = typeof c.ref === 'string' ? c.ref.trim() : '';
  if (!ref || ref.length > 500) throw new CampaignError('No se reconoce la campaña: volvé a consultar las promociones.');
  if (c.action !== 'join' && c.action !== 'leave') throw new CampaignError('Elegí si sumarse o salir.');
  const price = c.action === 'join' && c.price !== null && c.price !== undefined ? Math.round(Number(c.price)) : null;
  if (price !== null && !(price > 0)) throw new CampaignError('El precio para el comprador tiene que ser mayor que cero.');
  const text = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : fallback);
  return { action: c.action, ref, name: text(c.name, 'Campaña'), kind: text(c.kind, 'Campaña'), price };
}

async function loadPublication(db: PrismaClient, accountId: string, publicationId: string) {
  const p = await db.publication.findFirst({
    where: { id: publicationId, store: { accountId } },
    select: { id: true, externalId: true, store: { select: { id: true, channel: { select: { kind: true, name: true } }, connection: { select: { status: true } } } } },
  });
  if (!p) throw new CampaignError('La publicación no es de esta cuenta.');
  const channelName = getChannelAdapter(p.store.channel.kind, p.store.channel.name).name;
  if (!p.externalId) throw new CampaignError(`Todavía no está publicada en ${channelName}.`);
  return { ...p, externalId: p.externalId, channelName, publisher: getChannelPublisher(p.store.channel.kind) };
}

/** Lo pendiente de unas publicaciones, lo más viejo primero. */
export async function pendingCampaigns(db: PrismaClient, publicationIds: string[]): Promise<PendingCampaign[]> {
  if (publicationIds.length === 0) return [];
  const rows = await db.campaignRequest.findMany({
    where: { publicationId: { in: publicationIds } },
    orderBy: { createdAt: 'asc' },
    include: { requestedBy: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    publicationId: r.publicationId,
    action: fromAction(r.action),
    ref: r.ref,
    name: r.name,
    kind: r.kind,
    price: r.price === null ? null : Number(r.price),
    rejection: r.rejection,
    requestedBy: r.requestedBy?.name ?? null,
    createdAt: r.createdAt,
  }));
}

/** Deja pedido sumarse o salir, para Por subir. Lo que ya había pedido para esa campaña se reemplaza. */
export async function queueCampaign(db: PrismaClient, args: { accountId: string; publicationId: string; choice: CampaignChoice; userId: string | null }): Promise<PendingCampaign> {
  const choice = cleanChoice(args.choice);
  const p = await loadPublication(db, args.accountId, args.publicationId);
  const data = {
    action: ACTION[choice.action],
    name: choice.name,
    kind: choice.kind,
    price: choice.price,
    rejection: null,
    requestedById: args.userId,
    createdAt: new Date(),
  };
  await db.campaignRequest.upsert({
    where: { publicationId_ref: { publicationId: p.id, ref: choice.ref } },
    create: { publicationId: p.id, ref: choice.ref, ...data },
    update: data,
  });
  return (await pendingCampaigns(db, [p.id])).find((r) => r.ref === choice.ref)!;
}

/** Saca un pedido de Por subir sin mandarlo. */
export async function cancelCampaign(db: PrismaClient, args: { accountId: string; requestId: string }): Promise<void> {
  const r = await db.campaignRequest.deleteMany({ where: { id: args.requestId, publication: { store: { accountId: args.accountId } } } });
  if (r.count === 0) throw new CampaignError('Ese pedido ya no está en Por subir.');
}

/** Lo manda al canal y lo anota en el Registro. Lanza PublishError o ConnectError si no se pudo. */
async function send(db: PrismaClient, p: Awaited<ReturnType<typeof loadPublication>>, publisher: ChannelPublisher, choice: CampaignChoice, userId: string | null) {
  const record = (kind: 'SENT' | 'REJECTED', message: string | null) =>
    db.channelSyncChange.create({ data: { publicationId: p.id, field: 'campaign', kind, before: undefined, after: campaignText(choice), message, userId } });
  try {
    await withAccessToken(db, p.store.id, (token) =>
      choice.action === 'join' ? publisher.joinCampaign!(token, p.externalId, choice.ref, choice.price) : publisher.leaveCampaign!(token, p.externalId, choice.ref),
    );
  } catch (e) {
    if (e instanceof PublishError || e instanceof ConnectError) await record('REJECTED', e.message);
    throw e;
  }
  await record('SENT', null);
}

function checkPublisher(p: Awaited<ReturnType<typeof loadPublication>>): ChannelPublisher {
  const publisher = p.publisher;
  if (!publisher?.joinCampaign || !publisher.leaveCampaign) throw new CampaignError(`Todavía no se puede manejar las campañas de ${p.channelName} desde la app.`);
  if (p.store.connection?.status !== 'ACTIVE') throw new CampaignError(`La tienda no está conectada con ${p.channelName}: conectala en Conexión.`);
  return publisher;
}

/** Desde la página de la publicación: se manda en el momento. Lo pendiente para esa campaña deja de estarlo. */
export async function sendCampaignNow(
  db: PrismaClient,
  args: { accountId: string; publicationId: string; choice: CampaignChoice; userId: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const choice = cleanChoice(args.choice);
  const p = await loadPublication(db, args.accountId, args.publicationId);
  const publisher = checkPublisher(p);
  try {
    await send(db, p, publisher, choice, args.userId);
  } catch (e) {
    if (e instanceof PublishError || e instanceof ConnectError) return { ok: false, error: e.message };
    throw e;
  }
  await db.campaignRequest.deleteMany({ where: { publicationId: p.id, ref: choice.ref } });
  return { ok: true };
}

/**
 * Desde Por subir: manda lo pedido de la publicación, en el orden en que se
 * pidió. Lo que sale bien deja de estar pendiente; lo que el canal no acepta
 * queda con su motivo. Una conexión cortada corta el resto.
 */
export async function sendPendingCampaigns(db: PrismaClient, args: { accountId: string; publicationId: string; userId: string | null }): Promise<CampaignOutcome[]> {
  const pending = await pendingCampaigns(db, [args.publicationId]);
  if (pending.length === 0) return [];
  const p = await loadPublication(db, args.accountId, args.publicationId);
  const publisher = checkPublisher(p);
  const out: CampaignOutcome[] = [];
  for (const r of pending) {
    try {
      await send(db, p, publisher, r, args.userId);
    } catch (e) {
      if (!(e instanceof PublishError)) throw e;
      await db.campaignRequest.update({ where: { id: r.id }, data: { rejection: e.message } });
      out.push({ name: r.name, action: r.action, ok: false, message: e.message });
      continue;
    }
    await db.campaignRequest.delete({ where: { id: r.id } });
    out.push({ name: r.name, action: r.action, ok: true });
  }
  return out;
}
