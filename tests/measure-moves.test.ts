import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { measureMoves, movedMedia, movedVideoVariants, pairMeasures } from '@/domain/measure-moves';
import { variantKey } from '@/domain/media';
import { updateProductInfo, type ProductInfo } from '@/domain/product-info';
import { saveProduct, type ProductData } from '@/domain/products';
import { dropOrphanStock, loadProductStock } from '@/lib/stock';
import { StockError } from '@/domain/stock';

// Cambiarle el nombre o el SKU a una medida: su stock, su historial, sus
// fotos y lo demás pasan al nombre nuevo, sin dejar un renglón con el viejo.
// Los datos son inventados.

const key = (sku: string | null, measure: string | null) => variantKey({ sku, measure })!;

describe('qué medida de antes es cuál de ahora', () => {
  it('por su id, y sin id por lo que tienen igual', () => {
    const before = [
      { id: 'a', sku: 'AROS-1', measure: null },
      { id: 'b', sku: 'AROS-060', measure: '0.60' },
    ];
    // Con id: la misma fila, aunque cambie todo.
    expect(pairMeasures(before, [{ id: 'b', sku: 'X', measure: '1' }, { id: 'a', sku: 'Y', measure: '2' }])).toEqual([
      [1, 0],
      [0, 1],
    ]);
    // Sin id: la misma clave, el mismo SKU o la misma medida.
    expect(pairMeasures(before, [{ sku: 'AROS-060', measure: '0.60' }, { sku: 'AROS-1', measure: 'STD' }])).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(pairMeasures(before, [{ sku: 'OTRO', measure: '0,60 mm' }])).toEqual([[1, 0]]);
    // Si cambió todo, por su lugar solo cuando se pide y quedaron tantas de un lado como del otro.
    const all = [{ sku: 'N1', measure: 'STD' }, { sku: 'N2', measure: '0.25' }];
    expect(pairMeasures(before, all)).toEqual([]);
    expect(pairMeasures(before, all, { byPosition: true })).toEqual([
      [0, 0],
      [1, 1],
    ]);
    expect(pairMeasures(before, all.slice(0, 1), { byPosition: true })).toEqual([]);
  });

  it('las claves que cambian, también las del stock al pasar de una medida a dos', () => {
    const before = [
      { id: 'a', sku: 'AROS-1', measure: null },
      { id: 'b', sku: 'AROS-060', measure: '0.60' },
    ];
    const after = [
      { id: 'a', sku: 'AROS-1', measure: 'STD' },
      { id: 'b', sku: 'AROS-060', measure: '0.60' },
    ];
    const m = measureMoves(before, after);
    expect([...m.keys]).toEqual([[key('AROS-1', null), key('AROS-1', 'STD')]]);
    expect([...m.stock]).toEqual([[key('AROS-1', null), key('AROS-1', 'STD')]]);
    // Con una sola medida el stock no lleva clave: al sumar otra, pasa a la que estaba.
    const one = measureMoves([{ id: 'a', sku: 'AROS-1', measure: null }], after);
    expect([...one.stock]).toEqual([['', key('AROS-1', 'STD')]]);
    // Y al quedar una sola, la que queda se lleva el suyo.
    expect([...measureMoves(after, [after[1]]).stock]).toEqual([[key('AROS-060', '0.60'), '']]);
  });

  it('las fotos y los videos marcados para una medida', () => {
    const keys = new Map([['sku:A', 'sku:A medida:std']]);
    const media = [
      { kind: 'asset', url: 'https://ejemplo.com/1.jpg', variants: ['sku:A', 'sku:B'], positions: { 'sku:A': 0, 'sku:B': 2 } },
      { kind: 'asset', url: 'https://ejemplo.com/2.jpg' },
    ];
    expect(movedMedia(media, keys)).toEqual([
      { kind: 'asset', url: 'https://ejemplo.com/1.jpg', variants: ['sku:A medida:std', 'sku:B'], positions: { 'sku:A medida:std': 0, 'sku:B': 2 } },
      { kind: 'asset', url: 'https://ejemplo.com/2.jpg' },
    ]);
    expect(movedMedia([{ kind: 'asset', url: 'x', variants: ['sku:B'] }], keys)).toBeNull();
    expect(movedVideoVariants({ v1: ['sku:A'], v2: ['sku:B'] }, keys)).toEqual({ v1: ['sku:A medida:std'], v2: ['sku:B'] });
    expect(movedVideoVariants({ v2: ['sku:B'] }, keys)).toBeNull();
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('cambiarle el nombre a una medida, en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';

  afterAll(() => db.$disconnect());

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE accounts, users, channels CASCADE');
    await db.user.create({ data: { id: 'ana', name: 'Ana', email: 'ana@prueba.com', isAdmin: true } });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } })).id;
  });

  /** Un juego de aros con una medida sin nombre y la 0.60, su stock, su historial y una publicación por medida. */
  async function aros() {
    const product = await db.product.create({
      data: {
        accountId,
        name: 'Aros de pistón de prueba',
        stockSince: new Date(),
        variants: { create: [{ sku: 'AROS-1', measure: null, position: 0 }, { sku: 'AROS-060', measure: '0.60', position: 1 }] },
      },
      include: { variants: { orderBy: { position: 'asc' } } },
    });
    const sin = key('AROS-1', null);
    const half = key('AROS-060', '0.60');
    await db.productStock.createMany({
      data: [
        { productId: product.id, key: sin, label: 'AROS-1', quantity: 2 },
        { productId: product.id, key: half, label: '0.60', quantity: 4 },
      ],
    });
    await db.stockMovement.createMany({
      data: [
        { productId: product.id, key: sin, kind: 'INITIAL', delta: 2, after: 2 },
        { productId: product.id, key: half, kind: 'INITIAL', delta: 4, after: 4 },
      ],
    });
    const pub = await db.publication.create({
      data: {
        productId: product.id,
        storeId,
        externalId: 'MLA2000001',
        title: 'Aros sin medida',
        variantKey: sin,
        media: [{ kind: 'asset', url: 'https://ejemplo.com/aros.jpg', variants: [sin], positions: { [sin]: 0 } }],
        videoVariants: { video1: [sin] },
      },
    });
    return { product, pub, sin, half };
  }

  const info = (variants: ProductInfo['variants']): ProductInfo => ({
    productType: 'Aros',
    brand: 'Marca X',
    partNumber: null,
    line: null,
    origin: null,
    variants,
    compatibilities: [],
  });

  it('desde el paso Información o Claude: el stock, el historial, la publicación y sus fotos pasan a STD', async () => {
    const { product, pub, sin, half } = await aros();
    const std = key('AROS-1', 'STD');
    await db.$transaction((tx) =>
      updateProductInfo(tx, {
        accountId,
        productId: product.id,
        data: info([
          { id: product.variants[0].id, measure: 'STD', sku: 'AROS-1' },
          { id: product.variants[1].id, measure: '0.60', sku: 'AROS-060' },
        ]),
      }),
    );
    const stock = await db.productStock.findMany({ where: { productId: product.id }, orderBy: { key: 'asc' } });
    expect(stock.map((s) => [s.key, s.label, s.quantity])).toEqual(
      [
        [half, '0.60', 4],
        [std, 'STD', 2],
      ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
    expect(await db.stockMovement.count({ where: { productId: product.id, key: sin } })).toBe(0);
    expect(await db.stockMovement.count({ where: { productId: product.id, key: std } })).toBe(1);
    const after = await db.publication.findUniqueOrThrow({ where: { id: pub.id } });
    expect(after.variantKey).toBe(std);
    expect(after.media).toEqual([{ kind: 'asset', url: 'https://ejemplo.com/aros.jpg', variants: [std], positions: { [std]: 0 } }]);
    expect(after.videoVariants).toEqual({ video1: [std] });
    // La pantalla del stock: las dos medidas, sin renglones de más.
    const view = (await loadProductStock(db, { accountId, productId: product.id }))!;
    expect(view.lines.map((l) => [l.label, l.quantity])).toEqual([
      ['STD', 2],
      ['0.60', 4],
    ]);
    expect(view.orphans).toEqual([]);
  });

  it('desde la ficha, que manda las medidas sin id', async () => {
    const { product, pub } = await aros();
    const data: ProductData = {
      name: 'Aros de pistón de prueba',
      brand: null,
      partNumber: null,
      productType: null,
      engineSystem: null,
      line: null,
      origin: null,
      warranty: null,
      kitContents: null,
      notes: null,
      specs: [],
      variants: [
        { sku: 'AROS-1', measure: 'STD' },
        { sku: 'AROS-060', measure: '0.60' },
      ],
      compatibilities: [],
      assets: [],
    };
    await saveProduct(db, { accountId, productId: product.id, data });
    const view = (await loadProductStock(db, { accountId, productId: product.id }))!;
    expect(view.lines.map((l) => [l.label, l.quantity])).toEqual([
      ['STD', 2],
      ['0.60', 4],
    ]);
    expect(view.orphans).toEqual([]);
    expect((await db.publication.findUniqueOrThrow({ where: { id: pub.id } })).variantKey).toBe(key('AROS-1', 'STD'));
  });

  it('dos medidas que se cambian el nombre no mezclan su stock', async () => {
    const { product } = await aros();
    await db.$transaction((tx) =>
      updateProductInfo(tx, {
        accountId,
        productId: product.id,
        data: info([
          { id: product.variants[0].id, measure: '0.60', sku: 'AROS-060' },
          { id: product.variants[1].id, measure: null, sku: 'AROS-1' },
        ]),
      }),
    );
    const view = (await loadProductStock(db, { accountId, productId: product.id }))!;
    expect(view.lines.map((l) => [l.label, l.quantity])).toEqual([
      ['0.60', 2],
      ['AROS-1', 4],
    ]);
    expect(view.orphans).toEqual([]);
  });

  it('de una medida a dos: el stock que había queda en la que estaba', async () => {
    const product = await db.product.create({
      data: { accountId, name: 'Bulón de prueba', stockSince: new Date(), variants: { create: [{ sku: 'BUL-1', measure: null, position: 0 }] } },
      include: { variants: true },
    });
    await db.productStock.create({ data: { productId: product.id, key: '', label: '', quantity: 5 } });
    await db.$transaction((tx) =>
      updateProductInfo(tx, {
        accountId,
        productId: product.id,
        data: info([
          { id: product.variants[0].id, measure: 'STD', sku: 'BUL-1' },
          { id: null, measure: '0.25', sku: 'BUL-025' },
        ]),
      }),
    );
    const view = (await loadProductStock(db, { accountId, productId: product.id }))!;
    expect(view.lines.map((l) => [l.label, l.quantity])).toEqual([
      ['STD', 5],
      ['0.25', null],
    ]);
    expect(view.orphans).toEqual([]);
  });

  it('una sola medida que pasa a llamarse STD cambia de nombre en el stock', async () => {
    const product = await db.product.create({
      data: { accountId, name: 'Junta de prueba', stockSince: new Date(), variants: { create: [{ sku: 'JUN-1', measure: null, position: 0 }] } },
      include: { variants: true },
    });
    await db.productStock.create({ data: { productId: product.id, key: '', label: '', quantity: 3 } });
    await db.$transaction((tx) =>
      updateProductInfo(tx, { accountId, productId: product.id, data: info([{ id: product.variants[0].id, measure: 'STD', sku: 'JUN-1' }]) }),
    );
    expect(await db.productStock.findMany({ where: { productId: product.id }, select: { key: true, label: true, quantity: true } })).toEqual([
      { key: '', label: 'STD', quantity: 3 },
    ]);
  });

  it('el stock que quedó de una medida que ya no está se borra a mano, y queda en el historial', async () => {
    const { product, sin } = await aros();
    // Como quedaba antes del arreglo: la medida pasó a STD por otro lado y su stock quedó con el nombre viejo.
    await db.productVariant.update({ where: { id: product.variants[0].id }, data: { measure: 'STD' } });
    let view = (await loadProductStock(db, { accountId, productId: product.id }))!;
    expect(view.orphans.map((o) => [o.key, o.quantity])).toEqual([[sin, 2]]);
    await expect(dropOrphanStock(db, { accountId, productId: product.id, key: key('AROS-060', '0.60'), userId: 'ana' })).rejects.toThrow(StockError);
    await dropOrphanStock(db, { accountId, productId: product.id, key: sin, userId: 'ana' });
    view = (await loadProductStock(db, { accountId, productId: product.id }))!;
    expect(view.orphans).toEqual([]);
    expect(view.moves[0]).toMatchObject({ kind: 'MANUAL', delta: -2, after: 0, note: expect.stringContaining('ya no está en la ficha') });
  });
});
