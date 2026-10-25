'use server';

import { act } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { SUGGESTED_RULES, isCheckKey, readParams } from '@/domain/standard';

export type Result = { ok: true } | { ok: false; error: string };

async function accountIdFor(slug: string): Promise<string | null> {
  const account = await prisma.account.findUnique({ where: { slug }, select: { id: true } });
  return account?.id ?? null;
}

function revalidate(slug: string) {
  revalidatePath(`/a/${slug}/estandar`);
  revalidatePath(`/a/${slug}/publicaciones`);
  revalidatePath(`/a/${slug}/productos`, 'layout');
}

const ruleSchema = z.object({
  name: z.string().trim().min(1, 'Poné un nombre para la regla.').max(120),
  description: z.string().trim().max(500),
  check: z.string().refine(isCheckKey, 'Elegí qué revisa la regla.'),
  params: z.record(z.string(), z.union([z.number(), z.string()])),
  weight: z.coerce
    .number({ message: 'El peso tiene que ser un número.' })
    .int('El peso tiene que ser un número entero.')
    .min(1, 'El peso va de 1 a 100.')
    .max(100, 'El peso va de 1 a 100.'),
  active: z.boolean(),
});

export type RuleInput = z.input<typeof ruleSchema>;

export async function saveRuleAction(
  accountSlug: string,
  channelId: string,
  ruleId: string | null,
  input: RuleInput,
): Promise<Result> {
  return act(accountSlug, { section: 'estandar', does: 'Guardó una regla del estándar' }, async () => {
    await requireUser();
    const accountId = await accountIdFor(accountSlug);
    if (!accountId) return { ok: false, error: 'La cuenta no existe.' };
    const parsed = ruleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };

    const { name, description, check, weight, active } = parsed.data;
    const params = readParams(check as Parameters<typeof readParams>[0], parsed.data.params);
    if (check === 'title_length' && params.min > params.max) {
      return { ok: false, error: 'El mínimo de caracteres no puede ser mayor que el máximo.' };
    }
    const data = { name, description: description || null, check, params, weight, active };

    if (ruleId) {
      const { count } = await prisma.standardRule.updateMany({ where: { id: ruleId, accountId }, data });
      if (count === 0) return { ok: false, error: 'La regla ya no existe.' };
    } else {
      const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
      if (!channel) return { ok: false, error: 'El canal no existe.' };
      const last = await prisma.standardRule.aggregate({ where: { accountId, channelId }, _max: { position: true } });
      await prisma.standardRule.create({
        data: { ...data, accountId, channelId, position: (last._max.position ?? -1) + 1 },
      });
    }
    revalidate(accountSlug);
    return { ok: true };
  });
}

export async function deleteRuleAction(accountSlug: string, ruleId: string): Promise<Result> {
  return act(accountSlug, { section: 'estandar', does: 'Borró una regla del estándar' }, async () => {
    await requireUser();
    const accountId = await accountIdFor(accountSlug);
    if (!accountId) return { ok: false, error: 'La cuenta no existe.' };
    const { count } = await prisma.standardRule.deleteMany({ where: { id: ruleId, accountId } });
    if (count === 0) return { ok: false, error: 'La regla ya no existe.' };
    revalidate(accountSlug);
    return { ok: true };
  });
}

/** Carga las reglas sugeridas, solo si la cuenta no tiene reglas para ese canal. */
export async function loadSuggestedRulesAction(accountSlug: string, channelId: string): Promise<Result> {
  return act(accountSlug, { section: 'estandar', does: 'Cargó las reglas sugeridas del estándar' }, async () => {
    await requireUser();
    const accountId = await accountIdFor(accountSlug);
    if (!accountId) return { ok: false, error: 'La cuenta no existe.' };
    const existing = await prisma.standardRule.count({ where: { accountId, channelId } });
    if (existing > 0) return { ok: false, error: 'Esta cuenta ya tiene reglas para este canal.' };
    await prisma.standardRule.createMany({
      data: SUGGESTED_RULES.map((r, position) => ({
        accountId,
        channelId,
        name: r.name,
        description: r.description,
        check: r.check,
        params: r.params ?? {},
        weight: r.weight,
        active: r.active,
        position,
      })),
    });
    revalidate(accountSlug);
    return { ok: true };
  });
}
