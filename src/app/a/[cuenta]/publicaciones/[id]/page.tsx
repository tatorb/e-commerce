import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ExternalLink, KanbanSquare, Package } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { EntityLabel } from '@/components/navigation/EntityLabel';
import { PublicationHistoryPanel } from '@/components/publication/PublicationHistoryPanel';
import { channelInfo } from '@/channels';
import { codeOrUnpublished } from '@/domain/channel-status';
import { isAiConfigured } from '@/ai/claude';
import { getProduct } from '@/lib/queries/products';
import { loadRulesByChannel } from '@/lib/queries/scoring';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { ChannelStatusBadge, PipelineBadge } from '@/components/stages/StageBadge';
import { DraftBar, DraftField, FaceValue, ReadOneButton } from '@/components/publication/FaceControls';
import { CatalogCard } from '@/components/pipeline/info/CatalogCard';
import { MediaOrganizer, PhotoStrip } from '@/components/publication/MediaOrganizer';
import { prisma } from '@/lib/db';
import { loadMediaSources } from '@/lib/media';
import { createChecks } from '@/lib/channel-create';
import { CreateInChannelCard } from '@/components/publication/CreateInChannelCard';
import { ChannelStatusCard } from '@/components/publication/ChannelStatusCard';
import { relistInfo } from '@/lib/channel-status';
import { FACE_FIELDS, FACE_FIELD_LABEL, priceFaceText, SYNC_CHANGE_LABEL, type FaceField, type FaceValues } from '@/domain/channel-sync';
import { quantityText, type QuantityLine } from '@/domain/quantities';
import { QuantityEditor } from '@/components/publication/QuantityEditor';
import { RichTextView } from '@/components/ui/rich-text-view';
import { KnowledgeParts } from '@/components/products/KnowledgeParts';
import { loadKnowledge } from '@/lib/queries/research';
import { QaPanel } from '@/components/pipeline/qa/QaPanel';
import { loadQaStep } from '@/lib/publication-qa';
import { titleOrUntitled } from '@/domain/publication-title';
import { fieldLabel } from '@/domain/sync-log';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { formatDateTime, plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { loadPublicationFaces, type PublicationFaces } from '@/lib/queries/publication-faces';

export const dynamic = 'force-dynamic';
// Subir al canal hace varios pedidos y vuelve a leer la publicación, y generar
// una propuesta con IA puede tardar más de un minuto.
export const maxDuration = 300;

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

/** Si la cantidad se puede cambiar acá, o por qué no. */
function quantityReason(externalId: string | null, stockInChannel: boolean, lines: QuantityLine[] | null, channelName: string): true | string {
  if (!externalId) return `La cantidad se carga al crear la publicación en ${channelName}.`;
  if (stockInChannel) return `El stock lo maneja ${channelName}, por ejemplo porque está en Full: no se cambia desde la app.`;
  if (!lines) return `Todavía no se leyó la cantidad de ${channelName}.`;
  return true;
}

/** Un dato como texto: los datos de catálogo, uno por línea. */
function asText(values: FaceValues, field: FaceField): string {
  if (field === 'attributes') return values.attributes.map((a) => `${a.name}: ${a.value}`).join('\n');
  if (field === 'photos') return '';
  if (field === 'price' || field === 'installments' || field === 'discount') return priceFaceText(field, values[field]);
  if (field === 'quantity') return quantityText(values.quantity);
  return values[field] ?? '';
}

export default async function PublicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ cuenta: string; id: string }>;
  searchParams: Promise<{ cara?: string }>;
}) {
  const [{ cuenta, id }, { cara }] = await Promise.all([params, searchParams]);
  const { account } = await requireAccount(cuenta, 'publicaciones');
  const [data, media] = await Promise.all([loadPublicationFaces(account.id, id), loadMediaSources(prisma, account.id, id).catch(() => null)]);
  // Sin publicar: lo que hace falta para crearla en el canal.
  const create = data && !data.publication.externalId ? await createChecks(prisma, { accountId: account.id, publicationId: id }) : null;
  // Finalizada: lo que hace falta para republicarla.
  const relist = data?.publication.channelStatus === 'CLOSED' ? await relistInfo(prisma, { accountId: account.id, publicationId: id }) : null;
  if (!data) notFound();

  const { publication: p, channelName, app, channel, states, summary, copy } = data;
  const tz = account.timezone;
  const base = `/a/${account.slug}/publicaciones/${p.id}`;
  const pending = summary.draft.length + summary.choose.length;
  const face = cara === 'canal' || cara === 'borrador' || cara === 'historial' ? cara : pending > 0 || !p.externalId ? 'borrador' : 'canal';
  const title = titleOrUntitled(p.title);
  const channelOf = channelInfo(p.store.channel.kind, p.store.channel.name);
  const productHref = `/a/${account.slug}/productos/${p.product.id}`;
  // Las otras publicaciones del mismo producto, para pasar de una a otra.
  const [others, history, knowledge, qa] = await Promise.all([
    prisma.publication.findMany({
      where: { productId: p.product.id, id: { not: p.id } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, externalId: true, store: { select: { name: true } } },
    }),
    // El puntaje y el historial: solo en su pestaña.
    face === 'historial'
      ? Promise.all([getProduct(account.id, p.product.id), loadRulesByChannel(account.id)]).then(([product, rules]) => {
          const pub = product?.publications.find((x) => x.id === p.id);
          return product && pub ? { product, pub, rules: rules.get(pub.store.channelId) ?? [] } : null;
        })
      : Promise.resolve(null),
    // Lo que sabe la tienda: es del producto y la publicación lo hereda.
    loadKnowledge(prisma, p.product.id),
    // Preguntas y respuestas: es de la publicación.
    face !== 'historial' ? loadQaStep(prisma, { accountId: account.id, publicationId: p.id }) : Promise.resolve(null),
  ]);
  const pushable = summary.draft.filter((f) => data.publishable.includes(f));

  return (
    <>
      <PageHeader staticOnMobile className="max-w-5xl">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: account.name, href: `/a/${account.slug}/pipeline` },
              { label: 'Productos', href: `/a/${account.slug}/productos` },
              { label: p.product.name, href: productHref },
              { label: title },
            ]}
          />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <EntityLabel kind="publication" channelName={channelName} accent={channelOf.accent} />
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
              <p className="text-sm text-muted-foreground">
                {p.store.name} · {codeOrUnpublished(p.externalId)}
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
        {/* De qué producto es, y sus otras publicaciones. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <Link href={productHref} className="inline-flex min-w-0 items-center gap-1.5 hover:underline">
            <Package className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">Producto</span>
            <span className="truncate font-medium">{p.product.name}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </Link>
          {others.length > 0 ? (
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-muted-foreground">{others.length === 1 ? 'Otra publicación:' : 'Otras publicaciones:'}</span>
              {others.slice(0, 3).map((o) => (
                <Link
                  key={o.id}
                  href={`/a/${account.slug}/publicaciones/${o.id}`}
                  title={`${titleOrUntitled(o.title)} · ${o.store.name}`}
                  className="inline-flex min-w-0 max-w-full items-center gap-1 underline-offset-4 hover:underline"
                >
                  <span className="truncate sm:max-w-[16rem]">{titleOrUntitled(o.title)}</span>
                  <span className="shrink-0 text-muted-foreground">· {codeOrUnpublished(o.externalId)}</span>
                </Link>
              ))}
              {others.length > 3 ? (
                <Link href={`${productHref}?seccion=publicaciones`} className="text-muted-foreground underline-offset-4 hover:underline">
                  y {others.length - 3} más
                </Link>
              ) : null}
            </span>
          ) : null}
        </div>
      </PageHeader>

      <PageBody className="max-w-5xl">
        {p.externalId ? (
          <ChannelStatusCard accountSlug={account.slug} publicationId={p.id} status={p.channelStatus} channelName={channelName} relist={relist} />
        ) : null}

        {/* Las dos caras de la publicación, y su puntaje e historial. */}
        <div className="inline-flex w-full rounded-lg border bg-muted/50 p-1 sm:w-auto" role="tablist" aria-label="Cara de la publicación">
          {(
            [
              ['canal', channelName, null],
              ['borrador', 'Borrador', pending],
              ['historial', 'Puntaje e historial', null],
            ] as const
          ).map(([key, label, count]) => (
            <Link
              key={key}
              href={`${base}?cara=${key}`}
              role="tab"
              aria-selected={face === key}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors sm:flex-none sm:px-4',
                face === key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
              {count ? <span className="rounded-full bg-foreground px-1.5 text-[11px] tabular-nums text-background">{count}</span> : null}
            </Link>
          ))}
        </div>

        {face === 'historial' ? (
          history ? (
            <PublicationHistoryPanel
              accountSlug={account.slug}
              timeZone={tz}
              product={history.product}
              pub={history.pub}
              rules={history.rules}
              aiReady={isAiConfigured()}
              connected={p.store.connection?.status === 'ACTIVE'}
            />
          ) : null
        ) : face === 'borrador' ? (
          <>
            {create ? <CreateInChannelCard accountSlug={account.slug} publicationId={p.id} info={create} /> : null}
            {p.externalId ? (
              <div className="rounded-lg border bg-card px-4 py-3 text-sm">
                {data.missing ? (
                  <p>
                    {channelName} no la devuelve: puede estar borrada o ser de otra cuenta. Los cambios quedan en la app.
                  </p>
                ) : !copy ? (
                  <p>
                    Todavía no se leyó de {channelName}, así que no se sabe qué cambió. Leela para comparar.
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
            ) : null}

            {FACE_FIELDS.map((field) => {
              const state = states[field];
              // La cantidad que no se cambió en la app es la del canal.
              const quantities = app.quantity ?? channel?.quantity ?? null;
              const editable =
                field === 'attributes' && !data.catalog
                  ? `${channelName} todavía no tiene datos de catálogo en la app.`
                  : field === 'title' && data.titleLock.locked && p.title?.trim()
                    ? 'El título está bloqueado porque la publicación tiene ventas: se decide en el paso Título.'
                    : field === 'price'
                      ? 'El precio se decide en el paso Precio.'
                      : field === 'installments'
                        ? 'Las cuotas se deciden en el paso Precio.'
                        : field === 'discount'
                          ? 'El descuento se decide en el paso Precio.'
                          : field === 'quantity'
                            ? quantityReason(p.externalId, copy?.stockInChannel ?? false, quantities, channelName)
                            : (true as const);
              return (
                <SectionCard
                  key={field}
                  title={FACE_FIELD_LABEL[field]}
                  action={state === 'unread' && !p.externalId ? null : <Badge variant={STATE[state].variant}>{STATE[state].label}</Badge>}
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
                      value={field === 'quantity' ? quantityText(quantities) : asText(app, field)}
                      channelValue={channel ? asText(channel, field) : null}
                      channelName={channelName}
                      editable={editable}
                      pushBlocked={data.pushBlocked}
                      rejection={summary.rejected.find((r) => r.field === field)?.message ?? null}
                      editor={
                        field === 'attributes' && data.catalog ? (
                          <CatalogCard accountSlug={account.slug} publicationId={p.id} data={data.catalog} bare />
                        ) : field === 'photos' && media ? (
                          <MediaOrganizer accountSlug={account.slug} publicationId={p.id} sources={media} />
                        ) : field === 'quantity' && quantities ? (
                          <QuantityEditor
                            accountSlug={account.slug}
                            publicationId={p.id}
                            lines={quantities}
                            channelLines={channel?.quantity ?? null}
                            channelName={channelName}
                          />
                        ) : undefined
                      }
                      diff={field === 'attributes' ? data.attributeDiff : null}
                      display={field === 'photos' && media ? <PhotoStrip items={media.current} /> : undefined}
                      channelDisplay={field === 'photos' && media ? <PhotoStrip items={media.available.channel} /> : undefined}
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
                  {field === 'photos' ? (
                    <PhotoStrip items={media?.available.channel ?? []} />
                  ) : (
                    <FaceValue field={field} value={channel ? asText(channel, field) : ''} />
                  )}
                </SectionBody>
              </SectionCard>
            ))}
            <SectionCard title="Lo demás">
              <SectionBody>
                <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[10rem_1fr]">
                  <dt className="text-muted-foreground">Estado</dt>
                  <dd>
                    <ChannelStatusBadge status={copy.status} />
                  </dd>
                  <dt className="text-muted-foreground">Video</dt>
                  <dd>{copy.hasVideo ? 'Sí' : 'No'}</dd>
                </dl>
              </SectionBody>
            </SectionCard>
          </>
        )}

        {face !== 'historial' ? (
          <>
        <SectionCard
          title="Lo que sabe la tienda"
          description={`Es del producto${others.length > 0 ? ` y lo comparten sus ${others.length + 1} publicaciones` : ''}. Lo usan las respuestas a los compradores y la descripción.`}
          action={
            <Link href={`${productHref}?seccion=investigacion`} className="text-xs font-medium underline-offset-4 hover:underline">
              Editar en Investigación
            </Link>
          }
        >
          <SectionBody>
            <RichTextView html={knowledge.own} empty="Todavía no se cargó nada." />
            <KnowledgeParts accountSlug={account.slug} parts={knowledge.parts} />
          </SectionBody>
        </SectionCard>

        {qa ? (
          <QaPanel
            variant="publication"
            accountSlug={account.slug}
            publicationId={p.id}
            data={qa}
            aiReady={isAiConfigured()}
            timeZone={tz}
            knowledgeHref={`${productHref}?seccion=investigacion`}
            stepHref={`/a/${account.slug}/pipeline/${p.id}?paso=preguntas`}
          />
        ) : null}

        <SectionCard
          title="Preguntas de los compradores"
          count={p._count.buyerQuestions}
          description={`Las que llegaron de ${channelName}, lo más nuevo primero.`}
          action={
            p._count.buyerQuestions > 0 ? (
              <Link href={`/a/${account.slug}/preguntas?publicacion=${p.id}`} className="text-xs font-medium underline-offset-4 hover:underline">
                Ver todas
              </Link>
            ) : null
          }
        >
          {p.buyerQuestions.length > 0 ? (
            <ul className="divide-y text-sm">
              {p.buyerQuestions.map((q) => (
                <li key={q.id} className="space-y-1 px-4 py-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="tabular-nums text-xs text-muted-foreground">{formatDateTime(q.askedAt, tz)}</span>
                    {q.status === 'UNANSWERED' ? <Badge variant="alert">Sin responder</Badge> : null}
                  </div>
                  <p className="whitespace-pre-line break-words font-medium">{q.text || 'El canal ocultó el texto de esta pregunta.'}</p>
                  {q.answer ? <p className="whitespace-pre-line break-words text-muted-foreground">{q.answer}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <SectionBody>
              <p className="text-sm text-muted-foreground">Todavía no llegó ninguna pregunta.</p>
            </SectionBody>
          )}
        </SectionCard>

          </>
        ) : null}

        {face === 'historial' ? (
          <>
        <SectionCard
          title="Historial con el canal"
          description="Lo que llegó del canal, lo que se subió y lo que se eligió, lo más nuevo primero."
          action={
            p.syncChanges.length > 0 ? (
              <Link href={`/a/${account.slug}/registro?publicacion=${p.id}`} className="text-xs font-medium underline-offset-4 hover:underline">
                Ver con el antes y el después
              </Link>
            ) : null
          }
        >
          {p.syncChanges.length > 0 ? (
            <ul className="divide-y text-sm">
              {p.syncChanges.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2.5">
                  <span className="tabular-nums text-xs text-muted-foreground">{formatDateTime(c.createdAt, tz)}</span>
                  <span className="font-medium">{fieldLabel(c.field)}</span>
                  <span className="text-muted-foreground">
                    {SYNC_CHANGE_LABEL[c.kind]}
                    {c.user ? `, ${c.user.name}` : ''}
                  </span>
                  {c.message ? <span className="basis-full text-xs text-muted-foreground">{c.message}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <SectionBody>
              <p className="text-sm text-muted-foreground">Todavía no hay nada.</p>
            </SectionBody>
          )}
        </SectionCard>
          </>
        ) : null}
      </PageBody>
    </>
  );
}
