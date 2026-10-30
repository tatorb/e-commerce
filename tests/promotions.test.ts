import { describe, expect, it } from 'vitest';
import { needsDetail, parsePromotions, readRef, withDetail } from '@/channels/mercadolibre/promotions';
import { campaignOutcomeState, campaignPrice, campaignPriceProblem, campaignRevenue, combinedBounds, dealPrice, discountFit, discountOptions, pctForPrice, pctUpToPrice } from '@/domain/promotions';

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

describe('campañas', () => {
  it('cómo se suma a cada una y qué guarda para sumarse o salir', () => {
    const p = parsePromotions([
      { id: 'P-1', type: 'DEAL', status: 'candidate', price: 0, original_price: 100 },
      { id: 'P-2', type: 'SMART', status: 'candidate', price: 80, original_price: 100 },
      { id: 'P-3', type: 'SMART', status: 'started', ref_id: 'OFFER-1', price: 80 },
      { id: 'P-4', type: 'LIGHTNING', status: 'candidate', price: 0 },
      { type: 'DEAL', status: 'candidate' },
    ]);
    const [smartIn, deal, smart, lightning, noId] = p.campaigns;
    expect(deal).toMatchObject({ join: 'price', canLeave: false, pausesOwnDiscount: true });
    // La co-fondeada necesita el código de la oferta, que sale de la campaña.
    expect(smart).toMatchObject({ join: null });
    expect(needsDetail(smart)).toEqual({ type: 'SMART', promotion: 'P-2', offer: null });
    expect(withDetail(smart, needsDetail(smart)!, { results: [{ offer_id: 'CANDIDATE-1', meli_percentage: 5, seller_percentage: 15 }] })).toMatchObject({
      join: 'accept',
      channelPct: 5,
      sellerPct: 15,
    });
    // Sin el detalle no se puede sumar desde la app.
    expect(withDetail(deal, needsDetail(deal)!, { results: [] }).join).toBeNull();
    expect(smartIn).toMatchObject({ status: 'active', canLeave: true });
    expect(readRef(smartIn.ref!)).toEqual({ type: 'SMART', promotion: 'P-3', offer: 'OFFER-1' });
    expect(lightning).toMatchObject({ join: null, canLeave: false });
    expect(noId).toMatchObject({ ref: null, join: null });
    expect(readRef('cualquier cosa')).toBeNull();
  });

  it('lo que recibe la tienda suma lo que pone el canal, y el precio tiene que entrar en el rango', () => {
    expect(campaignRevenue({ price: 80, channelPct: 5, listPrice: 100 })).toBe(85);
    expect(campaignRevenue({ price: 80, channelPct: null, listPrice: 100 })).toBe(80);
    expect(campaignRevenue({ price: null, channelPct: 5, listPrice: 100 })).toBeNull();
    const range = { minPrice: 50, maxPrice: 90, suggestedPrice: 85 };
    expect(campaignPriceProblem(85, range, 100)).toBeNull();
    expect(campaignPriceProblem(95, range, 100)).toBe('Es más alto de lo que acepta el canal.');
    expect(campaignPriceProblem(40, range, 100)).toBe('Es más bajo de lo que acepta el canal.');
    expect(campaignPriceProblem(100, null, 100)).toBe('Tiene que ser menor que el precio publicado.');
    expect(campaignPriceProblem(0, range, 100)).toBe('Falta el precio para el comprador.');
    // Con centavos se redondea para abajo: el tope con centavos entra igual.
    expect(campaignPrice(90.56)).toBe(90);
    expect(campaignPriceProblem(90.56, { ...range, maxPrice: 90.56 }, 100)).toBeNull();
    expect(campaignPriceProblem(90.9, range, 100)).toBeNull();
  });

  it('cómo quedó en el canal lo que se mandó: programada o activa al sumarse, fuera al salir, o pendiente', () => {
    expect(campaignOutcomeState('join', 'active')).toBe('activa');
    expect(campaignOutcomeState('join', 'scheduled')).toBe('programada');
    expect(campaignOutcomeState('join', 'invited')).toBe('pendiente');
    expect(campaignOutcomeState('join', null)).toBe('pendiente');
    expect(campaignOutcomeState('leave', null)).toBe('fuera');
    expect(campaignOutcomeState('leave', 'invited')).toBe('fuera');
    expect(campaignOutcomeState('leave', 'active')).toBe('pendiente');
  });
});
