import type { ChannelKind } from '@/generated/prisma/enums';
import { mlGet } from './mercadolibre/http';
import { parsePromotionItems, parseSellerPromotions, type SellerPromotion, type SweepItem } from './mercadolibre/promotions';

// Leer las promociones de toda la cuenta de una vez: primero la lista de
// promociones del vendedor y después las publicaciones de cada una, de a
// páginas. Así no hace falta preguntar publicación por publicación.

export type { SellerPromotion, SweepItem };

export interface ChannelPromotionSweep {
  /** Las promociones de la cuenta: las campañas a las que la invitan y en las que está. */
  promotions(accessToken: string, userId: string): Promise<SellerPromotion[]>;
  /** Una página de las publicaciones de una promoción. next: por dónde seguir; vence a los pocos minutos. */
  items(accessToken: string, promotion: SellerPromotion, cursor: string | null): Promise<{ items: SweepItem[]; next: string | null }>;
}

const mercadolibreSweep: ChannelPromotionSweep = {
  async promotions(accessToken, userId) {
    return parseSellerPromotions(await mlGet(`/seller-promotions/users/${encodeURIComponent(userId)}?app_version=v2`, accessToken));
  },
  async items(accessToken, promotion, cursor) {
    const query = new URLSearchParams({ promotion_type: promotion.type, app_version: 'v2', limit: '50' });
    if (cursor) query.set('search_after', cursor);
    return parsePromotionItems(promotion, await mlGet(`/seller-promotions/promotions/${encodeURIComponent(promotion.id)}/items?${query}`, accessToken));
  },
};

const SWEEP: Partial<Record<ChannelKind, ChannelPromotionSweep>> = { MERCADOLIBRE: mercadolibreSweep };

export function getPromotionSweep(kind: ChannelKind): ChannelPromotionSweep | null {
  return SWEEP[kind] ?? null;
}
