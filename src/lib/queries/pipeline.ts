import type { PrismaClient } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { listScoredPublications } from './scoring';

// Lo que muestran el tablero y la pantalla de cada paso.

export type BoardItem = Awaited<ReturnType<typeof listBoard>>[number];

/** Las publicaciones que están en el pipeline, con desde cuándo están en su paso. Las que esperan hace más, primero. */
export async function listBoard(accountId: string, db: PrismaClient = prisma) {
  const items = await listScoredPublications(accountId, { pipelineStatus: 'IN_PIPELINE' }, db);
  const open = await db.pipelineMovement.findMany({
    where: { publicationId: { in: items.map((i) => i.id) }, exitedAt: null },
    select: { publicationId: true, enteredAt: true },
  });
  const since = new Map(open.map((m) => [m.publicationId, m.enteredAt]));
  return items
    .map((i) => ({ ...i, stepSince: since.get(i.id) ?? null }))
    .sort((a, b) => (a.stepSince?.getTime() ?? 0) - (b.stepSince?.getTime() ?? 0));
}

/** Una publicación con su recorrido por el pipeline, para la pantalla del paso. */
export async function getPipelinePublication(accountId: string, publicationId: string) {
  const [item] = await listScoredPublications(accountId, { id: publicationId });
  if (!item) return null;
  const movements = await listPipelineMovements(publicationId);
  return { ...item, movements };
}

export async function listPipelineMovements(publicationId: string, db: PrismaClient = prisma) {
  return db.pipelineMovement.findMany({
    where: { publicationId },
    orderBy: { enteredAt: 'asc' },
    include: { user: { select: { name: true } }, exitedBy: { select: { name: true } } },
  });
}

export type PipelineMovementRow = Awaited<ReturnType<typeof listPipelineMovements>>[number];
