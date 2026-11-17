// Campañas de descuento por cantidad que arma el vendedor: "llevá 3 y pagá 2",
// "10 % llevando 2" o "50 % en la 2da unidad". El vendedor crea la campaña y
// después le suma las publicaciones. El descuento lo paga entero el vendedor.

export class VolumeError extends Error {}

// lleva_paga: llevá N y pagá M. descuento_llevando: P % llevando N.
// descuento_en_la_unidad: P % en la unidad N.
export type VolumeKind = 'lleva_paga' | 'descuento_llevando' | 'descuento_en_la_unidad';

export type VolumeCampaignInput = {
  name: string;
  kind: VolumeKind;
  buyQuantity: number;
  // Solo en lleva_paga: cuántas se pagan.
  payQuantity?: number;
  // En las otras dos: el % de descuento.
  discountPct?: number;
  // Si se llega a la cantidad combinando publicaciones distintas.
  combine: boolean;
  // Fecha y hora local, sin zona: "2026-11-25T00:00:00".
  start: string;
  finish: string;
};

export type VolumeCampaign = {
  id: string;
  name: string | null;
  kind: VolumeKind | null;
  // Como lo dice el canal: pending, started, finished.
  status: string | null;
  buyQuantity: number | null;
  payQuantity: number | null;
  discountPct: number | null;
  combine: boolean | null;
  start: string | null;
  finish: string | null;
  // Lo que respondió el canal, sin interpretar.
  raw: unknown;
};

export type VolumeItem = {
  externalId: string;
  // candidate, pending, started, finished.
  status: string | null;
  price: number | null;
  originalPrice: number | null;
  offerId: string | null;
  raw: unknown;
};

export type VolumeItems = { items: VolumeItem[]; total: number | null };

export type VolumeJoin = { offerId: string | null; price: number | null; originalPrice: number | null; raw: unknown };

export interface ChannelVolume {
  /** Las campañas por cantidad de la cuenta. */
  list(accessToken: string, userId: string): Promise<VolumeCampaign[]>;
  create(accessToken: string, input: VolumeCampaignInput): Promise<VolumeCampaign>;
  get(accessToken: string, campaignId: string): Promise<VolumeCampaign>;
  /** Las publicaciones candidatas y las que participan. Con externalId, solo esa. */
  items(accessToken: string, campaignId: string, opts?: { externalId?: string; limit?: number }): Promise<VolumeItems>;
  join(accessToken: string, campaignId: string, externalId: string): Promise<VolumeJoin>;
  leave(accessToken: string, campaignId: string, externalId: string): Promise<void>;
  /** Borra la campaña: saca todas sus ofertas. */
  remove(accessToken: string, campaignId: string): Promise<void>;
  /** Todo lo que el canal informa de las promociones de una publicación, sin interpretar. */
  promotionsOf(accessToken: string, externalId: string): Promise<unknown>;
}
