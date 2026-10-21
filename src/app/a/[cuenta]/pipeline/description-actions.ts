'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { AI_NOT_CONFIGURED, isAiConfigured } from '@/ai/claude';
import { DescriptionError, proposeDescription, saveDescription, saveDescriptionSettings, type DescriptionSettingsInput } from '@/lib/descriptions';

// Lo que se hace desde el paso Descripción y desde Ajustes, Descripciones:
// pedir la propuesta de Claude, guardar la descripción en el borrador y
// guardar el encabezado y el pie de la cuenta.

type Result = { ok: true; message?: string } | { ok: false; error: string };

const NO_ACCOUNT: Result = { ok: false, error: 'La cuenta no existe.' };

export async function proposeDescriptionAction(accountSlug: string, publicationId: string): Promise<Result> {
  const user = await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return NO_ACCOUNT;
  if (!isAiConfigured()) return { ok: false, error: AI_NOT_CONFIGURED };
  const r = await proposeDescription(prisma, { accountId: account.id, publicationId: String(publicationId), userId: user.id });
  if (!r.ok) return r;
  revalidatePath(`/a/${accountSlug}/pipeline/${publicationId}`);
  return { ok: true, message: 'Claude propuso la descripción.' };
}

export async function saveDescriptionAction(accountSlug: string, publicationId: string, body: string, withFrame: boolean): Promise<Result> {
  await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return NO_ACCOUNT;
  try {
    const r = await saveDescription(prisma, { accountId: account.id, publicationId: String(publicationId), body: String(body ?? ''), withFrame: Boolean(withFrame) });
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, message: ['Guardada en el borrador.', ...r.warnings].join(' ') };
  } catch (e) {
    if (e instanceof DescriptionError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function saveDescriptionSettingsAction(accountSlug: string, input: DescriptionSettingsInput): Promise<Result> {
  await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return NO_ACCOUNT;
  try {
    await saveDescriptionSettings(prisma, account.id, {
      header: String(input?.header ?? ''),
      footer: String(input?.footer ?? ''),
      guidelines: String(input?.guidelines ?? ''),
    });
  } catch (e) {
    if (e instanceof DescriptionError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath(`/a/${accountSlug}`, 'layout');
  return { ok: true };
}
