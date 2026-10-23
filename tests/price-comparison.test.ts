import { describe, expect, it } from 'vitest';
import { compare, copyablePlan } from '@/domain/price-comparison';
import { marginOf, PRICING_DEFAULTS } from '@/domain/pricing';

// Precios inventados para las pruebas.
const P = PRICING_DEFAULTS;
const COST = 99_627.5;
const competitor = (sellerName: string, listPrice: number, discountPct: number, installments: number, freeShipping: boolean) => ({
  title: `Publicación de ${sellerName}`,
  sellerName,
  url: null,
  surveyedAt: '2026-10-20',
  offer: { listPrice, discountPct, installments, freeShipping },
});

describe('comparación con la competencia', () => {
  const competitors = [competitor('Uno', 250_000, 10, 6, true), competitor('Dos', 230_000, 0, 0, false), competitor('Tres', 260_000, 15, 3, true)];

  it('compara el precio efectivo: el mío con envío gratis, el de ellos con el envío si no es gratis', () => {
    const c = compare({ mine: { listPrice: 240_000, discountPct: 0, plan: 0 }, competitors, cost: COST, params: P });
    expect(c.rows[0]).toMatchObject({ mine: true, effectivePrice: 240_000, freeShipping: true });
    // Dos: 230.000 más el envío.
    expect(c.rows[2]).toMatchObject({ name: 'Dos', effectivePrice: 230_000 + P.shipping });
    expect(c.rows[1].effectivePrice).toBe(225_000);
    expect(c.rows[3].effectivePrice).toBe(221_000);
    // Más caro que Uno: la diferencia es positiva.
    expect(c.rows[1].diffPct).toBeCloseTo((240_000 / 225_000 - 1) * 100, 9);
    expect(c.cheapest?.name).toBe('Tres');
    expect(c.rank).toBe(3);
    expect(c.total).toBe(4);
    expect(c.withInstallments).toBe(2);
    expect(c.withDiscount).toBe(2);
  });

  it('igualar al más barato: el descuento y el margen que queda', () => {
    const c = compare({ mine: { listPrice: 260_000, discountPct: 0, plan: 0 }, competitors, cost: COST, params: P });
    expect(c.match!.discountPct).toBeCloseTo((1 - 221_000 / 260_000) * 100, 9);
    expect(c.match!.marginPct).toBeCloseTo(marginOf(221_000, COST, P, 0)!, 9);
    expect(c.match!.reachesMin).toBe(true);
    expect(c.summary.join(' ')).toContain('Tenés las cuotas apagadas');
    expect(c.summary.join(' ')).toContain('El más barato es Tres');
    // Si ya soy el más barato, no hay nada que igualar.
    expect(compare({ mine: { listPrice: 200_000, discountPct: 0, plan: 0 }, competitors, cost: COST, params: P }).match).toBeNull();
  });

  it('copiar sus cuotas solo si ese plan tiene el costo cargado', () => {
    const c = compare({ mine: { listPrice: 260_000, discountPct: 0, plan: 0 }, competitors: [competitor('Doce', 200_000, 0, 12, true)], cost: COST, params: P });
    expect(copyablePlan(c.cheapest, P)).toEqual({ plan: 12, available: false });
    expect(copyablePlan(c.cheapest, { ...P, installments12Pct: 15 })).toEqual({ plan: 12, available: true });
    expect(copyablePlan(null, P)).toBeNull();
  });
});
