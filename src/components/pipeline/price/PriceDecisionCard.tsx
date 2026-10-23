import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { formatPercent, formatPrice } from '@/domain/money';
import { LOW_INTEREST_PLAN } from '@/domain/pricing';
import type { LatestPriceDecision } from '@/lib/pricing';
import { formatDateTime } from '@/lib/format';

// En el paso Publicación: el precio que se decidió en el paso Precio. El
// precio publicado se sube desde Por subir, o va al crear la publicación; el
// descuento y las cuotas se cargan a mano en el canal.

export function PriceDecisionCard({
  decision,
  channelName,
  channelPrice,
  published,
  priceHref,
  timeZone,
}: {
  decision: LatestPriceDecision;
  channelName: string;
  // El precio que se leyó del canal; null si no se leyó.
  channelPrice: number | null;
  published: boolean;
  priceHref: string;
  timeZone: string;
}) {
  if (!decision) {
    return (
      <SectionCard title="Precio">
        <SectionBody>
          <p className="text-sm text-muted-foreground">Todavía no se guardó el precio en el paso Precio.</p>
          <Button asChild size="sm" variant="outline">
            <Link href={priceHref}>Ir a Precio</Link>
          </Button>
        </SectionBody>
      </SectionCard>
    );
  }
  const inChannel = channelPrice !== null && Math.round(channelPrice) === Math.round(decision.listPrice);
  const manual = [
    decision.discountPct > 0
      ? `Un descuento de ${formatPercent(decision.discountPct)}: el comprador paga ${formatPrice(Math.round(decision.finalPrice))}.`
      : null,
    decision.installments === LOW_INTEREST_PLAN
      ? 'La cuota promocionada: de 3 a 12 cuotas con interés bajo.'
      : decision.installments > 0
        ? `${decision.installments} cuotas sin interés de ${formatPrice(Math.round(decision.finalPrice / decision.installments))}.`
        : null,
  ].filter((line): line is string => line !== null);

  return (
    <SectionCard
      title="Precio"
      description={`Decidido el ${formatDateTime(decision.decidedAt, timeZone)}, con un margen de ${formatPercent(decision.marginPct)} sobre el costo${decision.belowMinConfirmed ? `, debajo del mínimo de ${formatPercent(decision.minMarginPct)} y confirmado igual` : ''}.`}
      action={
        <Button asChild size="sm" variant="outline">
          <Link href={priceHref}>Cambiarlo</Link>
        </Button>
      }
    >
      <SectionBody>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm">
            Precio publicado <span className="text-lg font-semibold tabular-nums">{formatPrice(decision.listPrice)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {!published
              ? `Va con la publicación cuando la crees en ${channelName}.`
              : inChannel
                ? `Ya está en ${channelName}.`
                : `Se sube a ${channelName} desde Por subir, abajo.`}
          </p>
        </div>
        {manual.length > 0 ? (
          <div className="space-y-1 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <p className="font-medium">Cargá a mano en {channelName}:</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {manual.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">La app todavía no los manda sola.</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin descuento ni cuotas sin interés.</p>
        )}
      </SectionBody>
    </SectionCard>
  );
}
