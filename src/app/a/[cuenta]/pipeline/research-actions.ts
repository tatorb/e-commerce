'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import {
  addInsight,
  cleanRichText,
  deleteInsight,
  manufacturerSchema,
  moveInsight,
  questionsSchema,
  ResearchError,
  updateInsight,
  updateResearch,
} from '@/domain/research';
import type { InsightKind } from '@/generated/prisma/enums';
import { BLOB_NOT_CONFIGURED, deleteProductFile, FileError, isBlobConfigured, registerProductFile } from '@/lib/files';

// Lo que se guarda desde las tarjetas nuevas del paso Información: fabricante,
// aclaraciones, preguntas, dolores y objeciones. Todo es del producto.

type Result = { ok: true; message?: string } | { ok: false; error: string };

const NOT_FOUND: Result = { ok: false, error: 'La publicación no existe en esta cuenta.' };

async function productOf(accountSlug: string, publicationId: string): Promise<string | null> {
  const pub = await prisma.publication.findFirst({
    where: { id: publicationId, product: { account: { slug: accountSlug } } },
    select: { productId: true },
  });
  return pub?.productId ?? null;
}

async function guard(accountSlug: string, run: () => Promise<string | void>): Promise<Result> {
  try {
    const message = await run();
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, message: message ?? undefined };
  } catch (e) {
    if (e instanceof ResearchError || e instanceof FileError) return { ok: false, error: e.message };
    throw e;
  }
}

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? 'Revisá los datos.';

export async function saveManufacturerAction(
  accountSlug: string,
  publicationId: string,
  input: { site: string; productUrl: string; text: string },
): Promise<Result> {
  const user = await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND;
  const parsed = manufacturerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { site, productUrl, text } = parsed.data;
  return guard(accountSlug, async () => {
    await updateResearch(prisma, {
      productId,
      userId: user.id,
      data: { manufacturerSite: site, manufacturerProductUrl: productUrl, manufacturerText: text },
    });
    return 'Guardado.';
  });
}

export async function saveClarificationsAction(accountSlug: string, publicationId: string, html: string): Promise<Result> {
  const user = await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND;
  return guard(accountSlug, async () => {
    await updateResearch(prisma, { productId, userId: user.id, data: { clarifications: cleanRichText(String(html ?? '')) } });
    return 'Guardado.';
  });
}

export async function saveQuestionsAction(
  accountSlug: string,
  publicationId: string,
  input: { own: string; competitors: string },
): Promise<Result> {
  const user = await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND;
  const parsed = questionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return guard(accountSlug, async () => {
    await updateResearch(prisma, {
      productId,
      userId: user.id,
      data: { ownQuestions: parsed.data.own, competitorQuestions: parsed.data.competitors },
    });
    return 'Preguntas guardadas.';
  });
}

const KINDS: InsightKind[] = ['PAIN', 'OBJECTION'];

export async function addInsightAction(accountSlug: string, publicationId: string, kind: InsightKind, text: string): Promise<Result> {
  await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND;
  if (!KINDS.includes(kind)) return { ok: false, error: 'La lista no es válida.' };
  return guard(accountSlug, async () => {
    await prisma.$transaction((tx) => addInsight(tx, { productId, kind, text: String(text ?? '') }));
  });
}

export async function updateInsightAction(accountSlug: string, publicationId: string, id: string, text: string): Promise<Result> {
  await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND;
  return guard(accountSlug, async () => {
    await updateInsight(prisma, { productId, id: String(id), text: String(text ?? '') });
  });
}

export async function deleteInsightAction(accountSlug: string, publicationId: string, id: string): Promise<Result> {
  await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND;
  return guard(accountSlug, async () => {
    await deleteInsight(prisma, { productId, id: String(id) });
  });
}

export async function moveInsightAction(
  accountSlug: string,
  publicationId: string,
  id: string,
  direction: 'up' | 'down',
): Promise<Result> {
  await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND;
  return guard(accountSlug, async () => {
    await prisma.$transaction((tx) => moveInsight(tx, { productId, id: String(id), direction: direction === 'up' ? 'up' : 'down' }));
  });
}

/** Anota un archivo que el navegador ya subió al depósito. */
export async function registerFileAction(accountSlug: string, publicationId: string, url: string, name: string): Promise<Result> {
  const user = await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND;
  if (!isBlobConfigured()) return { ok: false, error: BLOB_NOT_CONFIGURED };
  return guard(accountSlug, async () => {
    await registerProductFile(prisma, { productId, url: String(url), name: String(name ?? ''), userId: user.id });
  });
}

export async function deleteFileAction(accountSlug: string, publicationId: string, fileId: string): Promise<Result> {
  await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND;
  if (!isBlobConfigured()) return { ok: false, error: BLOB_NOT_CONFIGURED };
  return guard(accountSlug, async () => {
    await deleteProductFile(prisma, { productId, fileId: String(fileId) });
    return 'Archivo borrado.';
  });
}
