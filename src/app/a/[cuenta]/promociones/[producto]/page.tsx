import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { ProductPromoPanel } from '@/components/promo/ProductPromoPanel';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { loadPromoPanel } from '@/lib/promo/panel';

// Las promociones de un producto: etiquetas, almanaque y la grilla de medidas
// por formas de cobro.

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Promociones · ${account.name}` : 'Promociones' };
}

export default async function ProductPromotionsPage({ params }: { params: Promise<{ cuenta: string; producto: string }> }) {
  const { cuenta, producto } = await params;
  const { account } = await requireAccount(cuenta, 'promociones');
  const data = await loadPromoPanel(prisma, account.id, producto);
  if (!data) notFound();
  return (
    <>
      <PageHeader>
        <div className="space-y-1">
          <Link href={`/a/${account.slug}/promociones`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Promociones
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{data.grid.name}</h1>
          <p className="text-sm text-muted-foreground">
            {data.grid.brand ? `${data.grid.brand} · ` : ''}
            {data.grid.measures.length} {data.grid.measures.length === 1 ? 'medida' : 'medidas'} · {data.grid.measures.reduce((n, m) => n + m.options.length, 0)} publicaciones en {data.grid.channelName}
          </p>
        </div>
      </PageHeader>
      <PageBody>
        <ProductPromoPanel accountSlug={account.slug} timeZone={account.timezone} grid={data.grid} log={data.log} />
      </PageBody>
    </>
  );
}
