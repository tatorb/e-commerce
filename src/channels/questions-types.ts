// Las preguntas de los compradores en el canal, con la cuenta conectada. Cada
// canal lo resuelve en src/channels/<canal>/. Solo corre en el servidor.

export type ChannelQuestionStatus = 'UNANSWERED' | 'ANSWERED' | 'CLOSED' | 'REMOVED';

/** Una pregunta tal como la informa el canal, sin el formato del canal. */
export type ChannelQuestion = {
  externalId: string;
  // La cuenta que vende, para comprobar que es de la tienda.
  sellerId: string | null;
  listingId: string;
  text: string;
  status: ChannelQuestionStatus;
  askedAt: string;
  buyerId: string | null;
  // Cuántas preguntas de ese comprador ya respondió la tienda, si el canal lo dice.
  buyerAnswered: number | null;
  // Por qué no se puede responder, o no se ve, si el canal lo dice: "En revisión", "Bloqueada".
  statusNote: string | null;
  answer: { text: string; answeredAt: string | null } | null;
};

/** Lo que el canal muestra en público de quien pregunta. */
export type ChannelBuyerProfile = {
  nickname: string | null;
  city: string | null;
  state: string | null;
  registeredAt: string | null;
  profileUrl: string | null;
};

export type QuestionPage = {
  questions: ChannelQuestion[];
  // Cuántas hay en total, si el canal lo dice.
  total: number | null;
  // No hay más páginas. limited: el canal no deja seguir más atrás.
  end: boolean;
  limited?: boolean;
};

/** El canal no aceptó la respuesta: el motivo, en castellano. */
export class AnswerError extends Error {}

/** Lo que trae un aviso del canal sobre una pregunta. */
export type QuestionNotice = { userId: string; appId: string | null; questionId: string };

export interface ChannelQuestions {
  /** Las preguntas recibidas, las más nuevas primero. */
  listRecent(accessToken: string, userId: string, offset: number, limit: number): Promise<QuestionPage>;
  /** Las que esperan respuesta. */
  listUnanswered(accessToken: string, userId: string, offset: number, limit: number): Promise<QuestionPage>;
  /** Una pregunta, o null si el canal ya no la tiene. */
  readOne(accessToken: string, questionId: string): Promise<ChannelQuestion | null>;
  /** El perfil público de un comprador, o null si el canal no lo tiene. */
  readBuyer?(accessToken: string, buyerId: string): Promise<ChannelBuyerProfile | null>;
  /** Publica la respuesta. Si el canal no la acepta, AnswerError con el motivo. */
  answer(accessToken: string, questionId: string, text: string): Promise<void>;
  /** El aviso que manda el canal, o null si no es de una pregunta. */
  parseNotice(body: unknown): QuestionNotice | null;
}
