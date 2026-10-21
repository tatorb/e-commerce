import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, KanbanSquare, Package } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { ChannelStatusBadge, PipelineBadge } from '@/components/stages/StageBadge';
import { DraftBar, DraftField, FaceValue, ReadOneButton } from '@/components/publication/FaceControls';
import { CatalogCard } from '@/components/pipeline/info/CatalogCard';
import { FACE_FIELDS, FACE_FIELD_LABEL, isFaceField, SYNC_CHANGE_LABEL, type FaceField, type FaceValues } from '@/domain/channel-sync';
import { titleOrUntitled } from '@/domain/publication-title';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { formatDateTime, plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { loadPublicationFaces, type PublicationFaces } from '@/lib/queries/publication-faces';

export const dynamic = 'force-dynamic';
// Subir al canal hace varios pedidos y vuelve a leer la publicación.
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Publicación · ${account.name}` : 'Publicación' };
}

type State = PublicationFaces['states'][FaceField];

const STATE: Record<State, { label: string; variant: 'secondary' | 'destructive' | 'outline' }> = {
  same: { label: 'Igual en los dos lados', variant: 'outline' },
  draft: { label: 'Cambio sin subir', variant: 'secondary' },
  choose: { label: 'Para elegir', variant: 'destructive' },
  incoming: { label: 'Llegó un cambio', variant: 'outline' },
  unread: { label: 'Sin leer del canal', variant: 'outline' },
};

/** Un dato como texto: los datos de catálogo, uno por línea. */
function asText(values: FaceValues, field: FaceField): string {
  if (field === 'attributes') return values.attributes.map((a) => `${a.name}: ${a.value}`).join('\n');
  return values[field] ?? '';
}

const price = (n: unknown) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(n));

export default async function PublicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ cuenta: string; id: string }>;
  searchParams: Promise<{ cara?: string }>;
}) {
  const [{ cuenta, id }, { cara }] = await Promise.all([params, searchParams]);
  const { account } = await requireAccount(cuenta);
  const data = await loadPublicationFaces(account.id, id);
  if (!data) notFound();

  const { publication: p, channelName, app, channel, states, summary, copy } = data;
  const tz = account.timezone;
  const base = `/a/${account.slug}/publicaciones/${p.id}`;
  const pending = summary.draft.length + summary.choose.length;
  const face = cara === 'canal' || cara === 'borrador' ? cara : pending > 0 ? 'borrador' : 'canal';
  const title = titleOrUntitled(p.title);
  const pushable = summary.draft.filter((f) => data.publishable.includes(f));
  const photos = Array.isArray(copy?.photos) ? (copy.photos as string[]) : [];

  return (
    <>
      <PageHeader staticOnMobile className="max-w-5xl">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: account.name, href: `/a/${account.slug}/pipeline` },
              { label: 'Catálogo', href: `/a/${account.slug}/publicaciones` },
              { label: title },
            ]}
          />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">
                {p.externalId ?? 'Sin publicar'} · {p.store.name} · {p.product.name}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <ChannelStatusBadge status={p.channelStatus} />
                <PipelineBadge state={p} />
                {copy && !data.missing && pending === 0 ? <Badge variant="outline">Al día con {channelName}</Badge> : null}
                {summary.draft.length > 0 ? <Badge variant="secondary">Borrador</Badge> : null}
                {summary.choose.length > 0 ? <Badge variant="destructive">Para elegir</Badge> : null}
                {summary.rejected.length > 0 ? <Badge variant="destructive">Rechazada</Badge> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              {p.url ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    Ver en {channelName}
                  </a>
                </Button>
              ) : null}
              <Button size="sm" variant="outline" asChild>
                <Link href={`/a/${account.slug}/productos/${p.product.id}`}>
                  <Package />
                  Ficha del producto
                </Link>
              </Button>
              {p.pipelineStatus === 'IN_PIPELINE' ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/a/${account.slug}/pipeline/${p.id}`}>
                    <KanbanSquare />
                    Abrir su paso
                  </Link>
                </Button>
              ) : null}
              {data.canRead ? <ReadOneButton accountSlug={account.slug} publicationId={p.id} channelName={channelName} /> : null}
            </div>
          </div>
        </div>
      </PageHeader>

      <PageBody className="max-w-5xl">
        {/* Las dos caras de la publicación. */}
        <div className="inline-flex w-full rounded-lg border bg-muted/50 p-1 sm:w-auto" role="tablist" aria-label="Cara de la publicación">
          {(
            [
              ['canal', channelName, null],
              ['borrador', 'Borrador', pending],
            ] as const
          ).map(([key, label, count]) => (
            <Link
              key={key}
              href={`${base}?cara=${key}`}
              role="tab"
              aria-selected={face === key}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none',
                face === key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
              {count ? <span className="rounded-full bg-foreground px-1.5 text-[11px] tabular-nums text-background">{count}</span> : null}
            </Link>
          ))}
        </div>

        {face === 'borrador' ? (
          <>
            <div className="rounded-lg border bg-card px-4 py-3 text-sm">
              {data.missing ? (
                <p>
                  {channelName} no la devuelve: puede estar borrada o ser de otra cuenta. Los cambios quedan en la app.
                </p>
              ) : !copy ? (
                <p>
                  Todavía no se leyó de {channelName}, así que no se sabe qué cambió. {p.externalId ? 'Leela para comparar.' : 'Se compara cuando esté publicada.'}
                </p>
              ) : pending === 0 ? (
                <p>No hay cambios sin subir: lo que ves es lo mismo que está en {channelName}. Si cambiás algo acá, queda en el borrador hasta que lo subas.</p>
              ) : (
                <div className="space-y-3">
                  <p>
                    {summary.draft.length > 0 ? `${plural(summary.draft.length, 'dato cambió', 'datos cambiaron')} en la app y todavía no está en ${channelName}. ` : ''}
                    {summary.choose.length > 0 ? `${plural(summary.choose.length, 'dato cambió', 'datos cambiaron')} en los dos lados: elegí cuál queda.` : ''}
                  </p>
                  {summary.draft.length > 0 ? (
                    <DraftBar
                      accountSlug={account.slug}
                      publicationId={p.id}
                      channelName={channelName}
                      canPush={!data.pushBlocked && pushable.length > 0}
                      canDiscard
                    />
                  ) : null}
                </div>
              )}
            </div>

            {FACE_FIELDS.map((field) => {
              const state = states[field];
              const editable =
                field === 'attributes' && !data.catalog
                  ? `${channelName} todavía no tiene datos de catálogo en la app.`
                  : field === 'title' && data.titleLock.locked && p.title?.trim()
                    ? 'El título está bloqueado porque la publicación tiene ventas: se decide en el paso Título.'
                    : (true as const);
              return (
                <SectionCard
                  key={field}
                  title={FACE_FIELD_LABEL[field]}
                  action={state === 'same' && !copy ? null : <Badge variant={STATE[state].variant}>{STATE[state].label}</Badge>}
                >
                  <SectionBody>
                    {field === 'attributes' && data.categoryMismatch ? (
                      <p className="text-sm text-muted-foreground">
                        En la app la categoría es {data.categoryMismatch.app} y en {channelName} es {data.categoryMismatch.channel}. Los datos se
                        suben a los campos de la categoría de {channelName}.
                      </p>
                    ) : null}
                    <DraftField
                      accountSlug={account.slug}
                      publicationId={p.id}
                      field={field}
                      state={state}
                      value={asText(app, field)}
                      channelValue={channel ? asText(channel, field) : null}
                      channelName={channelName}
                      editable={editable}
                      pushBlocked={data.pushBlocked}
                      rejection={summary.rejected.find((r) => r.field === field)?.message ?? null}
                      editor={
                        field === 'attributes' && data.catalog ? (
                          <CatalogCard accountSlug={account.slug} publicationId={p.id} data={data.catalog} bare />
                        ) : undefined
                      }
                      diff={field === 'attributes' ? data.attributeDiff : null}
                    />
                  </SectionBody>
                </SectionCard>
              );
            })}
          </>
        ) : !copy ? (
          <SectionCard title={`En ${channelName}`}>
            <SectionBody>
              <p className="text-sm text-muted-foreground">
                {p.externalId
                  ? `Todavía no se leyó de ${channelName}. Se lee sola cada hora, o ahora con el botón Leer de ${channelName}.`
                  : `Todavía no está publicada en ${channelName}.`}
              </p>
            </SectionBody>
          </SectionCard>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Así está en {channelName}, según la lectura del {formatDateTime(copy.readAt, tz)}.
              {data.missing ? ` En la última lectura ${channelName} no la devolvió.` : ''}
            </p>
            {FACE_FIELDS.map((field) => (
              <SectionCard key={field} title={FACE_FIELD_LABEL[field]}>
                <SectionBody>
                  <FaceValue field={field} value={channel ? asText(channel, field) : ''} />
                </SectionBody>
              </SectionCard>
            ))}
            <SectionCard title="Lo demás">
              <SectionBody>
                <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[10rem_1fr]">
                  <dt className="text-muted-foreground">Precio</dt>
                  <dd>{price(copy.price)}</dd>
                  <dt className="text-muted-foreground">Estado</dt>
                  <dd>
                    <ChannelStatusBadge status={copy.status} />
                  </dd>
                  <dt className="text-muted-foreground">Video</dt>
                  <dd>{copy.hasVideo ? 'Sí' : 'No'}</dd>
                  <dt className="text-muted-foreground">Fotos</dt>
                  <dd>{photos.length}</dd>
                </dl>
                {photos.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {photos.slice(0, 12).map((src) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={src} src={src} alt="" loading="lazy" className="h-20 w-20 rounded-md border bg-white object-contain" />
                    ))}
                  </div>
                ) : null}
              </SectionBody>
            </SectionCard>
          </>
        )}

        <SectionCard title="Historial con el canal" description="Lo que llegó del canal, lo que se subió y lo que se eligió, lo más nuevo primero.">
          {p.syncChanges.length > 0 ? (
            <ul className="divide-y text-sm">
              {p.syncChanges.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2.5">
                  <span className="tabular-nums text-xs text-muted-foreground">{formatDateTime(c.createdAt, tz)}</span>
                  <span className="font-medium">{isFaceField(c.field) ? FACE_FIELD_LABEL[c.field] : c.field}</span>
                  <span className="text-muted-foreground">
                    {SYNC_CHANGE_LABEL[c.kind]}
                    {c.user ? `, ${c.user.name}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <SectionBody>
              <p className="text-sm text-muted-foreground">Todavía no hay nada.</p>
            </SectionBody>
          )}
        </SectionCard>
      </PageBody>
    </>
  );
}
