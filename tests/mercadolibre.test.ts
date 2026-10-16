import { describe, expect, it } from 'vitest';
import { mercadolibre } from '@/channels/mercadolibre';

describe('ID de publicación de Mercado Libre', () => {
  it.each([
    ['MLA1234567890', 'MLA1234567890'],
    ['  mla1234567890 ', 'MLA1234567890'],
    ['MLA-1234567890', 'MLA1234567890'],
    ['https://articulo.mercadolibre.com.ar/MLA-1234567890-subconjunto-ford-_JM', 'MLA1234567890'],
    [
      'https://www.mercadolibre.com.ar/up/MLAU9876543210?pdp_filters=item_id:MLA1234567890',
      'MLA1234567890',
    ],
  ])('limpia %s', (raw, expected) => {
    expect(mercadolibre.normalizeExternalId(raw)).toEqual({ ok: true, value: expected });
  });

  it.each(['', 'SP-000 STD', 'MLAU9876543210', '1234567890'])('rechaza %s', (raw) => {
    expect(mercadolibre.normalizeExternalId(raw).ok).toBe(false);
  });

  it('arma el link público', () => {
    expect(mercadolibre.publicationUrl('MLA1234567890')).toBe(
      'https://articulo.mercadolibre.com.ar/MLA-1234567890',
    );
  });
});
