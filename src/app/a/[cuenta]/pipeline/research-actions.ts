'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
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
  saveQuestions,
  updateInsight,
  updateResearch,
} from '@/domain/research';
import type { InsightKind } from '@/generated/prisma/enums';
import { addUploadedProductFile, deleteProductFile, FILE_TYPES, extensionOf, FileError, manufacturerFolderId, productFileProblem } from '@/lib/files';
import { startResumableUpload, withDriveToken } from '@/lib/drive';
import { publicAppUrl } from '@/lib/public-url';
import { removeStored, storageError } from '@/lib/stored-files';

// Lo que se guarda desde las tarjetas nuevas del paso Información: fabricante,
// lo que sabe la tienda, aclaraciones, preguntas, dolores y objeciones. Todo es del producto, salvo
// las preguntas en la publicación propia.

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
    const storage = storageError(e);
    if (storage) return { ok: false, error: storage };
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

/**
 * Lo que sabe la tienda del producto. Se guarda desde el paso Información, con
 * la publicación, o desde la pestaña Investigación del producto.
 */
export async function saveKnowledgeAction(accountSlug: string, target: { publicationId?: string; productId?: string }, html: string): Promise<Result> {
  const user = await requireUser();
  const productId = target.publicationId
    ? await productOf(accountSlug, String(target.publicationId))
    : target.productId
      ? ((await prisma.product.findFirst({ where: { id: String(target.productId), account: { slug: accountSlug } }, select: { id: true } }))?.id ?? null)
      : null;
  if (!productId) return { ok: false, error: 'El producto no existe en esta cuenta.' };
  return guard(accountSlug, async () => {
    await updateResearch(prisma, { productId, userId: user.id, data: { storeKnowledge: cleanRichText(String(html ?? '')) } });
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
    await prisma.$transaction((tx) =>
      saveQuestions(tx, { productId, publicationId, userId: user.id, own: parsed.data.own, competitors: parsed.data.competitors }),
    );
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

/** Abre la subida de un archivo a la carpeta Fabricante del producto: el navegador lo sube directo al Drive. */
export async function startFileUploadAction(
  accountSlug: string,
  publicationId: string,
  file: { name: string; size: number },
): Promise<{ ok: true; uploadUrl: string } | { ok: false; error: string }> {
  await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND as { ok: false; error: string };
  const name = String(file?.name ?? '').trim().slice(0, 200);
  const size = Number(file?.size);
  const problem = productFileProblem({ name, size });
  if (problem) return { ok: false, error: problem };
  // La subida se abre con el origen de la página, así el navegador puede usarla.
  const origin = (await headers()).get('origin') ?? publicAppUrl();
  try {
    const uploadUrl = await withDriveToken(prisma, async (token, email) =>
      startResumableUpload(token, {
        folderId: await manufacturerFolderId(prisma, token, email, productId),
        name,
        type: FILE_TYPES[extensionOf(name)].contentType,
        size,
        origin,
        properties: { mrbProducto: productId },
      }),
    );
    return { ok: true, uploadUrl };
  } catch (e) {
    const message = storageError(e);
    if (message) return { ok: false, error: message };
    throw e;
  }
}

/** Anota un archivo que el navegador ya subió al Drive. */
export async function registerFileAction(accountSlug: string, publicationId: string, fileId: string): Promise<Result> {
  const user = await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND;
  return guard(accountSlug, async () => {
    await addUploadedProductFile(prisma, { productId, fileId: String(fileId), userId: user.id });
  });
}

/** Saca el archivo de la ficha y lo manda a la papelera del Drive. */
export async function deleteFileAction(accountSlug: string, publicationId: string, fileId: string): Promise<Result> {
  await requireUser();
  const productId = await productOf(accountSlug, publicationId);
  if (!productId) return NOT_FOUND;
  return guard(accountSlug, async () => {
    await deleteProductFile(prisma, { productId, fileId: String(fileId) }, (url) => removeStored(prisma, url));
    return 'Archivo borrado.';
  });
}
