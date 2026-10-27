import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { FamilyPlanView } from '@/components/families/FamilyPlanView';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { planFamilies } from '@/lib/families';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Familias · ${account.name}` : 'Familias' };
}

// Las familias del canal: cómo quedarían agrupadas las publicaciones de cada
// medida. Por ahora solo se ven, sin cambiar nada.
export default async function FamiliesPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { account } = await requireAccount(cuenta, 'importar');
  const plans = await planFamilies(prisma, account.id);

  return (
    <>
      <PageHeader>
        <div className="space-y-1">
          <Breadcrumb items={[{ label: account.name }, { label: 'Importar', href: `/a/${account.slug}/importar` }, { label: 'Familias' }]} />
          <h1 className="text-2xl font-semibold tracking-tight">Familias</h1>
          <p className="text-sm text-muted-foreground">
            En Mercado Libre cada medida de un producto es una publicación aparte, con su propio código, y las medidas del mismo producto quedan
            juntas en una familia. Acá ves cómo quedarían agrupadas en la app las publicaciones de <strong>{account.name}</strong>: cuáles se juntan,
            qué medidas faltan traer y qué hay que revisar. Todavía no cambia nada.
          </p>
        </div>
      </PageHeader>
      <PageBody>
        {plans.length === 0 ? (
          <SectionCard title="Todavía no hay familias">
            <SectionBody>
              <p className="text-sm text-muted-foreground">
                La lectura de cada hora va leyendo la familia de cada publicación. Cuando encuentre medidas agrupadas en el canal, aparecen acá.
              </p>
            </SectionBody>
          </SectionCard>
        ) : (
          plans.map((plan) => <FamilyPlanView key={plan.storeId} plan={plan} accountSlug={account.slug} />)
        )}
      </PageBody>
    </>
  );
}
