import type { ChannelStatus } from '@/generated/prisma/enums';

// Textos de los estados en el canal. Archivo aparte, sin la base de datos,
// para poder usarlo en componentes del navegador.
export const CHANNEL_STATUS_LABEL: Record<ChannelStatus, string> = {
  ACTIVE: 'Activa',
  PAUSED: 'Pausada',
  CLOSED: 'Finalizada',
  UNDER_REVIEW: 'En revisión',
  INACTIVE: 'Inactiva',
  DELETED: 'Eliminada',
  UNPUBLISHED: 'Sin publicar',
};

/** Qué quiere decir cada estado, en pocas palabras. */
export function statusHelp(status: ChannelStatus, channelName: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'Se ve y se vende.';
    case 'PAUSED':
      return `No se ve, y se puede reactivar cuando quieras. ${channelName} también pausa las que se quedan sin stock.`;
    case 'CLOSED':
      return 'Ya no se vende. Se puede republicar, con otro código, o eliminar.';
    case 'UNDER_REVIEW':
      return `${channelName} la está revisando. Mientras tanto no se puede cambiar.`;
    case 'INACTIVE':
      return `No está a la venta, por ejemplo porque se quedó sin stock o por un motivo de ${channelName}. Se puede reactivar: si ${channelName} no deja, dice por qué.`;
    case 'DELETED':
      return `Se eliminó de ${channelName}. Queda archivada en la app, con su historial.`;
    case 'UNPUBLISHED':
      return `Todavía no está publicada en ${channelName}.`;
  }
}

/** Lo que se puede hacer con el estado de una publicación desde la app. */
export type StatusAction = 'pause' | 'activate' | 'close' | 'delete' | 'relist';

export const STATUS_ACTIONS: Record<StatusAction, { label: string; done: string; from: ChannelStatus[]; to: ChannelStatus }> = {
  pause: { label: 'Pausar', done: 'pausada', from: ['ACTIVE'], to: 'PAUSED' },
  activate: { label: 'Reactivar', done: 'reactivada', from: ['PAUSED', 'INACTIVE'], to: 'ACTIVE' },
  close: { label: 'Finalizar', done: 'finalizada', from: ['ACTIVE', 'PAUSED', 'INACTIVE'], to: 'CLOSED' },
  // Solo una finalizada se puede eliminar o republicar.
  delete: { label: 'Eliminar', done: 'eliminada', from: ['CLOSED'], to: 'DELETED' },
  relist: { label: 'Republicar', done: 'republicada', from: ['CLOSED'], to: 'ACTIVE' },
};

/** Las acciones que tiene una publicación en ese estado. */
export function statusActions(status: ChannelStatus): StatusAction[] {
  return (Object.keys(STATUS_ACTIONS) as StatusAction[]).filter((a) => STATUS_ACTIONS[a].from.includes(status));
}

/** Lo que se pregunta antes de una acción que no tiene vuelta atrás. Null si no hace falta. */
export function statusConfirm(action: StatusAction, channelName: string, count = 1): string | null {
  const one = count === 1;
  if (action === 'close') {
    return `${one ? 'Una publicación finalizada' : `Las ${count} publicaciones finalizadas`} ya no se ${one ? 'vende' : 'venden'} en ${channelName} y no se ${one ? 'puede' : 'pueden'} reactivar, solo republicar con otro código. ¿Finalizar?`;
  }
  if (action === 'delete') {
    return `${one ? 'Se elimina' : `Se eliminan ${count} publicaciones`} de ${channelName} para siempre. En la app ${one ? 'queda archivada' : 'quedan archivadas'}, con su historial. ¿Eliminar?`;
  }
  return null;
}

/** El código del canal, o "Sin publicar" si todavía no tiene. */
export const codeOrUnpublished = (externalId: string | null | undefined): string =>
  externalId || CHANNEL_STATUS_LABEL.UNPUBLISHED;

/** Las que no se venden pero se pueden reactivar. */
export const STOPPED_STATUSES: readonly ChannelStatus[] = ['PAUSED', 'INACTIVE'];

/**
 * Si al recibir esas cantidades la publicación hay que reactivarla: estaba
 * frenada y sin stock, y ahora tiene. Una que se pausó con stock no, porque
 * eso lo decidió alguien.
 */
export function needsReactivation(status: ChannelStatus, before: { quantity: number }[] | null, after: { quantity: number }[]): boolean {
  const total = (lines: { quantity: number }[]) => lines.reduce((sum, l) => sum + l.quantity, 0);
  return STOPPED_STATUSES.includes(status) && before !== null && total(before) === 0 && total(after) > 0;
}
