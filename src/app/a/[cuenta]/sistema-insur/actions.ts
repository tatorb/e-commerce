'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { act } from '@/lib/auth/guard';
import { approveInsur, InsurError, INSUR_SLUG, saveInsurSettings, setInsurLink } from '@/lib/insur';
import { fromZonedInput } from '@/lib/zoned-input';

// La pantalla Sistema de Insur: aprobar la primera corrida, mover la fecha de
// corte y confirmar o ignorar un cruce dudoso. Todo cambia cómo se corrigen el
// stock y el costo: lo pide el permiso de editar Productos.

type Result = { ok: true; message: string } | { ok: false; error: string };

const onlyInsur = (slug: string): Result | null => (slug === INSUR_SLUG ? null : { ok: false, error: 'Esta cuenta no usa el sistema de Insur.' });

export async function approveInsurAction(accountSlug: string) {
  const spec = { section: 'productos', does: 'Aprobó la primera corrida del sistema de Insur' } as const;
  return act<Result>(accountSlug, spec, async ({ account, user }) => {
    const no = onlyInsur(account.slug);
    if (no) return no;
    await approveInsur(prisma, { accountId: account.id, userId: user.id });
    revalidatePath(`/a/${account.slug}/sistema-insur`);
    return { ok: true, message: 'Aprobado. Desde ahora cada corrida de la extensión corrige el stock y el costo.' };
  });
}

export async function saveInsurSettingsAction(accountSlug: string, input: { cutoff: string; fichaEveryDays: number }) {
  const spec = { section: 'productos', does: 'Cambió la fecha de corte del sistema de Insur' } as const;
  return act<Result>(accountSlug, spec, async ({ account }) => {
    const no = onlyInsur(account.slug);
    if (no) return no;
    const cutoffAt = fromZonedInput(String(input?.cutoff ?? ''), account.timezone);
    if (!cutoffAt) return { ok: false, error: 'La fecha de corte no vale.' };
    try {
      await saveInsurSettings(prisma, { accountId: account.id, cutoffAt, fichaEveryDays: Number(input?.fichaEveryDays) });
    } catch (e) {
      if (e instanceof InsurError) return { ok: false, error: e.message };
      throw e;
    }
    revalidatePath(`/a/${account.slug}/sistema-insur`);
    return { ok: true, message: 'Guardado. Vale desde la corrida siguiente.' };
  });
}

export async function setInsurLinkAction(accountSlug: string, linkId: string, choice: { ignore: true } | { productId: string; key: string }) {
  const ignore = 'ignore' in choice;
  const spec = { section: 'productos', does: ignore ? 'Ignoró un artículo del sistema de Insur' : 'Confirmó un cruce con el sistema de Insur' } as const;
  return act<Result>(accountSlug, spec, async ({ account, user }) => {
    const no = onlyInsur(account.slug);
    if (no) return no;
    try {
      const r = await setInsurLink(prisma, {
        accountId: account.id,
        link: String(linkId),
        choice: ignore ? { ignore: true } : { productId: String(choice.productId), key: String(choice.key) },
        userId: user.id,
      });
      revalidatePath(`/a/${account.slug}/sistema-insur`);
      return { ok: true, message: r.status === 'IGNORED' ? `${r.code} quedó ignorado.` : `${r.code} quedó cruzado con ${r.product}${r.measure ? `, medida ${r.measure}` : ''}. Se corrige en la corrida siguiente.` };
    } catch (e) {
      if (e instanceof InsurError) return { ok: false, error: e.message };
      throw e;
    }
  });
}
