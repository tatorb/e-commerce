import type { ChannelStatus } from '@/generated/prisma/enums';

// Textos de los estados en el canal. Archivo aparte, sin la base de datos,
// para poder usarlo en componentes del navegador.
export const CHANNEL_STATUS_LABEL: Record<ChannelStatus, string> = {
  ACTIVE: 'Activa',
  PAUSED: 'Pausada',
  INACTIVE: 'Inactiva',
  UNPUBLISHED: 'Sin publicar',
};

/** El código del canal, o "Sin publicar" si todavía no tiene. */
export const codeOrUnpublished = (externalId: string | null | undefined): string =>
  externalId || CHANNEL_STATUS_LABEL.UNPUBLISHED;
