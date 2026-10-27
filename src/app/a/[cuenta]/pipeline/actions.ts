'use server';

import { act } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import {
  advanceStep,
  backStep,
  completePipeline,
  jumpToStep,
  PIPELINE_REMOVALS,
  PIPELINE_STEPS,
  PipelineError,
  removeFromPipeline,
} from '@/domain/pipeline';
import { createPipelinePublication, type ShortProduct } from '@/domain/pipeline-publications';
import { familyByMeasure } from '@/lib/families';
import { PRODUCT_KINDS } from '@/domain/combos';
import type { PipelineRemoval, PipelineStep } from '@/generated/prisma/enums';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { searchProducts, type ProductPick } from '@/lib/queries/product-search';
import { savePublicationCode } from '@/lib/publication-code';

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
  return act(accountSlug, { section: ['pipeline'], does: 'Movió la publicación en el pipeline', publicationId }, async () => {
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
  });
}

/** Lleva la publicación a cualquier paso, saltando los del medio. "expected" es el paso en que estaba. */
export async function jumpStepAction(accountSlug: string, publicationId: string, expected: PipelineStep, to: PipelineStep): Promise<Result> {
  return act(accountSlug, { section: ['pipeline'], does: 'Movió la publicación en el pipeline', publicationId }, async () => {
    const user = await requireUser();
    if (!PIPELINE_STEPS.includes(expected) || !PIPELINE_STEPS.includes(to)) return { ok: false, error: 'El paso no es válido.' };
    if (!(await belongs(accountSlug, publicationId))) return { ok: false, error: 'La publicación no existe en esta cuenta.' };
    try {
      await prisma.$transaction((tx) => jumpToStep(tx, { publicationId, expected, to, userId: user.id }));
    } catch (e) {
      if (e instanceof PipelineError) return { ok: false, error: e.message };
      throw e;
    }
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true };
  });
}

/** Saca la publicación del pipeline con un motivo. No borra nada. */
export async function removeFromPipelineAction(
  accountSlug: string,
  publicationId: string,
  expected: PipelineStep,
  reason: PipelineRemoval,
): Promise<Result> {
  return act(accountSlug, { section: ['publicaciones', 'pipeline'], does: 'Sacó la publicación del pipeline', publicationId }, async () => {
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
  });
}

/** Los productos que coinciden con lo que se escribe, para la publicación nueva. */
export async function searchProductsAction(accountSlug: string, q: string): Promise<ProductPick[]> {
  const r = await act(accountSlug, { section: ['pipeline'], level: 'read' }, async ({ account }) => searchProducts(prisma, account.id, String(q ?? '')));
  return Array.isArray(r) ? r : [];
}

/**
 * Crea una publicación sin publicar, de un producto que ya está o de uno
 * nuevo con ficha corta, y la deja en el pipeline en Información.
 */
export async function createPipelinePublicationAction(
  accountSlug: string,
  input: { storeId: string; productId: string | null; newProduct: ShortProduct | null },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  return act(accountSlug, { section: ['pipeline'], does: 'Creó una publicación nueva en el pipeline' }, async () => {
    const user = await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    const raw = input?.newProduct;
    const newProduct: ShortProduct | null =
      raw && typeof raw === 'object'
        ? { name: str(raw.name), productType: str(raw.productType), kind: PRODUCT_KINDS.includes(raw.kind) ? raw.kind : 'INDIVIDUAL' }
        : null;
    try {
      const r = await prisma.$transaction(async (tx) => {
        const made = await createPipelinePublication(tx, {
          accountId: account.id,
          storeId: str(input?.storeId),
          productId: str(input?.productId) || null,
          newProduct,
          userId: user.id,
        });
        // Con varias medidas, una publicación por medida, en su familia.
        await familyByMeasure(tx, { publicationId: made.publicationId, userId: user.id });
        return made;
      });
      revalidatePath(`/a/${accountSlug}`, 'layout');
      return { ok: true, id: r.publicationId };
    } catch (e) {
      if (e instanceof PipelineError) return { ok: false, error: e.message };
      throw e;
    }
  });
}

/** Carga el ID del canal cuando la publicación ya se publicó. */
export async function savePublicationCodeAction(
  accountSlug: string,
  publicationId: string,
  raw: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  return act(accountSlug, { section: ['pipeline', 'publicaciones'], does: 'Cargó el código de la publicación en el canal', publicationId, detail: raw }, async () => {
    await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    const r = await savePublicationCode(prisma, { accountId: account.id, publicationId, raw: String(raw ?? '') });
    if (!r.ok) return r;
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, message: `Guardado: ${r.externalId}.` };
  });
}
