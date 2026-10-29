import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { loadProductCosts, setProductCosts } from '@/lib/costs';
import { priceGroups } from '@/lib/pricing';

// Datos inventados.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('el costo de cada medida, en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';

  afterAll(() => db.$disconnect());

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE accounts, channels CASCADE');
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } })).id;
  });

  const STD = 'sku:A-00 medida:std';
  const HALF = 'sku:A-50 medida:0.50';
  const withMeasures = () =>
    db.product.create({
      data: { accountId, name: 'Subconjunto de prueba', variants: { create: [{ sku: 'A-00', measure: 'STD', position: 0 }, { sku: 'A-50', measure: '0.50', position: 1 }] } },
    });
  const publication = (productId: string, data: { variantKey?: string; skus?: string[] } = {}) =>
    db.publication.create({
      data: {
        productId,
        storeId,
        title: 'Publicación de prueba',
        variantKey: data.variantKey ?? null,
        ...(data.skus ? { channelCopy: { create: { readAt: new Date(), status: 'ACTIVE', details: { skus: data.skus } } } } : {}),
      },
    });

  it('sin medidas: un solo costo, que arranca con el de antes y se cambia, se borra y se valida', async () => {
    const p = await db.product.create({ data: { accountId, name: 'Kit de prueba', replacementCost: 900 } });
    expect(await loadProductCosts(db, { accountId, productId: p.id })).toEqual({ lines: [{ key: '', label: '', cost: 900 }], fromGeneral: true });
    await expect(setProductCosts(db, { accountId, productId: p.id, costs: { '': 'mil' } })).rejects.toThrow('El costo tiene que ser un monto');
    await expect(setProductCosts(db, { accountId, productId: p.id, costs: { '': '0' } })).rejects.toThrow('El costo tiene que ser un monto');

    expect(await setProductCosts(db, { accountId, productId: p.id, costs: { '': '1.250,50' } })).toEqual({ changed: 1 });
    expect(await loadProductCosts(db, { accountId, productId: p.id })).toEqual({ lines: [{ key: '', label: '', cost: 1250.5 }], fromGeneral: false });
    // El de antes deja de usarse.
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).replacementCost).toBeNull();
    expect((await priceGroups(db, (await publication(p.id)).id)).map((g) => [g.measures, g.cost, g.costNote])).toEqual([[[], 1250.5, 'el del producto']]);

    await setProductCosts(db, { accountId, productId: p.id, costs: { '': '' } });
    expect((await loadProductCosts(db, { accountId, productId: p.id }))!.lines[0].cost).toBeNull();
    // De otra cuenta, no.
    const other = (await db.account.create({ data: { slug: 'otra', name: 'Otra cuenta' } })).id;
    await expect(setProductCosts(db, { accountId: other, productId: p.id, costs: { '': '10' } })).rejects.toThrow('no existe');
    expect(await loadProductCosts(db, { accountId: other, productId: p.id })).toBeNull();
  });

  it('con medidas: cada publicación usa el de la medida que vende, o el más alto si vende varias o no se sabe', async () => {
    const p = await withMeasures();
    await setProductCosts(db, { accountId, productId: p.id, costs: { [STD]: '100', [HALF]: '130' } });
    expect((await loadProductCosts(db, { accountId, productId: p.id }))!.lines).toEqual([
      { key: STD, label: 'STD', cost: 100 },
      { key: HALF, label: '0.50', cost: 130 },
    ]);
    const bySku = await publication(p.id, { skus: ['A-50'] });
    const chosen = await publication(p.id, { variantKey: STD });
    const unknown = await publication(p.id);
    const tab = async (id: string) => (await priceGroups(db, id)).map((g) => [g.measures, g.cost, g.costNote, g.missing]);
    expect(await tab(bySku.id)).toEqual([[['0.50'], 130, 'el de la medida 0.50', []]]);
    expect(await tab(chosen.id)).toEqual([[['STD'], 100, 'el de la medida STD', []]]);
    expect(await tab(unknown.id)).toEqual([[['STD', '0.50'], 130, 'el más alto de STD y 0.50', []]]);

    // Sin el costo de una medida, el precio de varias no tiene costo y dice cuál falta.
    await setProductCosts(db, { accountId, productId: p.id, costs: { [STD]: '100', [HALF]: '' } });
    expect(await tab(unknown.id)).toEqual([[['STD', '0.50'], null, 'el más alto de STD y 0.50', ['0.50']]]);
    expect(await tab(chosen.id)).toEqual([[['STD'], 100, 'el de la medida STD', []]]);
  });
});
