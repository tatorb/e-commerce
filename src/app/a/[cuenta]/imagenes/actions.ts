'use server';

import { act } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import type { PhotoSettingsInput } from '@/domain/photo-settings';
import { PhotoSettingsError, resetPhotoSettings, savePhotoSettings } from '@/lib/photo-settings';

type Result = { ok: true } | { ok: false; error: string };

/** Guarda los ajustes de la línea de imágenes de la cuenta. Valen para los pasos que se hagan desde ahora. */
export async function savePhotoSettingsAction(accountSlug: string, input: PhotoSettingsInput): Promise<Result> {
  return act(accountSlug, { section: 'imagenes', does: 'Guardó los ajustes de imágenes' }, async () => {
    const user = await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    try {
      await savePhotoSettings(prisma, { accountId: account.id, userId: user.id, input });
    } catch (e) {
      if (e instanceof PhotoSettingsError) return { ok: false, error: e.message };
      throw e;
    }
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true };
  });
}

/** Vuelve a los valores de siempre. */
export async function resetPhotoSettingsAction(accountSlug: string): Promise<Result> {
  return act(accountSlug, { section: 'imagenes', does: 'Volvió a los ajustes de imágenes de fábrica' }, async () => {
    await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    await resetPhotoSettings(prisma, account.id);
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true };
  });
}
