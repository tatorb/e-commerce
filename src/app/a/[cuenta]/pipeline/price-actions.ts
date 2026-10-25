'use server';

import { act } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { parsePrice } from '@/domain/money';
import { pricingInputSchema } from '@/domain/pricing';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { PricingError, savePriceDecision, savePricingSettings } from '@/lib/pricing';

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
  // Como se escribe: "99.627,50".
  cost: string;
  // Los parámetros propios del producto, como se escriben; vacío sigue a la cuenta.
  overrides: Record<string, string>;
  confirmBelowMin: boolean;
};

/** Guarda el precio decidido en el paso Precio. */
export async function savePriceDecisionAction(accountSlug: string, publicationId: string, input: PriceDecisionInput): Promise<Result> {
  return act(accountSlug, { section: ['pipeline'], does: 'Guardó el precio', publicationId }, async () => {
    const user = await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return NO_ACCOUNT;
    const cost = parsePrice(String(input?.cost ?? ''));
    if (typeof cost !== 'number' || cost <= 0) return { ok: false, error: 'El costo de reposición tiene que ser un monto, por ejemplo 99.627,50.' };
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
        cost,
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
