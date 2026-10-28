'use server';

import { revalidatePath } from 'next/cache';
import { act } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { StockError } from '@/domain/stock';
import { dropOrphanStock, markStockReviewed, setProductStock } from '@/lib/stock';

// El stock del producto: cambiarlo a mano, que se sube solo a sus
// publicaciones, marcar como revisado lo que había para revisar y borrar el
// de medidas que ya no están en la ficha.

type Result = { ok: true; message: string } | { ok: false; error: string };

export async function setProductStockAction(accountSlug: string, productId: string, stock: Record<string, string>): Promise<Result> {
  return act(accountSlug, { section: 'productos', does: 'Cambió el stock del producto', productId }, async ({ user, account }) => {
    try {
      const r = await setProductStock(prisma, { accountId: account.id, productId: String(productId), userId: user.id, stock });
      revalidatePath(`/a/${accountSlug}`, 'layout');
      const sent = r.sync.sent > 0 ? ` Se subió a ${r.sync.sent === 1 ? '1 publicación' : `${r.sync.sent} publicaciones`}.` : '';
      const failed = r.sync.failed.length > 0 ? ` No se pudo subir a ${r.sync.failed.map((f) => `«${f.title}» (${f.error})`).join(', ')}: se vuelve a probar sola cada hora.` : '';
      return { ok: true, message: `${r.changed === 0 ? 'No cambió nada.' : 'Guardado.'}${sent}${failed}` };
    } catch (e) {
      if (e instanceof StockError) return { ok: false, error: e.message };
      throw e;
    }
  });
}

export async function markStockReviewedAction(accountSlug: string, productId: string): Promise<Result> {
  return act(accountSlug, { section: 'productos', does: 'Revisó el stock del producto', productId }, async ({ account }) => {
    await markStockReviewed(prisma, { accountId: account.id, productId: String(productId) });
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, message: 'Listo.' };
  });
}

export async function dropOrphanStockAction(accountSlug: string, productId: string, key: string): Promise<Result> {
  return act(accountSlug, { section: 'productos', does: 'Borró el stock de una medida que ya no está en la ficha', productId }, async ({ user, account }) => {
    try {
      await dropOrphanStock(prisma, { accountId: account.id, productId: String(productId), key: String(key), userId: user.id });
      revalidatePath(`/a/${accountSlug}`, 'layout');
      return { ok: true, message: 'Borrado.' };
    } catch (e) {
      if (e instanceof StockError) return { ok: false, error: e.message };
      throw e;
    }
  });
}
