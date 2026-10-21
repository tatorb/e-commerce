import type { ChannelKind } from '@/generated/prisma/enums';
import { mercadolibreQuestions } from './mercadolibre/questions';
import type { ChannelQuestions } from './questions-types';

// De qué canales se leen las preguntas de los compradores. Los tipos están en
// questions-types.ts, así cada canal los usa sin depender de esta lista.

export type { ChannelQuestion, ChannelQuestions, ChannelQuestionStatus, QuestionNotice, QuestionPage } from './questions-types';

const QUESTIONS: Partial<Record<ChannelKind, ChannelQuestions>> = {
  MERCADOLIBRE: mercadolibreQuestions,
};

export function getChannelQuestions(kind: ChannelKind): ChannelQuestions | null {
  return QUESTIONS[kind] ?? null;
}
