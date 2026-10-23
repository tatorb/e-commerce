import type { ChannelKind } from '@/generated/prisma/enums';
import { mercadolibrePublisher } from './mercadolibre/publish';
import type { ChannelPublisher } from './publish-types';

// A qué canales se pueden subir cambios con la cuenta conectada. Los tipos
// están en publish-types.ts, así cada canal los usa sin depender de esta lista.

export {
  PUBLISH_FIELDS,
  PublishError,
  type ChannelAttributeUpdate,
  type ChannelCreated,
  type ChannelNewListing,
  type ChannelNewVariant,
  type ChannelPicture,
  type ChannelPictureLayout,
  type ChannelPublisher,
  type ChannelRelist,
  type ChannelStatusChange,
  type PublishField,
} from './publish-types';

const PUBLISHERS: Partial<Record<ChannelKind, ChannelPublisher>> = {
  MERCADOLIBRE: mercadolibrePublisher,
};

export function getChannelPublisher(kind: ChannelKind): ChannelPublisher | null {
  return PUBLISHERS[kind] ?? null;
}
