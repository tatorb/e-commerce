'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { questionStores, readQuestions } from '@/lib/buyer-questions';

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Lo que lee cada pedido desde la pantalla: corto, así se ve el avance.
const STEP_BUDGET_MS = 12_000;

/** Lee las preguntas de las tiendas de la cuenta. pending: quedó algo para el próximo pedido. */
export async function readQuestionsAction(accountSlug: string): Promise<Result<{ pending: boolean; added: number; busy: boolean }>> {
  await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return { ok: false, error: 'La cuenta no existe.' };
  const stores = await questionStores(prisma, account.id);
  if (stores.length === 0) return { ok: false, error: 'No hay tiendas conectadas de un canal que deje leer las preguntas.' };
  let pending = false;
  let busy = false;
  let added = 0;
  const errors: string[] = [];
  for (const store of stores) {
    try {
      const r = await readQuestions(prisma, store.id, { budgetMs: STEP_BUDGET_MS / stores.length });
      added += r.added;
      if (r.status === 'pending') pending = true;
      if (r.status === 'busy') busy = true;
      if (r.error) errors.push(stores.length > 1 ? `${store.name}: ${r.error}` : r.error);
    } catch (e) {
      console.error('No se pudieron leer las preguntas', e instanceof Error ? e.message : e);
      errors.push('No se pudieron leer las preguntas. Probá de nuevo.');
    }
  }
  revalidatePath(`/a/${accountSlug}`, 'layout');
  if (errors.length > 0) return { ok: false, error: errors.join(' ') };
  return { ok: true, pending, added, busy };
}
