import type { Prisma } from '@/generated/prisma/client';
import { Stage } from '@/generated/prisma/enums';

// Estados del recorrido de la propuesta completa con IA, en orden. No es la
// etapa de la publicación: esa es la del pipeline (src/domain/pipeline.ts).
export const STAGES: Stage[] = [
  Stage.IMPORTED,
  Stage.PROPOSAL_GENERATED,
  Stage.IN_REVIEW,
  Stage.APPROVED,
  Stage.APPLIED,
  Stage.MEASURED,
];

export const STAGE_LABEL: Record<Stage, string> = {
  IMPORTED: 'Sin propuesta',
  PROPOSAL_GENERATED: 'Propuesta generada',
  IN_REVIEW: 'En revisión',
  APPROVED: 'Aprobado',
  APPLIED: 'Aplicado en canal',
  MEASURED: 'Medido',
};

type Tx = Prisma.TransactionClient;

/**
 * Única forma de cambiar la etapa de una publicación. Cierra la etapa
 * abierta y abre la nueva en la misma transacción, así nunca quedan dos
 * etapas abiertas ni una publicación sin etapa. Si la publicación ya está
 * en esa etapa, no hace nada.
 */
export async function moveToStage(
  tx: Tx,
  input: { publicationId: string; stage: Stage; userId: string | null; at?: Date },
): Promise<{ changed: boolean }> {
  const { publicationId, stage, userId } = input;

  // Bloquea la fila de la publicación hasta el final de la transacción: dos
  // movimientos simultáneos se ejecutan uno detrás del otro.
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM publications WHERE id = ${publicationId} FOR UPDATE`;
  if (locked.length === 0) throw new Error('La publicación no existe.');

  const open = await tx.stageMovement.findFirst({
    where: { publicationId, exitedAt: null },
    orderBy: { enteredAt: 'desc' },
  });
  if (open && open.stage === stage) return { changed: false };

  const at = input.at ?? new Date();
  await tx.stageMovement.updateMany({
    where: { publicationId, exitedAt: null },
    data: { exitedAt: at },
  });
  await tx.stageMovement.create({ data: { publicationId, stage, enteredAt: at, userId } });
  await tx.publication.update({ where: { id: publicationId }, data: { stage } });
  return { changed: true };
}

/**
 * Deshace el último cambio de etapa, para corregir un error: borra la etapa
 * abierta y vuelve a abrir la anterior, como si el cambio no hubiera pasado.
 * Solo si la etapa abierta es la esperada.
 */
export async function revertLastStage(
  tx: Tx,
  input: { publicationId: string; expected: Stage },
): Promise<{ stage: Stage }> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM publications WHERE id = ${input.publicationId} FOR UPDATE`;
  if (locked.length === 0) throw new Error('La publicación no existe.');
  const [open, previous] = await tx.stageMovement.findMany({
    where: { publicationId: input.publicationId },
    orderBy: { enteredAt: 'desc' },
    take: 2,
  });
  if (!open || open.exitedAt !== null || open.stage !== input.expected || !previous) {
    throw new Error('La etapa cambió mientras tanto. Recargá la página.');
  }
  await tx.stageMovement.delete({ where: { id: open.id } });
  await tx.stageMovement.update({ where: { id: previous.id }, data: { exitedAt: null } });
  await tx.publication.update({ where: { id: input.publicationId }, data: { stage: previous.stage } });
  return { stage: previous.stage };
}
