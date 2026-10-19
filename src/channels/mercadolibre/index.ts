import type { ChannelAdapter } from '../types';
import { mercadolibreApplyGuide } from './apply';
import { mercadolibreCatalog } from './catalog';
import { mercadolibreTitleLock } from './title-lock';
import { MERCADOLIBRE_TITLE_RULES, mercadolibreSearchUrl } from './title-rules';

// Mercado Libre Argentina. Los IDs de publicación tienen la forma MLA + números.
// La gente suele pegar el link entero, que puede venir de dos maneras:
//   https://articulo.mercadolibre.com.ar/MLA-1234567890-subconjunto-...
//   https://www.mercadolibre.com.ar/up/MLAU9876543210?pdp_filters=item_id:MLA1234567890
// En el segundo, MLAU... es el producto del catálogo y no sirve: lo que
// importa es el item_id. La expresión no toma MLAU porque después de MLA
// exige un guion o un número.
const ITEM_ID = /MLA-?(\d{6,})/i;

export const mercadolibre: ChannelAdapter = {
  kind: 'MERCADOLIBRE',
  name: 'Mercado Libre',
  externalId: {
    label: 'ID de la publicación',
    placeholder: 'MLA1234567890',
    help: 'Pegá el ID o el link de la publicación, lo limpiamos solos.',
  },
  titleMaxLength: 60,
  normalizeExternalId(raw) {
    const text = raw.trim();
    const match = text.match(ITEM_ID);
    if (!match) {
      return { ok: false, error: 'El ID tiene que empezar con MLA, por ejemplo MLA1234567890.' };
    }
    return { ok: true, value: `MLA${match[1]}` };
  },
  publicationUrl(externalId) {
    const match = externalId.match(ITEM_ID);
    return match ? `https://articulo.mercadolibre.com.ar/MLA-${match[1]}` : null;
  },
  applyGuide: mercadolibreApplyGuide,
  titleLock: mercadolibreTitleLock,
  titleRules: MERCADOLIBRE_TITLE_RULES,
  searchUrl: mercadolibreSearchUrl,
  catalog: mercadolibreCatalog,
};
