import type { DraftOutcome } from '@/generated/prisma/enums';
import { contactFound, contactList, withoutOwnLinks } from './contact';

// Las respuestas a las preguntas de los compradores: qué se revisa antes de
// mandar una y cómo se cuenta lo que se hizo con cada propuesta de Claude.
// Sin la base de datos, para poder probarlo solo.

// Lo más largo que acepta Mercado Libre en una respuesta.
export const ANSWER_MAX = 2000;

// Lo que Claude deja para que lo complete una persona.
export const FILL_IN = /\[COMPLETAR[^\]]*\]/i;

// De qué trata la pregunta.
export const ANSWER_KINDS = {
  compatibilidad: 'Compatibilidad',
  medidas: 'Medidas',
  contenido: 'Qué trae',
  marca_origen: 'Marca u origen',
  uso: 'Uso o instalación',
  stock: 'Stock',
  envio: 'Envío',
  precio: 'Precio',
  factura: 'Factura',
  reclamo: 'Reclamo',
  otro: 'Otra',
} as const;

export type AnswerKind = keyof typeof ANSWER_KINDS;

export const ANSWER_KIND_KEYS = Object.keys(ANSWER_KINDS) as [AnswerKind, ...AnswerKind[]];

export function answerKindLabel(kind: string): string {
  return kind in ANSWER_KINDS ? ANSWER_KINDS[kind as AnswerKind] : ANSWER_KINDS.otro;
}

// Lo que espera Claude, como mínimo, desde que llega la pregunta hasta mandar
// sola la respuesta. El tope es lo que entra en el tiempo de un aviso del canal.
export const ANSWER_DELAY_DEFAULT = 40;
export const ANSWER_DELAY_MAX = 240;

// Desde la tercera pregunta del mismo comprador en la misma publicación, responde una persona.
export const REPEAT_LIMIT = 2;
export const REPEAT_REASON = 'Es la tercera pregunta o más de este comprador en esta publicación: responde una persona.';

// Los reclamos, cambios y devoluciones los responde siempre una persona.
export const PERSON_KINDS: readonly AnswerKind[] = ['reclamo'];
export const PERSON_KIND_REASON = 'Los reclamos, cambios y devoluciones los responde una persona.';

/** Cuántos milisegundos faltan para poder mandar sola la respuesta. 0 si ya se puede. */
export function waitBeforeSending(askedAt: Date, delaySeconds: number, now: Date): number {
  return Math.max(0, askedAt.getTime() + delaySeconds * 1000 - now.getTime());
}

/** El precio que paga el comprador en el canal: el de lista con el descuento que se ve. Null sin precio. */
export function publishedPrice(price: number | null, discountPct: number | null): number | null {
  if (price === null || price <= 0) return null;
  const pct = discountPct ?? 0;
  return pct > 0 && pct < 100 ? Math.round(price * (1 - pct / 100) * 100) / 100 : price;
}

/** Si hay stock en el canal, sin decir cuánto: activa y con cantidad. Null si no se leyó. */
export function stockState(status: string | null, quantity: number | null): 'hay' | 'no hay' | null {
  if (status === null && quantity === null) return null;
  return status === 'ACTIVE' && (quantity ?? 0) > 0 ? 'hay' : 'no hay';
}

/** Lo que hay que corregir antes de mandar la respuesta. Vacía si está lista. */
export function checkAnswer(text: string): string[] {
  const value = text.trim();
  if (!value) return ['La respuesta está vacía.'];
  const problems: string[] = [];
  if (FILL_IN.test(value)) problems.push('Completá lo que está marcado con [COMPLETAR].');
  if (value.length > ANSWER_MAX) problems.push(`La respuesta puede tener hasta ${ANSWER_MAX} caracteres; tiene ${value.length}.`);
  // Los links a otras publicaciones del canal sí van: sirven para mandar al comprador a la que le sirve.
  const found = contactFound(withoutOwnLinks(value));
  if (found.length > 0) problems.push(`Sacá ${contactList(found)}: el canal no los acepta en las respuestas.`);
  return problems;
}

// El motivo en el Registro de una respuesta que Claude mandó solo.
export const AUTO_ANSWERED = 'Claude la respondió automáticamente.';

const normalized = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

/** Si se mandó la propuesta tal cual o se corrigió. */
export function sentOutcome(draft: string, sent: string): DraftOutcome {
  return normalized(draft) === normalized(sent) ? 'SENT_AS_IS' : 'SENT_EDITED';
}

export type PracticeCounts = Record<DraftOutcome | 'PENDING', number> & { total: number; costUsd: number };

/** Cómo le va a Claude: qué se hizo con sus propuestas y cuánto costaron. */
export function practiceCounts(drafts: { outcome: DraftOutcome | null; costUsd: number }[]): PracticeCounts {
  const counts: PracticeCounts = { SENT_AS_IS: 0, SENT_EDITED: 0, SENT_AUTO: 0, DISCARDED: 0, ANSWERED_IN_CHANNEL: 0, PENDING: 0, total: 0, costUsd: 0 };
  for (const d of drafts) {
    counts[d.outcome ?? 'PENDING']++;
    counts.total++;
    counts.costUsd += d.costUsd;
  }
  counts.costUsd = Math.round(counts.costUsd * 100) / 100;
  return counts;
}
