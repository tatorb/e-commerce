import type { ChannelKind } from '@/generated/prisma/enums';
import { mercadolibreVolume } from './mercadolibre/volume';
import type { ChannelVolume } from './volume-types';

// En qué canales se arman campañas de descuento por cantidad. Los tipos están en volume-types.ts.

export {
  VolumeError,
  type ChannelVolume,
  type VolumeCampaign,
  type VolumeCampaignInput,
  type VolumeItem,
  type VolumeItems,
  type VolumeJoin,
  type VolumeKind,
} from './volume-types';

const VOLUME: Partial<Record<ChannelKind, ChannelVolume>> = {
  MERCADOLIBRE: mercadolibreVolume,
};

export function getChannelVolume(kind: ChannelKind): ChannelVolume | null {
  return VOLUME[kind] ?? null;
}
