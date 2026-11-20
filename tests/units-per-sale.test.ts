import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { variantKey } from '@/domain/media';
import { available, plannedQuantities, setsOf, setsText, shownAvailable, stockSlots, unitParts, type StockSource } from '@/domain/stock';
import type { ChannelOrder } from '@/channels/sales';

// Las unidades por venta: una publicación que vende de a varias unidades del
// stock del producto, como un juego de aros de 4 bocas con el stock cargado
// por boca. Los datos son inventados.

const url = process.env.TEST_DATABASE_URL;

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { recordOrder } = await import('@/lib/stock');
const { planFor, PLAN_SELECT, productStockOf, productStockUnits } = await import('@/lib/stock-plan');
const { priceGroups } = await import('@/lib/pricing');
const { previewUnitsPerSale, setUnitsPerSale } = await import('@/lib/units-per-sale');
const { packSize, alarmTaskText } = await import('@/lib/stock-alarms');
const { lineFacts } = await import('@/lib/sales/queries');

describe('las unidades por venta sin la base', () => {
  const aros = (stock: number, showMore = false) => ({ id: 'aros', name: 'Aros AR-1', slots: stockSlots([]), stock: { '': stock }, showMore });
  const juego = (stock: number, units: number, showMore = false): StockSource => ({ kind: 'INDIVIDUAL', product: aros(stock, showMore), units });

  it('la cantidad es la parte entera del stock dividido por las unidades: 90 bocas de a 4 son 22', () => {
    expect(setsOf(90, 4)).toBe(22);
    expect(setsOf(88, 4)).toBe(22);
    expect(setsOf(3, 4)).toBe(0);
    expect(setsOf(90, 1)).toBe(90);
    expect(setsOf(90, null)).toBe(90);
    // Vendido sin tener: falta un juego.
    expect(setsOf(-1, 4)).toBe(-1);
    expect(available(juego(90, 4), null)).toBe(22);
    expect(plannedQuantities([], juego(90, 4))).toEqual({ lines: [{ key: '', label: '', quantity: 22 }] });
    expect(plannedQuantities([], juego(90, 1))).toEqual({ lines: [{ key: '', label: '', quantity: 90 }] });
    expect(setsText(88, 4)).toBe('22 juegos (88 unidades)');
    expect(setsText(5, 4)).toBe('1 juego (5 unidades)');
    expect(setsText(88, 1)).toBe('88');
  });

  it('cada unidad vendida saca del stock las unidades por venta, también en un combo', () => {
    expect(unitParts(juego(90, 4), null)).toEqual([{ productId: 'aros', key: '', quantity: 4 }]);
    const combo: StockSource = { kind: 'COMBO', parts: [{ product: aros(90), quantity: 2 }], units: 3 };
    expect(unitParts(combo, null)).toEqual([{ productId: 'aros', key: '', quantity: 6 }]);
    expect(available(combo, null)).toBe(15);
  });

  it('"Mostrar más de 5" cuenta los juegos que quedan, no las unidades sueltas', () => {
    // 24 bocas son 6 juegos: se ve lo que hay. 23 son 5 juegos: se ven 6.
    expect(shownAvailable(juego(24, 4, true), null)).toBe(6);
    expect(shownAvailable(juego(28, 4, true), null)).toBe(7);
    expect(shownAvailable(juego(3, 4, true), null)).toBe(6);
    expect(shownAvailable(juego(3, 4, false), null)).toBe(0);
  });
});

describe.skipIf(!url)('las unidades por venta en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE tasks, branch_stock, branches, stock_movements, channel_sales, product_stock, product_costs, channel_sync_changes, channel_copies, sales, listing_families, channel_connections, publications, products, stores, channels, accounts, users CASCADE',
    );
    await db.user.create({ data: { id: 'ana', name: 'Ana', email: 'ana@prueba.com', isAdmin: true } });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    // Lee las ventas: sus publicaciones siguen al stock. Sin conexión, nada se sube al canal en estas pruebas.
    storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA', salesSince: new Date('2026-11-01T00:00:00Z') } })).id;
  });

  const order = (orderId: string, listingId: string, quantity: number, extra: Partial<ChannelOrder> = {}): ChannelOrder => ({
    orderId,
    sellerId: '7',
    orderedAt: '2026-11-20T10:00:00.000-03:00',
    counts: true,
    cancelled: false,
    delivered: false,
    lines: [{ listingId, variationId: null, sku: null, quantity }],
    ...extra,
  });

  /** Un producto sin medidas con stock y costo, y su publicación. */
  const simple = async (stock: number, units: number, opts: { showMore?: boolean; cost?: number } = {}) => {
    const p = await db.product.create({ data: { accountId, name: 'Aros AR-1', stockSince: new Date('2026-11-01T00:00:00Z'), showMore: opts.showMore ?? false } });
    await db.productStock.create({ data: { productId: p.id, key: '', quantity: stock } });
    if (opts.cost) await db.productCost.create({ data: { productId: p.id, key: '', cost: opts.cost } });
    const pub = await db.publication.create({ data: { productId: p.id, storeId, externalId: 'MLA1', title: 'Juego De Aros 4 Cilindros', unitsPerSale: units, channelStatus: 'ACTIVE' } });
    await db.channelCopy.create({ data: { publicationId: pub.id, readAt: new Date(), status: 'ACTIVE', quantity: 0 } });
    return { productId: p.id, publicationId: pub.id };
  };
  const stockOf = async (productId: string, key = '') => (await db.productStock.findUniqueOrThrow({ where: { productId_key: { productId, key } } })).quantity;
  const planOf = async (id: string) => planFor(await db.publication.findUniqueOrThrow({ where: { id }, select: PLAN_SELECT }));

  it('90 bocas de a 4: al canal le tocan 22; una venta descuenta 4 y la cancelada los devuelve', async () => {
    const a = await simple(90, 4);
    const row = await db.publication.findUniqueOrThrow({ where: { id: a.publicationId }, select: PLAN_SELECT });
    expect(planFor(row)).toMatchObject({ managed: true, lines: [{ key: '', label: '', quantity: 22 }] });
    expect(productStockOf(row)).toBe(22);
    expect(productStockUnits(row)).toBe(90);

    await recordOrder(db, { storeId, order: order('7001', 'MLA1', 1) });
    expect(await stockOf(a.productId)).toBe(86);
    await recordOrder(db, { storeId, order: order('7002', 'MLA1', 2) });
    expect(await stockOf(a.productId)).toBe(78);
    expect(await planOf(a.publicationId)).toMatchObject({ lines: [{ quantity: 19 }] });
    const move = await db.stockMovement.findFirstOrThrow({ where: { note: 'Venta 7002' }, select: { delta: true, after: true } });
    expect(move).toEqual({ delta: -8, after: 78 });

    // Cancelada antes de entregarse: vuelven las 8.
    await recordOrder(db, { storeId, order: order('7002', 'MLA1', 2, { cancelled: true, counts: false }) });
    expect(await stockOf(a.productId)).toBe(86);
  });

  it('la alarma salta cuando quedan menos unidades que las de una venta, y dice cuántas hay', async () => {
    // 9 bocas de a 4 son 2 juegos. Se vende uno: quedan 5 bocas, 1 juego: aviso de que queda 1.
    const a = await simple(9, 4, { showMore: true });
    expect(await packSize(db, a.productId, '')).toBe(4);
    await recordOrder(db, { storeId, order: order('7101', 'MLA1', 1) });
    expect(await stockOf(a.productId)).toBe(5);
    let state = await db.productStock.findUniqueOrThrow({ where: { productId_key: { productId: a.productId, key: '' } } });
    expect(state.lowAt).not.toBeNull();
    expect(state.outSince).toBeNull();
    expect((await db.task.findFirstOrThrow({ select: { title: true } })).title).toBe('Queda 1: Aros AR-1');

    // Se vende el último: queda 1 boca, menos que las 4 de una venta. Sin stock para vender, aunque haya una unidad.
    await recordOrder(db, { storeId, order: order('7102', 'MLA1', 1) });
    expect(await stockOf(a.productId)).toBe(1);
    state = await db.productStock.findUniqueOrThrow({ where: { productId_key: { productId: a.productId, key: '' } } });
    expect(state.outSince).not.toBeNull();
    const task = await db.task.findFirstOrThrow({ select: { title: true, description: true, status: true } });
    expect(task.title).toBe('Reponer: Aros AR-1, sin stock');
    expect(task.description).toContain('Stock real: 1 unidad, se vende de a 4: no alcanza para ninguna venta.');
    // En el canal se sigue viendo 6.
    expect(await planOf(a.publicationId)).toMatchObject({ lines: [{ quantity: 6 }], real: [{ quantity: 0 }] });
    expect(alarmTaskText).toBeTypeOf('function');
  });

  it('en el paso Precio el costo de la publicación es el unitario por las unidades, y el de la venta también', async () => {
    const a = await simple(90, 4, { cost: 1000.5 });
    const [group] = await priceGroups(db, a.publicationId);
    expect(group).toMatchObject({ cost: 4002, unitCost: 1000.5, unitsPerSale: 4, costNote: 'el del producto, por las 4 unidades que lleva cada venta' });
    await db.publication.update({ where: { id: a.publicationId }, data: { unitsPerSale: 1 } });
    expect((await priceGroups(db, a.publicationId))[0]).toMatchObject({ cost: 1000.5, unitCost: 1000.5, unitsPerSale: 1, costNote: 'el del producto' });

    const facts = await lineFacts(db, accountId, []);
    expect(facts).toBeTypeOf('function');
    const line = { listingId: 'MLA1', variationId: null, sku: null, title: null, quantity: 1, unitPrice: 9000, listPrice: null, fee: null, publicationId: a.publicationId, productId: a.productId, key: '', measure: null };
    const cost = await lineFacts(db, accountId, [line]);
    expect(cost({ ...line, units: 4 }).unitCost).toBe(4002);
    expect(cost(line).unitCost).toBe(1000.5);
  });

  it('una familia con dos medidas y dos opciones de venta cada una: se guarda en todas, o solo en una medida', async () => {
    const variants = [
      { sku: 'PI-STD', measure: 'STD' },
      { sku: 'PI-050', measure: '0.50' },
    ];
    const p = await db.product.create({
      data: { accountId, name: 'Pistones PI-1', stockSince: new Date('2026-11-01T00:00:00Z'), variants: { create: variants.map((v, position) => ({ ...v, position })) } },
    });
    const [std, half] = stockSlots(variants).map((s) => s.key);
    await db.productStock.createMany({
      data: [
        { productId: p.id, key: std, label: 'STD', quantity: 90 },
        { productId: p.id, key: half, label: '0.50', quantity: 10 },
      ],
    });
    const make = async (externalId: string, v: { sku: string; measure: string }, installments: number, mainOptionId: string | null = null) => {
      const pub = await db.publication.create({ data: { productId: p.id, storeId, externalId, title: 'Juego De Pistones', variantKey: variantKey(v), mainOptionId, channelStatus: 'ACTIVE' } });
      await db.channelCopy.create({ data: { publicationId: pub.id, readAt: new Date(), status: 'ACTIVE', quantity: 0, installments } });
      return pub.id;
    };
    const stdMain = await make('MLA10', variants[0], 0);
    const stdOption = await make('MLA11', variants[0], 6, stdMain);
    const halfMain = await make('MLA20', variants[1], 0);
    const halfOption = await make('MLA21', variants[1], 6, halfMain);
    await db.listingFamily.create({ data: { storeId, productId: p.id, leadId: stdMain, members: { connect: [stdMain, stdOption, halfMain, halfOption].map((id) => ({ id })) } } });

    // La vista previa no guarda nada: por medida y opción, lo que le tocaría.
    const preview = await previewUnitsPerSale(db, { accountId, publicationId: stdOption, units: 4 });
    expect(preview.rows.map((r) => [r.externalId, r.measure, r.before, r.after, r.stock, r.planned])).toEqual(
      expect.arrayContaining([
        ['MLA10', 'STD', 1, 4, 90, '22'],
        ['MLA11', 'STD', 1, 4, 90, '22'],
        ['MLA20', '0.50', 1, 4, 10, '2'],
        ['MLA21', '0.50', 1, 4, 10, '2'],
      ]),
    );
    expect(preview.rows).toHaveLength(4);
    expect(preview.rows.find((r) => r.externalId === 'MLA11')!.plan).toContain('6');
    expect(await db.publication.count({ where: { unitsPerSale: { not: 1 } } })).toBe(0);

    // Guardar desde una opción de venta: va a toda la familia y sus opciones.
    const saved = await setUnitsPerSale(db, { accountId, publicationId: stdOption, units: 4, userId: 'ana' });
    expect(saved.changed).toBe(4);
    expect(await db.publication.count({ where: { unitsPerSale: 4 } })).toBe(4);
    expect(await planOf(halfOption)).toMatchObject({ lines: [{ quantity: 2 }] });

    // Una medida con otro valor: solo ella y su otra opción de venta.
    const only = await setUnitsPerSale(db, { accountId, publicationId: halfMain, units: 2, onlyThisMeasure: true, userId: 'ana' });
    expect(only.rows.map((r) => r.externalId).sort()).toEqual(['MLA20', 'MLA21']);
    expect(await planOf(halfOption)).toMatchObject({ lines: [{ quantity: 5 }] });
    expect(await planOf(stdMain)).toMatchObject({ lines: [{ quantity: 22 }] });
    // Las alarmas de cada medida cuentan con las suyas.
    expect(await packSize(db, p.id, std)).toBe(4);
    expect(await packSize(db, p.id, half)).toBe(2);

    // Una venta de la opción de 6 cuotas de la STD descuenta 4 de la STD.
    await recordOrder(db, { storeId, order: order('7301', 'MLA11', 1) });
    expect(await stockOf(p.id, std)).toBe(86);
    expect(await stockOf(p.id, half)).toBe(10);

    await expect(setUnitsPerSale(db, { accountId, publicationId: stdMain, units: 0, userId: 'ana' })).rejects.toThrow('número entero de 1 a');
    await expect(setUnitsPerSale(db, { accountId, publicationId: stdMain, units: 2.5, userId: 'ana' })).rejects.toThrow('número entero de 1 a');
  });
});
