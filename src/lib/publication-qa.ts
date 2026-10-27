import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelQuestions } from '@/channels/questions';
import { cleanRichText } from '@/domain/research';
import { familyMemberIds, writeToFamily } from '@/domain/family-members';

// El paso Preguntas y respuestas: las preguntas frecuentes de la publicación con
// su respuesta, las reglas de cuándo responde Claude y cuándo una persona, y si
// Claude manda solo las respuestas que está seguro. Es de la publicación, no
// del producto. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

// Las últimas preguntas de la publicación que muestra el paso.
const RECENT = 5;

/** La publicación no está en la cuenta o el texto no se puede guardar. */
export class QaError extends Error {}

export async function loadQaStep(db: Db, args: { accountId: string; publicationId: string }) {
  const pub = await db.publication.findFirstOrThrow({
    where: { id: args.publicationId, product: { accountId: args.accountId } },
    select: {
      faq: true,
      answerRules: true,
      autoAnswer: true,
      externalId: true,
      store: { select: { channel: { select: { kind: true, name: true } } } },
      product: { select: { research: { select: { storeKnowledge: true } } } },
    },
  });
  // En una familia, las preguntas que recibieron todas sus medidas: las responde el bot con lo de la familia.
  const ids = await familyMemberIds(db, args.publicationId);
  const unanswered = { publicationId: { in: ids }, status: 'UNANSWERED' as const };
  const [settings, recent, waiting, forPerson] = await Promise.all([
    db.questionSettings.findUnique({ where: { accountId: args.accountId }, select: { autoDraft: true } }),
    db.buyerQuestion.findMany({
      where: { publicationId: { in: ids }, text: { not: '' } },
      orderBy: { askedAt: 'desc' },
      take: RECENT,
      select: {
        id: true,
        text: true,
        status: true,
        askedAt: true,
        answer: true,
        answeredFrom: true,
        answeredBy: { select: { name: true } },
        draft: { select: { outcome: true, needsPerson: true, reason: true } },
      },
    }),
    db.buyerQuestion.count({ where: unanswered }),
    db.buyerQuestion.count({ where: { ...unanswered, draft: { is: { outcome: null, needsPerson: true } } } }),
  ]);
  return {
    faq: pub.faq,
    rules: pub.answerRules,
    autoAnswer: pub.autoAnswer,
    channelName: pub.store.channel.name,
    published: pub.externalId !== null,
    // Si el canal deja responder desde la app.
    canAnswer: getChannelQuestions(pub.store.channel.kind) !== null,
    hasKnowledge: Boolean(pub.product.research?.storeKnowledge),
    autoDraft: settings?.autoDraft ?? true,
    recent,
    counts: { waiting, forPerson },
  };
}

export type QaStepData = Awaited<ReturnType<typeof loadQaStep>>;

/** Guarda en la publicación y en las demás medidas de su familia: las preguntas frecuentes y las reglas son de la familia. */
async function update(db: Db, accountId: string, publicationId: string, data: { faq?: string | null; answerRules?: string | null; autoAnswer?: boolean }) {
  const found = await db.publication.count({ where: { id: publicationId, product: { accountId } } });
  if (found === 0) throw new QaError('La publicación no existe en esta cuenta.');
  await writeToFamily(db, publicationId, data);
}

const clean = (html: string | undefined) => {
  if (html === undefined) return undefined;
  try {
    return cleanRichText(html);
  } catch (e) {
    throw new QaError(e instanceof Error ? e.message : 'No se pudo guardar el texto.');
  }
};

/** Guarda las preguntas frecuentes, las reglas o los dos, en HTML. Lo que no llega queda como estaba; vacío borra. */
export async function saveQaTexts(db: Db, args: { accountId: string; publicationId: string; faq?: string; rules?: string }) {
  await update(db, args.accountId, args.publicationId, { faq: clean(args.faq), answerRules: clean(args.rules) });
}

/** Prende o apaga que Claude mande solo las respuestas de esta publicación. */
export async function setAutoAnswer(db: Db, args: { accountId: string; publicationId: string; on: boolean }) {
  await update(db, args.accountId, args.publicationId, { autoAnswer: args.on });
}
