import type { ChannelKind } from '@/generated/prisma/enums';
import { mercadolibreConnector } from './mercadolibre/oauth';
import type { ChannelConnector } from './connect-types';

// Qué canales se pueden conectar por API. Los tipos y el error están en
// connect-types.ts, así cada canal los usa sin depender de esta lista.

export { ConnectError, type ChannelConnector, type TokenSet } from './connect-types';

const CONNECTORS: Partial<Record<ChannelKind, ChannelConnector>> = {
  MERCADOLIBRE: mercadolibreConnector,
};

export function getChannelConnector(kind: ChannelKind): ChannelConnector | null {
  return CONNECTORS[kind] ?? null;
}

/** Ruta de vuelta de cada canal, igual para todas las cuentas. */
export function connectPath(kind: ChannelKind): string {
  return `/api/canales/${kind.toLowerCase()}/vuelta`;
}

/** Ruta donde el canal manda sus avisos, igual para todas las cuentas. */
export function noticesPath(kind: ChannelKind): string {
  return `/api/canales/${kind.toLowerCase()}/avisos`;
}
