// Cambiar una publicación en el canal con la cuenta conectada. Cada canal lo
// resuelve en src/channels/<canal>/; el resto de la app usa esta interfaz y
// nunca conoce el formato del canal. Solo corre en el servidor.

/** Los datos que hoy se pueden subir. */
export type PublishField = 'title' | 'description' | 'attributes';
export const PUBLISH_FIELDS: PublishField[] = ['title', 'description', 'attributes'];

/** Un dato de catálogo para subir: el código del campo en el canal y su valor; con multiple, varios separados por coma. */
export type ChannelAttributeUpdate = { id: string; value: string; multiple: boolean };

/** El canal no aceptó el cambio. El mensaje explica por qué, en castellano. */
export class PublishError extends Error {}

export interface ChannelPublisher {
  /** Cambia el título o la descripción de una publicación propia. Lanza PublishError si el canal no lo acepta. */
  update(accessToken: string, externalId: string, field: 'title' | 'description', value: string): Promise<void>;
  /** Cambia esos datos de catálogo; los demás quedan como están. Lanza PublishError si el canal no lo acepta. */
  updateAttributes(accessToken: string, externalId: string, attributes: ChannelAttributeUpdate[]): Promise<void>;
}
