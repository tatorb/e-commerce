import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PricingSettingsForm } from '@/components/settings/PricingSettingsForm';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { loadPricingSettings } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Precios · ${account.name}` : 'Precios' };
}

export default async function PricingSettingsPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { account } = await requireAccount(cuenta, 'precios');
  const settings = await loadPricingSettings(prisma, account.id);

  return (
    <>
      <PageHeader className="max-w-4xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Precios</h1>
          <p className="text-sm text-muted-foreground">
            Los cargos, impuestos, cuotas, costos y márgenes con que el paso Precio calcula el precio de las publicaciones de{' '}
            <strong>{account.name}</strong>. Cada producto puede cambiar cualquiera solo para él, desde el paso Precio.
          </p>
        </div>
      </PageHeader>
      <PageBody className="max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Parámetros de la cuenta</CardTitle>
            <CardDescription>
              {settings.updatedAt
                ? `Guardado el ${formatDateTime(settings.updatedAt, account.timezone)}${settings.updatedBy ? ` por ${settings.updatedBy}` : ''}.`
                : 'Todavía no se cambió nada: rigen los valores de partida.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PricingSettingsForm accountSlug={account.slug} initial={settings.values} />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
