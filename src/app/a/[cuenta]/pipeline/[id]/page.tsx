import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppWindow, ExternalLink, Lock, Package } from 'lucide-react';
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
import { StepActions } from '@/components/pipeline/StepActions';
import { PipelineHistory } from '@/components/pipeline/PipelineHistory';
import { AddToPipelineButton } from '@/components/pipeline/AddToPipelineButton';
import { PublicationCodeCard } from '@/components/pipeline/PublicationCodeCard';
import { PendingChangesCard } from '@/components/publication/PendingChangesCard';
import { MediaOrganizer } from '@/components/publication/MediaOrganizer';
import { loadMediaSources } from '@/lib/media';
import { CreateInChannelCard } from '@/components/publication/CreateInChannelCard';
import { createChecks } from '@/lib/channel-create';
import { loadPublicationFaces } from '@/lib/queries/publication-faces';
import { channelInfo, getChannelAdapter } from '@/channels';
import { codeOrUnpublished } from '@/domain/channel-status';
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
import { latestPriceDecision, loadPriceStep, productPricing } from '@/lib/pricing';
import { PriceDecisionCard } from '@/components/pipeline/price/PriceDecisionCard';
import { QuantityCard } from '@/components/pipeline/QuantityCard';
import { todayIn } from '@/domain/applications';

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
  const { account } = await requireAccount(cuenta, 'pipeline');
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
  const [ctx, info, images, channel, faces, media, create, videos, description, qa, price, decision] = await Promise.all([
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
    viewing === 'MEDIA' ? loadMediaSources(prisma, account.id, pub.id) : null,
    // Sin publicar: lo que hace falta para crearla en el canal.
    viewing === 'PUBLISH' && !pub.externalId ? createChecks(prisma, { accountId: account.id, publicationId: pub.id }) : null,
    viewing === 'VIDEOS' ? loadVideosStep(prisma, { accountId: account.id, publicationId: pub.id }) : null,
    viewing === 'DESCRIPTION' ? loadDescriptionStep(prisma, { accountId: account.id, publicationId: pub.id }) : null,
    viewing === 'QA' ? loadQaStep(prisma, { accountId: account.id, publicationId: pub.id }) : null,
    // Precio usa el costo, los parámetros y la competencia; Información, el envío; Publicación, el precio decidido.
    viewing === 'PRICE' ? loadPriceStep(prisma, account.id, pub.id) : null,
    viewing === 'PUBLISH' ? latestPriceDecision(prisma, pub.id) : null,
  ]);
  const auto = ctx && viewing === 'TITLE' ? await autoAvailable(prisma, ctx.channel, ctx.storeId) : null;

  return (
    <>
      <PageHeader staticOnMobile className="max-w-5xl">
        <div className="space-y-2">
          <Breadcrumb items={[{ label: account.name, href: boardHref }, { label: 'Pipeline', href: boardHref }, { label: titleOrUntitled(pub.title) }]} />
          <div className="space-y-1.5">
            <EntityLabel kind="publication" channelName={pub.channelName} accent={pub.channelAccent} />
            <h1 className="flex items-start gap-2 text-2xl font-semibold tracking-tight">
              <span className={pub.title ? undefined : 'text-muted-foreground'}>{titleOrUntitled(pub.title)}</span>
              {lock ? (
                <span title={lock} aria-label={lock} className="mt-2 shrink-0 text-amber-700">
                  <Lock className="h-4 w-4" />
                </span>
              ) : null}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
              <span>{codeOrUnpublished(pub.externalId)}</span>
              <KindBadge kind={pub.kind} />
              <ScoreBadge score={pub.score} />
              <span>{pub.sales === null ? 'Ventas sin dato' : `${plural(pub.sales, 'venta')} en 90 días`}</span>
              <PipelineBadge state={pub} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Link
                href={`/a/${account.slug}/productos/${pub.productId}`}
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                <Package className="h-3.5 w-3.5" />
                Producto: {pub.productName}
              </Link>
              {pub.url ? (
                <a
                  href={pub.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver en {pub.channelName}
                </a>
              ) : null}
              <a
                href={viewHref}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                <AppWindow className="h-3.5 w-3.5" />
                Abrir en otra pestaña
              </a>
            </div>
          </div>
        </div>
        <StepLine
          current={pub.pipelineStep}
          active={inPipeline}
          done={pub.pipelineStatus === 'CORRECTED'}
          viewing={viewing}
          baseHref={pageHref}
        />
      </PageHeader>
      <PageBody className="max-w-5xl">
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
              {viewing === 'TITLE' ? ' Podés trabajar el título; para aprobarlo, la publicación tiene que estar en Título.' : ''}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={`${pageHref}?paso=${PIPELINE_STEP_SLUG[current]}`}>Ir a {PIPELINE_STEP_LABEL[current]}</Link>
            </Button>
          </div>
        ) : null}

        {atCurrent && open ? (
          <p className="text-xs text-muted-foreground">
            En {PIPELINE_STEP_LABEL[current]} desde el {formatDateTime(open.enteredAt, account.timezone)}, hace{' '}
            {formatDuration(open.enteredAt, new Date())}.
          </p>
        ) : null}

        {ctx && info && viewing === 'INFO' ? (
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
            <PriceDecisionCard
              decision={decision}
              channelName={pub.channelName}
              sides={faces ? { app: faces.app, channel: faces.channel, states: faces.states, rejected: faces.summary.rejected } : null}
              discountUntil={faces?.copy?.discountUntil ?? null}
              published={Boolean(pub.externalId)}
              priceHref={`${pageHref}?paso=${PIPELINE_STEP_SLUG.PRICE}`}
              timeZone={account.timezone}
            />
            <QuantityCard
              accountSlug={account.slug}
              publicationId={pub.id}
              channelName={pub.channelName}
              published={Boolean(pub.externalId)}
              sides={faces ? { app: faces.app, channel: faces.channel, states: faces.states, rejected: faces.summary.rejected } : null}
              stockInChannel={faces?.copy?.stockInChannel ?? false}
            />
            {create ? <CreateInChannelCard accountSlug={account.slug} publicationId={pub.id} info={create} /> : null}
            <PublicationCodeCard
              accountSlug={account.slug}
              publicationId={pub.id}
              channel={channelInfo(channel.kind, channel.name)}
              externalId={pub.externalId}
              url={pub.url}
            />
            {faces ? <PendingChangesCard accountSlug={account.slug} faces={faces} /> : null}
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

        {pub.movements.length > 0 ? (
          <SectionCard title="Historial del pipeline" description="Cuánto estuvo en cada paso, quién la movió y por qué salió.">
            <PipelineHistory movements={[...pub.movements].reverse()} timeZone={account.timezone} />
          </SectionCard>
        ) : null}
      </PageBody>
    </>
  );
}
