import type { Prisma } from '@/generated/prisma/client';
import type { ApplyMethod, Stage } from '@/generated/prisma/enums';
import { isContentField, type ContentField } from './content';
import { parseReview } from './proposals';
import { moveToStage, revertLastStage } from './stages';

// Aplicación en el canal: cuándo lo aprobado quedó publicado en el canal. No
// sabe cómo se aplica (a mano, por planilla o por API): solo lo registra.

export class ApplicationError extends Error {}

/** Los campos que se escribieron al aprobar la propuesta. */
export function approvedFields(review: unknown): ContentField[] {
  const r = parseReview(review);
  return r?.kind === 'decision' ? r.fields.filter((f) => f.included).map((f) => f.field) : [];
}

/** La hora de un día y una hora en una zona horaria, como fecha absoluta. */
function zonedTime(day: string, time: string, timeZone: string): Date {
  const guess = new Date(`${day}T${time}Z`);
  // Cuánto se corre la zona horaria en ese momento.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(guess)
      .map((p) => [p.type, p.value]),
  );
  const asZoned = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess.getTime() - (asZoned - guess.getTime()));
}

export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(now);
}

/**
 * La fecha de aplicación a partir del día que elige la persona: hoy es
 * "ahora"; un día anterior es el final de ese día. No puede ser antes de la
 * aprobación ni en el futuro.
 */
export function resolveAppliedAt(
  day: string,
  opts: { timeZone: string; approvedAt: Date; now?: Date },
): Date {
  const now = opts.now ?? new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ApplicationError('La fecha no es válida.');
  const today = todayIn(opts.timeZone, now);
  if (day > today) throw new ApplicationError('La fecha no puede ser futura.');
  const at = day === today ? now : zonedTime(day, '23:59:00', opts.timeZone);
  if (at.getTime() < opts.approvedAt.getTime()) {
    throw new ApplicationError('La fecha no puede ser anterior a la aprobación.');
  }
  return at;
}

type Tx = Prisma.TransactionClient;

async function lockStage(tx: Tx, publicationId: string): Promise<Stage> {
  const [row] = await tx.$queryRaw<{ stage: Stage }[]>`
    SELECT stage FROM publications WHERE id = ${publicationId} FOR UPDATE`;
  if (!row) throw new ApplicationError('La publicación no existe.');
  return row.stage;
}

/** Cuándo entró la publicación en "Aprobado" por última vez. */
export async function approvedAt(tx: Tx, publicationId: string): Promise<Date | null> {
  const m = await tx.stageMovement.findFirst({
    where: { publicationId, stage: 'APPROVED' },
    orderBy: { enteredAt: 'desc' },
    select: { enteredAt: true },
  });
  return m?.enteredAt ?? null;
}

/** Marca como aplicada: registra la aplicación y pasa la publicación a "Aplicado en canal" con esa fecha. */
export async function markApplied(
  tx: Tx,
  args: { publicationId: string; userId: string | null; method: ApplyMethod; day: string; timeZone: string; now?: Date },
): Promise<{ id: string; appliedAt: Date }> {
  const stage = await lockStage(tx, args.publicationId);
  if (stage !== 'APPROVED') throw new ApplicationError('Solo se puede marcar como aplicada una publicación aprobada.');
  const since = await approvedAt(tx, args.publicationId);
  const appliedAt = resolveAppliedAt(args.day, { timeZone: args.timeZone, approvedAt: since ?? new Date(0), now: args.now });

  const proposal = await tx.proposal.findFirst({
    where: { publicationId: args.publicationId, status: 'APPROVED' },
    orderBy: { decidedAt: 'desc' },
    select: { id: true, review: true },
  });
  const application = await tx.channelApplication.create({
    data: {
      publicationId: args.publicationId,
      proposalId: proposal?.id ?? null,
      method: args.method,
      appliedAt,
      fields: proposal ? approvedFields(proposal.review) : [],
      createdById: args.userId,
    },
    select: { id: true },
  });
  await moveToStage(tx, { publicationId: args.publicationId, stage: 'APPLIED', userId: args.userId, at: appliedAt });
  return { id: application.id, appliedAt };
}

/**
 * Para corregir un error: borra la última aplicación y vuelve a "Aprobado".
 * No se puede si ya hay una medición posterior a la aplicación.
 */
export async function undoApplied(tx: Tx, args: { publicationId: string }): Promise<void> {
  const stage = await lockStage(tx, args.publicationId);
  if (stage !== 'APPLIED') throw new ApplicationError('La publicación no está marcada como aplicada.');
  const last = await tx.channelApplication.findFirst({
    where: { publicationId: args.publicationId },
    orderBy: { appliedAt: 'desc' },
  });
  if (!last) throw new ApplicationError('No hay una aplicación para deshacer.');
  const after = await tx.measurement.count({
    where: { publicationId: args.publicationId, takenAt: { gte: last.appliedAt } },
  });
  if (after > 0) throw new ApplicationError('Ya hay una medición posterior a la aplicación: no se puede deshacer.');
  await tx.channelApplication.delete({ where: { id: last.id } });
  try {
    await revertLastStage(tx, { publicationId: args.publicationId, expected: 'APPLIED' });
  } catch (e) {
    throw new ApplicationError(e instanceof Error ? e.message : 'No se pudo volver atrás.');
  }
}

export function parseAppliedFields(raw: unknown): ContentField[] {
  return Array.isArray(raw) ? raw.filter((f): f is ContentField => typeof f === 'string' && isContentField(f)) : [];
}
