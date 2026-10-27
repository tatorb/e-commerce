// Las familias del canal tal como se leyeron: el canal guarda cada medida como
// una publicación aparte y las agrupa. Lo leído se guarda en la cara del canal
// de cada publicación (ChannelCopy.details), con los códigos tal cual los da
// el canal. Este módulo no usa la base.

/**
 * Una familia del canal: las medidas de un producto que el canal guarda como
 * publicaciones aparte y muestra juntas. Los códigos son los del canal, sin
 * su formato: la app solo los compara.
 */
export type ChannelFamily = {
  familyId: string;
  // Los productos del canal de la familia, uno por medida.
  channelProductIds: string[];
  // Las publicaciones de todos esos productos.
  listingIds: string[];
};

// La familia se vuelve a leer cada tanto: casi nunca cambia y leerla cuesta varios pedidos.
export const FAMILY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** La familia leída del canal para una publicación. */
export type FamilyRead = {
  // Null: el canal dijo que no está en ninguna familia.
  channelFamilyId: string | null;
  // Los productos del canal de la familia y las publicaciones de todos ellos.
  productIds: string[];
  listingIds: string[];
  readAt: string;
};

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : []);

/** Lo que se leyó de la familia, guardado en la cara del canal. Null si todavía no se leyó. */
export function familyRead(details: unknown): FamilyRead | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const d = details as Record<string, unknown>;
  if (typeof d.familyReadAt !== 'string') return null;
  return {
    channelFamilyId: typeof d.channelFamilyId === 'string' && d.channelFamilyId !== '' ? d.channelFamilyId : null,
    productIds: strings(d.familyProductIds),
    listingIds: strings(d.familyListingIds),
    readAt: d.familyReadAt,
  };
}

/** Si hay que leer la familia: el canal dice de qué producto es y nunca se leyó, o hace mucho. */
export function needsFamilyRead(details: unknown, channelProductId: string | null | undefined, now: Date): boolean {
  if (!channelProductId) return false;
  const read = familyRead(details);
  if (!read) return true;
  const at = Date.parse(read.readAt);
  return Number.isNaN(at) || now.getTime() - at > FAMILY_MAX_AGE_MS;
}

/** Lo que se guarda en la cara del canal: lo recién leído, o lo que ya estaba si esta vez no se leyó. */
export function familyDetails(read: ChannelFamily | null | undefined, before: unknown, now: Date): Record<string, unknown> {
  if (read === undefined) {
    const kept = familyRead(before);
    return kept
      ? { channelFamilyId: kept.channelFamilyId, familyProductIds: kept.productIds, familyListingIds: kept.listingIds, familyReadAt: kept.readAt }
      : {};
  }
  return {
    channelFamilyId: read?.familyId ?? null,
    familyProductIds: read?.channelProductIds ?? [],
    familyListingIds: read?.listingIds ?? [],
    familyReadAt: now.toISOString(),
  };
}
