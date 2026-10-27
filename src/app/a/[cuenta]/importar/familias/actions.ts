'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { act } from '@/lib/auth/guard';
import { applyFamilies, type ApplyFamiliesResult } from '@/lib/family-apply';
import { FamilyError, setPublicationMeasure } from '@/lib/families';
import { plural } from '@/lib/format';

// La pantalla Familias: elegir a mano la medida que no se sabe por el SKU, y
// aplicar lo que muestra la vista previa en una tienda.

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const section = 'importar' as const;

export async function setMeasureAction(accountSlug: string, publicationId: string, variantKey: string): Promise<Result> {
  return act(accountSlug, { section, does: 'Eligió la medida de una publicación', publicationId: String(publicationId) }, async ({ account }) => {
    try {
      await setPublicationMeasure(prisma, { accountId: account.id, publicationId: String(publicationId), variantKey: String(variantKey) });
    } catch (e) {
      if (e instanceof FamilyError) return { ok: false, error: e.message };
      throw e;
    }
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true };
  });
}

type Applied = Result<{ result: ApplyFamiliesResult }>;

export async function applyFamiliesAction(accountSlug: string, storeId: string): Promise<Applied> {
  const spec = {
    section,
    does: 'Juntó las medidas en familias',
    targetOf: (r: Applied) => (r.ok ? plural(r.result.families + r.result.split, 'familia', 'familias') : null),
  };
  return act<Applied>(accountSlug, spec, async ({ user, account }): Promise<Applied> => {
      const store = await prisma.store.findFirst({ where: { id: String(storeId), accountId: account.id }, select: { id: true } });
      if (!store) return { ok: false, error: 'La tienda no es de esta cuenta.' };
      const result = await applyFamilies(prisma, { accountId: account.id, storeId: store.id, userId: user.id });
      revalidatePath(`/a/${accountSlug}`, 'layout');
      return { ok: true, result };
  });
}
