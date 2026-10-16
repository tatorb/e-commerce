import type { Prisma } from '@/generated/prisma/client';
import type { Stage } from '@/generated/prisma/enums';
import {
  CONTENT_FIELD_LABEL,
  isContentField,
  planContentUpdate,
  type ContentField,
  type ContentSnapshot,
  type IncomingContent,
} from './content';
import { moveToStage } from './stages';

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

const PLACEHOLDER = /\[\s*A CONFIRMAR\s*:?\s*([^\]]*)\]/gi;

/** Las marcas [A CONFIRMAR: …] dentro de un valor, en cualquier texto que tenga. */
export function findPlaceholders(value: unknown): string[] {
  const found: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(PLACEHOLDER)) found.push(m[1].trim() || 'dato');
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(value);
  return [...new Set(found)];
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
