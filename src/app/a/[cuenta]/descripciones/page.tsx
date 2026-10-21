import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DescriptionSettingsForm } from '@/components/settings/DescriptionSettingsForm';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { loadDescriptionSettings } from '@/lib/descriptions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Descripciones · ${account.name}` : 'Descripciones' };
}

export default async function DescriptionSettingsPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { account } = await requireAccount(cuenta);
  const row = await loadDescriptionSettings(prisma, account.id);

  return (
    <>
      <PageHeader className="max-w-4xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Descripciones</h1>
          <p className="text-sm text-muted-foreground">
            El encabezado y el pie que llevan todas las descripciones de <strong>{account.name}</strong>, y lo que Claude usa para
            proponerlas en el paso Descripción del pipeline.
          </p>
        </div>
      </PageHeader>
      <PageBody className="max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Encabezado, pie e indicaciones</CardTitle>
            <CardDescription>
              {row ? `Guardado el ${formatDateTime(row.updatedAt, account.timezone)}.` : 'Todavía no se cargó nada: las descripciones van sin encabezado ni pie.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DescriptionSettingsForm
              accountSlug={account.slug}
              initial={{ header: row?.header ?? '', footer: row?.footer ?? '', guidelines: row?.guidelines ?? '' }}
            />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
