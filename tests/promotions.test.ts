import { describe, expect, it } from 'vitest';
import { parsePromotions } from '@/channels/mercadolibre/promotions';
import { combinedBounds, dealPrice, discountFit, discountOptions, pctForPrice, pctUpToPrice } from '@/domain/promotions';

// Lo que Mercado Libre informa de las promociones de una publicación, y las
// cuentas del descuento frente a lo que acepta. Datos inventados, con la forma
// de la documentación de Mercado Libre.

describe('promociones de Mercado Libre', () => {
  it('lee el rango del descuento propio, el que está puesto y las campañas', () => {
    const p = parsePromotions([
      { type: 'PRICE_DISCOUNT', status: 'candidate', price: 0, original_price: 200_000, min_discounted_price: 60_000, max_discounted_price: 180_000, suggested_discounted_price: 175_000 },
      { id: 'P-MLA1', type: 'DEAL', status: 'candidate', price: 0, original_price: 200_000, name: 'Hot Sale', start_date: '2026-11-03T00:00:00-03:00', finish_date: '2026-11-10T23:59:59-03:00' },
      { id: 'P-MLA2', type: 'SMART', status: 'started', price: 150_000, original_price: 200_000, meli_percentage: 8, seller_percentage: 17, name: 'Descuento compartido' },
      { id: 'P-MLA3', type: 'PRICE_MATCHING', status: 'pending', price: 0, total_price_for_boosted_offer: 172_000, meli_percentage: 2, seller_percentage: 0 },
      { type: 'VOLUME', status: 'finished', price: 0 },
      { type: 'RARA', status: 'candidate' },
      'cualquier cosa',
    ]);
    expect(p.listPrice).toBe(200_000);
    expect(p.discount).toEqual({ minPrice: 60_000, maxPrice: 180_000, suggestedPrice: 175_000 });
    expect(p.current).toBeNull();
    // Primero en las que está, después las programadas y las invitaciones. Las terminadas no van.
    expect(p.campaigns.map((c) => [c.kind, c.status, c.price])).toEqual([
      ['Co-fondeada automática', 'active', 150_000],
      ['Precios competitivos', 'scheduled', 172_000],
      ['Campaña tradicional', 'invited', null],
      ['Otra promoción', 'invited', null],
    ]);
    expect(p.campaigns[0]).toMatchObject({ name: 'Descuento compartido', channelPct: 8, sellerPct: 17 });
    expect(p.campaigns[2].finish?.toISOString()).toBe('2026-11-11T02:59:59.000Z');
  });

  it('el descuento propio puesto o programado no es una candidata', () => {
    expect(parsePromotions([{ type: 'PRICE_DISCOUNT', status: 'started', price: 190_000, original_price: 200_000 }])).toMatchObject({
      discount: null,
      current: { price: 190_000, scheduled: false },
    });
    expect(parsePromotions([{ type: 'PRICE_DISCOUNT', status: 'pending', price: 190_000 }]).current).toEqual({ price: 190_000, scheduled: true });
    // Sin nada: no deja ponerle un descuento propio.
    expect(parsePromotions([])).toEqual({ listPrice: null, discount: null, current: null, campaigns: [] });
    expect(parsePromotions(null).campaigns).toEqual([]);
  });
});

describe('el descuento frente a lo que acepta el canal', () => {
  const bounds = { minPrice: 60_000, maxPrice: 180_000, suggestedPrice: 175_000 };

  it('avisa si queda chico o demasiado', () => {
    expect(dealPrice(200_000, 5)).toBe(190_000);
    expect(discountFit(200_000, 5, bounds)).toBe('small');
    expect(discountFit(200_000, 10, bounds)).toBe('ok');
    expect(discountFit(200_000, 75, bounds)).toBe('big');
    expect(discountFit(200_000, 0, bounds)).toBeNull();
    expect(discountFit(200_000, 10, null)).toBeNull();
  });

  it('el % que deja el precio con descuento justo en el límite, con el redondeo a pesos', () => {
    expect(pctForPrice(200_000, 180_000)).toBe(10);
    expect(pctUpToPrice(200_000, 60_000)).toBe(70);
    const pct = pctForPrice(268_990, 250_000)!;
    expect(dealPrice(268_990, pct)).toBeLessThanOrEqual(250_000);
    expect(dealPrice(268_990, pct - 0.01)).toBeGreaterThan(250_000);
    expect(pctForPrice(200_000, 250_000)).toBeNull();
  });

  it('las opciones respetan lo que acepta el canal en %', () => {
    const range = { min: 5, max: 80 };
    expect(discountOptions(200_000, bounds, range)).toEqual({ smallest: 10, largest: 70, suggested: 12.5 });
    // Si acepta cualquier precio debajo del de hoy, el más chico es el mínimo del canal.
    expect(discountOptions(200_000, { minPrice: null, maxPrice: 199_000, suggestedPrice: null }, range)).toEqual({ smallest: 5, largest: null, suggested: null });
    expect(discountOptions(200_000, { minPrice: 10_000, maxPrice: null, suggestedPrice: 199_500 }, range)).toEqual({ smallest: null, largest: 80, suggested: null });
    expect(discountOptions(0, bounds, range)).toEqual({ smallest: null, largest: null, suggested: null });
  });

  it('con varias publicaciones, el precio con descuento tiene que entrar en todas', () => {
    expect(
      combinedBounds([
        { minPrice: 60_000, maxPrice: 180_000, suggestedPrice: 175_000 },
        { minPrice: 70_000, maxPrice: 170_000, suggestedPrice: 160_000 },
      ]),
    ).toEqual({ minPrice: 70_000, maxPrice: 170_000, suggestedPrice: null });
    expect(combinedBounds([bounds, null])).toBeNull();
    expect(combinedBounds([])).toBeNull();
  });
});
