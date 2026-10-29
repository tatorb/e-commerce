'use server';

import { act } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { pricingInputSchema } from '@/domain/pricing';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { PricingError, savePriceDecision, savePricingSettings } from '@/lib/pricing';
import { readPromotions, type PromotionsResult } from '@/lib/channel-promotions';

// Lo que se hace desde el paso Precio y desde Ajustes > Precios.

type Result = { ok: true; message?: string } | { ok: false; error: string };

const NO_ACCOUNT: Result = { ok: false, error: 'La cuenta no existe.' };

/** Los parámetros de la cuenta, escritos a mano: vacío vuelve al valor de partida. */
export async function savePricingSettingsAction(accountSlug: string, values: Record<string, string>): Promise<Result> {
  return act(accountSlug, { section: 'precios', does: 'Guardó los ajustes de precios' }, async () => {
    const user = await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return NO_ACCOUNT;
    const parsed = pricingInputSchema.safeParse(values ?? {});
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };
    await savePricingSettings(prisma, { accountId: account.id, userId: user.id, values: parsed.data });
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, message: 'Parámetros guardados.' };
  });
}

export type PriceDecisionInput = {
  listPrice: number;
  discountPct: number;
  plan: number;
  // Los parámetros propios del producto, como se escriben; vacío sigue a la cuenta.
  overrides: Record<string, string>;
  confirmBelowMin: boolean;
};

/** Guarda el precio decidido en una pestaña del paso Precio: la publicación es cualquiera de la pestaña. */
export async function savePriceDecisionAction(accountSlug: string, publicationId: string, input: PriceDecisionInput): Promise<Result> {
  return act(accountSlug, { section: ['pipeline'], does: 'Guardó el precio', publicationId }, async () => {
    const user = await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return NO_ACCOUNT;
    const overrides = pricingInputSchema.safeParse(input?.overrides ?? {});
    if (!overrides.success) return { ok: false, error: overrides.error.issues[0]?.message ?? 'Revisá los parámetros.' };
    try {
      await savePriceDecision(prisma, {
        accountId: account.id,
        publicationId,
        userId: user.id,
        listPrice: Number(input.listPrice),
        discountPct: Number(input.discountPct),
        plan: Number(input.plan),
        overrides: overrides.data,
        confirmBelowMin: input.confirmBelowMin === true,
      });
    } catch (e) {
      if (e instanceof PricingError) return { ok: false, error: e.message };
      throw e;
    }
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, message: 'Precio guardado.' };
  });
}

/** Lo que el canal deja hacer hoy con el descuento de las publicaciones de una pestaña. Solo lee. */
export async function readPromotionsAction(accountSlug: string, publicationIds: string[]): Promise<PromotionsResult> {
  const ids = Array.isArray(publicationIds) ? publicationIds.filter((id): id is string => typeof id === 'string').slice(0, 20) : [];
  return act(accountSlug, { section: ['pipeline'], level: 'read' }, ({ account }) => readPromotions(prisma, { accountId: account.id, publicationIds: ids }));
}
