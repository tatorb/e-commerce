'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { titleRulesInputSchema, type TitleRulesInput } from '@/domain/title-rules';

type Result = { ok: true } | { ok: false; error: string };

async function target(accountSlug: string, channelId: string) {
  const account = await getAccountBySlug(accountSlug);
  if (!account) return null;
  const store = await prisma.store.findFirst({ where: { accountId: account.id, channelId }, select: { id: true } });
  return store ? account : null;
}

/** Guarda las reglas de título de la cuenta para ese canal. */
export async function saveTitleRulesAction(accountSlug: string, channelId: string, input: TitleRulesInput): Promise<Result> {
  const user = await requireUser();
  const account = await target(accountSlug, channelId);
  if (!account) return { ok: false, error: 'La cuenta no tiene tienda en ese canal.' };
  const parsed = titleRulesInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };
  const data = { ...parsed.data, updatedById: user.id };
  await prisma.titleRuleSet.upsert({
    where: { accountId_channelId: { accountId: account.id, channelId } },
    update: data,
    create: { ...data, accountId: account.id, channelId },
  });
  revalidatePath(`/a/${accountSlug}`, 'layout');
  return { ok: true };
}

/** Vuelve a las reglas del canal: borra las de la cuenta. */
export async function resetTitleRulesAction(accountSlug: string, channelId: string): Promise<Result> {
  await requireUser();
  const account = await target(accountSlug, channelId);
  if (!account) return { ok: false, error: 'La cuenta no tiene tienda en ese canal.' };
  await prisma.titleRuleSet.deleteMany({ where: { accountId: account.id, channelId } });
  revalidatePath(`/a/${accountSlug}`, 'layout');
  return { ok: true };
}
