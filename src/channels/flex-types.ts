// Envíos Flex: el vendedor entrega él mismo, en el día o al día siguiente. La
// app lee y cambia si cada publicación lo ofrece, y lee la configuración de la
// cuenta. Las entregas se hacen con la app de Flex del canal: desde acá no se
// marcan como entregadas.

export class FlexError extends Error {}

export type FlexDay = 'week' | 'saturday' | 'sunday';

export type FlexZone = {
  id: string;
  // El horario de corte de la zona, si la cuenta lo tiene por zona.
  cutoff: Partial<Record<FlexDay, number>> | null;
};

export type FlexRange = { day: FlexDay; from: number | null; to: number | null; cutoff: number | null; capacity: number | null };

export type FlexService = {
  serviceId: string;
  // Como lo dice el canal: in, out, pending...
  status: string;
  origin: string | null;
  coverage: string | null;
  zones: FlexZone[] | null;
  // same_day o next_day.
  deliveryWindow: string | null;
  ranges: FlexRange[];
  extendedRange: boolean;
  // El canal moderó el servicio.
  moderated: boolean;
  holidays: { date: string; description: string; selected: boolean }[];
  // Lo que no se pudo leer, en palabras.
  warnings: string[];
};

export interface ChannelFlex {
  /** Si la publicación ofrece Flex ahora, leído en el momento. */
  hasFlex(accessToken: string, externalId: string): Promise<boolean>;
  /** Prende o apaga Flex en la publicación. Si ya estaba así, no hace nada. */
  setFlex(accessToken: string, externalId: string, on: boolean): Promise<void>;
  /** La configuración de Flex de la cuenta. Vacía si la cuenta no tiene Flex. */
  config(accessToken: string, userId: string, site: string): Promise<FlexService[]>;
}
