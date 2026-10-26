import { describe, expect, it } from 'vitest';
import { mercadolibre } from '@/channels/mercadolibre';
import { discountDates } from '@/channels/mercadolibre/publish';

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
    // Como lo muestra el panel de ventas.
    ['#3304440284', 'MLA3304440284'],
    [' # 3304440284 ', 'MLA3304440284'],
  ])('limpia %s', (raw, expected) => {
    expect(mercadolibre.normalizeExternalId(raw)).toEqual({ ok: true, value: expected });
  });

  it.each(['', 'SP-000 STD', 'MLAU9876543210', '1234567890', '#12', 'SP-808 #3304440284'])('rechaza %s', (raw) => {
    expect(mercadolibre.normalizeExternalId(raw).ok).toBe(false);
  });

  it('arma el link público', () => {
    expect(mercadolibre.publicationUrl('MLA1234567890')).toBe(
      'https://articulo.mercadolibre.com.ar/MLA-1234567890',
    );
  });
});

describe('las fechas del descuento', () => {
  it('van en la hora de Argentina, desde hoy y por 14 días', () => {
    // Las 1 de la mañana en UTC son las 10 de la noche del día anterior en Argentina.
    const d = discountDates('MLA123', new Date('2026-10-24T01:00:00Z'));
    expect(d).toMatchObject({ start: '2026-10-23T00:00:00', finish: '2026-11-05T23:59:59' });
    expect(d.until.toISOString()).toBe('2026-11-06T02:59:59.000Z');
  });
});
