'use client';

import { ChannelPromotionsCard, usePromotions } from '@/components/pipeline/price/ChannelPromotionsCard';
import type { MarginContext } from '@/components/pipeline/price/CampaignList';

// Promociones abajo del precio, fuera del paso Precio: lo que el canal deja
// hacer hoy con el descuento y las campañas. En el paso Publicación sumarse o
// salir queda en Por subir (queue); en la página de la publicación se manda en
// el momento (now). El descuento propio se decide en el paso Precio.

export function PublicationPromotions({
  accountSlug,
  publicationIds,
  mode,
  channelName,
  listPrice,
  channelListPrice,
  range,
  margin,
  timeZone,
}: {
  accountSlug: string;
  // La publicación, o las que comparten su precio.
  publicationIds: string[];
  mode: 'queue' | 'now';
  channelName: string;
  // El precio publicado de la app; si no se pasa, el del canal.
  listPrice?: number | null;
  channelListPrice: number | null;
  range: { min: number; max: number } | null;
  margin: MarginContext | null;
  timeZone: string;
}) {
  const promotions = usePromotions(accountSlug, publicationIds);
  return (
    <ChannelPromotionsCard
      accountSlug={accountSlug}
      mode={mode}
      state={promotions.state}
      reload={promotions.reload}
      refresh={promotions.refresh}
      channelName={channelName}
      listPrice={listPrice ?? channelListPrice ?? 0}
      channelListPrice={channelListPrice}
      range={range}
      margin={margin}
      timeZone={timeZone}
    />
  );
}
