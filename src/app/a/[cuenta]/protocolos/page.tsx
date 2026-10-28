import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { ProtocolEditor } from '@/components/shoot/ProtocolEditor';
import { can } from '@/domain/access';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { listProtocols } from '@/lib/shoot';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Protocolos de fotos · ${account.name}` : 'Protocolos de fotos' };
}

export default async function ProtocolsPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { user, account } = await requireAccount(cuenta, 'protocolos');
  const protocols = await listProtocols(prisma, account.id, { archived: true });

  return (
    <>
      <PageHeader>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Protocolos de fotos</h1>
          <p className="text-sm text-muted-foreground">
            Los pasos que sigue el operario de <strong>{account.name}</strong> para sacar las fotos y los videos de cada producto con el celular, en{' '}
            {can(user.access, 'captura', 'read') ? (
              <Link href={`/a/${account.slug}/registro-productos`} className="font-medium text-foreground underline-offset-4 hover:underline">
                Registro de productos
              </Link>
            ) : (
              'Registro de productos'
            )}
            . Cada paso dice qué sacar o qué hacer, si es foto, video o sin registro, cómo hacerlo y muestra una ilustración de ejemplo. Los pasos sin registro, como preparar o limpiar el lugar, se marcan Listo.
          </p>
        </div>
      </PageHeader>
      <PageBody>
        <ProtocolEditor accountSlug={account.slug} protocols={protocols} />
      </PageBody>
    </>
  );
}
