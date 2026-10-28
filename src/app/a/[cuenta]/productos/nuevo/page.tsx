import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { EMPTY_PRODUCT, ProductForm } from '@/components/products/ProductForm';
import { requireAccount } from '@/lib/auth/account';

export const metadata = { title: 'Nuevo producto' };

export default async function NewProductPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { account } = await requireAccount(cuenta, 'productos');
  const base = `/a/${account.slug}/productos`;

  return (
    <>
      <PageHeader staticOnMobile>
        <div className="space-y-2">
          <Breadcrumb
            items={[{ label: account.name, href: base }, { label: 'Productos', href: base }, { label: 'Nuevo producto' }]}
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Nuevo producto</h1>
            <p className="text-sm text-muted-foreground">
              Cargá la ficha maestra. Después le agregás su publicación en cada tienda.
            </p>
          </div>
        </div>
      </PageHeader>
      <PageBody>
        <ProductForm accountSlug={account.slug} productId={null} initial={EMPTY_PRODUCT} />
      </PageBody>
    </>
  );
}
