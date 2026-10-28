import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhotoSettingsForm } from '@/components/settings/PhotoSettingsForm';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { formatDateTime } from '@/lib/format';
import { parsePhotoSettings, DEFAULT_PHOTO_SETTINGS } from '@/domain/photo-settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Imágenes · ${account.name}` : 'Imágenes' };
}

export default async function PhotoSettingsPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { account } = await requireAccount(cuenta, 'imagenes');
  const row = await prisma.photoSettings.findUnique({ where: { accountId: account.id } });

  return (
    <>
      <PageHeader>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Imágenes</h1>
          <p className="text-sm text-muted-foreground">
            Cómo quedan las fotos de <strong>{account.name}</strong> al pasar por la línea de corrección del paso Imágenes.
            Valen para los pasos que se hagan desde que los guardás.
          </p>
        </div>
      </PageHeader>
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Ajustes de la línea</CardTitle>
            <CardDescription>
              {row
                ? `Ajustes propios de la cuenta, guardados el ${formatDateTime(row.updatedAt, account.timezone)}.`
                : 'Son los ajustes de siempre. Si los cambiás, quedan como propios de la cuenta.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PhotoSettingsForm
              accountSlug={account.slug}
              settings={row ? parsePhotoSettings(row.values) : DEFAULT_PHOTO_SETTINGS}
              custom={row !== null}
            />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
