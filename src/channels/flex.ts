import type { ChannelKind } from '@/generated/prisma/enums';
import { mercadolibreFlex } from './mercadolibre/flex';
import type { ChannelFlex } from './flex-types';

// En qué canales se maneja Envíos Flex. Los tipos están en flex-types.ts.

export { FlexError, type ChannelFlex, type FlexService, type FlexRange, type FlexZone, type FlexDay } from './flex-types';

const FLEX: Partial<Record<ChannelKind, ChannelFlex>> = {
  MERCADOLIBRE: mercadolibreFlex,
};

export function getChannelFlex(kind: ChannelKind): ChannelFlex | null {
  return FLEX[kind] ?? null;
}
