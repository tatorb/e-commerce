import type { ChannelKind } from '@/generated/prisma/enums';
import type { ChannelAdapter } from './types';
import { mercadolibre } from './mercadolibre';

export type { ChannelAdapter } from './types';

// Canal sin reglas propias todavía, por ejemplo la tienda web: el ID es texto
// libre y no se arma link.
function genericAdapter(kind: ChannelKind, name: string): ChannelAdapter {
  return {
    kind,
    name,
    externalId: { label: 'ID en el canal', placeholder: '', help: '' },
    titleMaxLength: null,
    normalizeExternalId(raw) {
      const value = raw.trim();
      return value ? { ok: true, value } : { ok: false, error: 'Falta el ID.' };
    },
    publicationUrl: () => null,
  };
}

const ADAPTERS: Partial<Record<ChannelKind, ChannelAdapter>> = {
  MERCADOLIBRE: mercadolibre,
};

export function getChannelAdapter(kind: ChannelKind, fallbackName = 'Canal'): ChannelAdapter {
  return ADAPTERS[kind] ?? genericAdapter(kind, fallbackName);
}

/** Lo que un formulario del navegador necesita saber del canal: solo datos. */
export type ChannelInfo = {
  name: string;
  externalIdLabel: string;
  externalIdPlaceholder: string;
  externalIdHelp: string;
  titleMaxLength: number | null;
};

export function channelInfo(kind: ChannelKind, fallbackName?: string): ChannelInfo {
  const a = getChannelAdapter(kind, fallbackName);
  return {
    name: a.name,
    externalIdLabel: a.externalId.label,
    externalIdPlaceholder: a.externalId.placeholder,
    externalIdHelp: a.externalId.help,
    titleMaxLength: a.titleMaxLength,
  };
}
