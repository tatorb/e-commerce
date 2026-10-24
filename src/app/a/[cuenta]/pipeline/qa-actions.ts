'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { QaError, saveQaTexts, setAutoAnswer } from '@/lib/publication-qa';

// Lo que se guarda desde el paso Preguntas y respuestas.

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function guard(accountSlug: string, run: (accountId: string) => Promise<string>): Promise<Result> {
  await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return { ok: false, error: 'La cuenta no existe.' };
  try {
    const message = await run(account.id);
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, message };
  } catch (e) {
    if (e instanceof QaError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Las preguntas frecuentes o las reglas, en HTML. */
export async function saveQaTextAction(accountSlug: string, publicationId: string, field: 'faq' | 'rules', html: string): Promise<Result> {
  if (field !== 'faq' && field !== 'rules') return { ok: false, error: 'El campo no es válido.' };
  return guard(accountSlug, async (accountId) => {
    await saveQaTexts(prisma, { accountId, publicationId: String(publicationId), [field]: String(html ?? '') });
    return 'Guardado.';
  });
}

export async function setAutoAnswerAction(accountSlug: string, publicationId: string, on: boolean): Promise<Result> {
  return guard(accountSlug, async (accountId) => {
    await setAutoAnswer(prisma, { accountId, publicationId: String(publicationId), on: on === true });
    return on === true ? 'Listo. Claude manda solo las respuestas de las que está seguro.' : 'Listo. Las respuestas las manda una persona.';
  });
}
