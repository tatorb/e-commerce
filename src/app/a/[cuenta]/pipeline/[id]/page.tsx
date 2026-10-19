import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, FileText, Lock } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { PipelineBadge } from '@/components/stages/StageBadge';
import { ScoreBadge } from '@/components/stages/ScoreBadge';
import { StepLine } from '@/components/pipeline/StepLine';
import { StepActions } from '@/components/pipeline/StepActions';
import { PipelineHistory } from '@/components/pipeline/PipelineHistory';
import { AddToPipelineButton } from '@/components/pipeline/AddToPipelineButton';
import { PIPELINE_REMOVAL_LABEL, PIPELINE_STEP_LABEL } from '@/domain/pipeline';
import { titleLockText } from '@/domain/title-lock';
import type { PipelineStep } from '@/generated/prisma/enums';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { getPipelinePublication } from '@/lib/queries/pipeline';
import { loadTitleContext } from '@/lib/queries/title-step';
import { loadResearch } from '@/lib/queries/research';
import { isBlobConfigured } from '@/lib/files';
import { autoAvailable } from '@/lib/research';
import { prisma } from '@/lib/db';
import { AI_NOT_CONFIGURED, isAiConfigured } from '@/ai/claude';
import { InfoStep } from '@/components/pipeline/info/InfoStep';
import { TitleStep } from '@/components/pipeline/title/TitleStep';
import { formatDateTime, formatDuration, plural } from '@/lib/format';

export const dynamic = 'force-dynamic';
// Leer el buscador letra por letra o pedir títulos a la IA puede tardar.
export const maxDuration = 300;

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string; id: string }> }) {
  const { cuenta, id } = await params;
  const account = await getAccountBySlug(cuenta);
  const pub = account ? await getPipelinePublication(account.id, id) : null;
  return { title: pub ? `${pub.title} · Pipeline` : 'Pipeline' };
}

// Los pasos que todavía no tienen contenido.
function StepContent({ step }: { step: PipelineStep }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold">{PIPELINE_STEP_LABEL[step]}</h2>
      <p className="text-sm text-muted-foreground">
        Este paso todavía no tiene contenido. Por ahora podés avanzar al siguiente.
      </p>
    </div>
  );
}

export default async function PipelineStepPage({ params }: { params: Promise<{ cuenta: string; id: string }> }) {
  const { cuenta, id } = await params;
  const account = await getAccountBySlug(cuenta);
  if (!account) notFound();
  const pub = await getPipelinePublication(account.id, id);
  if (!pub) notFound();

  const boardHref = `/a/${account.slug}/pipeline`;
  const inPipeline = pub.pipelineStatus === 'IN_PIPELINE' && pub.pipelineStep !== null;
  const open = pub.movements.find((m) => m.exitedAt === null) ?? null;
  const lock = pub.titleLock.locked ? titleLockText(pub.titleLock) : null;
  // Información y Título usan la ficha, la competencia y lo leído del buscador.
  const ctx =
    inPipeline && (pub.pipelineStep === 'INFO' || pub.pipelineStep === 'TITLE')
      ? await loadTitleContext(prisma, account.id, pub.id)
      : null;

  return (
    <>
      <PageHeader staticOnMobile className="max-w-5xl">
        <div className="space-y-2">
          <Breadcrumb items={[{ label: account.name, href: boardHref }, { label: 'Pipeline', href: boardHref }, { label: pub.title }]} />
          <div className="space-y-1.5">
            <h1 className="flex items-start gap-2 text-2xl font-semibold tracking-tight">
              <span>{pub.title}</span>
              {lock ? (
                <span title={lock} aria-label={lock} className="mt-2 shrink-0 text-amber-700">
                  <Lock className="h-4 w-4" />
                </span>
              ) : null}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
              <span>{pub.externalId ?? 'Sin código'}</span>
              <ScoreBadge score={pub.score} />
              <span>{pub.sales === null ? 'Ventas sin dato' : `${plural(pub.sales, 'venta')} en 90 días`}</span>
              <PipelineBadge state={pub} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Link
                href={`/a/${account.slug}/productos/${pub.productId}`}
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                Ver la ficha
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
            </div>
          </div>
        </div>
        <StepLine current={pub.pipelineStep} active={inPipeline} done={pub.pipelineStatus === 'CORRECTED'} />
      </PageHeader>
      <PageBody className="max-w-5xl">
        {inPipeline && pub.pipelineStep ? (
          <>
            {open ? (
              <p className="text-xs text-muted-foreground">
                En {PIPELINE_STEP_LABEL[pub.pipelineStep]} desde el {formatDateTime(open.enteredAt, account.timezone)}, hace{' '}
                {formatDuration(open.enteredAt, new Date())}.
              </p>
            ) : null}
            {ctx && pub.pipelineStep === 'INFO' ? (
              <InfoStep
                accountSlug={account.slug}
                timeZone={account.timezone}
                ctx={ctx}
                research={await loadResearch(prisma, ctx.publication.productId)}
                blobReady={isBlobConfigured()}
              />
            ) : ctx && pub.pipelineStep === 'TITLE' ? (
              <TitleStep
                accountSlug={account.slug}
                timeZone={account.timezone}
                ctx={ctx}
                auto={await autoAvailable(prisma, ctx.channel, ctx.storeId)}
                aiDisabledReason={isAiConfigured() ? null : AI_NOT_CONFIGURED}
              />
            ) : (
              <Card>
                <CardContent className="space-y-4 p-6">
                  <StepContent step={pub.pipelineStep} />
                </CardContent>
              </Card>
            )}
            <StepActions accountSlug={account.slug} publicationId={pub.id} title={pub.title} step={pub.pipelineStep} />
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
              <p className="text-sm">
                {pub.pipelineStatus === 'CORRECTED'
                  ? 'Esta publicación ya está corregida.'
                  : pub.pipelineStatus === 'DISCARDED'
                    ? `Se sacó del pipeline${pub.pipelineRemoval ? ` por «${PIPELINE_REMOVAL_LABEL[pub.pipelineRemoval].toLowerCase()}»` : ''}. Si la volvés a agregar, retoma en ${pub.pipelineStep ? PIPELINE_STEP_LABEL[pub.pipelineStep] : 'Información'}.`
                    : 'Esta publicación todavía no está en el pipeline.'}
              </p>
              {pub.externalId ? (
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
              ) : (
                <p className="text-sm text-muted-foreground">No tiene código del canal: no puede entrar.</p>
              )}
            </CardContent>
          </Card>
        )}

        {pub.movements.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Historial del pipeline</p>
            <PipelineHistory movements={[...pub.movements].reverse()} timeZone={account.timezone} />
          </div>
        ) : null}
      </PageBody>
    </>
  );
}
