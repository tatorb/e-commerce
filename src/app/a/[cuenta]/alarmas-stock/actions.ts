'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { act } from '@/lib/auth/guard';
import { saveStockTaskRecipients, StockRecipientsError } from '@/lib/stock-task-recipients';

// A quién le llegan las tareas de stock de la cuenta. Es asignar tareas: lo
// pide el permiso de editar Tareas.

type Result = { ok: true; added: number; removed: number } | { ok: false; error: string };

export async function saveStockTaskRecipientsAction(accountSlug: string, userIds: string[]) {
  const spec = { section: 'tareas', does: 'Eligió a quién le llegan las tareas de stock' } as const;
  return act<Result>(accountSlug, spec, async ({ account }) => {
    try {
      const r = await saveStockTaskRecipients(prisma, account.id, Array.isArray(userIds) ? userIds.map(String) : []);
      revalidatePath(`/a/${account.slug}/alarmas-stock`);
      return { ok: true, ...r };
    } catch (e) {
      if (e instanceof StockRecipientsError) return { ok: false, error: e.message };
      throw e;
    }
  });
}
