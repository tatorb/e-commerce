'use server';

import { act } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { QaError, saveQaTexts, setAutoAnswer } from '@/lib/publication-qa';
import { ReplyError, tryAnswer, type TryResult } from '@/lib/answers';
import { AI_NOT_CONFIGURED, isAiConfigured } from '@/ai/claude';
import { ResearchError } from '@/domain/research';
import { TRAIN_BOT } from '@/domain/access';

// Lo que se guarda y se prueba desde Preguntas y respuestas, en el paso del
// Pipeline y en la página de la publicación.

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
  return act(accountSlug, { section: TRAIN_BOT, does: (field === 'rules' ? 'Guardó cuándo responde una persona' : 'Guardó las preguntas frecuentes'), publicationId }, async () => {
    if (field !== 'faq' && field !== 'rules') return { ok: false, error: 'El campo no es válido.' };
    return guard(accountSlug, async (accountId) => {
      await saveQaTexts(prisma, { accountId, publicationId: String(publicationId), [field]: String(html ?? '') });
      return 'Guardado.';
    });
  });
}

export async function setAutoAnswerAction(accountSlug: string, publicationId: string, on: boolean): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'publicaciones'], does: (on === true ? 'Prendió que Claude responda solo' : 'Apagó que Claude responda solo'), publicationId }, async () => {
    return guard(accountSlug, async (accountId) => {
      await setAutoAnswer(prisma, { accountId, publicationId: String(publicationId), on: on === true });
      return on === true ? 'Listo. Claude manda solo las respuestas de las que está seguro.' : 'Listo. Las respuestas las manda una persona.';
    });
  });
}

// Lo más largo que acepta Mercado Libre en una pregunta.
const MAX_QUESTION = 2000;

/** Una pregunta de prueba: Claude responde con lo escrito, aunque no esté guardado. No se manda nada. */
export async function tryAnswerAction(
  accountSlug: string,
  publicationId: string,
  input: { question: string; faq: string; rules: string },
): Promise<{ ok: true; result: TryResult } | { ok: false; error: string }> {
  return act(accountSlug, { section: TRAIN_BOT, does: 'Probó una respuesta de Claude', publicationId, detail: String(input?.question ?? '') }, async () => {
    await requireUser();
    const account = await getAccountBySlug(accountSlug);
    if (!account) return { ok: false, error: 'La cuenta no existe.' };
    if (!isAiConfigured()) return { ok: false, error: AI_NOT_CONFIGURED };
    const question = String(input?.question ?? '').trim();
    if (!question) return { ok: false, error: 'Escribí una pregunta.' };
    if (question.length > MAX_QUESTION) return { ok: false, error: `La pregunta puede tener hasta ${MAX_QUESTION} caracteres.` };
    try {
      const r = await tryAnswer(prisma, {
        accountId: account.id,
        publicationId: String(publicationId),
        question,
        faq: String(input?.faq ?? ''),
        rules: String(input?.rules ?? ''),
      });
      return r.ok ? r : { ok: false, error: r.error };
    } catch (e) {
      if (e instanceof ReplyError || e instanceof ResearchError) return { ok: false, error: e.message };
      throw e;
    }
  });
}
