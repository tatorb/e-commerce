import type { ChannelKind } from '@/generated/prisma/enums';
import { CONTENT_FIELD_KIND, CONTENT_FIELD_LABEL, CONTENT_FIELDS, type ContentSnapshot } from '@/domain/content';
import type { ApplySection, ChannelAdapter } from './types';
import { mercadolibre } from './mercadolibre';
import { compatText } from './shared/apply-format';
import { EMPTY_TITLE_RULES } from '@/domain/title-rules';

export type { ApplyItem, ApplySection, ChannelAdapter } from './types';

/** Sin un orden propio del canal: un dato por campo, en el orden de la ficha. */
function genericApplyGuide(c: ContentSnapshot, changed: ReadonlySet<string>): ApplySection[] {
  return CONTENT_FIELDS.filter((f) => f !== 'notes').map((field) => {
    const value = c[field];
    const kind = CONTENT_FIELD_KIND[field];
    const text =
      kind === 'specs'
        ? c.specs.map((s) => `${s.name}: ${s.value}`).join('\n')
        : kind === 'compatibilities'
          ? c.compatibilities.map(compatText).join('\n')
          : kind === 'measures'
            ? c.measures.map((m) => `${m.sku ?? 'Sin SKU'}: ${m.measure ?? ''}`).join('\n')
            : kind === 'links'
              ? (value as string[]).join('\n')
              : ((value as string | null) ?? '');
    return {
      key: field,
      title: CONTENT_FIELD_LABEL[field],
      hint: null,
      items: [
        {
          label: CONTENT_FIELD_LABEL[field],
          value: text,
          kind: 'copy' as const,
          changed: changed.has(field),
          multiline: kind !== 'short',
        },
      ],
    };
  });
}

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
    applyGuide: genericApplyGuide,
    titleLock: () => null,
    titleRules: EMPTY_TITLE_RULES,
    searchUrl: () => null,
    catalog: null,
    fullSizePhotoUrl: () => null,
    photos: null,
    clips: null,
  };
}

const ADAPTERS: Partial<Record<ChannelKind, ChannelAdapter>> = {
  MERCADOLIBRE: mercadolibre,
};

export function getChannelAdapter(kind: ChannelKind, fallbackName = 'Canal'): ChannelAdapter {
  return ADAPTERS[kind] ?? genericAdapter(kind, fallbackName);
}

/** El link para bajar una foto publicada en algún canal, en su tamaño más grande. Null si no es de ningún canal. */
export function channelPhotoUrl(url: string): string | null {
  for (const adapter of Object.values(ADAPTERS)) {
    const full = adapter?.fullSizePhotoUrl(url);
    if (full) return full;
  }
  return null;
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
