'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { AI_NOT_CONFIGURED, isAiConfigured } from '@/ai/claude';
import { ANSWER_MAX } from '@/domain/answers';
import { discardDraft, draftAnswer, questionsToDraft, ReplyError, saveAnswerSettings, sendAnswer } from '@/lib/answers';

// Responder desde la pantalla Preguntas: pedir la propuesta a Claude,
// mandarla, descartarla, y los ajustes de cómo responde la cuenta.

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Las que se proponen solas por pedido, al abrir la pantalla.
const DRAFTS_PER_STEP = 2;

const idSchema = z.string().min(1).max(40);

function refresh(accountSlug: string) {
  revalidatePath(`/a/${accountSlug}`, 'layout');
}

async function accountOf(accountSlug: string) {
  const user = await requireUser();
  const account = await getAccountBySlug(accountSlug);
  return account ? { user, account } : null;
}

/** Pide a Claude la propuesta para esa pregunta, u otra si ya había. */
export async function draftAnswerAction(accountSlug: string, questionId: string): Promise<Result<{ costUsd: number }>> {
  const ctx = await accountOf(accountSlug);
  if (!ctx) return { ok: false, error: 'La cuenta no existe.' };
  if (!isAiConfigured()) return { ok: false, error: AI_NOT_CONFIGURED };
  const id = idSchema.safeParse(questionId);
  if (!id.success) return { ok: false, error: 'La pregunta no existe.' };
  const r = await draftAnswer(prisma, { accountId: ctx.account.id, questionId: id.data });
  refresh(accountSlug);
  return r.ok ? { ok: true, costUsd: r.costUsd } : { ok: false, error: r.error };
}

/** Propone las que esperan respuesta y todavía no tienen propuesta, de a poco. */
export async function draftMissingAction(accountSlug: string): Promise<Result<{ drafted: number; pending: boolean }>> {
  const ctx = await accountOf(accountSlug);
  if (!ctx) return { ok: false, error: 'La cuenta no existe.' };
  if (!isAiConfigured()) return { ok: false, error: AI_NOT_CONFIGURED };
  const list = await questionsToDraft(prisma, { accountId: ctx.account.id, max: DRAFTS_PER_STEP + 1 });
  let drafted = 0;
  for (const q of list.slice(0, DRAFTS_PER_STEP)) {
    // Se proponen solas: en las publicaciones que lo dejan, Claude manda las que está seguro.
    const r = await draftAnswer(prisma, { accountId: ctx.account.id, questionId: q.id, auto: true });
    if (!r.ok) return { ok: false, error: r.error };
    drafted++;
  }
  if (drafted > 0) refresh(accountSlug);
  return { ok: true, drafted, pending: list.length > DRAFTS_PER_STEP };
}

/** Manda la respuesta al canal. Si alguien ya respondió allá, devuelve esa respuesta. */
export async function sendAnswerAction(
  accountSlug: string,
  questionId: string,
  text: string,
): Promise<Result<{ sent: boolean; answer: string | null }>> {
  const ctx = await accountOf(accountSlug);
  if (!ctx) return { ok: false, error: 'La cuenta no existe.' };
  const parsed = z.object({ id: idSchema, text: z.string().max(ANSWER_MAX * 2) }).safeParse({ id: questionId, text });
  if (!parsed.success) return { ok: false, error: 'Revisá la respuesta.' };
  // Sin refrescar acá: la pantalla muestra el "Listo" y refresca un momento después.
  try {
    const r = await sendAnswer(prisma, { accountId: ctx.account.id, questionId: parsed.data.id, text: parsed.data.text, userId: ctx.user.id });
    return r.sent ? { ok: true, sent: true, answer: null } : { ok: true, sent: false, answer: r.answer };
  } catch (e) {
    if (e instanceof ReplyError) return { ok: false, error: e.message };
    console.error('No se pudo responder', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo responder. Probá de nuevo.' };
  }
}

/** Descarta la propuesta de Claude. */
export async function discardDraftAction(accountSlug: string, questionId: string): Promise<Result> {
  const ctx = await accountOf(accountSlug);
  if (!ctx) return { ok: false, error: 'La cuenta no existe.' };
  const id = idSchema.safeParse(questionId);
  if (!id.success) return { ok: false, error: 'La pregunta no existe.' };
  try {
    await discardDraft(prisma, { accountId: ctx.account.id, questionId: id.data, userId: ctx.user.id });
  } catch (e) {
    if (e instanceof ReplyError) return { ok: false, error: e.message };
    throw e;
  }
  refresh(accountSlug);
  return { ok: true };
}

const settingsSchema = z.object({
  greeting: z.string().max(200, 'El saludo puede tener hasta 200 caracteres.'),
  signature: z.string().max(200, 'La firma puede tener hasta 200 caracteres.'),
  tone: z.string().max(500, 'El tono puede tener hasta 500 caracteres.'),
  notes: z.string().max(4000, 'Lo que Claude tiene que saber puede tener hasta 4.000 caracteres.'),
  autoDraft: z.boolean(),
});

/** Guarda cómo responde la cuenta. */
export async function saveAnswerSettingsAction(accountSlug: string, input: z.input<typeof settingsSchema>): Promise<Result> {
  const ctx = await accountOf(accountSlug);
  if (!ctx) return { ok: false, error: 'La cuenta no existe.' };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };
  await saveAnswerSettings(prisma, ctx.account.id, parsed.data);
  refresh(accountSlug);
  return { ok: true };
}
