import { MercadoLibreRequestError, mlGet } from './http';
import type { ChannelQuestion, ChannelQuestions, ChannelQuestionStatus, QuestionNotice, QuestionPage } from '../questions-types';

// Las preguntas de los compradores en Mercado Libre, con la versión 4 de su
// formato. Del comprador se guarda solo su código.

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const id = (v: unknown): string | null => (typeof v === 'number' && Number.isFinite(v) ? String(v) : str(v));

function statusOf(raw: unknown, deleted: boolean): ChannelQuestionStatus {
  if (deleted) return 'REMOVED';
  if (raw === 'UNANSWERED') return 'UNANSWERED';
  if (raw === 'ANSWERED') return 'ANSWERED';
  if (raw === 'CLOSED_UNANSWERED') return 'CLOSED';
  // BANNED, DELETED, DISABLED y UNDER_REVIEW: no se ve o no se puede responder.
  return 'REMOVED';
}

/** Una pregunta de Mercado Libre en el formato neutro, o null si le falta lo básico. */
export function parseQuestion(raw: unknown): ChannelQuestion | null {
  if (!isObj(raw)) return null;
  const externalId = id(raw.id);
  const listingId = str(raw.item_id);
  const askedAt = str(raw.date_created);
  if (!externalId || !listingId || !askedAt) return null;
  const answer = isObj(raw.answer) ? raw.answer : null;
  const answerText = answer ? str(answer.text) : null;
  return {
    externalId,
    sellerId: id(raw.seller_id),
    listingId,
    // Las bloqueadas vienen sin texto.
    text: typeof raw.text === 'string' ? raw.text.trim() : '',
    status: statusOf(raw.status, raw.deleted_from_listing === true),
    askedAt,
    buyerId: isObj(raw.from) ? id(raw.from.id) : null,
    answer: answerText ? { text: answerText, answeredAt: str(answer!.date_created) } : null,
  };
}

function parsePage(body: unknown, offset: number, limit: number): QuestionPage {
  const b = isObj(body) ? body : {};
  const list = Array.isArray(b.questions) ? b.questions : [];
  const questions = list.map(parseQuestion).filter((q): q is ChannelQuestion => q !== null);
  const total = typeof b.total === 'number' ? b.total : null;
  return { questions, total, end: list.length < limit || (total !== null && offset + list.length >= total) };
}

const NO_PERMISSION =
  'Mercado Libre no deja leer las preguntas con esta conexión. Revisá que la aplicación tenga el permiso de comunicación con los compradores y volvé a conectar la tienda.';

/** Lo que dijo Mercado Libre, tal cual, para saber por qué no devolvió las preguntas. */
function mlSays(body: unknown): string {
  if (!isObj(body)) return '';
  const said = [...new Set([str(body.message), str(body.error)].filter((s): s is string => s !== null))].join(' · ').slice(0, 300);
  return said ? ` Mercado Libre dijo: «${said}».` : '';
}

/** Si Mercado Libre no devuelve las preguntas, lo dice en castellano y con lo que respondió. */
async function get(path: string, accessToken: string): Promise<unknown> {
  try {
    return await mlGet(path, accessToken);
  } catch (e) {
    if (!(e instanceof MercadoLibreRequestError) || [401, 404, 429].includes(e.status)) throw e;
    console.error('Mercado Libre no devolvió las preguntas', path.split('?')[0], e.status, JSON.stringify(e.body)?.slice(0, 500));
    const message = e.status === 403 ? NO_PERMISSION : `Mercado Libre no devolvió las preguntas (código ${e.status}).`;
    throw new MercadoLibreRequestError(`${message}${mlSays(e.body)}`, e.status, e.body);
  }
}

const isBadRequest = (e: unknown) => e instanceof MercadoLibreRequestError && e.status === 400;

/**
 * Una página de preguntas. Prueba las búsquedas en orden: si Mercado Libre no
 * acepta una, sigue con la próxima. Más atrás de cierto punto no pagina: ahí
 * termina lo que se puede traer.
 */
async function page(paths: string[], accessToken: string, offset: number, limit: number): Promise<QuestionPage> {
  let first: unknown = null;
  for (const path of paths) {
    try {
      return parsePage(await get(`${path}&limit=${limit}&offset=${offset}`, accessToken), offset, limit);
    } catch (e) {
      if (!isBadRequest(e)) throw e;
      first ??= e;
    }
  }
  if (offset > 0) return { questions: [], total: null, end: true, limited: true };
  throw first;
}

export const mercadolibreQuestions: ChannelQuestions = {
  listRecent(accessToken, userId, offset, limit) {
    const seller = encodeURIComponent(userId);
    // Si no acepta la búsqueda por vendedor, las recibidas por la cuenta conectada.
    return page(
      [
        `/questions/search?seller_id=${seller}&api_version=4&sort_fields=date_created&sort_types=DESC`,
        '/my/received_questions/search?api_version=4&sort_fields=date_created&sort_types=DESC',
      ],
      accessToken,
      offset,
      limit,
    );
  },

  async listUnanswered(accessToken, userId, offset, limit) {
    const result = await page(['/my/received_questions/search?status=UNANSWERED&api_version=4'], accessToken, offset, limit);
    // Las de la cuenta conectada: la llave podría ser de otra.
    return { ...result, questions: result.questions.filter((q) => q.sellerId === null || q.sellerId === userId) };
  },

  async readOne(accessToken, questionId) {
    if (!/^\d{1,20}$/.test(questionId)) return null;
    try {
      return parseQuestion(await get(`/questions/${questionId}?api_version=4`, accessToken));
    } catch (e) {
      if (e instanceof MercadoLibreRequestError && e.status === 404) return null;
      throw e;
    }
  },

  parseNotice(body): QuestionNotice | null {
    if (!isObj(body)) return null;
    if (body.topic !== 'questions' && body.topic !== 'marketplace_questions') return null;
    const resource = str(body.resource);
    const userId = id(body.user_id);
    const match = resource?.match(/\/questions\/(\d{1,20})$/);
    if (!match || !userId) return null;
    return { userId, appId: id(body.application_id), questionId: match[1] };
  },
};
