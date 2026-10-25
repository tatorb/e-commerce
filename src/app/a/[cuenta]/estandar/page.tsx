import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RuleDialog } from '@/components/standard/RuleDialog';
import { DeleteRuleButton, LoadSuggestedButton } from '@/components/standard/RuleActions';
import { describeCheck, isCheckKey, readParams } from '@/domain/standard';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { cn } from '@/lib/utils/cn';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Estándar · ${account.name}` : 'Estándar' };
}

export default async function StandardPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { account } = await requireAccount(cuenta, 'estandar');

  // Un estándar por cada canal en el que la cuenta tiene tiendas.
  const [stores, rules] = await Promise.all([
    prisma.store.findMany({ where: { accountId: account.id }, include: { channel: true } }),
    prisma.standardRule.findMany({
      where: { accountId: account.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);
  const channels = [...new Map(stores.map((s) => [s.channel.id, s.channel])).values()];

  return (
    <>
      <PageHeader className="max-w-4xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Estándar de publicación</h1>
          <p className="text-sm text-muted-foreground">
            Qué tiene que tener una publicación correcta en <strong>{account.name}</strong>. El puntaje de cada
            publicación sale de estas reglas: lo que suman las que cumple, sobre lo que suman todas, llevado a 100.
          </p>
        </div>
      </PageHeader>
      <PageBody className="max-w-4xl">
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta cuenta todavía no tiene tiendas en ningún canal.</p>
        ) : null}
        {channels.map((channel) => {
          const channelRules = rules.filter((r) => r.channelId === channel.id);
          const totalWeight = channelRules.filter((r) => r.active).reduce((s, r) => s + r.weight, 0);
          return (
            <Card key={channel.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle>{channel.name}</CardTitle>
                    <CardDescription>
                      {channelRules.length === 0
                        ? 'Sin reglas todavía.'
                        : `Suma de pesos de las reglas activas: ${totalWeight}.`}
                    </CardDescription>
                  </div>
                  {channelRules.length > 0 ? <RuleDialog accountSlug={account.slug} channelId={channel.id} /> : null}
                </div>
              </CardHeader>
              <CardContent>
                {channelRules.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Esta cuenta no tiene reglas para {channel.name}.
                    </p>
                    <LoadSuggestedButton accountSlug={account.slug} channelId={channel.id} />
                  </div>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {channelRules.map((rule) => {
                      const known = isCheckKey(rule.check);
                      return (
                        <li key={rule.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                          <div className={cn('flex-1 min-w-0 space-y-1', !rule.active && 'opacity-60')}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-sm">{rule.name}</span>
                              <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium tabular-nums">
                                Peso {rule.weight}
                              </span>
                              {!rule.active ? (
                                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                                  Apagada
                                </span>
                              ) : null}
                            </div>
                            {rule.description ? (
                              <p className="text-sm text-muted-foreground">{rule.description}</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">Revisa: {describeCheck(rule.check, rule.params)}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {known ? (
                              <RuleDialog
                                accountSlug={account.slug}
                                channelId={channel.id}
                                rule={{
                                  id: rule.id,
                                  name: rule.name,
                                  description: rule.description ?? '',
                                  check: rule.check as Parameters<typeof readParams>[0],
                                  params: readParams(rule.check as Parameters<typeof readParams>[0], rule.params),
                                  weight: rule.weight,
                                  active: rule.active,
                                }}
                              />
                            ) : null}
                            <DeleteRuleButton accountSlug={account.slug} ruleId={rule.id} name={rule.name} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </PageBody>
    </>
  );
}
