'use server';

import { revalidatePath } from 'next/cache';
import { act } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { ConnectError } from '@/channels/connect';
import { CatalogError } from '@/domain/catalog-data';
import { CreateError } from '@/lib/channel-create';
import { applyRecreate, planRecreate, RecreateError, type RecreatePlan, type RecreateResult } from '@/lib/recreate';

// Recrear el producto en otra categoría, desde el paso Publicación.

type Failure = { ok: false; error: string };

const known = (e: unknown): Failure | null =>
  e instanceof RecreateError || e instanceof CatalogError || e instanceof ConnectError || e instanceof CreateError ? { ok: false, error: e.message } : null;

/** Lo que se va a hacer, sin cambiar nada. */
export async function planRecreateAction(accountSlug: string, publicationId: string, categoryId: string, allPlans: boolean): Promise<{ ok: true; plan: RecreatePlan } | Failure> {
  return act(accountSlug, { section: 'pipeline', level: 'read' }, async ({ account }) => {
    try {
      return { ok: true as const, plan: await planRecreate(prisma, { accountId: account.id, publicationId: String(publicationId), categoryId: String(categoryId), allPlans: allPlans !== false }) };
    } catch (e) {
      const f = known(e);
      if (f) return f;
      throw e;
    }
  });
}

/** Crea el producto en la categoría, le pasa el trabajo y finaliza las viejas. */
export async function applyRecreateAction(accountSlug: string, publicationId: string, categoryId: string, allPlans: boolean): Promise<{ ok: true; result: RecreateResult } | Failure> {
  return act(accountSlug, { section: 'subir', does: 'Recreó el producto en otra categoría', publicationId }, async ({ user, account }) => {
    try {
      const result = await applyRecreate(prisma, { accountId: account.id, publicationId: String(publicationId), categoryId: String(categoryId), allPlans: allPlans !== false, userId: user.id });
      revalidatePath(`/a/${accountSlug}`, 'layout');
      return { ok: true as const, result };
    } catch (e) {
      const f = known(e);
      if (f) return f;
      throw e;
    }
  });
}
