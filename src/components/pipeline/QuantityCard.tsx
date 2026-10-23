import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { QuantityEditor } from '@/components/publication/QuantityEditor';
import type { PriceSides } from '@/components/pipeline/price/PriceDecisionCard';
import { quantityText } from '@/domain/quantities';

// En el paso Publicación: la cantidad disponible. Se cambia acá y queda en Por
// subir, igual que el precio.

export function QuantityCard({
  accountSlug,
  publicationId,
  channelName,
  published,
  sides,
  stockInChannel,
}: {
  accountSlug: string;
  publicationId: string;
  channelName: string;
  published: boolean;
  // Las dos caras de la publicación; null si no se pudieron leer.
  sides: PriceSides | null;
  stockInChannel: boolean;
}) {
  const channel = sides?.channel?.quantity ?? null;
  const lines = sides?.app.quantity ?? channel;
  const state = sides?.states.quantity ?? 'unread';
  const rejected = sides?.rejected.find((r) => r.field === 'quantity')?.message ?? null;

  let note: string;
  if (!published) note = `Se carga al crear la publicación en ${channelName}.`;
  else if (stockInChannel) note = `El stock lo maneja ${channelName}, por ejemplo porque está en Full: no se cambia desde la app.`;
  else if (!lines) note = `Todavía no se leyó la cantidad de ${channelName}.`;
  else if (rejected) note = `No se pudo subir: ${rejected}`;
  else if (state === 'draft') note = `Se sube a ${channelName} desde Por subir, abajo.`;
  else if (state === 'choose') note = `Cambió también en ${channelName}: elegí cuál queda en Por subir, abajo.`;
  else note = `Ya está en ${channelName}. Cada venta la baja allá y la app la lee sola cada hora.`;

  return (
    <SectionCard title="Cantidad disponible" description={channel ? `En ${channelName}: ${quantityText(channel)}.` : undefined}>
      <SectionBody>
        <p className={rejected ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>{note}</p>
        {published && !stockInChannel && lines ? (
          <QuantityEditor accountSlug={accountSlug} publicationId={publicationId} lines={lines} channelLines={channel} channelName={channelName} />
        ) : null}
      </SectionBody>
    </SectionCard>
  );
}
