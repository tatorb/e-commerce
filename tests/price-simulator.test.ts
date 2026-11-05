import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { searchForSimulator } from '@/lib/queries/price-simulator';

// El buscador del simulador de precio, con datos inventados: por código del
// canal, SKU, título de la publicación o nombre del producto.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('buscador del simulador de precio', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';

  beforeAll(async () => {
    await db.$executeRawUnsafe('TRUNCATE publications, product_variants, products, stores, channels, accounts CASCADE');
    const ch = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const other = await db.account.create({ data: { slug: 'otra', name: 'Otra cuenta' } });
    accountId = account.id;
    const store = await db.store.create({ data: { accountId, channelId: ch.id, name: 'TIENDA' } });
    const otherStore = await db.store.create({ data: { accountId: other.id, channelId: ch.id, name: 'OTRA' } });
    const product = await db.product.create({
      data: { accountId, name: 'Subconjunto Inventado SP-1', variants: { create: [{ sku: 'SP-1-00', measure: 'STD', position: 0 }] } },
    });
    const otherProduct = await db.product.create({ data: { accountId: other.id, name: 'Subconjunto Inventado SP-1' } });
    await db.publication.create({ data: { productId: product.id, storeId: store.id, externalId: 'MLA1000000001', title: 'Pistones Motor Inventado 1.6', channelStatus: 'ACTIVE' } });
    await db.publication.create({ data: { productId: product.id, storeId: store.id, externalId: 'MLA1000000002', title: 'Borrada', channelStatus: 'DELETED' } });
    await db.publication.create({ data: { productId: otherProduct.id, storeId: otherStore.id, externalId: 'MLA1000000003', title: 'De otra cuenta', channelStatus: 'ACTIVE' } });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('encuentra por código, SKU, título y producto, solo de la cuenta y sin las borradas', async () => {
    for (const q of ['MLA1000000001', 'MLA-1000000001', 'sp-1-00', 'motor inventado', 'Subconjunto inventado']) {
      expect((await searchForSimulator(db, accountId, q)).map((r) => r.externalId)).toEqual(['MLA1000000001']);
    }
    expect(await searchForSimulator(db, accountId, 'x')).toEqual([]);
    expect(await searchForSimulator(db, accountId, 'nada que ver')).toEqual([]);
    expect((await searchForSimulator(db, accountId, 'SP-1'))[0]).toMatchObject({ skus: ['SP-1-00'], product: 'Subconjunto Inventado SP-1', store: 'TIENDA' });
  });
});
