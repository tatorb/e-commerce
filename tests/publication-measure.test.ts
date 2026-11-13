import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { skuWithoutMeasure, stockSlots } from '@/domain/stock';
import { variantKey } from '@/domain/media';

// Elegir la medida de una publicación cuyo SKU en el canal no la dice. Datos inventados.

process.env.DATABASE_URL ||= process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base';
const { loadMeasureChoice, setPublicationMeasure, sendPendingSku, MeasureError } = await import('@/lib/publication-measure');
const { listToPush } = await import('@/lib/queries/sync');
const { setProductStock } = await import('@/lib/stock');
const { PLAN_SELECT, planFor } = await import('@/lib/stock-plan');
const { MEASURE_TOOLS } = await import('@/lib/mcp/measure-tools');
const { measurelessSkuNote } = await import('@/importers/apply');

const variants = [
  { sku: 'SP-1-00', measure: 'STD' },
  { sku: 'SP-1-50', measure: '0,50 mm' },
];

describe('un SKU sin la medida', () => {
  it('es el número de pieza o lo que comparten los SKU de las medidas', () => {
    expect(skuWithoutMeasure(['SP-1'], variants)).toBe(true);
    expect(skuWithoutMeasure(['sp-1 '], variants)).toBe(true);
    expect(skuWithoutMeasure(['TIK9'], variants, 'TIK9')).toBe(true);
    // El de una medida, otro producto o una sola medida: no.
    expect(skuWithoutMeasure(['SP-1-00'], variants)).toBe(false);
    expect(skuWithoutMeasure(['SP-2'], variants)).toBe(false);
    expect(skuWithoutMeasure(['SP-1'], [variants[0]])).toBe(false);
    expect(skuWithoutMeasure([], variants)).toBe(false);
    expect(measurelessSkuNote('SP-1')).toContain('SKU sin medida, elegila en la publicación');
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('la medida de una publicación', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';
  let productId = '';
  const ids: Record<string, string> = {};

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE tasks, stock_movements, channel_sales, product_stock, channel_copies, channel_sync_changes, channel_connections, product_variants, listing_families, publications, products, stores, channels, accounts, users CASCADE',
    );
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Prueba' } })).id;
    await db.user.create({ data: { id: 'ana', name: 'Ana', email: 'ana@prueba.com', isAdmin: true } });
    // Lee las ventas, pero no está conectada: la cantidad no llega al canal y lo dice.
    storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA', salesSince: new Date(Date.now() - 3600_000) } })).id;
    productId = (await db.product.create({ data: { accountId, name: 'Subconjunto SP-1', partNumber: 'SP-1', variants: { create: variants.map((v, i) => ({ ...v, position: i })) } } })).id;
    const [stdSlot, halfSlot] = stockSlots(variants);
    await setProductStock(db, { accountId, productId, userId: 'ana', stock: { [stdSlot.key]: 3, [halfSlot.key]: 1 } });
    const copy = (sku: string) => ({ readAt: new Date(), status: 'ACTIVE' as const, quantity: 7, variations: [], details: { skus: [sku] } });
    const pub = (externalId: string, sku: string, extra: object = {}) =>
      db.publication.create({ data: { productId, storeId, externalId, title: `Subconjunto ${externalId}`, channelCopy: { create: copy(sku) }, ...extra }, select: { id: true } });
    ids.main = (await pub('MLA1', 'SP-1')).id;
    ids.option = (await pub('MLA2', 'SP-1', { mainOptionId: ids.main })).id;
    ids.half = (await pub('MLA3', 'SP-1-50', { variantKey: variantKey(variants[1]) })).id;
    const family = await db.listingFamily.create({ data: { storeId, productId, leadId: ids.main } });
    await db.publication.updateMany({ where: { id: { in: [ids.main, ids.half] } }, data: { familyId: family.id } });
  });

  it('elige la medida para todas las opciones de venta, con la cantidad y el SKU para mandar', async () => {
    const stock = await db.productStock.findMany({ where: { productId } });
    expect(stock.map((s) => s.quantity).sort()).toEqual([1, 3]);
    const keyOf = (label: string) => stock.find((s) => s.label === label)!.key;

    // Desde la opción en cuotas: la app no sabe qué medida vende.
    const choice = (await loadMeasureChoice(db, { accountId, publicationId: ids.option }))!;
    expect(choice).toMatchObject({ mainId: ids.main, unknown: true, current: null });
    expect(choice.options.map((o) => o.externalId)).toEqual(['MLA1', 'MLA2']);
    // La 0,50 ya la vende otra de la familia; la STD pasa de 7 a 3 en las dos.
    const std = choice.measures.find((m) => m.label === 'STD')!;
    expect(choice.measures.find((m) => m.label === '0,50 mm')!.takenBy).toBe('MLA3');
    expect(std.quantities).toEqual([
      { externalId: 'MLA1', from: 7, to: 3 },
      { externalId: 'MLA2', from: 7, to: 3 },
    ]);

    await expect(setPublicationMeasure(db, { accountId, publicationId: ids.option, measure: 'SP-1-50', userId: 'ana' })).rejects.toThrow('ya la vende MLA3');
    await expect(setPublicationMeasure(db, { accountId, publicationId: ids.option, measure: 'XL', userId: 'ana' })).rejects.toBeInstanceOf(MeasureError);

    const r = await setPublicationMeasure(db, { accountId, publicationId: ids.option, measure: 'SP-1-00', sendSku: true, userId: 'ana' });
    expect(r.measure.label).toBe('STD');
    expect(r.publications).toHaveLength(2);
    expect(r.skuToPush).toBe(2);
    // La tienda no está conectada: la cantidad no sube y dice por qué.
    expect(r.stock.failed.map((f) => f.error)).toEqual(['La tienda no está conectada con Mercado Libre.', 'La tienda no está conectada con Mercado Libre.']);
    const after = await db.publication.findMany({ where: { id: { in: [ids.main, ids.option] } }, select: { variantKey: true, skuToPush: true } });
    expect(after.every((p) => p.variantKey === keyOf('STD') && p.skuToPush === 'SP-1-00')).toBe(true);

    // Ya sabe la medida: la tarjeta queda para mandar el SKU.
    expect(await loadMeasureChoice(db, { accountId, publicationId: ids.main })).toMatchObject({ unknown: false, current: { label: 'STD' } });
    // En Por subir, con el SKU.
    const rows = await listToPush(accountId, db);
    expect(rows.filter((x) => x.sku === 'SP-1-00').map((x) => x.externalId).sort()).toEqual(['MLA1', 'MLA2']);
    // Sin conexión no se manda y queda en Por subir.
    expect(await sendPendingSku(db, { accountId, publicationId: ids.main })).toMatchObject({ ok: false, sku: 'SP-1-00' });
    expect((await db.publication.findUniqueOrThrow({ where: { id: ids.main } })).skuToPush).toBe('SP-1-00');
  });

  it('Claude muestra la vista previa sin guardar y después elige', async () => {
    const tool = (name: string) => MEASURE_TOOLS.find((t) => t.name === name)!;
    const ctx = { db, userId: 'ana', access: { isAdmin: true, permissions: {}, accountIds: [accountId] }, baseUrl: 'https://app' };
    const run = (name: string, args: Record<string, unknown>) => tool(name).run(ctx as never, tool(name).input.parse({ cuenta: 'prueba', ...args }));
    const preview = (await run('set_publication_measure', { publicacion: ids.option, medida: 'STD', subir_sku: true, vista_previa: true })) as Record<string, unknown>;
    expect(preview).toMatchObject({ vista_previa: true, medida: 'STD', medida_actual: 'sin elegir' });
    expect((await db.publication.findUniqueOrThrow({ where: { id: ids.main } })).variantKey).toBeNull();
    const done = (await run('set_publication_measure', { publicacion: ids.main, medida: 'std' })) as Record<string, unknown>;
    expect(done).toMatchObject({ cambio: true, medida: 'STD', opciones_de_venta: ['MLA1', 'MLA2'] });
    expect(done.sku_en_por_subir).toBeUndefined();
    const pushed = (await run('push_skus', {})) as Record<string, unknown>;
    expect(pushed).toMatchObject({ aviso: 'No hay SKU por subir en la cuenta.' });
  });

  it('una opción de venta con las medidas adentro no frena a las demás, y otra del producto tampoco', async () => {
    // Como el SP-413: la de 3 cuotas tiene STD y 0,50 adentro en el canal.
    const both = variants.map((v, i) => ({ id: `V${i}`, sku: v.sku, measure: v.measure, quantity: 6 }));
    const inside = (externalId: string, extra: object = {}) =>
      db.publication.create({
        data: { productId, storeId, externalId, title: `Subconjunto ${externalId}`, channelCopy: { create: { readAt: new Date(), status: 'ACTIVE', quantity: 12, variations: both, details: { skus: ['SP-1-00', 'SP-1-50'] } } }, ...extra },
        select: { id: true },
      });
    ids.withBoth = (await inside('MLA4', { mainOptionId: ids.main })).id;
    // Otra publicación del producto, fuera del grupo, también con las medidas adentro.
    await inside('MLA5');

    // Lo mismo que dice la cantidad: la principal no sabe su medida.
    const plan = (await db.publication.findUniqueOrThrow({ where: { id: ids.main }, select: PLAN_SELECT }));
    expect(planFor(plan)).toMatchObject({ managed: false, reason: expect.stringContaining('su SKU no dice de cuál es') });

    for (const from of [ids.main, ids.option, ids.withBoth]) {
      const choice = (await loadMeasureChoice(db, { accountId, publicationId: from }))!;
      expect(choice).toMatchObject({ mainId: ids.main, unknown: true, withMeasuresInside: ['MLA4'] });
      expect(choice.options.map((o) => o.externalId)).toEqual(['MLA1', 'MLA2']);
    }
    const r = await setPublicationMeasure(db, { accountId, publicationId: ids.withBoth, measure: 'STD', userId: 'ana' });
    expect(r.publications.map((p) => p.externalId)).toEqual(['MLA1', 'MLA2']);
    expect(r.withMeasuresInside).toEqual(['MLA4']);
    expect((await db.publication.findUniqueOrThrow({ where: { id: ids.withBoth } })).variantKey).toBeNull();
    expect(planFor(await db.publication.findUniqueOrThrow({ where: { id: ids.main }, select: PLAN_SELECT }))).toMatchObject({ managed: true, measure: { label: 'STD' } });
  });
});
