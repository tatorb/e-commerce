// Cambiar una publicación en el canal con la cuenta conectada. Cada canal lo
// resuelve en src/channels/<canal>/; el resto de la app usa esta interfaz y
// nunca conoce el formato del canal. Solo corre en el servidor.

/** Los datos que hoy se pueden subir. */
export type PublishField = 'title' | 'description';
export const PUBLISH_FIELDS: PublishField[] = ['title', 'description'];

/** El canal no aceptó el cambio. El mensaje explica por qué, en castellano. */
export class PublishError extends Error {}

export interface ChannelPublisher {
  /** Cambia un dato de una publicación propia. Lanza PublishError si el canal no lo acepta. */
  update(accessToken: string, externalId: string, field: PublishField, value: string): Promise<void>;
}
