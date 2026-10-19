'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { CatalogError } from '@/domain/catalog-data';
import { saveCatalogData } from '@/lib/catalog-data';

// Lo que se guarda desde la tarjeta Datos de catálogo del paso Información.
// Es de la publicación: cada canal tiene su formulario.

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function guard(accountSlug: string, publicationId: string, run: () => Promise<string>): Promise<Result> {
  await requireUser();
  const pub = await prisma.publication.findFirst({
    where: { id: publicationId, product: { account: { slug: accountSlug } } },
    select: { id: true },
  });
  if (!pub) return { ok: false, error: 'La publicación no existe en esta cuenta.' };
  try {
    const message = await run();
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, message };
  } catch (e) {
    if (e instanceof CatalogError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Elige la categoría a mano. Null vuelve a la de la familia. */
export async function setCatalogCategoryAction(accountSlug: string, publicationId: string, categoryId: string | null): Promise<Result> {
  return guard(accountSlug, publicationId, async () => {
    await saveCatalogData(prisma, { publicationId, category: categoryId, values: {} });
    return 'Categoría cambiada.';
  });
}

export async function saveCatalogAction(
  accountSlug: string,
  publicationId: string,
  categoryId: string,
  values: Record<string, string>,
): Promise<Result> {
  return guard(accountSlug, publicationId, async () => {
    await saveCatalogData(prisma, { publicationId, expectedCategoryId: categoryId, values });
    return 'Guardado.';
  });
}
