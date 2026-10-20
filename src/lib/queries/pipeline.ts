import { cache } from 'react';
import type { PrismaClient } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { listScoredPublications } from './scoring';

// Lo que muestran el tablero y la pantalla de cada paso. Lo que no depende
// entre sí se pide junto: con la base lejos, cada consulta en fila suma una
// ida y vuelta.

export type BoardItem = Awaited<ReturnType<typeof listBoard>>[number];

/** Las publicaciones que están en el pipeline, con desde cuándo están en su paso. Las que esperan hace más, primero. */
export async function listBoard(accountId: string, db: PrismaClient = prisma) {
  const [items, open] = await Promise.all([
    listScoredPublications(accountId, { pipelineStatus: 'IN_PIPELINE' }, db),
    db.pipelineMovement.findMany({
      where: { exitedAt: null, publication: { pipelineStatus: 'IN_PIPELINE', product: { accountId } } },
      select: { publicationId: true, enteredAt: true },
    }),
  ]);
  const since = new Map(open.map((m) => [m.publicationId, m.enteredAt]));
  return items
    .map((i) => ({ ...i, stepSince: since.get(i.id) ?? null }))
    .sort((a, b) => (a.stepSince?.getTime() ?? 0) - (b.stepSince?.getTime() ?? 0));
}

/** Una publicación con su recorrido por el pipeline, para la pantalla del paso. Una vez por pedido: la usan el título de la pestaña y la página. */
export const getPipelinePublication = cache(async (accountId: string, publicationId: string) => {
  const [[item], movements] = await Promise.all([
    listScoredPublications(accountId, { id: publicationId }),
    listPipelineMovements(publicationId),
  ]);
  if (!item) return null;
  return { ...item, movements };
});

export async function listPipelineMovements(publicationId: string, db: PrismaClient = prisma) {
  return db.pipelineMovement.findMany({
    where: { publicationId },
    orderBy: { enteredAt: 'asc' },
    include: { user: { select: { name: true } }, exitedBy: { select: { name: true } } },
  });
}

export type PipelineMovementRow = Awaited<ReturnType<typeof listPipelineMovements>>[number];
