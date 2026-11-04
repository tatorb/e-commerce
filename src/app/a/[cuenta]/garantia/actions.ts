'use server';

import { revalidatePath } from 'next/cache';
import { act } from '@/lib/auth/guard';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { WarrantyError, warrantyFromInput } from '@/domain/warranty';
import { accountWarranty, setAccountWarranty, setWarranties, type WarrantyPlan } from '@/lib/warranty';

// Ajustes, Garantía: la garantía de la cuenta y cargarla en todas las publicaciones.

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Guarda la garantía de la cuenta, o la saca con null. No cambia ninguna publicación. */
export async function saveAccountWarrantyAction(accountSlug: string, input: unknown): Promise<Result> {
  return act(accountSlug, { section: 'precios', does: input === null ? 'Sacó la garantía de la cuenta' : 'Guardó la garantía de la cuenta' }, async () => {
    await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    try {
      await setAccountWarranty(prisma, account.id, input === null ? null : warrantyFromInput(input));
    } catch (e) {
      if (e instanceof WarrantyError) return { ok: false, error: e.message };
      throw e;
    }
    revalidatePath(`/a/${accountSlug}/garantia`);
    return { ok: true };
  });
}

/**
 * Carga la garantía de la cuenta en todas sus publicaciones. Con dryRun solo
 * cuenta cuántas cambian, sin tocar nada. Quedan en Por subir: nada se manda
 * al canal desde acá.
 */
export async function applyAccountWarrantyAction(accountSlug: string, dryRun: boolean): Promise<Result<{ plan: Omit<WarrantyPlan, 'changing'> & { changing: number } }>> {
  return act(accountSlug, dryRun ? { section: 'publicaciones', level: 'read' } : { section: 'publicaciones', does: 'Cargó la garantía de la cuenta en las publicaciones' }, async () => {
    await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    const warranty = await accountWarranty(prisma, account.id);
    if (!warranty) return { ok: false, error: 'Primero guardá la garantía de la cuenta.' };
    const plan = await setWarranties(prisma, { accountId: account.id, warranty, dryRun: dryRun === true });
    if (!dryRun) {
      revalidatePath(`/a/${accountSlug}/publicaciones`, 'layout');
      revalidatePath(`/a/${accountSlug}/pipeline`, 'layout');
    }
    return { ok: true, plan: { ...plan, changing: plan.changing.length } };
  });
}
