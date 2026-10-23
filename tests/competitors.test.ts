import { describe, expect, it } from 'vitest';
import { competitorsSchema, daysSince, offerOf, offerPrices, storedCompetitor } from '@/domain/competitors';
import { parsePercent } from '@/domain/money';

describe('precios de la competencia', () => {
  it('precio final, cuota y precio efectivo', () => {
    expect(offerPrices({ listPrice: 100000, discountPct: 15, installments: 6, freeShipping: false }, 10890)).toEqual({
      finalPrice: 85000,
      installmentValue: 85000 / 6,
      effectivePrice: 95890,
    });
    // Con envío gratis no suma el envío; sin cuotas no hay valor de cuota.
    expect(offerPrices({ listPrice: 100000, discountPct: 0, installments: 0, freeShipping: true }, 10890)).toEqual({
      finalPrice: 100000,
      installmentValue: null,
      effectivePrice: 100000,
    });
  });

  it('una fila sin precio de lista no tiene oferta', () => {
    expect(offerOf({ listPrice: null, discountPct: '0', installments: 0, freeShipping: false })).toBeNull();
    expect(offerOf({ listPrice: '125000.50', discountPct: '10.5', installments: 3, freeShipping: true })).toEqual({
      listPrice: 125000.5,
      discountPct: 10.5,
      installments: 3,
      freeShipping: true,
    });
  });

  it('lee lo que se escribe a mano', () => {
    const parsed = competitorsSchema.parse([
      {
        title: 'Kit Embrague Gol',
        url: '',
        soldQuantity: '1.200',
        sellerName: '  Repuestos Sur ',
        listPrice: '$ 125.000,50',
        discountPct: '12,5 %',
        installments: '6',
        freeShipping: true,
        surveyedAt: '2026-10-20',
        notes: '',
      },
      { title: 'Solo el título', url: '', soldQuantity: '' },
    ]);
    expect(parsed[0]).toEqual({
      title: 'Kit Embrague Gol',
      url: null,
      soldQuantity: 1200,
      sellerName: 'Repuestos Sur',
      listPrice: 125000.5,
      discountPct: 12.5,
      installments: 6,
      freeShipping: true,
      surveyedAt: '2026-10-20',
      notes: null,
    });
    expect(parsed[1]).toMatchObject({ sellerName: null, listPrice: null, discountPct: 0, installments: 0, freeShipping: false, surveyedAt: null });
  });

  it.each([
    [{ listPrice: 'mucho' }, 'precio de lista'],
    [{ listPrice: '0' }, 'precio de lista'],
    [{ discountPct: '100' }, 'descuento'],
    [{ discountPct: 'diez' }, 'descuento'],
    [{ installments: '4' }, 'cuotas'],
    [{ surveyedAt: '23/10/2026' }, 'fecha'],
    [{ surveyedAt: '2026-02-30' }, 'fecha'],
  ])('rechaza %o', (row, message) => {
    const r = competitorsSchema.safeParse([{ title: 'x', url: '', soldQuantity: '', ...row }]);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain(message);
  });

  it('vuelve a guardar una fila tal cual estaba', () => {
    expect(
      storedCompetitor({
        title: 'A',
        url: null,
        soldQuantity: 5,
        sellerName: 'V',
        listPrice: '1000',
        discountPct: '5',
        installments: 3,
        freeShipping: false,
        surveyedAt: new Date('2026-10-01T00:00:00Z'),
        notes: null,
      }),
    ).toEqual({ title: 'A', url: null, soldQuantity: 5, sellerName: 'V', listPrice: 1000, discountPct: 5, installments: 3, freeShipping: false, surveyedAt: '2026-10-01', notes: null });
  });

  it('días desde el relevamiento', () => {
    expect(daysSince('2026-10-01', '2026-10-23')).toBe(22);
    expect(daysSince('2026-10-23', '2026-10-23')).toBe(0);
  });

  it('porcentaje escrito a mano', () => {
    expect(parsePercent('')).toBeNull();
    expect(parsePercent('15')).toBe(15);
    expect(parsePercent('14,3 %')).toBe(14.3);
    expect(parsePercent('-5')).toBe('invalid');
  });
});
