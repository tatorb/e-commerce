'use server';

import { revalidatePath } from 'next/cache';
import { act } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { readAllSales } from '@/lib/sales/read';
import { saleAlarmPass } from '@/lib/sales/alarms';
import { readerStatus } from '@/lib/sales/queries';

// Traer las ventas ahora, sin esperar la lectura de cada hora. Cada llamada
// lee lo que alcanza en su tiempo; la pantalla vuelve a llamar mientras quede.

const BUDGET_MS = 25_000;

export type ReadNowResult = { ok: true; pending: boolean; read: number; completed: number; message: string } | { ok: false; error: string };

export async function readSalesNowAction(accountSlug: string): Promise<ReadNowResult> {
  return act(accountSlug, { section: 'ventas', level: 'read' }, async ({ account }) => {
    const r = await readAllSales(prisma, { budgetMs: BUDGET_MS, accountId: account.id });
    await saleAlarmPass(prisma, { accountId: account.id });
    const status = await readerStatus(prisma, account.id);
    revalidatePath(`/a/${accountSlug}/ventas`, 'layout');
    const error = status.find((s) => s.lastError)?.lastError;
    if (error && r.read === 0 && r.completed === 0) return { ok: false as const, error };
    const history = status.find((s) => s.history && !s.history.done)?.history;
    const message = r.pending
      ? `Sigue leyendo${history ? `: el historial va por el ${history.pct} %` : ''}.`
      : 'Listo, las ventas están al día.';
    return { ok: true as const, pending: r.pending, read: r.read, completed: r.completed, message };
  });
}
