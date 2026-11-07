import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { flatForMargin, flatProfit, modeRows } from '@/domain/option-table';
import { PRICING_DEFAULTS } from '@/domain/pricing';
import { setProductCosts } from '@/lib/costs';
import { loadOptionTable } from '@/lib/option-table';

// La tabla de precios por modo de compra, calibrada desde el sin cuotas.
// Datos inventados, salvo el ejemplo del Falcon con los costos de la cuenta.

describe('el precio de cada modo desde el sin cuotas', () => {
  it('el ejemplo del Falcon: todos dejan la misma ganancia y el mismo margen', () => {
    const cost = 222_666.5;
    expect(Math.round(flatProfit(473_416, cost, PRICING_DEFAULTS))).toBe(66_801);
    const rows = modeRows({ flatPrice: 473_416, cost, params: PRICING_DEFAULTS });
    expect(rows.map((r) => [r.label, r.price])).toEqual([
      ['Sin cuotas', 473_416],
      ['Cuota promocionada', 513_918],
      ['3 cuotas', 546_655],
      ['6 cuotas', 594_242],
      ['9 cuotas', 650_904],
      ['12 cuotas', 704_326],
    ]);
    for (const r of rows) {
      expect(r.profit!).toBeGreaterThan(66_800);
      expect(r.profit!).toBeLessThan(66_802);
      expect(r.marginPct!).toBeCloseTo(30, 1);
      expect(r.level).toBe('target');
    }
    expect(rows.find((r) => r.plan === 3)?.installmentValue).toBe(182_218.33);
    expect(rows.find((r) => r.plan === 1)?.installmentValue).toBeNull();
  });

  it('los atajos al objetivo y al mínimo, y una cuota sin costo cargado no inventa precio', () => {
    expect(flatForMargin(222_666.5, PRICING_DEFAULTS, 30)).toBe(473_416);
    expect(flatForMargin(222_666.5, PRICING_DEFAULTS, 15)).toBe(420_771);
    const rows = modeRows({ flatPrice: 420_771, cost: 222_666.5, params: { ...PRICING_DEFAULTS, installments9Pct: null } });
    expect(rows.find((r) => r.plan === 9)).toMatchObject({ price: null, missing: 'Falta cargar el costo de 9 cuotas en Ajustes > Precios.' });
    expect(rows.find((r) => r.plan === 6)?.level).toBe('between');
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('la tabla en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE price_decisions, channel_copies, publications, products, stores, channels, accounts CASCADE');
    const ch = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    storeId = (await db.store.create({ data: { accountId, channelId: ch.id, name: 'TIENDA' } })).id;
  });

  it('cada medida muestra qué publicación tiene en cada modo, con su estado y lo que deja hoy', async () => {
    const product = await db.product.create({ data: { accountId, name: 'Subconjunto SP-221', variants: { create: [{ sku: 'SP-221-00', measure: 'STD', position: 0 }] } } });
    await setProductCosts(db, { accountId, productId: product.id, costs: { '': '222666.5' } });
    const flat = await db.publication.create({ data: { productId: product.id, storeId, externalId: 'MLA10', title: 'Falcon' } });
    const low = await db.publication.create({ data: { productId: product.id, storeId, externalId: 'MLA11', title: 'Falcon', mainOptionId: flat.id } });
    await db.channelCopy.create({ data: { publicationId: flat.id, readAt: new Date(), status: 'ACTIVE', installments: 0, price: 473_416, discount: 0 } });
    await db.channelCopy.create({
      data: { publicationId: low.id, readAt: new Date(), status: 'UNDER_REVIEW', statusReason: 'Prohibida.', statusBlocked: true, installments: 1, price: 500_000, discount: 10 },
    });

    // Sin precio guardado: parte del margen objetivo.
    const t = (await loadOptionTable(db, { accountId, publicationId: flat.id, campaigns: false }))!;
    expect(t.groups).toHaveLength(1);
    expect(t.groups[0]).toMatchObject({ cost: 222_666.5, flatPrice: 473_416, flatSource: 'margen_objetivo' });
    const m = t.groups[0].measures[0];
    expect(m.modes.map((x) => [x.plan, x.options.map((o) => o.externalId)])).toEqual([
      [0, ['MLA10']],
      [1, ['MLA11']],
      [3, []],
      [6, []],
      [9, []],
      [12, []],
    ]);
    expect(m.modes[1].options[0]).toMatchObject({ status: 'UNDER_REVIEW', blocked: true, main: false, priceNow: 500_000, discountNow: 10 });
    // Hoy deja lo de 450.000 (500.000 con 10 % de descuento) con la cuota promocionada.
    expect(m.modes[1].options[0].now?.marginPct).toBeCloseTo(((450_000 * 0.584446 - 10_890 - 222_666.5) / 222_666.5) * 100, 1);

    // Con un precio sin cuotas pedido, toda la tabla sale de ahí.
    const asked = (await loadOptionTable(db, { accountId, publicationId: flat.id, flatPrices: { [flat.id]: 473_416 }, campaigns: false }))!;
    expect(asked.groups[0]).toMatchObject({ flatPrice: 473_416, flatSource: 'pedido' });
    expect(asked.groups[0].rows.map((r) => r.price)).toEqual([473_416, 513_918, 546_655, 594_242, 650_904, 704_326]);
  });
});
