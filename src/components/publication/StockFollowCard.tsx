import Link from 'next/link';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { followsStockOf, plannedText, type StockPlan } from '@/lib/stock-plan';
import { FollowStockSwitch } from './FollowStockSwitch';

// En el paso Información: si la cantidad de la publicación se actualiza sola
// con el stock del producto, y qué le toca ahora.
export function StockFollowCard({
  accountSlug,
  publicationId,
  plan,
  productHref,
}: {
  accountSlug: string;
  publicationId: string;
  plan: StockPlan | null;
  productHref: string;
}) {
  const now = plan?.managed
    ? `Le toca ${plannedText(plan)}.${plan.measure ? ` Vende solo la medida ${plan.measure.label} del producto.` : ''}`
    : plan && !plan.off
      ? plan.reason
      : null;
  return (
    <SectionCard title="Cantidad automática" description="La cantidad de la publicación sale del stock del producto, que es uno solo para todas sus publicaciones.">
      <SectionBody className="space-y-3">
        <FollowStockSwitch accountSlug={accountSlug} publicationId={publicationId} on={followsStockOf(plan)} />
        {now ? <p className="text-sm text-muted-foreground">{now}</p> : null}
        <p className="text-sm">
          <Link href={productHref} className="font-medium underline-offset-4 hover:underline">
            Ver el stock del producto
          </Link>
        </p>
      </SectionBody>
    </SectionCard>
  );
}
