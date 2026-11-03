import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { getChannelQuestions } from '@/channels/questions';
import { channelInfo } from '@/channels';
import { practiceCounts } from '@/domain/answers';
import { loadBuyerFacts } from '@/lib/buyers';

// Lo que muestran la pantalla Preguntas, el menú y el aviso del Pipeline.

export const QUESTIONS_PAGE_SIZE = 50;
const MAX_PAGE = 100;

export type QuestionView = 'sin-responder' | 'respondidas' | 'otras';

export type QuestionSearch = { vista?: string; q?: string; publicacion?: string; comprador?: string; page?: string };

export function parseQuestionSearch(search: QuestionSearch) {
  const page = Number.parseInt(search.page ?? '', 10);
  return {
    view: (search.vista === 'respondidas' || search.vista === 'otras' ? search.vista : 'sin-responder') as QuestionView,
    q: (search.q ?? '').trim().slice(0, 100),
    publicationId: search.publicacion && /^[\w-]{1,40}$/.test(search.publicacion) ? search.publicacion : null,
    buyerId: search.comprador && /^[\w-]{1,40}$/.test(search.comprador) ? search.comprador : null,
    page: Number.isFinite(page) && page > 1 ? Math.min(page, MAX_PAGE) : 1,
  };
}

export type QuestionFilters = ReturnType<typeof parseQuestionSearch>;

/** Cuántas esperan respuesta y desde cuándo espera la más vieja. */
export async function unansweredSummary(accountId: string) {
  const where = { status: 'UNANSWERED' as const, store: { accountId } };
  const [count, oldest] = await Promise.all([
    prisma.buyerQuestion.count({ where }),
    prisma.buyerQuestion.findFirst({ where, orderBy: { askedAt: 'asc' }, select: { askedAt: true } }),
  ]);
  return { count, oldestAt: oldest?.askedAt ?? null };
}

// Lo que trae cada pregunta de la lista.
const QUESTION_SELECT = {
  id: true,
  text: true,
  status: true,
  askedAt: true,
  answer: true,
  answeredAt: true,
  storeId: true,
  listingId: true,
  buyerId: true,
  buyerAnswered: true,
  statusNote: true,
  answeredFrom: true,
  answeredBy: { select: { name: true } },
  draft: {
    select: { text: true, kind: true, usedData: true, missing: true, needsPerson: true, reason: true, outcome: true, sentText: true, costUsd: true },
  },
  // La publicación donde se preguntó, con su link y su primera foto en el canal.
  publication: { select: { id: true, title: true, externalId: true, url: true, channelCopy: { select: { photos: true } } } },
  store: { select: { name: true, channel: { select: { name: true } } } },
} satisfies Prisma.BuyerQuestionSelect;

// La propuesta que Claude dejó para que la revise una persona y todavía nadie usó.
const FOR_PERSON = { needsPerson: true, outcome: null } satisfies Prisma.QuestionDraftWhereInput;

// Las cerradas, borradas o que el canal tiene en revisión: no se pueden responder.
const OTHER_STATUS = { in: ['CLOSED' as const, 'REMOVED' as const] };

export async function loadQuestions(accountId: string, f: QuestionFilters) {
  // Se busca también por el nombre de usuario de quien preguntó.
  const byNickname = f.q
    ? await prisma.channelBuyer.findMany({
        where: { store: { accountId }, nickname: { contains: f.q, mode: 'insensitive' } },
        select: { buyerId: true },
        take: 200,
      })
    : [];
  const base: Prisma.BuyerQuestionWhereInput = {
    store: { accountId },
    ...(f.publicationId ? { publicationId: f.publicationId } : {}),
    ...(f.buyerId ? { buyerId: f.buyerId } : {}),
    ...(f.q
      ? {
          OR: [
            { text: { contains: f.q, mode: 'insensitive' } },
            { answer: { contains: f.q, mode: 'insensitive' } },
            { listingId: { contains: f.q, mode: 'insensitive' } },
            { publication: { title: { contains: f.q, mode: 'insensitive' } } },
            ...(byNickname.length > 0 ? [{ buyerId: { in: byNickname.map((b) => b.buyerId) } }] : []),
          ],
        }
      : {}),
  };
  // Sin responder, las que Claude dejó para una persona van aparte, arriba.
  const forPersonWhere: Prisma.BuyerQuestionWhereInput = { ...base, status: 'UNANSWERED', draft: { is: FOR_PERSON } };
  const where: Prisma.BuyerQuestionWhereInput =
    f.view === 'respondidas'
      ? { ...base, status: 'ANSWERED' }
      : f.view === 'otras'
        ? { ...base, status: OTHER_STATUS }
        : { ...base, status: 'UNANSWERED', NOT: { draft: { is: FOR_PERSON } } };
  const [questions, forPerson, total, forPersonCount, unanswered, answered, others, stores, publication] = await Promise.all([
    prisma.buyerQuestion.findMany({
      where,
      // Sin responder, la que más espera arriba. Respondidas, la última arriba. Las otras, la última arriba.
      orderBy:
        f.view === 'respondidas'
          ? [{ answeredAt: { sort: 'desc', nulls: 'last' } }, { askedAt: 'desc' }]
          : f.view === 'otras'
            ? [{ askedAt: 'desc' }]
            : [{ askedAt: 'asc' }],
      skip: (f.page - 1) * QUESTIONS_PAGE_SIZE,
      take: QUESTIONS_PAGE_SIZE,
      select: QUESTION_SELECT,
    }),
    f.view === 'sin-responder' && f.page === 1
      ? prisma.buyerQuestion.findMany({ where: forPersonWhere, orderBy: { askedAt: 'asc' }, take: QUESTIONS_PAGE_SIZE, select: QUESTION_SELECT })
      : [],
    prisma.buyerQuestion.count({ where }),
    f.view === 'sin-responder' ? prisma.buyerQuestion.count({ where: forPersonWhere }) : 0,
    prisma.buyerQuestion.count({ where: { ...base, status: 'UNANSWERED' } }),
    prisma.buyerQuestion.count({ where: { ...base, status: 'ANSWERED' } }),
    prisma.buyerQuestion.count({ where: { ...base, status: OTHER_STATUS } }),
    // Las conectadas, aunque haya que volver a conectarlas.
    prisma.store.findMany({
      where: { accountId, connection: { isNot: null } },
      select: { id: true, name: true, channel: { select: { kind: true, name: true } }, connection: { select: { status: true } }, questionReader: true },
      orderBy: { createdAt: 'asc' },
    }),
    f.publicationId
      ? prisma.publication.findFirst({ where: { id: f.publicationId, product: { accountId } }, select: { id: true, title: true, externalId: true } })
      : null,
  ]);
  const buyers = await loadBuyerFacts(prisma, [...forPerson, ...questions]);
  // Con el filtro de un comprador, lo que se sabe de él aunque no haya preguntas en esta vista.
  const buyer = f.buyerId
    ? ([...buyers.values()].find((b) => b.buyerId === f.buyerId) ??
      (await prisma.channelBuyer.findFirst({ where: { store: { accountId }, buyerId: f.buyerId }, select: { nickname: true } })))
    : null;
  return {
    questions,
    forPerson,
    total,
    pages: Math.min(Math.max(1, Math.ceil(total / QUESTIONS_PAGE_SIZE)), MAX_PAGE),
    counts: { unanswered, answered, others, forPerson: forPersonCount },
    buyers,
    buyerFilter: f.buyerId ? { buyerId: f.buyerId, nickname: buyer?.nickname ?? null } : null,
    stores: stores
      .filter((s) => getChannelQuestions(s.channel.kind) !== null)
      .map((s) => ({
        id: s.id,
        name: s.name,
        channelName: s.channel.name,
        // El color del canal, para su etiqueta.
        accent: channelInfo(s.channel.kind, s.channel.name).accent,
        connected: s.connection?.status === 'ACTIVE',
        reader: s.questionReader,
      })),
    publication,
  };
}

export type QuestionList = Awaited<ReturnType<typeof loadQuestions>>;
export type QuestionRow = QuestionList['questions'][number];

// Cuántos días mira la práctica.
export const PRACTICE_DAYS = 30;

/** Qué se hizo con las propuestas de Claude en los últimos días, y cuánto costaron. */
export async function loadPractice(accountId: string, now = new Date()) {
  const drafts = await prisma.questionDraft.findMany({
    where: { question: { store: { accountId } }, createdAt: { gte: new Date(now.getTime() - PRACTICE_DAYS * 24 * 60 * 60 * 1000) } },
    select: { outcome: true, costUsd: true },
  });
  return practiceCounts(drafts);
}

export async function loadAnswerSettings(accountId: string) {
  return prisma.questionSettings.findUnique({ where: { accountId } });
}
