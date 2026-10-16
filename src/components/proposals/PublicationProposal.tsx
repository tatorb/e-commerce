import Link from 'next/link';
import { ClipboardCheck, Send } from 'lucide-react';
import { AI_NOT_CONFIGURED, PROPOSAL_MODEL } from '@/ai/claude';
import { Button } from '@/components/ui/button';
import { canGenerateProposal, parseNotes, parseProposalFields, parseReview, ProposalStageError } from '@/domain/proposals';
import type { ProposalStatus, Stage } from '@/generated/prisma/enums';
import { formatDateTime, formatUsd } from '@/lib/format';
import { GenerateProposalButton } from './GenerateProposalButton';
import { ProposalView } from './ProposalView';
import { StartReviewButton } from './StartReviewButton';
import { UndoAppliedButton } from '@/components/apply/UndoAppliedButton';

// La sección "Propuesta de la IA" de una publicación, en la ficha del producto.

type StoredProposal = {
  id: string;
  status: ProposalStatus;
  summary: string;
  fields: unknown;
  notes: unknown;
  model: string;
  usage: unknown;
  createdAt: Date;
  createdBy: { name: string } | null;
  review: unknown;
  decidedAt: Date | null;
  decidedBy: { name: string } | null;
  rejectReason: string | null;
};

type StoredApplication = { appliedAt: Date; method: 'MANUAL' | 'SPREADSHEET' | 'API'; createdBy: { name: string } | null };

const METHOD_LABEL: Record<StoredApplication['method'], string> = {
  MANUAL: 'a mano',
  SPREADSHEET: 'por planilla',
  API: 'por API',
};

function costOf(usage: unknown): number | null {
  const cost = usage && typeof usage === 'object' ? (usage as { costUsd?: unknown }).costUsd : null;
  return typeof cost === 'number' ? cost : null;
}

/** "Aprobada por Martín el 17/10/26 10:30 · 3 campos escritos, 1 editado". */
function decisionText(p: StoredProposal, timeZone: string): string {
  const who = `${p.decidedBy?.name ?? '—'} el ${p.decidedAt ? formatDateTime(p.decidedAt, timeZone) : '—'}`;
  if (p.status === 'REJECTED') {
    return `Rechazada por ${who}.${p.rejectReason ? ` Motivo: ${p.rejectReason}` : ''}`;
  }
  const review = parseReview(p.review);
  const used = review?.kind === 'decision' ? review.fields.filter((f) => f.included) : [];
  const edited = used.filter((f) => f.edited).length;
  return `Aprobada por ${who} · ${used.length === 1 ? '1 campo escrito' : `${used.length} campos escritos`} en la ficha, ${edited === 1 ? '1 editado' : `${edited} editados`} en la revisión.`;
}

export function PublicationProposal({
  accountSlug,
  timeZone,
  publicationId,
  stage,
  proposal,
  proposalCount,
  aiReady,
  channelName,
  application,
}: {
  accountSlug: string;
  timeZone: string;
  publicationId: string;
  stage: Stage;
  // La vigente, o la última que se decidió.
  proposal: StoredProposal | null;
  proposalCount: number;
  aiReady: boolean;
  channelName: string;
  // La última vez que se aplicó en el canal.
  application: StoredApplication | null;
}) {
  const active = proposal?.status === 'ACTIVE' ? proposal : null;
  const decided = proposal && proposal.status !== 'ACTIVE' ? proposal : null;
  const reviewUrl = `/a/${accountSlug}/publicaciones/${publicationId}/revision`;
  const applyUrl = `/a/${accountSlug}/publicaciones/${publicationId}/aplicar`;
  const applied = (stage === 'APPLIED' || stage === 'MEASURED') && application ? application : null;
  const previous = proposalCount - (active ? 1 : 0);
  const disabledReason = !aiReady ? AI_NOT_CONFIGURED : canGenerateProposal(stage) ? null : new ProposalStageError().message;
  const cost = active ? costOf(active.usage) : null;
  const meta = active
    ? [
        `Generada el ${formatDateTime(active.createdAt, timeZone)} por ${active.createdBy?.name ?? '—'}`,
        cost !== null ? `costo aproximado ${formatUsd(cost)}` : null,
        active.model !== PROPOSAL_MODEL ? `respondió ${active.model}` : null,
        previous > 0 ? (previous === 1 ? '1 propuesta anterior' : `${previous} propuestas anteriores`) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Propuesta de la IA</p>
          {!active && !decided ? (
            <p className="text-sm text-muted-foreground">
              La IA propone cómo mejorar esta publicación según el estándar, sin inventar datos. No cambia nada hasta
              que se apruebe.
            </p>
          ) : null}
          {decided ? <p className="text-sm">{decisionText(decided, timeZone)}</p> : null}
          {applied ? (
            <p className="text-sm">
              Aplicada en {channelName} el {formatDateTime(applied.appliedAt, timeZone)} por{' '}
              {applied.createdBy?.name ?? '—'}, {METHOD_LABEL[applied.method]}.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {active && stage === 'PROPOSAL_GENERATED' ? (
            <StartReviewButton accountSlug={accountSlug} proposalId={active.id} href={reviewUrl} />
          ) : null}
          {active && stage === 'IN_REVIEW' ? (
            <Button size="sm" asChild>
              <Link href={reviewUrl}>
                <ClipboardCheck className="h-4 w-4" />
                Seguir revisando
              </Link>
            </Button>
          ) : null}
          {stage === 'APPROVED' ? (
            <Button size="sm" asChild>
              <Link href={applyUrl}>
                <Send className="h-4 w-4" />
                Aplicar en {channelName}
              </Link>
            </Button>
          ) : null}
          {applied ? (
            <>
              <Button size="sm" variant="outline" asChild>
                <Link href={applyUrl}>Ver lo aplicado</Link>
              </Button>
              {stage === 'APPLIED' ? <UndoAppliedButton accountSlug={accountSlug} publicationId={publicationId} /> : null}
            </>
          ) : null}
          {canGenerateProposal(stage) ? (
            <GenerateProposalButton
              accountSlug={accountSlug}
              publicationId={publicationId}
              hasProposal={active !== null}
              disabledReason={disabledReason}
            />
          ) : null}
        </div>
      </div>
      {active ? (
        <ProposalView
          summary={active.summary}
          fields={parseProposalFields(active.fields)}
          notes={parseNotes(active.notes)}
          meta={meta}
        />
      ) : null}
    </div>
  );
}
