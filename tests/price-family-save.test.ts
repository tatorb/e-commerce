import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { setProductCosts } from '@/lib/costs';
import { saveFlatPrice, savePriceDecision } from '@/lib/pricing';
import { variantKey } from '@/domain/media';
import { TRANSACTION_OPTIONS } from '@/lib/transaction-options';

// Guardar el precio de una familia con dos medidas y seis formas de cobro en
// cada una, como el SP-683, con una base que tarda en responder como la de
// producción. Datos inventados.

const url = process.env.TEST_DATABASE_URL;
// Lo que tarda cada consulta desde el servidor hasta la base.
const LATENCY_MS = 120;

describe.skipIf(!url)('guardar el precio de una familia con muchas formas de cobro', () => {
  // Con las mismas opciones que la app (src/lib/db.ts).
  const plain = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }), transactionOptions: TRANSACTION_OPTIONS });
  const slow = plain.$extends({
    query: {
      async $allOperations({ args, query }) {
        await new Promise((r) => setTimeout(r, LATENCY_MS));
        return query(args);
      },
    },
  }) as unknown as PrismaClient;
  let accountId = '';
  let userId = '';
  let leadId = '';

  afterAll(async () => {
    await plain.$disconnect();
  });

  beforeEach(async () => {
    const db = plain;
    await db.$executeRawUnsafe('TRUNCATE listing_families, channel_copies, channel_sync_changes, price_decisions, publications, products, stores, channels, accounts, users CASCADE');
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Prueba' } })).id;
    userId = (await db.user.create({ data: { id: 'u-ana', name: 'Ana', email: 'ana@prueba.com' } })).id;
    const storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } })).id;
    const variants = [
      { sku: 'SP-9-00', measure: 'STD' },
      { sku: 'SP-9-60', measure: '0,60 mm' },
    ];
    const productId = (await db.product.create({ data: { accountId, name: 'Subconjunto SP-9', variants: { create: variants.map((v, i) => ({ ...v, position: i })) } } })).id;
    await setProductCosts(db, { accountId, productId, costs: { [variantKey(variants[0])!]: '100000', [variantKey(variants[1])!]: '100000' } });
    let n = 0;
    const pub = async (v: (typeof variants)[number], installments: number, mainOptionId: string | null) => {
      const p = await db.publication.create({
        data: { productId, storeId, externalId: `MLA${++n}`, title: 'Subconjunto', variantKey: variantKey(v), mainOptionId, price: 189_900, installments },
      });
      await db.channelCopy.create({ data: { publicationId: p.id, readAt: new Date(), status: 'ACTIVE', installments, price: 189_900, details: { skus: [v.sku] } } });
      return p.id;
    };
    const mains: string[] = [];
    for (const v of variants) {
      const main = await pub(v, 0, null);
      mains.push(main);
      // Cuota promocionada, 3, 6, 9 y 12.
      for (const plan of [1, 3, 6, 9, 12]) await pub(v, plan, main);
    }
    leadId = mains[0];
    const family = await db.listingFamily.create({ data: { storeId, productId, leadId } });
    await db.publication.updateMany({ where: { id: { in: mains } }, data: { familyId: family.id } });
  });

  it('desde el precio sin cuotas, aunque la base tarde, guarda las doce', async () => {
    const r = await saveFlatPrice(slow, { accountId, publicationId: leadId, userId, flatPrice: 221_305, confirmBelowMin: false });
    expect(r.main.listPrice).toBe(221_305);
    expect(r.options.filter((o) => o.listPrice !== null)).toHaveLength(10);
    expect(await plain.priceDecision.count()).toBe(12);
  }, 120_000);

  it('con el precio publicado, aunque la base tarde, guarda las doce', async () => {
    const r = await savePriceDecision(slow, { accountId, publicationId: leadId, userId, listPrice: 221_305, discountPct: 0, plan: 0, overrides: {}, confirmBelowMin: false });
    expect(r.options.filter((o) => o.listPrice !== null)).toHaveLength(10);
  }, 120_000);
});
