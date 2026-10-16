import { AI_NOT_CONFIGURED, PROPOSAL_MODEL } from '@/ai/claude';
import { canGenerateProposal, parseNotes, parseProposalFields, ProposalStageError } from '@/domain/proposals';
import type { Stage } from '@/generated/prisma/enums';
import { formatDateTime, formatUsd } from '@/lib/format';
import { GenerateProposalButton } from './GenerateProposalButton';
import { ProposalView } from './ProposalView';

// La sección "Propuesta de la IA" de una publicación, en la ficha del producto.

type StoredProposal = {
  summary: string;
  fields: unknown;
  notes: unknown;
  model: string;
  usage: unknown;
  createdAt: Date;
  createdBy: { name: string } | null;
};

function costOf(usage: unknown): number | null {
  const cost = usage && typeof usage === 'object' ? (usage as { costUsd?: unknown }).costUsd : null;
  return typeof cost === 'number' ? cost : null;
}

export function PublicationProposal({
  accountSlug,
  timeZone,
  publicationId,
  stage,
  proposal,
  proposalCount,
  aiReady,
}: {
  accountSlug: string;
  timeZone: string;
  publicationId: string;
  stage: Stage;
  proposal: StoredProposal | null;
  proposalCount: number;
  aiReady: boolean;
}) {
  const previous = proposalCount - (proposal ? 1 : 0);
  const disabledReason = !aiReady ? AI_NOT_CONFIGURED : canGenerateProposal(stage) ? null : new ProposalStageError().message;
  const cost = proposal ? costOf(proposal.usage) : null;
  const meta = proposal
    ? [
        `Generada el ${formatDateTime(proposal.createdAt, timeZone)} por ${proposal.createdBy?.name ?? '—'}`,
        cost !== null ? `costo aproximado ${formatUsd(cost)}` : null,
        proposal.model !== PROPOSAL_MODEL ? `respondió ${proposal.model}` : null,
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
          {!proposal ? (
            <p className="text-sm text-muted-foreground">
              La IA propone cómo mejorar esta publicación según el estándar, sin inventar datos. No cambia nada hasta
              que se apruebe.
            </p>
          ) : null}
        </div>
        <GenerateProposalButton
          accountSlug={accountSlug}
          publicationId={publicationId}
          hasProposal={proposal !== null}
          disabledReason={disabledReason}
        />
      </div>
      {proposal ? (
        <ProposalView
          summary={proposal.summary}
          fields={parseProposalFields(proposal.fields)}
          notes={parseNotes(proposal.notes)}
          meta={meta}
        />
      ) : null}
    </div>
  );
}
