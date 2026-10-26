import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { QuantityEditor } from '@/components/publication/QuantityEditor';
import type { PriceSides } from '@/components/pipeline/price/PriceDecisionCard';
import Link from 'next/link';
import { quantityText } from '@/domain/quantities';
import { followsStockOf, type StockPlan } from '@/lib/stock-plan';
import { FollowStockSwitch } from '@/components/publication/FollowStockSwitch';

// En el paso Publicación: la cantidad disponible. Si sale del stock del
// producto, se cambia allá y se sube sola; si no, se cambia acá y queda en Por
// subir, igual que el precio.

export function QuantityCard({
  accountSlug,
  publicationId,
  channelName,
  published,
  sides,
  stockInChannel,
  stock,
}: {
  accountSlug: string;
  publicationId: string;
  channelName: string;
  published: boolean;
  // Las dos caras de la publicación; null si no se pudieron leer.
  sides: PriceSides | null;
  stockInChannel: boolean;
  // Lo que le toca según el stock del producto, y dónde se cambia.
  stock?: { plan: StockPlan; productHref: string } | null;
}) {
  const toggle = <FollowStockSwitch accountSlug={accountSlug} publicationId={publicationId} on={followsStockOf(stock?.plan)} />;
  if (stock?.plan.managed) {
    const channel = stock.plan.channel;
    return (
      <SectionCard title="Cantidad disponible" description={channel ? `En ${channelName}: ${quantityText(channel)}.` : undefined}>
        <SectionBody>
          {toggle}
          <p className="text-sm">
            Sale del stock del producto{stock.plan.measure ? `, medida ${stock.plan.measure.label}` : ''}:{' '}
            <span className="font-medium">{quantityText(stock.plan.lines)}</span>.
            {stock.plan.pending ? ` Se sube a ${channelName} en la próxima pasada.` : ''}
          </p>
          {stock.plan.measure ? (
            <p className="text-sm text-muted-foreground">
              En {channelName} vende solo esa medida
              {stock.plan.measure.sku && stock.plan.measure.sku !== stock.plan.measure.label ? `, por su SKU ${stock.plan.measure.sku}` : ''}.
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Cada venta lo descuenta y la cantidad nueva se sube sola a todas sus publicaciones.{' '}
            <Link href={stock.productHref} className="font-medium text-foreground underline-offset-4 hover:underline">
              Cambiar el stock en el producto
            </Link>
          </p>
        </SectionBody>
      </SectionCard>
    );
  }
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

  // Prendida pero sin seguir al stock todavía: por qué.
  const why = stock && !stock.plan.managed && !stock.plan.off ? stock.plan.reason : null;

  return (
    <SectionCard title="Cantidad disponible" description={channel ? `En ${channelName}: ${quantityText(channel)}.` : undefined}>
      <SectionBody>
        {toggle}
        {why ? <p className="text-sm text-muted-foreground">{why}</p> : null}
        <p className={rejected ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>{note}</p>
        {published && !stockInChannel && lines ? (
          <QuantityEditor accountSlug={accountSlug} publicationId={publicationId} lines={lines} channelLines={channel} channelName={channelName} />
        ) : null}
      </SectionBody>
    </SectionCard>
  );
}
