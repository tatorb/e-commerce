'use server';

import { formatPrice } from '@/domain/money';
import { act } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { pricingInputSchema } from '@/domain/pricing';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { PricingError, savePriceDecision, savePricingSettings } from '@/lib/pricing';
import { readPromotions, type PromotionsResult } from '@/lib/channel-promotions';
import { CampaignError, cancelCampaign, familyCampaignAction, queueCampaign, type CampaignChoice } from '@/lib/channel-campaigns';
import { familyCampaignInput, type FamilyCampaignActionResult, type FamilyCampaignInput } from '@/lib/family-campaign-input';
import { z } from 'zod';

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
    let options: Awaited<ReturnType<typeof savePriceDecision>>['options'] = [];
    try {
      ({ options } = await savePriceDecision(prisma, {
        accountId: account.id,
        publicationId,
        userId: user.id,
        listPrice: Number(input.listPrice),
        discountPct: Number(input.discountPct),
        plan: Number(input.plan),
        overrides: overrides.data,
        confirmBelowMin: input.confirmBelowMin === true,
      }));
    } catch (e) {
      if (e instanceof PricingError) return { ok: false, error: e.message };
      throw e;
    }
    revalidatePath(`/a/${accountSlug}`, 'layout');
    // Las otras opciones de venta de la medida, cada una con el precio de su forma de cobro.
    const others = options.map((o) =>
      o.listPrice === null
        ? `${o.externalId ?? 'Otra opción'} (${o.planLabel.toLowerCase()}) queda sin precio: ${o.reason}`
        : `${o.externalId ?? 'Otra opción'} (${o.planLabel.toLowerCase()}) queda en ${formatPrice(o.listPrice)}.${o.note ? ` ${o.note}` : ''}`,
    );
    return { ok: true, message: ['Precio guardado.', ...others].join(' ') };
  });
}

/** Lo que el canal deja hacer hoy con el descuento de las publicaciones de una pestaña. Solo lee. */
export async function readPromotionsAction(accountSlug: string, publicationIds: string[], opts?: { family?: boolean }): Promise<PromotionsResult> {
  const ids = Array.isArray(publicationIds) ? publicationIds.filter((id): id is string => typeof id === 'string').slice(0, 20) : [];
  return act(accountSlug, { section: ['pipeline', 'publicaciones'], level: 'read' }, ({ account }) =>
    readPromotions(prisma, { accountId: account.id, publicationIds: ids, family: opts?.family === true }),
  );
}

/** Desde el paso Precio y el paso Publicación: queda en Por subir para todas las medidas que pueden. */
export async function queueFamilyCampaignAction(accountSlug: string, input: FamilyCampaignInput): Promise<FamilyCampaignActionResult> {
  const parsed = familyCampaignInput.safeParse(input);
  const does = parsed.success && parsed.data.action === 'leave' ? 'Dejó para subir: salir de una campaña' : 'Dejó para subir: sumarse a una campaña';
  return act<FamilyCampaignActionResult>(accountSlug,
    { section: ['pipeline'], does, publicationId: parsed.success ? parsed.data.publicationIds[0] : null, targetOf: (r) => (r.ok ? r.name : null) },
    async ({ user, account }): Promise<FamilyCampaignActionResult> => {
      if (!parsed.success) return { ok: false as const, error: 'Revisá la campaña y el precio.' };
      try {
        const r = await familyCampaignAction(prisma, { accountId: account.id, ...parsed.data, mode: 'queue', userId: user.id });
        revalidatePath(`/a/${accountSlug}`, 'layout');
        return { ok: true as const, name: r.name, results: r.results };
      } catch (e) {
        if (e instanceof CampaignError) return { ok: false as const, error: e.message };
        throw e;
      }
    },
  );
}

type CampaignResult = { ok: true } | { ok: false; error: string };

const campaignChoice = z.object({
  action: z.enum(['join', 'leave']),
  ref: z.string().min(1).max(500),
  name: z.string().max(200),
  kind: z.string().max(200),
  price: z.number().positive().max(999_999_999).nullable(),
  pausesOwnDiscount: z.boolean().optional(),
});

/** Desde el paso Precio: sumarse a una campaña o salir queda en Por subir. */
export async function queueCampaignAction(accountSlug: string, publicationId: string, choice: CampaignChoice): Promise<CampaignResult> {
  const parsed = campaignChoice.safeParse(choice);
  const does = parsed.success && parsed.data.action === 'leave' ? 'Dejó para subir: salir de una campaña' : 'Dejó para subir: sumarse a una campaña';
  return act(accountSlug, { section: ['pipeline'], does, publicationId, detail: parsed.success ? parsed.data.name : null }, async ({ user, account }) => {
    if (!parsed.success) return { ok: false, error: 'Revisá la campaña y el precio.' };
    try {
      await queueCampaign(prisma, { accountId: account.id, publicationId, choice: parsed.data, userId: user.id });
    } catch (e) {
      if (e instanceof CampaignError) return { ok: false, error: e.message };
      throw e;
    }
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true };
  });
}

/** Saca de Por subir un pedido de sumarse o salir, sin mandarlo. */
export async function cancelCampaignAction(accountSlug: string, requestId: string): Promise<CampaignResult> {
  return act(accountSlug, { section: ['pipeline', 'subir'], does: 'Sacó de Por subir un pedido de campaña' }, async ({ account }) => {
    try {
      await cancelCampaign(prisma, { accountId: account.id, requestId: String(requestId ?? '') });
    } catch (e) {
      if (e instanceof CampaignError) return { ok: false, error: e.message };
      throw e;
    }
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true };
  });
}
