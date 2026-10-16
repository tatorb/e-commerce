'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import {
  advanceStep,
  backStep,
  completePipeline,
  PIPELINE_REMOVALS,
  PIPELINE_STEPS,
  PipelineError,
  removeFromPipeline,
} from '@/domain/pipeline';
import type { PipelineRemoval, PipelineStep } from '@/generated/prisma/enums';

type Result = { ok: true } | { ok: false; error: string };
type Move = 'advance' | 'back' | 'complete';

async function belongs(accountSlug: string, publicationId: string): Promise<boolean> {
  const n = await prisma.publication.count({ where: { id: publicationId, product: { account: { slug: accountSlug } } } });
  return n > 0;
}

/** Avanza, vuelve o termina. "expected" es el paso que la persona estaba viendo. */
export async function moveStepAction(
  accountSlug: string,
  publicationId: string,
  expected: PipelineStep,
  move: Move,
): Promise<Result> {
  const user = await requireUser();
  if (!PIPELINE_STEPS.includes(expected)) return { ok: false, error: 'El paso no es válido.' };
  if (!(await belongs(accountSlug, publicationId))) return { ok: false, error: 'La publicación no existe en esta cuenta.' };
  const args = { publicationId, expected, userId: user.id };
  try {
    await prisma.$transaction(async (tx) => {
      if (move === 'advance') await advanceStep(tx, args);
      else if (move === 'back') await backStep(tx, args);
      else if (move === 'complete') await completePipeline(tx, args);
      else throw new PipelineError('No se entiende qué hacer.');
    });
  } catch (e) {
    if (e instanceof PipelineError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath(`/a/${accountSlug}`, 'layout');
  return { ok: true };
}

/** Saca la publicación del pipeline con un motivo. No borra nada. */
export async function removeFromPipelineAction(
  accountSlug: string,
  publicationId: string,
  expected: PipelineStep,
  reason: PipelineRemoval,
): Promise<Result> {
  const user = await requireUser();
  if (!PIPELINE_STEPS.includes(expected)) return { ok: false, error: 'El paso no es válido.' };
  if (!PIPELINE_REMOVALS.includes(reason)) return { ok: false, error: 'Elegí un motivo.' };
  if (!(await belongs(accountSlug, publicationId))) return { ok: false, error: 'La publicación no existe en esta cuenta.' };
  try {
    await prisma.$transaction((tx) => removeFromPipeline(tx, { publicationId, expected, userId: user.id, reason }));
  } catch (e) {
    if (e instanceof PipelineError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath(`/a/${accountSlug}`, 'layout');
  return { ok: true };
}
