import { Tag, Shapes, Users } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { OptionListEditor } from '@/components/settings/OptionListEditor';
import { CompetitorScopeEditor } from '@/components/settings/CompetitorScopeEditor';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { loadProductOptions, optionUsage } from '@/lib/product-options';

// Ajustes, Tipos y marcas: las listas fijas de la ficha de los productos.

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Tipos y marcas · ${account.name}` : 'Tipos y marcas' };
}

export default async function OptionsPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { account, canWrite } = await requireAccount(cuenta, 'productos');
  const [options, usage, scopes] = await Promise.all([
    loadProductOptions(prisma, account.id),
    optionUsage(prisma, account.id),
    prisma.productOption.findMany({ where: { accountId: account.id, kind: 'TYPE' }, select: { name: true, competitorScope: true } }),
  ]);
  const scopeOf = new Map(scopes.map((o) => [o.name, o.competitorScope]));
  const rows = (names: string[], used: Map<string, number>) => names.map((name) => ({ name, products: used.get(name) ?? 0 }));

  return (
    <>
      <PageHeader>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Tipos y marcas</h1>
          <p className="text-sm text-muted-foreground">
            Los tipos de producto y las marcas de <strong>{account.name}</strong>. En la ficha, en el paso Información, en Registro de productos y en el
            importador solo se puede usar uno de estas listas. Si cambiás un nombre, cambia en todos los productos que lo usan.
          </p>
        </div>
      </PageHeader>
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Tipos de producto" icon={<Shapes />} count={options.types.length} description="Sirven para los filtros, la categoría del canal y las reglas de título.">
            <SectionBody>
              <OptionListEditor accountSlug={account.slug} kind="TYPE" items={rows(options.types, usage.types)} canWrite={canWrite} />
            </SectionBody>
          </SectionCard>
          <SectionCard title="Marcas" icon={<Tag />} count={options.brands.length} description="La marca del repuesto, como figura en la ficha.">
            <SectionBody>
              <OptionListEditor accountSlug={account.slug} kind="BRAND" items={rows(options.brands, usage.brands)} canWrite={canWrite} />
            </SectionBody>
          </SectionCard>
        </div>
        <SectionCard
          title="Competencia por tipo de producto"
          icon={<Users />}
          description="Por publicación: cada publicación tiene su propia lista de competencia. Por producto: una sola lista, compartida por todas las publicaciones del producto (sus opciones de venta y las medidas de su familia), igual que la ficha. La comparación de precios siempre usa el precio y las cuotas de cada publicación."
        >
          <SectionBody>
            <CompetitorScopeEditor
              accountSlug={account.slug}
              types={options.types.map((name) => ({ name, scope: scopeOf.get(name) ?? 'PUBLICATION', products: usage.types.get(name) ?? 0 }))}
              canWrite={canWrite}
            />
          </SectionBody>
        </SectionCard>
      </PageBody>
    </>
  );
}
