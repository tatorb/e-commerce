import type { ChannelKind } from '@/generated/prisma/enums';
import { mercadolibreResearch } from './mercadolibre/research';
import type { ChannelResearch } from './research-types';

// Qué canales se pueden leer desde el servidor. Los tipos y el error están en
// research-types.ts, así cada canal los usa sin depender de esta lista.

export { pause, ResearchError, type ChannelResearch, type ProbeResult } from './research-types';

const RESEARCH: Partial<Record<ChannelKind, ChannelResearch>> = {
  MERCADOLIBRE: mercadolibreResearch,
};

export function getChannelResearch(kind: ChannelKind): ChannelResearch | null {
  return RESEARCH[kind] ?? null;
}

