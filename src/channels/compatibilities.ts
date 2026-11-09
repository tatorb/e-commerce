import type { ChannelKind } from '@/generated/prisma/enums';
import { mercadolibreCompatibilities } from './mercadolibre/compatibilities';
import type { ChannelCompatibilities } from './compatibilities-types';

// Qué canales tienen compatibilidades con vehículos. Los tipos están en
// compatibilities-types.ts, así cada canal los usa sin depender de esta lista.

export type {
  CatalogField,
  CatalogFilter,
  CatalogValue,
  ChannelCompatibilities,
  ChannelCompatibilityRead,
  ChannelVehicle,
  CompatibilityChange,
  CompatibilityWriteResult,
} from './compatibilities-types';

const COMPATIBILITIES: Partial<Record<ChannelKind, ChannelCompatibilities>> = {
  MERCADOLIBRE: mercadolibreCompatibilities,
};

export function getChannelCompatibilities(kind: ChannelKind): ChannelCompatibilities | null {
  return COMPATIBILITIES[kind] ?? null;
}
