'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { ComboError, setComboItems, type ComboItemInput } from '@/domain/combos';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { searchComboCandidates, type ComboProduct } from '@/lib/queries/combos';

// Lo que se hace desde la tarjeta Productos del combo, en la ficha y en el
// paso Información.

type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function searchComboProductsAction(
  accountSlug: string,
  comboId: string,
  q: string,
): Promise<Omit<ComboProduct, 'quantity'>[]> {
  await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return [];
  return searchComboCandidates(prisma, account.id, comboId, q);
}

export async function saveComboItemsAction(accountSlug: string, comboId: string, items: ComboItemInput[]): Promise<Result> {
  await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return { ok: false, error: 'La cuenta no existe.' };
  try {
    await prisma.$transaction((tx) => setComboItems(tx, { accountId: account.id, comboId, items }));
  } catch (e) {
    if (e instanceof ComboError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath(`/a/${accountSlug}`, 'layout');
  return { ok: true, message: 'Guardado.' };
}
