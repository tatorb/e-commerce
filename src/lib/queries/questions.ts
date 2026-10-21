import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { getChannelQuestions } from '@/channels/questions';

// Lo que muestran la pantalla Preguntas, el menú y el aviso del Pipeline.

export const QUESTIONS_PAGE_SIZE = 50;
const MAX_PAGE = 100;

export type QuestionView = 'sin-responder' | 'respondidas';

export type QuestionSearch = { vista?: string; q?: string; publicacion?: string; page?: string };

export function parseQuestionSearch(search: QuestionSearch) {
  const page = Number.parseInt(search.page ?? '', 10);
  return {
    view: (search.vista === 'respondidas' ? 'respondidas' : 'sin-responder') as QuestionView,
    q: (search.q ?? '').trim().slice(0, 100),
    publicationId: search.publicacion && /^[\w-]{1,40}$/.test(search.publicacion) ? search.publicacion : null,
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

export async function loadQuestions(accountId: string, f: QuestionFilters) {
  const base: Prisma.BuyerQuestionWhereInput = {
    store: { accountId },
    ...(f.publicationId ? { publicationId: f.publicationId } : {}),
    ...(f.q
      ? {
          OR: [
            { text: { contains: f.q, mode: 'insensitive' } },
            { answer: { contains: f.q, mode: 'insensitive' } },
            { listingId: { contains: f.q, mode: 'insensitive' } },
            { publication: { title: { contains: f.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const where: Prisma.BuyerQuestionWhereInput = { ...base, status: f.view === 'respondidas' ? 'ANSWERED' : 'UNANSWERED' };
  const [questions, total, unanswered, answered, stores, publication] = await Promise.all([
    prisma.buyerQuestion.findMany({
      where,
      // Sin responder, la que más espera arriba. Respondidas, la última arriba.
      orderBy: f.view === 'respondidas' ? [{ answeredAt: { sort: 'desc', nulls: 'last' } }, { askedAt: 'desc' }] : [{ askedAt: 'asc' }],
      skip: (f.page - 1) * QUESTIONS_PAGE_SIZE,
      take: QUESTIONS_PAGE_SIZE,
      select: {
        id: true,
        text: true,
        status: true,
        askedAt: true,
        answer: true,
        answeredAt: true,
        listingId: true,
        buyerId: true,
        publication: { select: { id: true, title: true, externalId: true } },
        store: { select: { name: true, channel: { select: { name: true } } } },
      },
    }),
    prisma.buyerQuestion.count({ where }),
    prisma.buyerQuestion.count({ where: { ...base, status: 'UNANSWERED' } }),
    prisma.buyerQuestion.count({ where: { ...base, status: 'ANSWERED' } }),
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
  return {
    questions,
    total,
    pages: Math.min(Math.max(1, Math.ceil(total / QUESTIONS_PAGE_SIZE)), MAX_PAGE),
    counts: { unanswered, answered },
    stores: stores
      .filter((s) => getChannelQuestions(s.channel.kind) !== null)
      .map((s) => ({ id: s.id, name: s.name, channelName: s.channel.name, connected: s.connection?.status === 'ACTIVE', reader: s.questionReader })),
    publication,
  };
}

export type QuestionList = Awaited<ReturnType<typeof loadQuestions>>;
export type QuestionRow = QuestionList['questions'][number];
