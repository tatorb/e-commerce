import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { discountText, installmentsText, priceFaceText, priceText, type FaceField, type FaceValues, type FieldState } from '@/domain/channel-sync';
import { formatPercent, formatPrice } from '@/domain/money';
import { fixedInstallments, LOW_INTEREST_PLAN } from '@/domain/pricing';
import type { LatestPriceDecision } from '@/lib/pricing';
import { formatDateTime } from '@/lib/format';

// En el paso Publicación: el precio, las cuotas y el descuento que se
// decidieron en el paso Precio, y si ya están en el canal, y las campañas que
// se pidieron en Promociones. Se suben desde Por subir; el precio también va
// al crear la publicación.

type PriceField = 'price' | 'installments' | 'discount';

/** Sumarse a una campaña o salir, pedido en Promociones y todavía sin subir. code: de qué medida, si hay varias. */
export type PendingCampaignRow = {
  id: string;
  action: 'join' | 'leave';
  name: string;
  kind: string;
  price: number | null;
  rejection: string | null;
  code: string | null;
  // El margen estimado si se suma con ese precio.
  marginPct: number | null;
};

export type PriceSides = {
  app: FaceValues;
  channel: FaceValues | null;
  states: Record<FaceField, FieldState | 'unread'>;
  rejected: { field: FaceField; message: string }[];
};

export function PriceDecisionCard({
  decision,
  channelName,
  sides,
  discountUntil,
  published,
  priceHref,
  timeZone,
  campaigns = [],
}: {
  decision: LatestPriceDecision;
  channelName: string;
  // Las dos caras de la publicación; null si no se pudieron leer.
  sides: PriceSides | null;
  // Hasta cuándo dura el descuento que subió la app.
  discountUntil: Date | null;
  published: boolean;
  priceHref: string;
  timeZone: string;
  campaigns?: PendingCampaignRow[];
}) {
  if (!decision) {
    return (
      <SectionCard title="Precio">
        <SectionBody>
          <p className="text-sm text-muted-foreground">Todavía no se guardó el precio en el paso Precio.</p>
          <Button asChild size="sm" variant="outline">
            <Link href={priceHref}>Ir a Precio</Link>
          </Button>
          {campaigns.length > 0 ? (
            <dl className="divide-y rounded-md border">
              <CampaignRows campaigns={campaigns} channelName={channelName} />
            </dl>
          ) : null}
        </SectionBody>
      </SectionCard>
    );
  }

  const decided: Record<PriceField, string | null> = {
    price: priceText(decision.listPrice),
    installments: installmentsText(decision.installments),
    discount: discountText(decision.discountPct),
  };

  /** Si ya está en el canal, si queda para subir o qué pasó. */
  function status(field: PriceField): string {
    if (!published) return field === 'price' ? `Va con la publicación cuando la crees en ${channelName}.` : 'Después de crearla, queda en Por subir.';
    const state = sides?.states[field] ?? 'unread';
    if (!sides || state === 'unread') return `Todavía no se leyó de ${channelName}.`;
    const channel = sides.channel?.[field] ?? null;
    if (channel === decided[field]) return `Ya está en ${channelName}.`;
    if (sides.app[field] !== decided[field]) return `En ${channelName} está ${priceFaceText(field, channel).toLowerCase() || 'vacío'}: cambió después de decidirlo.`;
    const rejected = sides.rejected.find((r) => r.field === field);
    if (rejected) return `No se pudo subir: ${rejected.message}`;
    if (state === 'choose') return `Cambió también en ${channelName}: elegí cuál queda en Por subir, abajo.`;
    // Ya se subió y el canal todavía no lo muestra, o cambió allá y la app lo toma en la próxima lectura.
    if (state === 'incoming') return field === 'discount' ? `Ya se subió: ${channelName} todavía no lo muestra.` : `Cambió en ${channelName}: la app lo toma en la próxima lectura.`;
    return `Se sube a ${channelName} desde Por subir, abajo.`;
  }

  const each = fixedInstallments(decision.installments);
  const rows: { field: PriceField; label: string; value: string; detail: string | null }[] = [
    { field: 'price', label: 'Precio publicado', value: formatPrice(decision.listPrice), detail: null },
    {
      field: 'installments',
      label: 'Cuotas',
      value: priceFaceText('installments', decided.installments),
      detail:
        decision.installments === LOW_INTEREST_PLAN
          ? 'De 3 a 12 cuotas con interés bajo.'
          : each
            ? `${each} cuotas sin interés de ${formatPrice(Math.round(decision.finalPrice / each))}.`
            : null,
    },
    {
      field: 'discount',
      label: 'Descuento',
      value: priceFaceText('discount', decided.discount),
      detail: decision.discountPct > 0 ? `El comprador paga ${formatPrice(Math.round(decision.finalPrice))}.` : null,
    },
  ];
  const renews = discountUntil && decision.discountPct > 0 && sides?.channel?.discount === decided.discount;

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
        <dl className="divide-y rounded-md border">
          {rows.map((r) => (
            <div key={r.field} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{r.label}</dt>
                <dd className="font-semibold tabular-nums">{r.value}</dd>
                {r.detail ? <dd className="text-xs text-muted-foreground">{r.detail}</dd> : null}
              </div>
              <dd className="text-sm text-muted-foreground sm:max-w-[60%] sm:text-right">{status(r.field)}</dd>
            </div>
          ))}
          <CampaignRows campaigns={campaigns} channelName={channelName} />
        </dl>
        {renews ? (
          <p className="text-sm text-muted-foreground">
            El descuento dura hasta el {formatDateTime(discountUntil, timeZone)}. Un día antes, la app lo vuelve a subir sola, y queda en el Registro.
          </p>
        ) : null}
      </SectionBody>
    </SectionCard>
  );
}

/** Una fila por campaña pedida, como las del precio. */
function CampaignRows({ campaigns, channelName }: { campaigns: PendingCampaignRow[]; channelName: string }) {
  return campaigns.map((c) => {
    // "Campaña tradicional, el comprador paga $ 85.000, margen de 18 % sobre el costo."
    const detail = [
      c.name !== c.kind ? c.kind : null,
      c.action === 'join' ? (c.price !== null ? `el comprador paga ${formatPrice(c.price)}` : `el precio lo pone ${channelName}`) : null,
      c.marginPct !== null ? `margen de ${formatPercent(c.marginPct)} sobre el costo` : null,
    ]
      .filter(Boolean)
      .join(', ');
    return (
      <div key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Campaña{c.code ? ` · ${c.code}` : ''}</dt>
          <dd className="font-semibold">
            {c.action === 'join' ? 'Sumarse a' : 'Salir de'} {c.name}
          </dd>
          {detail ? <dd className="text-xs text-muted-foreground">{`${detail.charAt(0).toUpperCase()}${detail.slice(1)}.`}</dd> : null}
        </div>
        <dd className={c.rejection ? 'text-sm text-destructive sm:max-w-[60%] sm:text-right' : 'text-sm text-muted-foreground sm:max-w-[60%] sm:text-right'}>
          {c.rejection ? `No se pudo subir: ${c.rejection}` : `Se sube a ${channelName} desde Por subir, abajo.`}
        </dd>
      </div>
    );
  });
}
