import type { ChannelKind } from '@/generated/prisma/enums';
import { mercadolibreResearch } from './mercadolibre/research';

// Lo que la app puede leer de un canal desde el servidor: las sugerencias de
// su buscador y la posición de una publicación en una búsqueda. Solo corre en
// el servidor. Cada canal lo resuelve a su manera en src/channels/<canal>/.

export type ProbeResult = { check: string; label: string; ok: boolean; detail: string };

export class ResearchError extends Error {
  constructor(
    message: string,
    // El canal frenó los pedidos: no conviene seguir pidiendo ahora.
    readonly blocked = false,
  ) {
    super(message);
  }
}

export interface ChannelResearch {
  /** Prueba qué se puede leer del canal desde el servidor de la app. */
  probe(): Promise<ProbeResult[]>;
  /** Las sugerencias del buscador para lo que se escribe, en su orden. */
  suggest(query: string): Promise<string[]>;
  /** Página y posición de la publicación en una búsqueda, o null si no aparece en esas páginas. */
  findPosition(query: string, externalId: string, pages: number): Promise<{ page: number; position: number } | null>;
  /** Qué prueba tiene que haber salido bien para leer cada cosa sola. */
  checks: { suggestions: string; positions: string };
}

const RESEARCH: Partial<Record<ChannelKind, ChannelResearch>> = {
  MERCADOLIBRE: mercadolibreResearch,
};

export function getChannelResearch(kind: ChannelKind): ChannelResearch | null {
  return RESEARCH[kind] ?? null;
}

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
