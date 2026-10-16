import { notFound } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProbeButton } from '@/components/settings/ProbeButton';
import { getChannelResearch } from '@/channels/research';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
// La prueba hace varios pedidos al canal, con pausas.
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  return { title: account ? `Conexión · ${account.name}` : 'Conexión' };
}

// Qué habilita cada prueba, para explicarlo en pantalla.
const ENABLES: Record<string, string> = {
  suggestions: 'Si sale bien, el paso Título lee solo las sugerencias del buscador. Si no, se pegan a mano.',
  search_api: 'Si sale bien, el paso Título lee sola la posición en cada búsqueda. Si no, se carga a mano.',
  search_page: 'Solo informativo: dice si la página de resultados se puede leer o pide verificación.',
};

export default async function ConnectionPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  if (!account) notFound();

  const stores = await prisma.store.findMany({ where: { accountId: account.id }, include: { channel: true } });
  const channels = [...new Map(stores.map((s) => [s.channel.id, s.channel])).values()].filter((c) =>
    getChannelResearch(c.kind),
  );
  const probes = await prisma.channelProbe.findMany({
    where: { channelId: { in: channels.map((c) => c.id) } },
    orderBy: { checkedAt: 'desc' },
    take: 60,
  });

  return (
    <>
      <PageHeader className="max-w-4xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Conexión con los canales</h1>
          <p className="text-sm text-muted-foreground">
            Prueba si la app puede leer sola las sugerencias del buscador y las posiciones de búsqueda. Corre desde el
            servidor de la app, igual que cuando se usa el paso Título. Lo que no se pueda leer solo se carga a mano.
          </p>
        </div>
      </PageHeader>
      <PageBody className="max-w-4xl">
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ningún canal de la cuenta tiene algo para probar.</p>
        ) : null}
        {channels.map((channel) => {
          // Lo último de cada prueba.
          const latest = new Map<string, (typeof probes)[number]>();
          for (const p of probes) if (p.channelId === channel.id && !latest.has(p.check)) latest.set(p.check, p);
          const last = [...latest.values()];
          return (
            <Card key={channel.id}>
              <CardHeader>
                <CardTitle>{channel.name}</CardTitle>
                <CardDescription>
                  {last.length === 0
                    ? 'Todavía no se probó.'
                    : `Última prueba: ${formatDateTime(last[0].checkedAt, account.timezone)}.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProbeButton
                  accountSlug={account.slug}
                  channelId={channel.id}
                  label={last.length === 0 ? `Probar conexión con ${channel.name}` : 'Probar de nuevo'}
                />
                {last.length > 0 ? (
                  <ul className="divide-y rounded-md border">
                    {last.map((p) => (
                      <li key={p.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                        {p.ok ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Anda" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-label="No anda" />
                        )}
                        <div className="space-y-0.5">
                          <p className="font-medium">
                            {p.check === 'suggestions'
                              ? 'Sugerencias del buscador'
                              : p.check === 'search_api'
                                ? 'Búsqueda por la API oficial'
                                : p.check === 'search_page'
                                  ? 'Página de resultados'
                                  : p.check}
                          </p>
                          <p className="text-muted-foreground">{p.detail}</p>
                          {ENABLES[p.check] ? <p className="text-xs text-muted-foreground">{ENABLES[p.check]}</p> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </PageBody>
    </>
  );
}
