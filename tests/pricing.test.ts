import { describe, expect, it } from 'vitest';
import {
  availablePlans,
  breakdown,
  BREAKDOWN_PARTS,
  cushionListPrice,
  finalPriceFor,
  fixedInstallments,
  LOW_INTEREST_PLAN,
  planLabel,
  listPriceForMargin,
  marginLevel,
  marginOf,
  maxDiscount,
  PRICING_DEFAULTS,
  pricingInputSchema,
  references,
  resolvePricing,
  simulate,
  targetListPrice,
  vatShare,
} from '@/domain/pricing';

// Un costo inventado para las pruebas.
const COST = 99_627.5;
const P = PRICING_DEFAULTS;

describe('precio', () => {
  it('el IVA como parte del precio', () => {
    expect(vatShare(P) * 100).toBeCloseTo(17.355, 3);
  });

  it('verificación: costo 99.627,50, sin cuotas ni descuento y margen 30 % da unos $221.303', () => {
    // Con el IVA redondeado a 17,355 % da 221.303,4; con el exacto, 17,3554 %, da 221.304,4.
    const target = finalPriceFor(COST, 30, P, 0)!;
    expect(Math.abs(target - 221_303)).toBeLessThan(2);
    expect(finalPriceFor(COST, 30, { ...P, vatRatePct: (0.17355 / (1 - 0.17355)) * 100 }, 0)).toBeCloseTo(221_303.4, 0);
    expect(targetListPrice(COST, P, 0, 0)).toBe(Math.ceil(target));
    expect(references(221_305, COST, P).target).toBe(target);
  });

  it('el margen de un precio es el que se pidió', () => {
    for (const plan of [0, 3, 6] as const) {
      const final = finalPriceFor(COST, 22, P, plan)!;
      expect(marginOf(final, COST, P, plan)).toBeCloseTo(22, 6);
    }
  });

  it('la composición suma el precio final', () => {
    const parts = breakdown(250_000, COST, P, 6);
    const total = BREAKDOWN_PARTS.reduce((sum, k) => sum + parts[k], 0);
    expect(total).toBeCloseTo(250_000, 6);
    // 6 cuotas al mismo precio: 12,9 %.
    expect(parts.installments).toBeCloseTo(32_250, 6);
    expect(parts.shippingPackaging).toBe(10_890);
  });

  it('simular: precio final, ganancia, margen y semáforo', () => {
    const s = simulate({ listPrice: 260_000, discountPct: 10, plan: 3, cost: COST, params: P });
    expect(s.finalPrice).toBe(234_000);
    expect(s.marginPct).toBeCloseTo(marginOf(234_000, COST, P, 3)!, 9);
    expect(s.profitShareOfPrice).toBeCloseTo((s.profit / 234_000) * 100, 9);
    expect(marginLevel(30, P)).toBe('target');
    expect(marginLevel(20, P)).toBe('between');
    expect(marginLevel(14.9, P)).toBe('below');
  });

  it('el precio para un margen y el descuento máximo', () => {
    const list = listPriceForMargin({ marginPct: 30, discountPct: 10, plan: 0, cost: COST, params: P })!;
    expect(list).toBe(Math.round(finalPriceFor(COST, 30, P, 0)! / 0.9));
    // Con el descuento máximo, el margen queda justo en el mínimo.
    const d = maxDiscount(300_000, COST, P, 6)!;
    expect(marginOf(300_000 * (1 - d / 100), COST, P, 6)).toBeCloseTo(15, 6);
    // Si ni sin descuento llega al mínimo: no entra.
    expect(maxDiscount(150_000, COST, P, 0)).toBeNull();
  });

  it('presupuesto de promo', () => {
    const r = references(250_000, COST, P);
    expect(r.promoBudgetPct).toBeCloseTo((1 - r.floor! / 250_000) * 100, 9);
  });

  it('el colchón aguanta 6 cuotas y 10 % de descuento con el margen mínimo', () => {
    const list = cushionListPrice(COST, P)!;
    expect(marginOf(list * 0.9, COST, P, 6)).toBeGreaterThanOrEqual(15);
    expect(marginOf((list - 1) * 0.9, COST, P, 6)).toBeLessThan(15);
    expect(cushionListPrice(COST, { ...P, installments6Pct: null })).toBeNull();
  });

  it('los planes de cuotas que se pueden usar', () => {
    expect(availablePlans(P)).toEqual([0, 1, 3, 6, 9, 12]);
    expect(availablePlans({ ...P, installmentsLowPct: null, installments9Pct: null, installments12Pct: null })).toEqual([0, 3, 6]);
  });

  it('la cuota promocionada cuesta su % pero no tiene una cantidad fija de cuotas', () => {
    expect(breakdown(200_000, COST, P, LOW_INTEREST_PLAN).installments).toBeCloseTo(10_000, 6);
    expect(fixedInstallments(LOW_INTEREST_PLAN)).toBeNull();
    expect(fixedInstallments(6)).toBe(6);
    expect([0, LOW_INTEREST_PLAN, 6].map(planLabel)).toEqual(['Sin cuotas', 'Cuota promocionada', '6 cuotas']);
  });

  it('cuenta, producto y valores de partida', () => {
    const params = resolvePricing({ channelFeePct: 13, shipping: 9000, rara: 5 }, { shipping: 0, minMarginPct: -3 });
    expect(params).toMatchObject({ channelFeePct: 13, shipping: 0, minMarginPct: 15, targetMarginPct: 30 });
  });

  it('lo que se carga a mano', () => {
    expect(pricingInputSchema.parse({ channelFeePct: '13,5', shipping: '10.890', packaging: '', installments9Pct: '12' })).toEqual({
      channelFeePct: 13.5,
      shipping: 10_890,
      installments9Pct: 12,
    });
    expect(pricingInputSchema.safeParse({ channelFeePct: 'mucho' }).success).toBe(false);
    expect(pricingInputSchema.safeParse({ minMarginPct: '40', targetMarginPct: '30' }).success).toBe(false);
  });
});
