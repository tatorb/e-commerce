import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WarrantyEditor } from '@/components/publication/WarrantyEditor';
import { ApplyWarrantyCard } from '@/components/settings/ApplyWarrantyCard';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { warrantyLabel } from '@/domain/warranty';
import { accountWarranty } from '@/lib/warranty';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Garantía · ${account.name}` : 'Garantía' };
}

export default async function WarrantySettingsPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { account } = await requireAccount(cuenta, 'precios');
  const [warranty, store] = await Promise.all([
    accountWarranty(prisma, account.id),
    prisma.store.findFirst({ where: { accountId: account.id }, orderBy: { createdAt: 'asc' }, select: { channel: { select: { name: true } } } }),
  ]);
  const channelName = store?.channel.name ?? 'el canal';

  return (
    <>
      <PageHeader>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Garantía</h1>
          <p className="text-sm text-muted-foreground">
            La garantía de <strong>{account.name}</strong>: con la que se crean las publicaciones nuevas y la que se puede cargar en todas.
          </p>
        </div>
      </PageHeader>
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Garantía de la cuenta</CardTitle>
            <CardDescription>
              {warranty ? `Hoy: ${warrantyLabel(warranty)}.` : 'Todavía no se definió.'} Las publicaciones nuevas se crean con esta garantía, salvo que
              tengan una propia. Guardarla acá no cambia las que ya están.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WarrantyEditor accountSlug={account.slug} target={{ kind: 'account' }} initial={warranty} canClear={warranty !== null} />
          </CardContent>
        </Card>
        {warranty ? (
          <Card>
            <CardHeader>
              <CardTitle>Cargarla en todas las publicaciones</CardTitle>
              <CardDescription>
                Primero te digo cuántas cambian, sin tocar nada. Al confirmar, la garantía queda en cada publicación como un cambio sin subir, en Por
                subir. A {channelName} llega recién cuando lo subís desde ahí.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApplyWarrantyCard accountSlug={account.slug} channelName={channelName} />
            </CardContent>
          </Card>
        ) : null}
      </PageBody>
    </>
  );
}
