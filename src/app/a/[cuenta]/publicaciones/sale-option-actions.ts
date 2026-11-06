'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { act } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { SaleOptionError, setMainOption } from '@/lib/sale-options';

// Elegir la opción de venta principal de una medida, desde la publicación o el pipeline.

type Result = { ok: true; message: string } | { ok: false; error: string };

const idSchema = z.string().min(1).max(40);

export async function setMainOptionAction(accountSlug: string, publicationId: string, mainId: string): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'publicaciones'], does: 'Cambió la opción de venta principal', publicationId }, async ({ user, account }) => {
    const pub = idSchema.safeParse(publicationId);
    const main = idSchema.safeParse(mainId);
    if (!pub.success || !main.success) return { ok: false, error: 'La publicación no existe.' };
    try {
      const r = await setMainOption(prisma, { accountId: account.id, publicationId: pub.data, mainId: main.data, userId: user.id, reason: 'Se eligió a mano.' });
      revalidatePath(`/a/${accountSlug}`, 'layout');
      return { ok: true, message: r.changed ? `Listo. La principal ahora es ${r.to ?? 'la elegida'}.` : 'Ya era la principal.' };
    } catch (e) {
      if (e instanceof SaleOptionError) return { ok: false, error: e.message };
      throw e;
    }
  });
}
