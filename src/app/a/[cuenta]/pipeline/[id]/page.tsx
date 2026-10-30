import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppWindow, ExternalLink, Lock, Package, Tag } from 'lucide-react';
import { EntityHero } from '@/components/navigation/EntityHero';
import { HeroMenu } from '@/components/navigation/HeroMenu';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { EntityLabel } from '@/components/navigation/EntityLabel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PipelineBadge } from '@/components/stages/StageBadge';
import { ScoreBadge } from '@/components/stages/ScoreBadge';
import { KindBadge } from '@/components/products/KindBadge';
import { loadCombo } from '@/lib/queries/combos';
import { StepLine } from '@/components/pipeline/StepLine';
import { JumpHereButton, StepActions } from '@/components/pipeline/StepActions';
import { PublicationFactsRow } from '@/components/publication/PublicationFactsRow';
import { FamilyPublishCard, type FamilyPublishRow } from '@/components/families/FamilyPublishCard';
import { listScoredPublications } from '@/lib/queries/scoring';
import { familyLeadId, familyOf } from '@/lib/families';
import { familyMeasuresText, loadPublicationFacts } from '@/lib/publication-facts';
import { firstPhoto, productCovers } from '@/lib/queries/products';
import { PipelineHistory } from '@/components/pipeline/PipelineHistory';
import { AddToPipelineButton } from '@/components/pipeline/AddToPipelineButton';
import { PublicationCodeCard } from '@/components/pipeline/PublicationCodeCard';
import { PendingChangesCard } from '@/components/publication/PendingChangesCard';
import { campaignText, pendingCampaigns } from '@/lib/channel-campaigns';
import { MediaOrganizer } from '@/components/publication/MediaOrganizer';
import { loadMediaSources } from '@/lib/media';
import { loadFamilyMedia } from '@/lib/family-media';
import { CreateInChannelCard } from '@/components/publication/CreateInChannelCard';
import { createChecks } from '@/lib/channel-create';
import { loadPublicationFaces } from '@/lib/queries/publication-faces';
import { channelInfo, getChannelAdapter } from '@/channels';
import { CHANNEL_STATUS_LABEL, codeOrUnpublished } from '@/domain/channel-status';
import { PIPELINE_REMOVAL_LABEL, PIPELINE_STEP_LABEL, PIPELINE_STEP_SLUG, stepFromSlug } from '@/domain/pipeline';
import { titleLockText } from '@/domain/title-lock';
import type { PipelineStep } from '@/generated/prisma/enums';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { getPipelinePublication } from '@/lib/queries/pipeline';
import { loadTitleContext } from '@/lib/queries/title-step';
import { loadResearch } from '@/lib/queries/research';
import { loadCatalogData } from '@/lib/catalog-data';
import { autoAvailable } from '@/lib/research';
import { prisma } from '@/lib/db';
import { AI_NOT_CONFIGURED, isAiConfigured } from '@/ai/claude';
import { InfoStep } from '@/components/pipeline/info/InfoStep';
import { TitleStep } from '@/components/pipeline/title/TitleStep';
import { ImagesStep } from '@/components/pipeline/images/ImagesStep';
import { openPhotoIds } from '@/components/pipeline/images/open-photos';
import { countChannelPhotos, loadPhotoLine } from '@/lib/photos';
import { workerState } from '@/lib/image-worker';
import { formatDateTime, formatDuration, plural } from '@/lib/format';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { titleOrUntitled } from '@/domain/publication-title';
import { VideosStep } from '@/components/pipeline/videos/VideosStep';
import { loadVideosStep } from '@/lib/videos';
import { driveEmail, folderUrl, knownFolderId } from '@/lib/drive';
import { DescriptionStep } from '@/components/pipeline/description/DescriptionStep';
import { loadDescriptionStep } from '@/lib/descriptions';
import { QaPanel } from '@/components/pipeline/qa/QaPanel';
import { loadQaStep } from '@/lib/publication-qa';
import { PriceStep } from '@/components/pipeline/price/PriceStep';
import { campaignMarginFor, latestPriceDecision, loadPriceStep, productPricing } from '@/lib/pricing';
import { PriceDecisionCard, type PendingCampaignRow } from '@/components/pipeline/price/PriceDecisionCard';
import { PublicationPromotions } from '@/components/publication/PublicationPromotions';
import { marginOf } from '@/domain/pricing';
import { QuantityCard } from '@/components/pipeline/QuantityCard';
import { StockFollowCard } from '@/components/publication/StockFollowCard';
import { todayIn } from '@/domain/applications';
import { PublicationTasksCard } from '@/components/tasks/PublicationTasksCard';
import { assignablePeople, tasksOfPublication } from '@/lib/tasks';
import { plansFor } from '@/lib/stock-plan';
import { can } from '@/domain/access';

export const dynamic = 'force-dynamic';
// Leer el buscador letra por letra o pedir títulos a la IA puede tardar.
export const maxDuration = 300;

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string; id: string }> }) {
  const { cuenta, id } = await params;
  const account = await accountForTitle(cuenta);
  const pub = account ? await getPipelinePublication(account.id, id) : null;
  return { title: pub ? `${titleOrUntitled(pub.title)} · Pipeline` : 'Pipeline' };
}

// Los pasos que todavía no tienen contenido.
function StepContent({ step, atCurrent }: { step: PipelineStep; atCurrent: boolean }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold">{PIPELINE_STEP_LABEL[step]}</h2>
      <p className="text-sm text-muted-foreground">
        Este paso todavía no tiene contenido.{atCurrent ? ' Por ahora podés avanzar al siguiente.' : ''}
      </p>
    </div>
  );
}

export default async function PipelineStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ cuenta: string; id: string }>;
  searchParams: Promise<{ paso?: string | string[]; foto?: string | string[]; fotos?: string | string[] }>;
}) {
  const { cuenta, id } = await params;
  const { paso, foto, fotos } = await searchParams;
  const { user, account } = await requireAccount(cuenta, 'pipeline');
  // Una familia se trabaja desde su principal: las demás medidas llevan ahí.
  const leadId = await familyLeadId(prisma, id);
  if (leadId !== id) {
    const step = typeof paso === 'string' ? paso : null;
    redirect(`/a/${account.slug}/pipeline/${leadId}${step ? `?paso=${encodeURIComponent(step)}` : ''}`);
  }
  const pub = await getPipelinePublication(account.id, id);
  if (!pub) notFound();

  const boardHref = `/a/${account.slug}/pipeline`;
  const inPipeline = pub.pipelineStatus === 'IN_PIPELINE' && pub.pipelineStep !== null;
  const current = inPipeline ? pub.pipelineStep : null;
  // Se puede mirar cualquier paso, esté donde esté la publicación: el que
  // pide la dirección o, si no pide ninguno, el actual.
  const viewing = stepFromSlug(paso) ?? current;
  const atCurrent = current !== null && viewing === current;
  const pageHref = `/a/${account.slug}/pipeline/${pub.id}`;
  const viewHref = viewing ? `${pageHref}?paso=${PIPELINE_STEP_SLUG[viewing]}` : pageHref;
  const open = pub.movements.find((m) => m.exitedAt === null) ?? null;
  const lock = pub.titleLock.locked ? titleLockText(pub.titleLock) : null;
  // Lo que usa el paso que se mira, pedido todo junto: con la base lejos, cada
  // consulta en fila suma una ida y vuelta.
  const canTask = can(user.access, 'tareas', 'write');
  const [ctx, info, images, channel, faces, media, create, videos, description, qa, price, decision, tasks, people, stockPlans, factsOf, family, cover] = await Promise.all([
    // Información y Título usan la ficha, la competencia y lo leído del buscador.
    viewing === 'INFO' || viewing === 'TITLE' ? loadTitleContext(prisma, account.id, pub.id) : null,
    viewing === 'INFO'
      ? Promise.all([
          loadResearch(prisma, pub.productId),
          loadCatalogData(prisma, pub.id),
          loadCombo(prisma, pub.productId),
          driveEmail(prisma),
          productPricing(prisma, account.id, pub.productId),
        ])
      : null,
    viewing === 'IMAGES'
      ? Promise.all([
          loadPhotoLine(prisma, pub.productId),
          workerState(prisma),
          countChannelPhotos(prisma, pub.productId),
          prisma.publication.count({ where: { productId: pub.productId } }),
          driveEmail(prisma).then(async (email) => ({
            ready: email !== null,
            folderUrl: email ? await knownFolderId(prisma, `fotos:${pub.productId}`, email).then((id) => (id ? folderUrl(id) : null)) : null,
          })),
          // Lo que acepta el canal tal como viene, para las fotos que se usan tal cual.
          prisma.publication
            .findUniqueOrThrow({ where: { id: pub.id }, select: { store: { select: { channel: true } } } })
            .then((p) => getChannelAdapter(p.store.channel.kind, p.store.channel.name).photos),
        ])
      : null,
    // Publicación carga el ID del canal, con el formato de cada canal, y lo que falta subir.
    viewing === 'PUBLISH'
      ? prisma.publication
          .findUniqueOrThrow({ where: { id: pub.id }, select: { store: { select: { channel: true } } } })
          .then((p) => p.store.channel)
      : null,
    viewing === 'PUBLISH' ? loadPublicationFaces(account.id, pub.id) : null,
    // Una familia ordena las fotos de todas sus medidas juntas, una ventana por medida.
    viewing === 'MEDIA' ? loadFamilyMedia(prisma, account.id, pub.id).then((f) => f ?? loadMediaSources(prisma, account.id, pub.id)) : null,
    // Sin publicar, o una familia con medidas sin publicar: lo que hace falta para crearlas en el canal.
    viewing === 'PUBLISH'
      ? createChecks(prisma, { accountId: account.id, publicationId: pub.id }).then((c) => (pub.externalId && c.measures.length === 0 ? null : c))
      : null,
    viewing === 'VIDEOS' ? loadVideosStep(prisma, { accountId: account.id, publicationId: pub.id }) : null,
    viewing === 'DESCRIPTION' ? loadDescriptionStep(prisma, { accountId: account.id, publicationId: pub.id }) : null,
    viewing === 'QA' ? loadQaStep(prisma, { accountId: account.id, publicationId: pub.id }) : null,
    // Precio usa el costo, los parámetros y la competencia; Información, el envío; Publicación, el precio decidido
    // y, para Promociones, las que comparten el precio y el margen de las campañas.
    viewing === 'PRICE' || (viewing === 'PUBLISH' && pub.externalId) ? loadPriceStep(prisma, account.id, pub.id).catch(() => null) : null,
    viewing === 'PUBLISH' ? latestPriceDecision(prisma, pub.id) : null,
    // Las tareas de la publicación, en todos los pasos.
    tasksOfPublication(prisma, { publicationId: pub.id, viewer: user, timeZone: account.timezone }),
    canTask ? assignablePeople(prisma, account.id) : [],
    viewing === 'PUBLISH' || viewing === 'INFO' ? plansFor(prisma, [pub.id]) : null,
    // El código, las medidas y la respuesta automática, para el encabezado.
    loadPublicationFacts(prisma, [pub.id]),
    // Las medidas de su familia, que se trabajan juntas.
    familyOf(prisma, pub.id),
    // La foto de la ficha de arriba: la primera en el canal o, si no tiene, la del producto.
    Promise.all([
      prisma.channelCopy.findUnique({ where: { publicationId: pub.id }, select: { photos: true } }),
      productCovers([pub.productId]),
    ]).then(([copy, covers]) => firstPhoto(copy?.photos) ?? covers.get(pub.productId) ?? null),
  ]);
  // Sumarse a una campaña o salir, pedido en Promociones: se sube con los demás cambios.
  const pendingCampaignTexts =
    viewing === 'PUBLISH' ? (await pendingCampaigns(prisma, [pub.id])).map((c) => ({ text: campaignText(c), rejection: c.rejection })) : [];
  // En la tarjeta Precio: las campañas pedidas de las que comparten el precio, con el margen si se suma con ese precio.
  const { group: priceGroup, margin: campaignMargin } = campaignMarginFor(viewing === 'PUBLISH' ? price : null, pub.id);
  const priceCampaigns: PendingCampaignRow[] =
    viewing === 'PUBLISH'
      ? await (async () => {
          const ids = priceGroup?.publicationIds ?? [pub.id];
          const [list, codes] = await Promise.all([
            pendingCampaigns(prisma, ids),
            ids.length > 1 ? prisma.publication.findMany({ where: { id: { in: ids } }, select: { id: true, externalId: true } }) : [],
          ]);
          const codeOf = new Map(codes.map((c) => [c.id, c.externalId]));
          return list.map((c) => ({
            id: c.id,
            action: c.action,
            name: c.name,
            kind: c.kind,
            price: c.price,
            rejection: c.rejection,
            code: codeOf.get(c.publicationId) ?? null,
            marginPct:
              c.action === 'join' && c.price !== null && campaignMargin?.cost ? marginOf(c.price, campaignMargin.cost, campaignMargin.params, campaignMargin.plan) : null,
          }));
        })()
      : [];
  const facts = factsOf.get(pub.id) ?? null;
  const auto = ctx && viewing === 'TITLE' ? await autoAvailable(prisma, ctx.channel, ctx.storeId) : null;
  // En Publicación, cada medida de la familia con su código, su estado y sus cambios sin subir.
  const familyRows: FamilyPublishRow[] | null =
    family && viewing === 'PUBLISH'
      ? (await listScoredPublications(account.id, { familyId: family.id }, prisma))
          .map((r) => ({
            id: r.id,
            measure: family.members.find((m) => m.id === r.id)?.measure ?? null,
            externalId: r.externalId,
            url: r.url,
            channelStatus: r.channelStatus,
            draft: r.sync.draft,
            choose: r.sync.choose,
            quantity: r.quantity.channel,
          }))
          .sort((a, b) => family.members.findIndex((m) => m.id === a.id) - family.members.findIndex((m) => m.id === b.id))
      : null;

  return (
    <>
      <PageHeader staticOnMobile>
        <div className="space-y-3">
          <Breadcrumb items={[{ label: account.name, href: boardHref }, { label: 'Pipeline', href: boardHref }, { label: titleOrUntitled(pub.title) }]} />
          <EntityHero
            photo={{ src: cover, alt: titleOrUntitled(pub.title) }}
            label={<EntityLabel kind="publication" channelName={pub.channelName} accent={pub.channelAccent} />}
            // Cómo está: pipeline, puntaje, código, estado, medidas y respuesta automática.
            badges={
              <>
                <PipelineBadge state={pub} />
                <ScoreBadge score={pub.score} />
                <KindBadge kind={pub.kind} />
                {facts ? (
                  <PublicationFactsRow
                    facts={facts}
                    hideMeasures={!family && facts.measures.kind === 'none'}
                    measuresLabel={family ? familyMeasuresText(family.members) : undefined}
                    className="contents"
                  />
                ) : null}
              </>
            }
            title={
              <span className="flex items-start gap-2">
                <span className={pub.title ? undefined : 'text-muted-foreground'}>{titleOrUntitled(pub.title)}</span>
                {lock ? (
                  <span title={lock} aria-label={lock} className="mt-1 shrink-0 text-amber-700">
                    <Lock className="h-4 w-4" />
                  </span>
                ) : null}
              </span>
            }
            meta={`${codeOrUnpublished(pub.externalId)} · ${pub.sales === null ? 'Ventas sin dato' : `${plural(pub.sales, 'venta')} en 90 días`}`}
            menu={
              <HeroMenu
                label="Links de la publicación"
                groups={[
                  {
                    items: [
                      { href: `/a/${account.slug}/productos/${pub.productId}`, label: 'Producto', icon: <Package /> },
                      // En una familia, cada medida con su link, abajo.
                      ...(pub.url && !family ? [{ href: pub.url, label: `Ver en ${pub.channelName}`, icon: <ExternalLink />, external: true }] : []),
                      ...(can(user.access, 'publicaciones', 'read')
                        ? [{ href: `/a/${account.slug}/publicaciones/${pub.id}`, label: 'Fuera del pipeline', icon: <Tag /> }]
                        : []),
                      { href: viewHref, label: 'Otra pestaña', icon: <AppWindow />, external: true },
                    ],
                  },
                  {
                    title: `Ver cada medida en ${pub.channelName}`,
                    items: (family?.members ?? []).map((m) => ({
                      href: m.url,
                      label: m.measure ?? 'Medida sin elegir',
                      icon: <ExternalLink />,
                      external: true,
                      note: `${m.externalId ?? 'Sin publicar'}${m.channelStatus !== 'ACTIVE' ? ` · ${CHANNEL_STATUS_LABEL[m.channelStatus]}` : ''}`,
                    })),
                  },
                ]}
              />
            }
          />
        </div>
        <StepLine
          current={pub.pipelineStep}
          active={inPipeline}
          visited={pub.movements.map((m) => m.step)}
          viewing={viewing}
          baseHref={pageHref}
        />
      </PageHeader>
      <PageBody>
        {!inPipeline ? (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
              <p className="text-sm">
                {pub.pipelineStatus === 'CORRECTED'
                  ? 'Esta publicación ya está corregida.'
                  : pub.pipelineStatus === 'DISCARDED'
                    ? `Se sacó del pipeline${pub.pipelineRemoval ? ` por «${PIPELINE_REMOVAL_LABEL[pub.pipelineRemoval].toLowerCase()}»` : ''}. Si la volvés a agregar, retoma en ${pub.pipelineStep ? PIPELINE_STEP_LABEL[pub.pipelineStep] : 'Información'}.`
                    : 'Esta publicación todavía no está en el pipeline.'}
              </p>
              <AddToPipelineButton
                accountSlug={account.slug}
                publicationId={pub.id}
                label={
                  pub.pipelineStatus === 'CORRECTED'
                    ? 'Volver a corregirla'
                    : pub.pipelineStatus === 'DISCARDED'
                      ? 'Volver a agregarla'
                      : 'Agregar al pipeline'
                }
              />
            </CardContent>
          </Card>
        ) : null}

        {current && viewing && !atCurrent ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 px-4 py-3">
            <p className="text-sm">
              Estás viendo <strong>{PIPELINE_STEP_LABEL[viewing]}</strong>. La publicación está en {PIPELINE_STEP_LABEL[current]}.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`${pageHref}?paso=${PIPELINE_STEP_SLUG[current]}`}>Ir a {PIPELINE_STEP_LABEL[current]}</Link>
              </Button>
              <JumpHereButton accountSlug={account.slug} publicationId={pub.id} from={current} to={viewing} />
            </div>
          </div>
        ) : null}

        {atCurrent && open ? (
          <p className="text-xs text-muted-foreground">
            En {PIPELINE_STEP_LABEL[current]} desde el {formatDateTime(open.enteredAt, account.timezone)}, hace{' '}
            {formatDuration(open.enteredAt, new Date())}.
          </p>
        ) : null}

        {ctx && info && viewing === 'INFO' ? (
          <>
            <InfoStep
              accountSlug={account.slug}
              timeZone={account.timezone}
              ctx={ctx}
              research={info[0]}
              catalog={info[1]}
              combo={info[2]}
              driveReady={info[3] !== null}
              shippingCost={info[4].shipping}
            />
            <StockFollowCard
              accountSlug={account.slug}
              publicationId={pub.id}
              plan={stockPlans?.get(pub.id) ?? null}
              productHref={`/a/${account.slug}/productos/${pub.productId}?seccion=stock`}
            />
          </>
        ) : ctx && auto && viewing === 'TITLE' ? (
          <TitleStep
            accountSlug={account.slug}
            timeZone={account.timezone}
            ctx={ctx}
            auto={auto}
            aiDisabledReason={isAiConfigured() ? null : AI_NOT_CONFIGURED}
          />
        ) : media && viewing === 'MEDIA' ? (
          <SectionCard
            title="Fotos y videos de la publicación"
            description={`Arriba marcás qué fotos y videos van${media.measures.length > 0 ? ' y en qué medidas' : ''}; abajo los ordenás. La primera foto es la portada. Lo que guardes queda en el borrador hasta que lo subas a ${media.channelName}.${media.clip ? ` Los videos que van son los ${media.clip.name}s, y se suben a mano desde el paso Videos.` : ''}`}
          >
            <SectionBody>
              <MediaOrganizer accountSlug={account.slug} publicationId={pub.id} sources={media} />
            </SectionBody>
          </SectionCard>
        ) : images && viewing === 'IMAGES' ? (
          <ImagesStep
            accountSlug={account.slug}
            publicationId={pub.id}
            pageHref={`${pageHref}?paso=${PIPELINE_STEP_SLUG.IMAGES}`}
            timeZone={account.timezone}
            edits={images[0]}
            openIds={openPhotoIds({ foto, fotos })}
            worker={images[1]}
            channelPhotos={images[2]}
            channelName={pub.channelName}
            photoRules={images[5]}
            sharedWith={images[3]}
            drive={images[4]}
          />
        ) : videos && viewing === 'VIDEOS' ? (
          <VideosStep
            accountSlug={account.slug}
            publicationId={pub.id}
            timeZone={account.timezone}
            data={videos}
            clipRules={getChannelAdapter(videos.channel.kind, videos.channel.name).clips}
          />
        ) : description && viewing === 'DESCRIPTION' ? (
          <DescriptionStep
            accountSlug={account.slug}
            publicationId={pub.id}
            timeZone={account.timezone}
            data={description}
            aiDisabledReason={isAiConfigured() ? null : AI_NOT_CONFIGURED}
            publicationHref={`/a/${account.slug}/publicaciones/${pub.id}`}
          />
        ) : qa && viewing === 'QA' ? (
          <QaPanel
            variant="step"
            accountSlug={account.slug}
            publicationId={pub.id}
            data={qa}
            aiReady={isAiConfigured()}
            timeZone={account.timezone}
            knowledgeHref={`${pageHref}?paso=${PIPELINE_STEP_SLUG.INFO}`}
          />
        ) : price && viewing === 'PRICE' ? (
          <PriceStep
            accountSlug={account.slug}
            data={price}
            today={todayIn(account.timezone)}
            timeZone={account.timezone}
            infoHref={`${pageHref}?paso=${PIPELINE_STEP_SLUG.INFO}`}
            settingsHref={`/a/${account.slug}/precios`}
          />
        ) : channel && viewing === 'PUBLISH' ? (
          <>
            {familyRows ? <FamilyPublishCard accountSlug={account.slug} channelName={pub.channelName} rows={familyRows} /> : null}
            <PriceDecisionCard
              campaigns={priceCampaigns}
              decision={decision}
              channelName={pub.channelName}
              sides={faces ? { app: faces.app, channel: faces.channel, states: faces.states, rejected: faces.summary.rejected } : null}
              discountUntil={faces?.copy?.discountUntil ?? null}
              published={Boolean(pub.externalId)}
              priceHref={`${pageHref}?paso=${PIPELINE_STEP_SLUG.PRICE}`}
              timeZone={account.timezone}
            />
            {/* Promociones, junto al precio: sumarse o salir queda en Por subir. */}
            {pub.externalId && priceGroup ? (
              <PublicationPromotions
                accountSlug={account.slug}
                publicationIds={priceGroup.publicationIds}
                mode="queue"
                channelName={pub.channelName}
                listPrice={priceGroup.price}
                channelListPrice={priceGroup.channelPrice}
                range={price?.discountRange ?? null}
                margin={campaignMargin}
                timeZone={account.timezone}
              />
            ) : null}
            <QuantityCard
              accountSlug={account.slug}
              publicationId={pub.id}
              channelName={pub.channelName}
              published={Boolean(pub.externalId)}
              sides={faces ? { app: faces.app, channel: faces.channel, states: faces.states, rejected: faces.summary.rejected } : null}
              stockInChannel={faces?.copy?.stockInChannel ?? false}
              stock={stockPlans?.get(pub.id) ? { plan: stockPlans.get(pub.id)!, productHref: `/a/${account.slug}/productos/${pub.productId}?seccion=stock` } : null}
            />
            {create ? <CreateInChannelCard accountSlug={account.slug} publicationId={pub.id} info={create} /> : null}
            <PublicationCodeCard
              accountSlug={account.slug}
              publicationId={pub.id}
              channel={channelInfo(channel.kind, channel.name)}
              externalId={pub.externalId}
              url={pub.url}
            />
            {faces ? <PendingChangesCard accountSlug={account.slug} faces={faces} campaigns={pendingCampaignTexts} /> : null}
          </>
        ) : viewing ? (
          <Card>
            <CardContent className="space-y-4 p-6">
              <StepContent step={viewing} atCurrent={atCurrent} />
            </CardContent>
          </Card>
        ) : null}

        {/* Mover la publicación, solo desde su paso actual: así no se mueve por error desde otra pestaña. */}
        {atCurrent ? (
          <StepActions
            accountSlug={account.slug}
            publicationId={pub.id}
            title={titleOrUntitled(pub.title)}
            step={current}
            completeBlocked={pub.externalId ? null : 'Para marcarla como corregida, cargá antes su ID.'}
          />
        ) : null}

        <PublicationTasksCard
          accountSlug={account.slug}
          publication={{ id: pub.id, title: titleOrUntitled(pub.title), externalId: pub.externalId }}
          tasks={tasks}
          people={people}
          meId={user.id}
          canCreate={canTask}
          timeZone={account.timezone}
        />

        {pub.movements.length > 0 ? (
          <SectionCard title="Historial del pipeline" description="Cuánto estuvo en cada paso, quién la movió y por qué salió.">
            <PipelineHistory movements={[...pub.movements].reverse()} timeZone={account.timezone} />
          </SectionCard>
        ) : null}
      </PageBody>
    </>
  );
}
