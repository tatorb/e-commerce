import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TitleRulesForm } from '@/components/settings/TitleRulesForm';
import { getChannelAdapter } from '@/channels';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { loadTitleRules } from '@/lib/title-rules';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  return { title: account ? `Reglas de título · ${account.name}` : 'Reglas de título' };
}

export default async function TitleRulesPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  if (!account) notFound();

  const stores = await prisma.store.findMany({ where: { accountId: account.id }, include: { channel: true } });
  const channels = [...new Map(stores.map((s) => [s.channel.id, s.channel])).values()];
  const families = (
    await prisma.product.findMany({
      where: { accountId: account.id, productType: { not: null } },
      distinct: ['productType'],
      select: { productType: true },
      orderBy: { productType: 'asc' },
    })
  ).flatMap((p) => (p.productType ? [p.productType] : []));
  const loaded = await Promise.all(channels.map((c) => loadTitleRules(prisma, account.id, c)));

  return (
    <>
      <PageHeader className="max-w-4xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Reglas de título</h1>
          <p className="text-sm text-muted-foreground">
            Lo que tiene que cumplir el título de cada publicación de <strong>{account.name}</strong>. El paso Título
            del pipeline las chequea en vivo y no deja aprobar un título que no las cumple.
          </p>
        </div>
      </PageHeader>
      <PageBody className="max-w-4xl">
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta cuenta todavía no tiene tiendas en ningún canal.</p>
        ) : null}
        {channels.map((channel, i) => {
          const { rules, custom, updatedAt } = loaded[i];
          return (
            <Card key={channel.id}>
              <CardHeader>
                <CardTitle>{channel.name}</CardTitle>
                <CardDescription>
                  {custom
                    ? `Reglas propias de la cuenta${updatedAt ? `, guardadas el ${formatDateTime(updatedAt, account.timezone)}` : ''}.`
                    : `Son las reglas iniciales de ${channel.name}. Si las cambiás, quedan como reglas propias de la cuenta.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TitleRulesForm
                  accountSlug={account.slug}
                  channelId={channel.id}
                  channelName={channel.name}
                  rules={rules}
                  defaults={getChannelAdapter(channel.kind, channel.name).titleRules}
                  custom={custom}
                  families={families}
                />
              </CardContent>
            </Card>
          );
        })}
      </PageBody>
    </>
  );
}
