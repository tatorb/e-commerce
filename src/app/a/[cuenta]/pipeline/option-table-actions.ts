'use server';

import { revalidatePath } from 'next/cache';
import { act } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { loadOptionTable, type OptionTable } from '@/lib/option-table';
import { PricingError, saveFlatPrice } from '@/lib/pricing';

// La tabla de precios por modo de compra: se pide al abrir la tarjeta, porque lee las campañas del canal.

export type OptionTableResult = { ok: true; table: OptionTable } | { ok: false; error: string };

export async function loadOptionTableAction(accountSlug: string, publicationId: string): Promise<OptionTableResult> {
  return act(accountSlug, { section: ['pipeline', 'publicaciones'], level: 'read' }, async ({ account }) => {
    const table = await loadOptionTable(prisma, { accountId: account.id, publicationId: String(publicationId) }).catch(() => null);
    return table ? { ok: true, table } : { ok: false, error: 'No se pudo armar la tabla de precios.' };
  });
}

export type SaveFlatResult =
  | { ok: true; lines: { code: string; plan: string; price: number | null; text: string | null }[] }
  | { ok: false; error: string };

/**
 * Guarda la tabla desde el precio sin cuotas: cada publicación de la pestaña
 * queda con el precio de su modo de compra, en Por subir. No manda nada al canal.
 */
export async function saveFlatPriceAction(accountSlug: string, publicationId: string, flatPrice: number, confirmBelowMin: boolean): Promise<SaveFlatResult> {
  return act(accountSlug, { section: ['pipeline'], does: 'Guardó el precio desde la tabla por modo de compra', publicationId }, async ({ user, account }) => {
    const flat = Number(flatPrice);
    if (!Number.isFinite(flat) || flat <= 0 || flat > 999_999_999) return { ok: false, error: 'Cargá el precio sin cuotas.' };
    try {
      const r = await saveFlatPrice(prisma, { accountId: account.id, publicationId: String(publicationId), userId: user.id, flatPrice: flat, confirmBelowMin: confirmBelowMin === true });
      const main = await prisma.publication.findUnique({ where: { id: r.main.id }, select: { externalId: true } });
      revalidatePath(`/a/${accountSlug}`, 'layout');
      return {
        ok: true,
        lines: [
          { code: main?.externalId ?? 'Sin publicar', plan: r.main.planLabel, price: r.main.listPrice, text: null },
          ...r.options.map((o) => ({ code: o.externalId ?? 'Sin publicar', plan: o.planLabel, price: o.listPrice, text: o.reason ?? o.note })),
        ],
      };
    } catch (e) {
      if (e instanceof PricingError) return { ok: false, error: e.message };
      throw e;
    }
  });
}
