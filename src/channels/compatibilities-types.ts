// Las compatibilidades con vehículos: con qué vehículos del catálogo del canal
// es compatible una publicación de autopartes. Cada canal lo resuelve en
// src/channels/<canal>/; el resto de la app usa esta interfaz y no sabe cómo
// las guarda cada canal.

/** Un vehículo cargado como compatible en el canal. */
export type ChannelVehicle = {
  // El código de la compatibilidad en el canal, para borrarla. Null en las que cargó el canal.
  id: string | null;
  // El código del vehículo en el catálogo del canal.
  vehicleId: string | null;
  // Cómo lo nombra el canal, por ejemplo "Volkswagen Amarok 2015 2.0 TDI 180cv".
  name: string;
  // La cargó el canal, por ejemplo al aplicar una sugerencia: solo se ve la marca
  // y cuántos son, y no se puede borrar desde la app, solo desde el canal.
  byChannel: boolean;
  // En las que cargó el canal, cuántos vehículos son de esa marca.
  total: number | null;
  note: string | null;
};

export type ChannelCompatibilityRead = {
  // Lo que tiene cargado la publicación.
  listing: ChannelVehicle[];
  // Lo que tiene cargado el producto del canal que agrupa las opciones de venta
  // de la medida. Null si no tiene ese producto o no se pudo leer.
  product: ChannelVehicle[] | null;
  // El canal pide informar los vehículos compatibles.
  needed: boolean;
  // El canal tiene sugerencias de vehículos esperando que se acepten.
  suggested: boolean;
  // Lo que respondió el canal, recortado, para revisar cómo responde.
  raw?: Record<string, unknown>;
};

/** Las listas del catálogo de vehículos, como los filtros de la pantalla del canal. */
export type CatalogField = 'brand' | 'model' | 'year' | 'version' | 'engine' | 'fuel' | 'power';

export type CatalogValue = { id: string; name: string };

/** Un valor ya elegido, para filtrar la lista siguiente. */
export type CatalogFilter = { field: CatalogField; id: string };

export interface ChannelCompatibilities {
  /** Las compatibilidades de una publicación y de su producto del canal. */
  read(
    accessToken: string,
    ref: { externalId: string; channelProductId: string | null },
    opts?: { raw?: boolean },
  ): Promise<ChannelCompatibilityRead>;
  /**
   * Los valores de una lista del catálogo de vehículos, filtrada por los
   * valores ya elegidos. site: el sitio del canal, por ejemplo MLA. Si el canal
   * no tiene esa lista, devuelve null.
   */
  values(accessToken: string, args: { site: string; field: CatalogField; known: CatalogFilter[] }): Promise<CatalogValue[] | null>;
  /** Cuántos vehículos del catálogo cumplen los filtros. Null si no se pudo saber. */
  count(accessToken: string, args: { site: string; filters: CatalogFilter[] }): Promise<number | null>;
  /**
   * Lo que responde el canal al buscar vehículos con esos filtros, tal cual,
   * para saber si deja buscarlos uno por uno.
   */
  probeSearch?(accessToken: string, args: { site: string; filters: CatalogFilter[] }): Promise<unknown>;
}
