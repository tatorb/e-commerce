import type { Prisma } from '@/generated/prisma/client';
import type { Stage } from '@/generated/prisma/enums';
import {
  CONTENT_FIELD_LABEL,
  isContentField,
  loadContent,
  planContentUpdate,
  writeContentField,
  type ContentField,
  type ContentSnapshot,
  type IncomingContent,
} from './content';
import {
  findPlaceholders,
  reviewFieldsInputSchema,
  validateReview,
  wasEdited,
  type ReviewField,
  type ReviewProblem,
} from './review';
import { moveToStage } from './stages';

export { findPlaceholders } from './review';

// Propuesta de mejora de una publicación, campo por campo. No sabe quién la
// escribió: recibe lo propuesto ya traducido a campos de la app. No cambia
// nada de la ficha ni de la publicación: eso pasa recién al aprobarla.

/** Lo propuesto, en campos de la app, con el motivo y lo que hay que confirmar. */
export type ProposalDraft = {
  summary: string;
  content: IncomingContent;
  notes: Partial<Record<ContentField, { reason: string; toConfirm: string[] }>>;
};

export type ProposalField = {
  field: ContentField;
  before: unknown;
  after: unknown;
  reason: string;
  toConfirm: string[];
  // Marcas [A CONFIRMAR: …] que quedaron dentro del valor propuesto.
  placeholders: string[];
};

// Etapas desde las que se puede generar una propuesta. En revisión, aprobada
// o aplicada, primero hay que terminar ese ciclo.
export const PROPOSAL_STAGES: Stage[] = ['IMPORTED', 'PROPOSAL_GENERATED', 'MEASURED'];

export function canGenerateProposal(stage: Stage): boolean {
  return PROPOSAL_STAGES.includes(stage);
}

/** Lista para una propuesta nueva: todavía no tiene una vigente. Las tandas generan solo estas. */
export function needsProposal(stage: Stage): boolean {
  return stage === 'IMPORTED' || stage === 'MEASURED';
}

/**
 * Compara lo propuesto con cómo está hoy y deja solo lo que cambia, con la
 * misma comparación que usan las importaciones.
 */
export function toProposalFields(
  baseline: ContentSnapshot,
  draft: ProposalDraft,
  opts: { titleMaxLength: number | null },
): { fields: ProposalField[]; notes: string[] } {
  const { changes, warnings } = planContentUpdate(baseline, draft.content, 'REPLACE', { publication: true });
  const changed = new Set(changes.map((c) => c.field));

  const fields = changes.map((c): ProposalField => {
    const note = draft.notes[c.field];
    const toConfirm = [...(note?.toConfirm ?? [])].filter((t) => t.trim() !== '');
    if (c.field === 'title' && opts.titleMaxLength && typeof c.after === 'string') {
      const length = c.after.length;
      if (length > opts.titleMaxLength) {
        toConfirm.push(`Tiene ${length} caracteres y el máximo del canal es ${opts.titleMaxLength}.`);
      }
    }
    return {
      field: c.field,
      before: c.before,
      after: c.after,
      reason: note?.reason?.trim() ?? '',
      toConfirm,
      placeholders: findPlaceholders(c.after),
    };
  });

  // Lo que hay que confirmar en campos que no cambian también se muestra.
  const notes = [...warnings];
  for (const [field, note] of Object.entries(draft.notes) as [ContentField, { toConfirm: string[] }][]) {
    if (changed.has(field)) continue;
    for (const t of note.toConfirm) if (t.trim()) notes.push(`${CONTENT_FIELD_LABEL[field]}, a confirmar: ${t.trim()}`);
  }
  return { fields, notes };
}

/** Lee los campos guardados, descartando lo que no tenga la forma esperada. */
export function parseProposalFields(raw: unknown): ProposalField[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): ProposalField[] => {
    if (!item || typeof item !== 'object') return [];
    const f = item as Record<string, unknown>;
    if (typeof f.field !== 'string' || !isContentField(f.field)) return [];
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return [
      {
        field: f.field,
        before: f.before ?? null,
        after: f.after ?? null,
        reason: typeof f.reason === 'string' ? f.reason : '',
        toConfirm: strings(f.toConfirm),
        placeholders: strings(f.placeholders),
      },
    ];
  });
}

export function parseNotes(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

export class ProposalStageError extends Error {
  constructor() {
    super('Esta publicación tiene una propuesta en revisión, aprobada o aplicada. Primero hay que terminar ese ciclo.');
  }
}

/**
 * Guarda la propuesta como la vigente de la publicación: la anterior queda
 * reemplazada, en el historial. La publicación pasa a "Propuesta generada".
 */
export async function saveProposal(
  tx: Prisma.TransactionClient,
  args: {
    publicationId: string;
    userId: string | null;
    summary: string;
    fields: ProposalField[];
    notes: string[];
    baseline: ContentSnapshot;
    model: string;
    usage: Prisma.InputJsonValue;
  },
): Promise<{ id: string }> {
  // Bloquea la publicación para que dos propuestas simultáneas no queden vigentes a la vez.
  const [row] = await tx.$queryRaw<{ stage: Stage }[]>`
    SELECT stage FROM publications WHERE id = ${args.publicationId} FOR UPDATE`;
  if (!row) throw new Error('La publicación no existe.');
  if (!canGenerateProposal(row.stage)) throw new ProposalStageError();

  await tx.proposal.updateMany({
    where: { publicationId: args.publicationId, status: 'ACTIVE' },
    data: { status: 'SUPERSEDED' },
  });
  const proposal = await tx.proposal.create({
    data: {
      publicationId: args.publicationId,
      createdById: args.userId,
      summary: args.summary,
      fields: args.fields as unknown as Prisma.InputJsonValue,
      notes: args.notes,
      baseline: args.baseline as unknown as Prisma.InputJsonValue,
      model: args.model,
      usage: args.usage,
    },
    select: { id: true },
  });
  await moveToStage(tx, { publicationId: args.publicationId, stage: 'PROPOSAL_GENERATED', userId: args.userId });
  return proposal;
}

// ───────────────────────────── Revisión ─────────────────────────────

export class ReviewError extends Error {}

export class ReviewValidationError extends ReviewError {
  constructor(readonly problems: ReviewProblem[]) {
    super(`No se puede aprobar: ${problems.map((p) => p.message).join(' ')}`);
  }
}

/** Lo que queda guardado al decidir, por campo. */
export type DecidedField = {
  field: ContentField;
  included: boolean;
  edited: boolean;
  // Lo que propuso la IA (null si el campo lo sumó la persona).
  aiValue: unknown;
  // Lo que quedó.
  value: unknown;
  // Cómo estaba en la app justo antes de aprobar.
  before: unknown;
};

export type StoredReview =
  | { kind: 'draft'; fields: ReviewField[]; savedAt: string; savedById: string | null }
  | { kind: 'decision'; fields: DecidedField[] };

export function parseReview(raw: unknown): StoredReview | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { kind?: unknown; fields?: unknown };
  if (r.kind === 'draft') {
    const parsed = reviewFieldsInputSchema.safeParse(r.fields);
    if (!parsed.success) return null;
    const d = raw as { savedAt?: unknown; savedById?: unknown };
    return {
      kind: 'draft',
      fields: parsed.data,
      savedAt: typeof d.savedAt === 'string' ? d.savedAt : '',
      savedById: typeof d.savedById === 'string' ? d.savedById : null,
    };
  }
  if (r.kind === 'decision' && Array.isArray(r.fields)) {
    const fields = r.fields.filter(
      (f): f is DecidedField => !!f && typeof f === 'object' && isContentField((f as { field?: string }).field ?? ''),
    );
    return { kind: 'decision', fields };
  }
  return null;
}

type Tx = Prisma.TransactionClient;

/** La propuesta vigente y su publicación, con la publicación bloqueada hasta el final de la transacción. */
async function lockProposal(tx: Tx, proposalId: string) {
  const [row] = await tx.$queryRaw<{ publicationId: string; productId: string; stage: Stage; status: string }[]>`
    SELECT p.id AS "publicationId", p."productId", p.stage, pr.status
    FROM proposals pr JOIN publications p ON p.id = pr."publicationId"
    WHERE pr.id = ${proposalId}
    FOR UPDATE OF p`;
  if (!row) throw new ReviewError('La propuesta no existe.');
  if (row.status !== 'ACTIVE') throw new ReviewError('Esta propuesta ya fue aprobada, rechazada o reemplazada.');
  return row;
}

/** Empieza la revisión: la publicación pasa a "En revisión". */
export async function startReview(tx: Tx, args: { proposalId: string; userId: string | null }): Promise<void> {
  const row = await lockProposal(tx, args.proposalId);
  if (row.stage !== 'PROPOSAL_GENERATED' && row.stage !== 'IN_REVIEW') {
    throw new ReviewError('Esta publicación no tiene una propuesta para revisar.');
  }
  await moveToStage(tx, { publicationId: row.publicationId, stage: 'IN_REVIEW', userId: args.userId });
}

/** Guarda lo editado sin aprobar. */
export async function saveReviewDraft(
  tx: Tx,
  args: { proposalId: string; userId: string | null; fields: ReviewField[] },
): Promise<void> {
  const row = await lockProposal(tx, args.proposalId);
  if (row.stage !== 'IN_REVIEW') throw new ReviewError('Primero hay que empezar la revisión.');
  const review: StoredReview = { kind: 'draft', fields: args.fields, savedAt: new Date().toISOString(), savedById: args.userId };
  await tx.proposal.update({ where: { id: args.proposalId }, data: { review: review as unknown as Prisma.InputJsonValue } });
}

/**
 * Aprueba: vuelve a validar, escribe en la ficha y la publicación los campos
 * marcados, guarda qué se editó y pasa la publicación a "Aprobado".
 */
export async function approveProposal(
  tx: Tx,
  args: { proposalId: string; userId: string | null; fields: ReviewField[]; titleMaxLength: number | null },
): Promise<{ publicationId: string; written: number; edited: number }> {
  const row = await lockProposal(tx, args.proposalId);
  if (row.stage !== 'IN_REVIEW') throw new ReviewError('Primero hay que empezar la revisión.');
  const check = validateReview(args.fields, { titleMaxLength: args.titleMaxLength });
  if (!check.ok) throw new ReviewValidationError(check.problems);

  const proposal = await tx.proposal.findUniqueOrThrow({ where: { id: args.proposalId }, select: { fields: true } });
  const aiValues = new Map(parseProposalFields(proposal.fields).map((f) => [f.field, f.after]));
  const live = await loadContent(tx, row.productId, row.publicationId);
  const target = { productId: row.productId, publicationId: row.publicationId };

  const decided: DecidedField[] = [];
  for (const f of check.fields) {
    const aiValue = aiValues.get(f.field);
    const edited = wasEdited(f.field, f.normalized, aiValue);
    decided.push({ field: f.field, included: f.included, edited, aiValue: aiValue ?? null, value: f.normalized, before: live[f.field] });
    if (f.included) await writeContentField(tx, target, f.field, f.normalized);
  }

  const review: StoredReview = { kind: 'decision', fields: decided };
  await tx.proposal.update({
    where: { id: args.proposalId },
    data: {
      status: 'APPROVED',
      review: review as unknown as Prisma.InputJsonValue,
      decidedAt: new Date(),
      decidedById: args.userId,
    },
  });
  await moveToStage(tx, { publicationId: row.publicationId, stage: 'APPROVED', userId: args.userId });
  return {
    publicationId: row.publicationId,
    written: decided.filter((d) => d.included).length,
    edited: decided.filter((d) => d.included && d.edited).length,
  };
}

/**
 * Rechaza: la propuesta queda rechazada y la publicación vuelve a la etapa en
 * la que estaba antes de la propuesta, para poder generar otra.
 */
export async function rejectProposal(
  tx: Tx,
  args: { proposalId: string; userId: string | null; reason: string },
): Promise<{ publicationId: string; stage: Stage }> {
  const row = await lockProposal(tx, args.proposalId);
  if (row.stage !== 'PROPOSAL_GENERATED' && row.stage !== 'IN_REVIEW') {
    throw new ReviewError('Esta publicación no tiene una propuesta para revisar.');
  }
  const movements = await tx.stageMovement.findMany({
    where: { publicationId: row.publicationId },
    orderBy: { enteredAt: 'desc' },
    select: { stage: true },
  });
  // La última etapa sin propuesta antes de esta: Importado o Medido.
  const previous = movements.find((m) => needsProposal(m.stage))?.stage ?? 'IMPORTED';
  await tx.proposal.update({
    where: { id: args.proposalId },
    data: {
      status: 'REJECTED',
      decidedAt: new Date(),
      decidedById: args.userId,
      rejectReason: args.reason.trim() || null,
    },
  });
  await moveToStage(tx, { publicationId: row.publicationId, stage: previous, userId: args.userId });
  return { publicationId: row.publicationId, stage: previous };
}

/** La próxima publicación con una propuesta para revisar, la más vieja primero. */
export async function nextPendingProposal(
  db: Tx,
  args: { accountId: string; excludePublicationId: string },
): Promise<{ publicationId: string; proposalId: string } | null> {
  const next = await db.proposal.findFirst({
    where: {
      status: 'ACTIVE',
      publicationId: { not: args.excludePublicationId },
      publication: { stage: { in: ['PROPOSAL_GENERATED', 'IN_REVIEW'] }, product: { accountId: args.accountId } },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, publicationId: true },
  });
  return next ? { publicationId: next.publicationId, proposalId: next.id } : null;
}
