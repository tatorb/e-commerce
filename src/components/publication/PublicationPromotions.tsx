'use client';

import { ChannelPromotionsCard, usePromotions } from '@/components/pipeline/price/ChannelPromotionsCard';
import type { MarginContext } from '@/components/pipeline/price/CampaignList';

// En la página de la publicación: lo que el canal deja hacer hoy con su
// descuento y sus campañas. Sumarse a una campaña o salir se manda en el
// momento; el descuento propio se decide en el paso Precio.

export function PublicationPromotions({
  accountSlug,
  publicationId,
  channelName,
  channelListPrice,
  range,
  margin,
  timeZone,
}: {
  accountSlug: string;
  publicationId: string;
  channelName: string;
  channelListPrice: number | null;
  range: { min: number; max: number } | null;
  margin: MarginContext | null;
  timeZone: string;
}) {
  const promotions = usePromotions(accountSlug, [publicationId]);
  return (
    <ChannelPromotionsCard
      accountSlug={accountSlug}
      mode="now"
      state={promotions.state}
      reload={promotions.reload}
      refresh={promotions.refresh}
      channelName={channelName}
      listPrice={channelListPrice ?? 0}
      channelListPrice={channelListPrice}
      range={range}
      margin={margin}
      timeZone={timeZone}
    />
  );
}
