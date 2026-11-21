import type { PrismaClient } from '@/generated/prisma/client';

// Las campañas que se pierden al subir el precio: en una co-fondeada o en un
// descuento por cantidad, si a la publicación se le sube el precio el canal
// la saca de la campaña y no la deja volver a entrar. Antes de subir un precio
// más alto conviene saberlo. Solo lee, de la copia de las invitaciones.

// Los tipos de campaña del canal que no aguantan una suba de precio.
const LOST_ON_RISE = ['MARKETPLACE_CAMPAIGN', 'VOLUME', 'SMART', 'PRICE_MATCHING', 'PRICE_MATCHING_MELI_ALL'];

export type PriceRisk = { publicationId: string; externalId: string | null; campaigns: string[]; rising: boolean };

/**
 * Las publicaciones del producto de esa publicación que están adentro o
 * anotadas en una campaña que se pierde al subir el precio. rising: el precio
 * guardado en la app ya es más alto que el del canal, y está por subir.
 */
export async function priceRiseRisks(db: PrismaClient, accountId: string, publicationId: string): Promise<PriceRisk[]> {
  const pub = await db.publication.findFirst({ where: { id: publicationId, product: { accountId } }, select: { productId: true } });
  if (!pub) return [];
  const rows = await db.channelPromotionItem.findMany({
    where: { type: { in: LOST_ON_RISE }, status: { in: ['active', 'scheduled'] }, publication: { productId: pub.productId } },
    select: { name: true, kind: true, publication: { select: { id: true, externalId: true, price: true, channelCopy: { select: { price: true } } } } },
  });
  const out = new Map<string, PriceRisk>();
  for (const r of rows) {
    const p = r.publication;
    const mine = p.price === null ? null : Number(p.price);
    const theirs = p.channelCopy?.price == null ? null : Number(p.channelCopy.price);
    const risk = out.get(p.id) ?? { publicationId: p.id, externalId: p.externalId, campaigns: [], rising: mine !== null && theirs !== null && mine > theirs };
    const name = r.name ?? r.kind;
    if (!risk.campaigns.includes(name)) risk.campaigns.push(name);
    out.set(p.id, risk);
  }
  return [...out.values()];
}

/** El aviso en una frase, o null si no hay nada que avisar. onlyRising: solo si ya hay un precio más alto por subir. */
export function priceRiskText(risks: PriceRisk[], channelName: string, onlyRising = false): string | null {
  const list = onlyRising ? risks.filter((r) => r.rising) : risks;
  if (list.length === 0) return null;
  const names = [...new Set(list.flatMap((r) => r.campaigns))];
  const codes = list.map((r) => r.externalId).filter(Boolean);
  return `${list.length === 1 ? 'Una publicación está' : `${list.length} publicaciones están`} en ${names.join(', ')}${codes.length <= 6 ? ` (${codes.join(', ')})` : ''}. Si se les sube el precio, ${channelName} las saca de la campaña y no las deja volver a entrar. Bajar el precio no las saca.`;
}
