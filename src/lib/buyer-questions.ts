import type { PrismaClient } from '@/generated/prisma/client';
import type { ChannelKind } from '@/generated/prisma/enums';
import { ConnectError } from '@/channels/connect';
import { getChannelQuestions, type ChannelQuestion } from '@/channels/questions';
import { isUniqueViolation } from '@/domain/publications';
import { withAccessToken } from '@/lib/connections';

// Las preguntas de los compradores: se leen del canal y se guardan sin
// repetir, unidas a su publicación si está en la app. Llegan con el aviso del
// canal, con la lectura de cada hora y con el botón Leer ahora. La primera vez
// se traen también las anteriores, por tandas. Recibe la base por parámetro
// para poder probarlo con una base de prueba y un canal simulado.

type Db = PrismaClient;

const PAGE = 50;
// Las lecturas siguientes repasan un día antes de la más nueva que ya se tenía, por si alguna llegó tarde.
const OVERLAP_MS = 24 * 60 * 60 * 1000;
const NEWEST_PAGES_MAX = 20;
// Las que dejaron de esperar respuesta se vuelven a leer de a una, hasta estas por vez.
const RECHECK_MAX = 30;
const LEASE_MS = 90_000;

export class QuestionError extends Error {}

const toDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Guarda las preguntas sin repetir y las une con su publicación. Devuelve cuántas eran nuevas. */
export async function saveQuestions(db: Db, storeId: string, questions: ChannelQuestion[], now: Date): Promise<number> {
  try {
    return await upsertQuestions(db, storeId, questions, now);
  } catch (e) {
    // El aviso y la lectura de cada hora trajeron la misma pregunta a la vez: la segunda vez ya está.
    if (!isUniqueViolation(e)) throw e;
    return upsertQuestions(db, storeId, questions, now);
  }
}

async function upsertQuestions(db: Db, storeId: string, questions: ChannelQuestion[], now: Date): Promise<number> {
  const valid = questions.filter((q) => toDate(q.askedAt) !== null);
  if (valid.length === 0) return 0;
  const [publications, existing] = await Promise.all([
    db.publication.findMany({
      where: { storeId, externalId: { in: [...new Set(valid.map((q) => q.listingId))] } },
      select: { id: true, externalId: true },
    }),
    db.buyerQuestion.findMany({ where: { storeId, externalId: { in: valid.map((q) => q.externalId) } }, select: { externalId: true } }),
  ]);
  const publicationOf = new Map(publications.map((p) => [p.externalId, p.id]));
  const known = new Set(existing.map((e) => e.externalId));
  await db.$transaction(
    valid.map((q) => {
      const publicationId = publicationOf.get(q.listingId);
      const common = { listingId: q.listingId, status: q.status, askedAt: toDate(q.askedAt)!, buyerId: q.buyerId, readAt: now };
      return db.buyerQuestion.upsert({
        where: { storeId_externalId: { storeId, externalId: q.externalId } },
        create: {
          storeId,
          externalId: q.externalId,
          ...common,
          publicationId: publicationId ?? null,
          text: q.text,
          answer: q.answer?.text ?? null,
          answeredAt: toDate(q.answer?.answeredAt),
        },
        update: {
          ...common,
          ...(publicationId ? { publicationId } : {}),
          // Las que el canal bloquea vienen sin texto: queda el que ya se tenía.
          ...(q.text ? { text: q.text } : {}),
          ...(q.answer ? { answer: q.answer.text, answeredAt: toDate(q.answer.answeredAt) } : q.status === 'UNANSWERED' ? { answer: null, answeredAt: null } : {}),
        },
      });
    }),
  );
  return valid.filter((q) => !known.has(q.externalId)).length;
}

export type QuestionReadResult = {
  status: 'done' | 'pending' | 'busy' | 'failed';
  read: number;
  added: number;
  error?: string;
};

/**
 * Lee las preguntas de una tienda hasta que se acabe el tiempo: las nuevas,
 * las anteriores que falten traer y las que esperaban respuesta y ya no.
 * Si otro pedido está leyendo, no hace nada.
 */
export async function readQuestions(db: Db, storeId: string, opts: { budgetMs: number; now?: () => Date }): Promise<QuestionReadResult> {
  const clock = opts.now ?? (() => new Date());
  const started = clock().getTime();
  const left = () => opts.budgetMs - (clock().getTime() - started);
  const store = await db.store.findUnique({ where: { id: storeId }, select: { channel: { select: { kind: true, name: true } } } });
  const channel = store ? getChannelQuestions(store.channel.kind) : null;
  if (!store || !channel) throw new QuestionError(`Todavía no se pueden leer las preguntas de ${store?.channel.name ?? 'este canal'}.`);

  await db.questionReader.upsert({ where: { storeId }, create: { storeId }, update: {} });
  const leased = await db.questionReader.updateMany({
    where: { storeId, OR: [{ leaseUntil: null }, { leaseUntil: { lt: clock() } }] },
    data: { leaseUntil: new Date(clock().getTime() + LEASE_MS) },
  });
  if (leased.count === 0) return { status: 'busy', read: 0, added: 0 };

  const reader = await db.questionReader.findUniqueOrThrow({ where: { storeId } });
  const result: QuestionReadResult = { status: 'done', read: 0, added: 0 };
  let newest = reader.newestAt;
  let pending = false;
  let lastError: string | null = null;

  const save = async (questions: ChannelQuestion[]) => {
    result.read += questions.length;
    result.added += await saveQuestions(db, storeId, questions, clock());
    for (const q of questions) {
      const d = toDate(q.askedAt);
      if (d && (!newest || d > newest)) newest = d;
    }
  };

  try {
    await withAccessToken(db, storeId, async (token, userId) => {
      // 1. Las nuevas desde la última lectura, hasta llegar a las que ya se tenían.
      if (reader.newestAt) {
        const stopAt = reader.newestAt.getTime() - OVERLAP_MS;
        for (let offset = 0, pages = 0; pages < NEWEST_PAGES_MAX; pages++) {
          if (left() <= 0) {
            pending = true;
            break;
          }
          const page = await channel.listRecent(token, userId, offset, PAGE);
          await save(page.questions);
          offset += page.questions.length;
          const oldest = toDate(page.questions.at(-1)?.askedAt);
          if (page.end || !oldest || oldest.getTime() < stopAt) break;
        }
      }

      // 2. Las anteriores: la primera vez, todas las que deje traer el canal. Sigue donde quedó.
      let offset = reader.historyOffset;
      while (offset !== null) {
        if (left() <= 0) {
          pending = true;
          break;
        }
        const page = await channel.listRecent(token, userId, offset, PAGE);
        await save(page.questions);
        offset = page.end ? null : offset + page.questions.length;
        await db.questionReader.update({
          where: { storeId },
          data: {
            historyOffset: offset,
            newestAt: newest,
            ...(page.total !== null ? { historyTotal: page.total } : {}),
            ...(page.limited ? { historyLimited: true } : {}),
          },
        });
      }

      // 3. Las que esperan respuesta. Las que la app tenía sin responder y ya no esperan se leen de a una.
      if (left() <= 0) {
        pending = true;
        return;
      }
      const waiting = new Set<string>();
      for (let o = 0; ; ) {
        const page = await channel.listUnanswered(token, userId, o, PAGE);
        await save(page.questions);
        for (const q of page.questions) waiting.add(q.externalId);
        o += page.questions.length;
        if (page.end || page.questions.length === 0) break;
        if (left() <= 0) {
          pending = true;
          return;
        }
      }
      const stale = await db.buyerQuestion.findMany({
        where: { storeId, status: 'UNANSWERED', externalId: { notIn: [...waiting] } },
        orderBy: { readAt: 'asc' },
        take: RECHECK_MAX,
        select: { externalId: true },
      });
      for (const s of stale) {
        if (left() <= 0) {
          pending = true;
          return;
        }
        const q = await channel.readOne(token, s.externalId);
        if (q && q.sellerId && q.sellerId !== userId) continue;
        if (q) await save([q]);
        else {
          await db.buyerQuestion.update({
            where: { storeId_externalId: { storeId, externalId: s.externalId } },
            data: { status: 'REMOVED', readAt: clock() },
          });
        }
      }
      if (stale.length === RECHECK_MAX) pending = true;
    });
  } catch (e) {
    if (!(e instanceof ConnectError)) {
      lastError = 'No se pudieron leer las preguntas. Se vuelve a probar en la próxima lectura.';
      throw e;
    }
    lastError = e.message;
    result.status = 'failed';
    result.error = e.message;
  } finally {
    await db.questionReader.update({
      where: { storeId },
      data: { leaseUntil: null, readAt: clock(), lastError, ...(newest ? { newestAt: newest } : {}) },
    });
    // Las de publicaciones que se sumaron a la app después.
    await db.$executeRaw`
      UPDATE buyer_questions q SET "publicationId" = p.id
      FROM publications p
      WHERE q."storeId" = ${storeId} AND q."publicationId" IS NULL AND p."storeId" = q."storeId" AND p."externalId" = q."listingId"`;
  }
  if (result.status === 'done' && pending) result.status = 'pending';
  return result;
}

/** Las tiendas conectadas de un canal que deja leer sus preguntas. */
export async function questionStores(db: Db, accountId?: string) {
  const stores = await db.store.findMany({
    where: { connection: { status: 'ACTIVE' }, ...(accountId ? { accountId } : {}) },
    select: { id: true, name: true, accountId: true, channel: { select: { kind: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return stores.filter((s) => getChannelQuestions(s.channel.kind) !== null);
}

/** La lectura programada: las preguntas de todas las tiendas, con lo que queda de tiempo. */
export async function readAllQuestions(db: Db, opts: { budgetMs: number; now?: () => Date }): Promise<{ pending: boolean }> {
  const clock = opts.now ?? (() => new Date());
  const started = clock().getTime();
  let pending = false;
  for (const store of await questionStores(db)) {
    const left = opts.budgetMs - (clock().getTime() - started);
    if (left <= 0) return { pending: true };
    try {
      const r = await readQuestions(db, store.id, { budgetMs: left, now: clock });
      if (r.status === 'pending') pending = true;
    } catch (e) {
      console.error('No se pudieron leer las preguntas', store.id, e instanceof Error ? e.message : e);
    }
  }
  return { pending };
}

/**
 * El aviso del canal de que una pregunta llegó o cambió. No se confía en lo
 * que trae: solo se toma el número de la pregunta y se la pide al canal con la
 * conexión de la tienda que corresponde. Devuelve cuántas tiendas la guardaron.
 */
export async function receiveNotice(db: Db, kind: ChannelKind, body: unknown, now = new Date()): Promise<number> {
  const channel = getChannelQuestions(kind);
  const notice = channel?.parseNotice(body);
  if (!channel || !notice) return 0;
  const connections = await db.channelConnection.findMany({
    where: { status: 'ACTIVE', externalUserId: notice.userId, store: { channel: { kind } }, ...(notice.appId ? { appId: notice.appId } : {}) },
    select: { storeId: true },
  });
  let saved = 0;
  for (const { storeId } of connections) {
    await db.questionReader.upsert({ where: { storeId }, create: { storeId, noticeAt: now }, update: { noticeAt: now } });
    try {
      const q = await withAccessToken(db, storeId, (token) => channel.readOne(token, notice.questionId));
      if (!q) {
        await db.buyerQuestion.updateMany({ where: { storeId, externalId: notice.questionId }, data: { status: 'REMOVED', readAt: now } });
        continue;
      }
      if (q.sellerId && q.sellerId !== notice.userId) continue;
      await saveQuestions(db, storeId, [q], now);
      saved++;
    } catch (e) {
      console.error('No se pudo leer la pregunta del aviso', e instanceof Error ? e.message : e);
    }
  }
  return saved;
}
