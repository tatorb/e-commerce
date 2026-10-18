import { notFound } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyButton } from '@/components/apply/CopyButton';
import { ProbeButton } from '@/components/settings/ProbeButton';
import { AppCredentialsForm } from '@/components/settings/AppCredentialsForm';
import { ConnectButtons } from '@/components/settings/ConnectButtons';
import { KeySetup } from '@/components/settings/KeySetup';
import { getChannelConnector } from '@/channels/connect';
import { getChannelResearch } from '@/channels/research';
import { isCryptoConfigured } from '@/lib/crypto';
import { connectionSummary, redirectUri } from '@/lib/connections';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

export const dynamic = 'force-dynamic';
// La prueba hace varios pedidos al canal, con pausas.
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  return { title: account ? `Conexión · ${account.name}` : 'Conexión' };
}

const CHECK_LABEL: Record<string, string> = {
  suggestions: 'Sugerencias del buscador',
  search_api: 'Búsqueda sin cuenta',
  search_page: 'Página de resultados',
  connected_user: 'Cuenta conectada',
  connected_items: 'Publicaciones propias',
  search_connected: 'Búsqueda con la cuenta conectada',
};

// Qué habilita cada prueba, para explicarlo en pantalla.
const ENABLES: Record<string, string> = {
  suggestions: 'Si sale bien, el paso Título lee solo las sugerencias del buscador. Si no, se pegan a mano.',
  search_api: 'Si sale bien, el paso Título lee sola la posición en cada búsqueda. Si no, se carga a mano.',
  search_page: 'Solo informativo: dice si la página de resultados se puede leer o pide verificación.',
  connected_user: 'La cuenta que autorizó responde con su llave.',
  connected_items: 'Sirve para traer las publicaciones desde Mercado Libre, en la próxima parte.',
  search_connected: 'Si sale bien, el paso Título lee sola la posición usando la cuenta conectada.',
};

const ORDER = ['connected_user', 'connected_items', 'search_connected', 'suggestions', 'search_api', 'search_page'];

const STATUS_TEXT = {
  NOT_CONNECTED: 'Sin conectar.',
  ACTIVE: 'Conectada.',
  NEEDS_REAUTH: 'Hay que volver a conectar.',
} as const;

export default async function ConnectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ cuenta: string }>;
  searchParams: Promise<{ resultado?: string; detalle?: string }>;
}) {
  const [{ cuenta }, { resultado, detalle }] = await Promise.all([params, searchParams]);
  const account = await getAccountBySlug(cuenta);
  if (!account) notFound();

  const stores = (
    await prisma.store.findMany({ where: { accountId: account.id }, include: { channel: true }, orderBy: { name: 'asc' } })
  ).filter((s) => getChannelResearch(s.channel.kind) || getChannelConnector(s.channel.kind));
  const probes = await prisma.channelProbe.findMany({
    where: { channelId: { in: stores.map((s) => s.channel.id) } },
    orderBy: { checkedAt: 'desc' },
    take: 200,
  });
  const summaries = await Promise.all(stores.map((s) => connectionSummary(prisma, s.id)));
  const keyReady = isCryptoConfigured();

  return (
    <>
      <PageHeader className="max-w-4xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Conexión con los canales</h1>
          <p className="text-sm text-muted-foreground">
            Conectá la cuenta de cada tienda para que la app lea y, más adelante, cambie sus publicaciones. La prueba de
            conexión dice qué se puede leer solo. Lo que no se pueda leer solo se carga a mano.
          </p>
        </div>
      </PageHeader>
      <PageBody className="max-w-4xl">
        {resultado ? (
          <p
            role="status"
            className={cn(
              'flex items-start gap-2 rounded-md border px-4 py-3 text-sm',
              resultado === 'ok' ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-destructive/40 bg-destructive/5',
            )}
          >
            {resultado === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            )}
            {detalle ?? (resultado === 'ok' ? 'Listo.' : 'No se pudo conectar.')}
          </p>
        ) : null}
        {stores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguna tienda de la cuenta tiene un canal para conectar.</p>
        ) : null}
        {stores.map((store, i) => {
          const connector = getChannelConnector(store.channel.kind);
          const summary = summaries[i];
          const back = redirectUri(store.channel.kind);
          // Lo último de cada prueba: las del canal y las de esta tienda.
          const latest = new Map<string, (typeof probes)[number]>();
          for (const p of probes) {
            if (p.channelId !== store.channel.id || (p.storeId !== null && p.storeId !== store.id)) continue;
            if (!latest.has(p.check)) latest.set(p.check, p);
          }
          const last = [...latest.values()].sort((a, b) => ORDER.indexOf(a.check) - ORDER.indexOf(b.check));
          const lastAt = last.reduce<Date | null>((d, p) => (!d || p.checkedAt > d ? p.checkedAt : d), null);
          const connected = summary?.status === 'ACTIVE';
          return (
            <Card key={store.id}>
              <CardHeader>
                <CardTitle>
                  {store.channel.name} · {store.name}
                </CardTitle>
                <CardDescription>
                  {summary
                    ? summary.status === 'ACTIVE'
                      ? `Conectada como ${summary.externalNickname ?? '—'}${summary.connectedAt ? ` desde el ${formatDateTime(summary.connectedAt, account.timezone)}` : ''}${summary.connectedBy ? `, por ${summary.connectedBy.name}` : ''}.`
                      : `${STATUS_TEXT[summary.status]}${summary.lastError ? ` ${summary.lastError}` : ''}`
                    : 'Sin conectar.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {connector ? (
                  keyReady ? (
                    <>
                      <div className="space-y-3">
                        <p className="text-sm font-medium">1. Datos de la aplicación de {store.channel.name}</p>
                        <details className="rounded-md border px-4 py-3 text-sm" open={!summary}>
                          <summary className="cursor-pointer font-medium">Cómo crear la aplicación</summary>
                          <ol className="mt-3 list-decimal space-y-1.5 pl-5">
                            {connector.setupSteps(back).map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <code className="break-all rounded bg-muted px-2 py-1 text-xs">{back}</code>
                            <CopyButton value={back} label="la dirección de vuelta" />
                          </div>
                        </details>
                        <AppCredentialsForm
                          accountSlug={account.slug}
                          storeId={store.id}
                          appId={summary?.appId ?? null}
                          secretHint={summary?.appSecretHint ?? null}
                        />
                      </div>
                      <div className="space-y-3">
                        <p className="text-sm font-medium">2. Autorizar con la cuenta de {store.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Abrí la sesión de {store.name} en {store.channel.name} y tocá Conectar. Si la tiene otra
                          persona, copiá el link y mandáselo.
                          {connected && summary?.expiresAt
                            ? ` La llave se renueva sola; la actual vence el ${formatDateTime(summary.expiresAt, account.timezone)}.`
                            : ''}
                        </p>
                        <ConnectButtons
                          accountSlug={account.slug}
                          storeId={store.id}
                          channelName={store.channel.name}
                          connected={connected}
                          ready={Boolean(summary)}
                        />
                      </div>
                    </>
                  ) : (
                    <KeySetup />
                  )
                ) : null}

                {getChannelResearch(store.channel.kind) ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">
                      {connector ? '3. ' : ''}Prueba de conexión
                      <span className="font-normal text-muted-foreground">
                        {lastAt ? ` · última, ${formatDateTime(lastAt, account.timezone)}` : ' · todavía no se probó'}
                      </span>
                    </p>
                    <ProbeButton
                      accountSlug={account.slug}
                      storeId={store.id}
                      label={last.length === 0 ? `Probar conexión con ${store.channel.name}` : 'Probar de nuevo'}
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
                              <p className="font-medium">{CHECK_LABEL[p.check] ?? p.check}</p>
                              <p className="text-muted-foreground">{p.detail}</p>
                              {ENABLES[p.check] ? <p className="text-xs text-muted-foreground">{ENABLES[p.check]}</p> : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </PageBody>
    </>
  );
}
