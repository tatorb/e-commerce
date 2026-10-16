import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { EMPTY_PRODUCT, ProductForm } from '@/components/products/ProductForm';
import { getAccountBySlug } from '@/lib/queries/accounts';

export const metadata = { title: 'Nuevo producto' };

export default async function NewProductPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  if (!account) notFound();
  const base = `/a/${account.slug}/productos`;

  return (
    <>
      <PageHeader staticOnMobile className="max-w-5xl">
        <div className="space-y-2">
          <Breadcrumb
            items={[{ label: account.name, href: base }, { label: 'Productos', href: base }, { label: 'Nuevo producto' }]}
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Nuevo producto</h1>
            <p className="text-sm text-muted-foreground">
              Cargá la ficha maestra. Después le agregás su publicación en cada tienda.
            </p>
          </div>
        </div>
      </PageHeader>
      <PageBody className="max-w-5xl">
        <ProductForm accountSlug={account.slug} productId={null} initial={EMPTY_PRODUCT} />
      </PageBody>
    </>
  );
}
