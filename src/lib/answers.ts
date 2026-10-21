import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import type { ChannelKind } from '@/generated/prisma/enums';
import { requestAnswer, type AnswerInput, type AnswerResult } from '@/ai/answers';
import { ProposalError } from '@/ai/request';
import { ConnectError } from '@/channels/connect';
import { AnswerError, getChannelQuestions } from '@/channels/questions';
import { checkAnswer, sentOutcome } from '@/domain/answers';
import { comboParts } from '@/domain/combos';
import { loadContent } from '@/domain/content';
import { parseNameValueList } from '@/domain/name-value';
import { isUniqueViolation } from '@/domain/publications';
import { withoutPrices } from '@/domain/research';
import { receiveNotice, saveQuestions } from '@/lib/buyer-questions';
import { withAccessToken } from '@/lib/connections';
import { loadCombo } from '@/lib/queries/combos';

// Responder las preguntas de los compradores desde la app: Claude propone una
// respuesta con los datos de la app, una persona la manda como está, la
// corrige o la descarta, y queda anotado qué se hizo con cada propuesta.
// Recibe la base y el pedido a Claude por parámetro para poder probarlo.

type Db = PrismaClient;
type Requester = (input: AnswerInput) => Promise<AnswerResult>;

// Las preguntas viejas no se proponen solas: ya no las espera nadie.
const AUTO_DRAFT_DAYS = 30;
const PREVIOUS = 20;
const EXAMPLES = 8;
const EARLIER = 5;

/** No se pudo responder: el motivo, para la pantalla. */
export class ReplyError extends Error {}

const json = (v: unknown) => v as Prisma.InputJsonValue;

async function loadQuestion(db: Db, accountId: string, questionId: string) {
  return db.buyerQuestion.findFirst({
    where: { id: questionId, store: { accountId } },
    include: {
      store: { select: { id: true, name: true, accountId: true, channel: { select: { kind: true, name: true } } } },
      publication: { select: { id: true, title: true, description: true, attributes: true, productId: true } },
      draft: true,
    },
  });
}

type LoadedQuestion = NonNullable<Awaited<ReturnType<typeof loadQuestion>>>;

// Las respuestas que nombran precios no se le pasan a Claude.
const withoutPriceAnswers = (list: { text: string; answer: string | null }[]) =>
  list.flatMap((q) => (q.answer && withoutPrices(q.answer).hidden === 0 ? [{ question: q.text, answer: q.answer }] : []));

/** Lo que recibe Claude para proponer la respuesta. */
export async function answerInput(db: Db, q: LoadedQuestion): Promise<AnswerInput> {
  const answered = { storeId: q.storeId, status: 'ANSWERED' as const, answer: { not: null }, text: { not: '' } };
  const [settings, previous, examples, earlier, content, combo] = await Promise.all([
    db.questionSettings.findUnique({ where: { accountId: q.store.accountId } }),
    db.buyerQuestion.findMany({
      where: { ...answered, listingId: q.listingId, id: { not: q.id } },
      orderBy: { askedAt: 'desc' },
      take: PREVIOUS,
      select: { text: true, answer: true },
    }),
    db.buyerQuestion.findMany({
      where: { ...answered, listingId: { not: q.listingId } },
      orderBy: { answeredAt: { sort: 'desc', nulls: 'last' } },
      take: EXAMPLES * 2,
      select: { text: true, answer: true },
    }),
    q.buyerId
      ? db.buyerQuestion.findMany({
          where: { storeId: q.storeId, listingId: q.listingId, buyerId: q.buyerId, askedAt: { lt: q.askedAt }, text: { not: '' } },
          orderBy: { askedAt: 'desc' },
          take: EARLIER,
          select: { text: true, answer: true },
        })
      : [],
    q.publication ? loadContent(db, q.publication.productId, q.publication.id) : null,
    q.publication ? loadCombo(db, q.publication.productId).then(comboParts) : null,
  ]);
  return {
    channelName: q.store.channel.name,
    storeName: q.store.name,
    settings: {
      greeting: settings?.greeting ?? null,
      signature: settings?.signature ?? null,
      tone: settings?.tone ?? null,
      notes: settings?.notes ?? null,
    },
    question: q.text,
    earlierFromBuyer: earlier.reverse().map((e) => ({ question: e.text, answer: e.answer })),
    publication: q.publication
      ? { title: q.publication.title, description: q.publication.description, catalog: parseNameValueList(q.publication.attributes) }
      : null,
    content,
    combo,
    previous: withoutPriceAnswers(previous),
    examples: withoutPriceAnswers(examples).slice(0, EXAMPLES),
  };
}

export type DraftOutcomeResult = { ok: true; costUsd: number } | { ok: false; error: string; costUsd: number };

/** Pide a Claude una respuesta para la pregunta y la guarda. Si ya había una sin usar, la reemplaza. */
export async function draftAnswer(
  db: Db,
  args: { accountId: string; questionId: string },
  request: Requester = requestAnswer,
): Promise<DraftOutcomeResult> {
  const q = await loadQuestion(db, args.accountId, args.questionId);
  if (!q) return { ok: false, error: 'La pregunta no está en la cuenta.', costUsd: 0 };
  if (q.status !== 'UNANSWERED') return { ok: false, error: 'La pregunta ya no espera respuesta.', costUsd: 0 };
  if (!q.text) return { ok: false, error: 'El canal ocultó el texto de esta pregunta.', costUsd: 0 };
  // Después de descartar una, se puede pedir otra.
  if (q.draft?.outcome && q.draft.outcome !== 'DISCARDED') return { ok: false, error: 'Esta propuesta ya se usó.', costUsd: 0 };

  let r: AnswerResult;
  try {
    r = await request(await answerInput(db, q));
  } catch (e) {
    if (e instanceof ProposalError) return { ok: false, error: e.message, costUsd: e.usage?.costUsd ?? 0 };
    throw e;
  }
  const o = r.output;
  const clean = (list: string[]) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];
  const data = {
    text: o.answer.trim(),
    kind: o.kind,
    usedData: clean(o.usedData),
    missing: clean(o.missing),
    needsPerson: o.needsPerson,
    reason: o.reason.trim() || null,
    model: r.model,
    usage: json(r.usage),
  };
  const update = () =>
    db.questionDraft.update({
      where: { questionId: q.id },
      data: { ...data, costUsd: { increment: r.usage.costUsd }, attempts: { increment: 1 }, outcome: null, decidedAt: null, decidedById: null },
    });
  if (q.draft) await update();
  else {
    try {
      await db.questionDraft.create({ data: { questionId: q.id, ...data, costUsd: r.usage.costUsd } });
    } catch (e) {
      // Otro pedido la propuso a la vez: queda la última.
      if (!isUniqueViolation(e)) throw e;
      await update();
    }
  }
  return { ok: true, costUsd: r.usage.costUsd };
}

/** Las que esperan respuesta sin propuesta, de las cuentas que proponen solas. */
export async function questionsToDraft(db: Db, args: { accountId?: string; externalId?: string; max: number; now?: Date }) {
  const since = new Date((args.now ?? new Date()).getTime() - AUTO_DRAFT_DAYS * 24 * 60 * 60 * 1000);
  return db.buyerQuestion.findMany({
    where: {
      status: 'UNANSWERED',
      ...(args.externalId ? { externalId: args.externalId } : {}),
      draft: { is: null },
      text: { not: '' },
      askedAt: { gte: since },
      store: {
        ...(args.accountId ? { accountId: args.accountId } : {}),
        account: { OR: [{ questionSettings: { is: null } }, { questionSettings: { is: { autoDraft: true } } }] },
      },
    },
    orderBy: { askedAt: 'asc' },
    take: args.max,
    select: { id: true, store: { select: { accountId: true } } },
  });
}

/**
 * El aviso del canal: guarda la pregunta y, si es nueva y espera respuesta,
 * Claude la propone enseguida, así está lista cuando alguien entra.
 */
export async function handleNotice(
  db: Db,
  kind: ChannelKind,
  body: unknown,
  opts: { aiReady: boolean; request?: Requester; now?: Date },
): Promise<{ saved: number; drafted: number }> {
  const saved = await receiveNotice(db, kind, body, opts.now);
  const notice = getChannelQuestions(kind)?.parseNotice(body);
  if (!saved || !notice || !opts.aiReady) return { saved, drafted: 0 };
  const pending = await questionsToDraft(db, { externalId: notice.questionId, max: 5, now: opts.now });
  let drafted = 0;
  for (const q of pending) {
    const r = await draftAnswer(db, { accountId: q.store.accountId, questionId: q.id }, opts.request);
    if (r.ok) drafted++;
    else console.error('No se pudo proponer la respuesta', r.error);
  }
  return { saved, drafted };
}

export type SendResult = { sent: true } | { sent: false; answer: string | null };

/**
 * Manda la respuesta al canal. Antes se fija que la pregunta siga esperando:
 * si alguien la respondió en el canal, no manda nada y devuelve esa respuesta.
 */
export async function sendAnswer(
  db: Db,
  args: { accountId: string; questionId: string; text: string; userId: string | null; now?: Date },
): Promise<SendResult> {
  const now = args.now ?? new Date();
  const q = await loadQuestion(db, args.accountId, args.questionId);
  if (!q) throw new ReplyError('La pregunta no está en la cuenta.');
  if (q.status === 'ANSWERED') return { sent: false, answer: q.answer };
  if (q.status !== 'UNANSWERED') throw new ReplyError('Esta pregunta ya no se puede responder: la publicación se cerró o el canal la sacó.');
  const text = args.text.replace(/\r\n?/g, '\n').trim();
  const problems = checkAnswer(text);
  if (problems.length > 0) throw new ReplyError(problems.join(' '));
  const channel = getChannelQuestions(q.store.channel.kind);
  if (!channel) throw new ReplyError(`Todavía no se pueden responder preguntas de ${q.store.channel.name} desde la app.`);

  const logFailure = async (message: string) => {
    if (!q.publicationId) return;
    await db.channelSyncChange
      .create({ data: { publicationId: q.publicationId, field: 'question', kind: 'ANSWER_FAILED', before: q.text, after: text, message, userId: args.userId } })
      .catch((err) => console.error('No se pudo anotar el intento', err instanceof Error ? err.message : err));
  };

  let answeredElsewhere: string | null | undefined;
  try {
    answeredElsewhere = await withAccessToken(db, q.store.id, async (token) => {
      const fresh = await channel.readOne(token, q.externalId);
      if (!fresh) {
        await db.buyerQuestion.update({ where: { id: q.id }, data: { status: 'REMOVED', readAt: now } });
        throw new AnswerError(`${q.store.channel.name} ya no tiene esta pregunta: puede que la hayan borrado.`);
      }
      if (fresh.status !== 'UNANSWERED') {
        await saveQuestions(db, q.store.id, [fresh], now);
        if (fresh.status !== 'ANSWERED') throw new AnswerError('Esta pregunta ya no se puede responder: la publicación se cerró o el canal la sacó.');
        return fresh.answer?.text ?? null;
      }
      await channel.answer(token, q.externalId, text);
      return undefined;
    });
  } catch (e) {
    if (e instanceof AnswerError || e instanceof ConnectError) {
      await logFailure(e.message);
      throw new ReplyError(e.message);
    }
    throw e;
  }
  if (answeredElsewhere !== undefined) return { sent: false, answer: answeredElsewhere };

  await db.$transaction(async (tx) => {
    await tx.buyerQuestion.update({
      where: { id: q.id },
      data: { status: 'ANSWERED', answer: text, answeredAt: now, answeredFrom: 'APP', answeredById: args.userId, readAt: now },
    });
    if (q.draft && !q.draft.outcome) {
      const outcome = sentOutcome(q.draft.text, text);
      await tx.questionDraft.update({
        where: { id: q.draft.id },
        data: { outcome, sentText: outcome === 'SENT_EDITED' ? text : null, decidedAt: now, decidedById: args.userId },
      });
    }
    if (q.publicationId) {
      await tx.channelSyncChange.create({
        data: { publicationId: q.publicationId, field: 'question', kind: 'ANSWERED', before: q.text, after: text, userId: args.userId },
      });
    }
  });
  return { sent: true };
}

/** Descarta la propuesta: la pregunta sigue esperando respuesta. */
export async function discardDraft(db: Db, args: { accountId: string; questionId: string; userId: string | null; now?: Date }) {
  const done = await db.questionDraft.updateMany({
    where: { questionId: args.questionId, outcome: null, question: { store: { accountId: args.accountId } } },
    data: { outcome: 'DISCARDED', decidedAt: args.now ?? new Date(), decidedById: args.userId },
  });
  if (done.count === 0) throw new ReplyError('No hay una propuesta para descartar.');
}

export type AnswerSettingsInput = { greeting: string; signature: string; tone: string; notes: string; autoDraft: boolean };

/** Cómo responde la cuenta. Lo vacío queda sin dato. */
export async function saveAnswerSettings(db: Db, accountId: string, input: AnswerSettingsInput) {
  const text = (v: string) => v.replace(/\r\n?/g, '\n').trim() || null;
  const data = { greeting: text(input.greeting), signature: text(input.signature), tone: text(input.tone), notes: text(input.notes), autoDraft: input.autoDraft };
  await db.questionSettings.upsert({ where: { accountId }, create: { accountId, ...data }, update: data });
}
