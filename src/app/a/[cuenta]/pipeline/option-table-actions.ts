'use server';

import { act } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { loadOptionTable, type OptionTable } from '@/lib/option-table';

// La tabla de precios por modo de compra: se pide al abrir la tarjeta, porque lee las campañas del canal.

export type OptionTableResult = { ok: true; table: OptionTable } | { ok: false; error: string };

export async function loadOptionTableAction(accountSlug: string, publicationId: string): Promise<OptionTableResult> {
  return act(accountSlug, { section: ['pipeline', 'publicaciones'], level: 'read' }, async ({ account }) => {
    const table = await loadOptionTable(prisma, { accountId: account.id, publicationId: String(publicationId) }).catch(() => null);
    return table ? { ok: true, table } : { ok: false, error: 'No se pudo armar la tabla de precios.' };
  });
}
