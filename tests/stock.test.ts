import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { mercadolibreSales, parseOrder } from '@/channels/mercadolibre/sales';
import { available, copySkus, initialStock, listingMeasure, matchSlot, observedStock, parseStockChange, plannedQuantities, stockSlots, unitParts, type StockSource } from '@/domain/stock';
import { encrypt } from '@/lib/crypto';
import { handleSalesNotice, readSales, recordOrder, setFollowsStock, setProductStock, setShowMore, startStock, syncStock, affectedPublications, reconcileStock } from '@/lib/stock';
import { stockAlarmPass } from '@/lib/stock-alarms';
import { afterRestock } from '@/lib/restock';
import { STATUS_TOOLS } from '@/lib/mcp/status-tools';
import { STOCK_TOOLS } from '@/lib/mcp/stock-tools';
import type { McpContext } from '@/lib/mcp/tool';
import { managedNote, plannedText, plansFor } from '@/lib/stock-plan';
import { saveQuantities } from '@/lib/quantities';
import type { ChannelOrder } from '@/channels/sales';
import { plainLinks } from '@/domain/text-links';

// El stock del producto: lo heredan sus publicaciones y lo descuentan las
// ventas, contra un Mercado Libre simulado. Los datos son inventados.

const aros = [
  { sku: 'AROS-STD', measure: 'STD' },
  { sku: 'AROS-050', measure: '0.50' },
];

describe('el stock por medida y de los combos', () => {
  it('las medidas del producto y cómo se reconocen las del canal', () => {
    expect(stockSlots([])).toEqual([{ key: '', label: '', sku: null, measure: null }]);
    // Una sola medida es como no tener medidas: la publicación tampoco las tiene.
    expect(stockSlots([{ sku: 'X', measure: 'STD' }]).map((s) => s.key)).toEqual(['']);
    const slots = stockSlots(aros);
    expect(slots.map((s) => [s.key, s.label])).toEqual([
      ['sku:AROS-STD medida:std', 'STD'],
      ['sku:AROS-050 medida:0.50', '0.50'],
    ]);
    expect(matchSlot(slots, { sku: 'AROS-050', measure: '0.50' })).toBe('sku:AROS-050 medida:0.50');
    expect(matchSlot(slots, { sku: 'aros-050', measure: null })).toBe('sku:AROS-050 medida:0.50');
    expect(matchSlot(slots, { sku: null, measure: '0,50 mm' })).toBe('sku:AROS-050 medida:0.50');
    expect(matchSlot(slots, { sku: 'OTRO', measure: '0.75' })).toBeNull();
  });

  it('lo que le toca a cada publicación, y a un combo lo que se puede armar', () => {
    const bulon = { id: 'bulon', name: 'Bulón', slots: stockSlots([]), stock: { '': 10 } };
    const juego = { id: 'aros', name: 'Aros', slots: stockSlots(aros), stock: { 'sku:AROS-STD medida:std': 3, 'sku:AROS-050 medida:0.50': 7 } };
    const single: StockSource = { kind: 'INDIVIDUAL', product: bulon };
    expect(plannedQuantities([], single)).toEqual({ lines: [{ key: '', label: '', quantity: 10 }] });
    const measured: StockSource = { kind: 'INDIVIDUAL', product: juego };
    expect(plannedQuantities(aros, measured)).toEqual({
      lines: [
        { key: 'sku:AROS-STD medida:std', label: 'STD', quantity: 3 },
        { key: 'sku:AROS-050 medida:0.50', label: '0.50', quantity: 7 },
      ],
    });
    expect(plannedQuantities([], measured)).toMatchObject({ reason: expect.stringContaining('no tiene medidas y el producto sí') });
    expect(plannedQuantities([{ sku: 'Z', measure: '0.75' }], measured)).toMatchObject({ reason: expect.stringContaining('0.75') });

    // Un combo con 2 bulones: con 10 se arman 5. Con medidas, cada pieza por la suya.
    const kit: StockSource = { kind: 'COMBO', parts: [{ product: bulon, quantity: 2 }, { product: juego, quantity: 1 }] };
    expect(available({ kind: 'COMBO', parts: [{ product: bulon, quantity: 2 }] }, null)).toBe(5);
    expect(available(kit, { sku: 'KIT-STD', measure: 'STD' })).toBe(3);
    expect(available(kit, { sku: 'KIT-050', measure: '0.50' })).toBe(5);
    expect(unitParts(kit, { sku: 'KIT-050', measure: '0.50' })).toEqual([
      { productId: 'bulon', key: '', quantity: 2 },
      { productId: 'aros', key: 'sku:AROS-050 medida:0.50', quantity: 1 },
    ]);
    // Sin stock en la app no se sabe; el negativo cuenta como 0.
    expect(available({ kind: 'INDIVIDUAL', product: { ...bulon, stock: null } }, null)).toBeNull();
    expect(available({ kind: 'INDIVIDUAL', product: { ...bulon, stock: { '': -2 } } }, null)).toBe(0);
  });

  it('cada medida publicada sola: su SKU dice de cuál es', () => {
    const slots = stockSlots(aros);
    expect(copySkus({ skus: ['aros-050', 3], brand: 'X' })).toEqual(['aros-050']);
    expect(copySkus(null)).toEqual([]);
    const half = listingMeasure(slots, ['aros-050']);
    expect(half).toEqual({ sku: 'AROS-050', measure: '0.50' });
    // Sin medidas en el producto, o con SKU de las dos o de ninguna, no se sabe.
    expect(listingMeasure(stockSlots([]), ['AROS-050'])).toBeNull();
    expect(listingMeasure(slots, ['AROS-STD', 'AROS-050'])).toBeNull();
    expect(listingMeasure(slots, ['OTRO'])).toBeNull();
    const juego: StockSource = { kind: 'INDIVIDUAL', product: { id: 'aros', name: 'Aros', slots, stock: { 'sku:AROS-STD medida:std': 3, 'sku:AROS-050 medida:0.50': 7 } } };
    expect(plannedQuantities([], juego, half)).toEqual({ lines: [{ key: '', label: '', quantity: 7 }] });
    expect(observedStock(slots, [{ key: '', label: '', quantity: 6 }], [], half)).toEqual({ 'sku:AROS-050 medida:0.50': 6 });
    expect(observedStock(slots, [{ key: '', label: '', quantity: 6 }], [])).toEqual({});
  });

  it('el de partida es la cantidad más baja, y avisa para revisar', () => {
    const slots = stockSlots(aros);
    const r = initialStock(slots, [{ 'sku:AROS-STD medida:std': 5, 'sku:AROS-050 medida:0.50': 2 }, { 'sku:AROS-STD medida:std': 8 }]);
    expect(r.lines.map((l) => l.quantity)).toEqual([5, 2]);
    expect(r.review).toBe('Al empezar a llevar el stock, STD: las publicaciones tenían 5, 8, quedó 5.');
    expect(initialStock(stockSlots([]), [{ '': 4 }, { '': 4 }]).review).toBeNull();
    expect(initialStock(slots, [{ 'sku:AROS-STD medida:std': 1 }]).review).toContain('0.50: ninguna publicación tenía cantidad, quedó en 0');
    expect(parseStockChange({ '': '12' }, stockSlots([]))).toEqual({ '': 12 });
    expect(() => parseStockChange({ '': -1 }, stockSlots([]))).toThrow('número entero');
    expect(() => parseStockChange({ otra: 1 }, stockSlots([]))).toThrow('Las medidas del producto cambiaron');
  });

  it('las ventas de Mercado Libre: confirmadas, canceladas y entregadas', () => {
    const order = parseOrder({
      id: 2000001,
      status: 'paid',
      date_created: '2026-10-26T10:00:00.000-03:00',
      date_closed: '2026-10-26T10:01:00.000-03:00',
      seller: { id: 7 },
      tags: ['paid', 'not_delivered'],
      order_items: [{ item: { id: 'MLA1', variation_id: 11, seller_sku: 'AROS-STD' }, quantity: 2 }, { item: {}, quantity: 1 }],
    })!;
    expect(order).toEqual({
      orderId: '2000001',
      sellerId: '7',
      orderedAt: '2026-10-26T10:00:00.000-03:00',
      counts: true,
      cancelled: false,
      delivered: false,
      lines: [{ listingId: 'MLA1', variationId: '11', sku: 'AROS-STD', quantity: 2 }],
    });
    // Sin confirmar, Mercado Libre todavía no descontó nada.
    expect(parseOrder({ id: 1, status: 'payment_required', date_created: 'x', date_closed: null })).toMatchObject({ counts: false, cancelled: false });
    expect(parseOrder({ id: 1, status: 'cancelled', date_created: 'x', date_closed: 'y', tags: ['delivered'] })).toMatchObject({ counts: false, cancelled: true, delivered: true });
    expect(mercadolibreSales.parseNotice({ topic: 'orders_v2', resource: '/orders/2000001', user_id: 7, application_id: 99 })).toEqual({
      userId: '7',
      appId: '99',
      orderId: '2000001',
    });
    expect(mercadolibreSales.parseNotice({ topic: 'questions', resource: '/questions/1', user_id: 7 })).toBeNull();
  });
});

const url = process.env.TEST_DATABASE_URL;

// status: el estado en el canal. reactivates: el canal la reactiva solo al recibir stock.
type Item = {
  quantity?: number;
  variations?: { id: number; sku: string; measure: string; quantity: number }[];
  full?: boolean;
  status?: string;
  reactivates?: boolean;
  // Como Mercado Libre: al quedar en 0, la pausa.
  pausesAtZero?: boolean;
};

describe.skipIf(!url)('el stock en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let server: http.Server;
  let items: Record<string, Item> = {};
  let orders: Record<string, unknown> = {};
  // El buscador de ventas: lo que devuelve, o "sin permiso".
  let search: unknown[] | 'forbidden' = [];
  const writes: { path: string; body: { available_quantity?: number; status?: string; variations?: { id: number; available_quantity?: number }[] } }[] = [];
  let storeId = '';
  let accountId = '';
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    server = http.createServer(async (req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      const json = (status: number, body: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      if (req.headers.authorization !== 'Bearer llave') return json(401, {});
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : null;
      const itemJson = (id: string, it: Item) => ({
        id,
        seller_id: 7,
        title: `Publicación ${id}`,
        status: it.status ?? 'active',
        available_quantity: it.quantity,
        shipping: { logistic_type: it.full ? 'fulfillment' : 'cross_docking' },
        variations: (it.variations ?? []).map((v) => ({
          id: v.id,
          available_quantity: v.quantity,
          attribute_combinations: [{ id: 'SIZE', value_name: v.measure }],
          attributes: [{ id: 'SELLER_SKU', value_name: v.sku }],
        })),
      });
      if (u.pathname === '/items/bulk') {
        const ids = (u.searchParams.get('ids') ?? '').split(',');
        return json(200, ids.map((id) => (items[id] ? { code: 200, body: itemJson(id, items[id]) } : { code: 404, body: {} })));
      }
      if (/^\/items\/\w+\/description$/.test(u.pathname)) return json(200, { plain_text: 'Descripción.' });
      const item = u.pathname.match(/^\/items\/(\w+)$/);
      if (item && items[item[1]]) {
        const it = items[item[1]];
        if (req.method === 'GET') return json(200, itemJson(item[1], it));
        writes.push({ path: u.pathname, body });
        if (body.status) it.status = body.status;
        if (body.available_quantity !== undefined) it.quantity = body.available_quantity;
        for (const v of body.variations ?? []) {
          const mine = it.variations?.find((x) => x.id === v.id);
          if (mine && v.available_quantity !== undefined) mine.quantity = v.available_quantity;
        }
        if (it.reactivates && it.status !== 'active' && (it.quantity ?? 0) > 0) it.status = 'active';
        if (it.pausesAtZero && body.available_quantity === 0) it.status = 'paused';
        return json(200, { id: item[1] });
      }
      const order = u.pathname.match(/^\/orders\/(\d+)$/);
      if (order) return orders[order[1]] ? json(200, orders[order[1]]) : json(404, {});
      if (u.pathname === '/orders/search') {
        if (search === 'forbidden') return json(403, { message: 'forbidden' });
        return json(200, { results: search, paging: { total: search.length, offset: 0, limit: 50 } });
      }
      return json(404, {});
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    process.env.MERCADOLIBRE_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.close();
    delete process.env.MERCADOLIBRE_API_URL;
    await db.$disconnect();
  });

  const copy = (quantity: number | null, variations: unknown[] = [], extra: object = {}) => ({
    readAt: new Date(),
    status: 'ACTIVE' as const,
    quantity,
    variations: variations as object[],
    ...extra,
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE tasks, stock_movements, channel_sales, product_stock, channel_copies, channel_sync_changes, channel_connections, combo_items, product_variants, publications, products, stores, channels, accounts, users CASCADE',
    );
    writes.length = 0;
    orders = {};
    search = [];
    items = {
      MLA1000001: { quantity: 5 },
      MLA1000002: { quantity: 8 },
      MLA1000003: {
        variations: [
          { id: 11, sku: 'AROS-STD', measure: 'STD', quantity: 3 },
          { id: 12, sku: 'AROS-050', measure: '0.50', quantity: 4 },
        ],
      },
      MLA1000004: { quantity: 2 },
      MLA1000005: { quantity: 40, full: true },
    };
    await db.user.create({ data: { id: 'ana', name: 'Ana', email: 'ana@prueba.com', isAdmin: true } });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    // Lee las ventas desde un rato antes de la última lectura de las publicaciones.
    storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA', salesSince: new Date(Date.now() - 3600_000) } })).id;
    await db.channelConnection.create({
      data: {
        storeId,
        appId: '1234567890',
        appSecret: encrypt('secreto-de-prueba'),
        appSecretHint: 'ueba',
        status: 'ACTIVE',
        externalUserId: '7',
        accessToken: encrypt('llave'),
        refreshToken: encrypt('renovar'),
        expiresAt: new Date(Date.now() + 6 * 3600_000),
      },
    });
    const bulon = await db.product.create({ data: { accountId, name: 'Bulón de tapa' } });
    const juego = await db.product.create({
      data: { accountId, name: 'Aros de pistón', variants: { create: aros.map((v, i) => ({ ...v, position: i })) } },
    });
    const kit = await db.product.create({ data: { accountId, name: 'Kit de bulones', kind: 'COMBO', comboItems: { create: [{ productId: bulon.id, quantity: 2 }] } } });
    ids.bulon = bulon.id;
    ids.juego = juego.id;
    ids.kit = kit.id;
    const pub = async (key: string, productId: string, externalId: string, c: ReturnType<typeof copy>) =>
      (ids[key] = (await db.publication.create({ data: { productId, storeId, externalId, title: `Publicación ${key}`, channelCopy: { create: c } } })).id);
    await pub('p1', bulon.id, 'MLA1000001', copy(5));
    await pub('p2', bulon.id, 'MLA1000002', copy(8));
    await pub(
      'p3',
      juego.id,
      'MLA1000003',
      copy(7, [
        { sku: 'AROS-STD', measure: 'STD', photoIds: [], variationId: '11', quantity: 3 },
        { sku: 'AROS-050', measure: '0.50', photoIds: [], variationId: '12', quantity: 4 },
      ]),
    );
    await pub('p4', kit.id, 'MLA1000004', copy(2));
    await pub('p5', bulon.id, 'MLA1000005', copy(40, [], { stockInChannel: true }));
  });

  const stockOf = async (productId: string) =>
    Object.fromEntries((await db.productStock.findMany({ where: { productId } })).map((s) => [s.label || '-', s.quantity]));

  const sale = (orderId: string, lines: ChannelOrder['lines'], extra: Partial<ChannelOrder> = {}): ChannelOrder => ({
    orderId,
    sellerId: '7',
    orderedAt: new Date().toISOString(),
    counts: true,
    cancelled: false,
    delivered: false,
    lines,
    ...extra,
  });

  const pushedTo = () => writes.map((w) => `${w.path.replace('/items/', '')}=${w.body.available_quantity ?? (w.body.variations ?? []).map((v) => v.available_quantity ?? '-').join('/')}`);

  it('empieza con lo más bajo de sus publicaciones y deja a todas igual, sin tocar Full', async () => {
    expect(await startStock(db)).toEqual({ started: 2, pending: false });
    expect(await stockOf(ids.bulon)).toEqual({ '-': 5 });
    expect(await stockOf(ids.juego)).toEqual({ STD: 3, '0.50': 4 });
    const bulon = await db.product.findUniqueOrThrow({ where: { id: ids.bulon } });
    expect(bulon.stockReview).toBe('Al empezar a llevar el stock, las publicaciones tenían 5, 8, quedó 5.');
    expect(await db.stockMovement.count({ where: { kind: 'INITIAL' } })).toBe(3);

    const plans = await plansFor(db, [ids.p1, ids.p2, ids.p4, ids.p5]);
    expect(plans.get(ids.p2)).toMatchObject({ managed: true, pending: true, lines: [{ quantity: 5 }] });
    // El combo de 2 bulones: con 5 se arman 2, como ya tiene.
    expect(plans.get(ids.p4)).toMatchObject({ managed: true, pending: false, lines: [{ quantity: 2 }] });
    expect(plans.get(ids.p5)).toMatchObject({ managed: false, reason: expect.stringContaining('Full') });

    const r = await reconcileStock(db, { budgetMs: 10_000 });
    expect(r).toMatchObject({ sent: 1, failed: [] });
    expect(pushedTo()).toEqual(['MLA1000002=5']);
    const change = await db.channelSyncChange.findFirstOrThrow({ where: { publicationId: ids.p2 } });
    expect(change).toMatchObject({ field: 'quantity', kind: 'SENT', message: 'Volvió a la cantidad del stock del producto.' });
    // Ya está: la segunda pasada no sube nada.
    expect((await reconcileStock(db, { budgetMs: 10_000 })).sent).toBe(0);
    // A mano ya no se cambia en la publicación.
    const manual = await saveQuantities(db, { accountId, publicationIds: [ids.p1], change: { all: 9 } });
    expect(manual.skipped[0].reason).toContain('sale del stock del producto');
  });

  it('una venta descuenta del producto y la cantidad nueva se sube a las demás publicaciones y a los combos', async () => {
    await startStock(db);
    writes.length = 0;
    const products = await recordOrder(db, { storeId, order: sale('3001', [{ listingId: 'MLA1000001', variationId: null, sku: null, quantity: 2 }]) });
    expect(products).toEqual([ids.bulon]);
    expect(await stockOf(ids.bulon)).toEqual({ '-': 3 });
    const sync = await syncStock(db, { publicationIds: await affectedPublications(db, products), note: 'Por una venta en el canal.' });
    expect(sync.sent).toBe(3);
    expect(pushedTo().sort()).toEqual(['MLA1000001=3', 'MLA1000002=3', 'MLA1000004=1']);
    expect(await db.stockMovement.findFirstOrThrow({ where: { kind: 'SALE' } })).toMatchObject({ delta: -2, after: 3, publicationId: ids.p1, note: 'Venta 3001' });
    // El mismo aviso otra vez no la cuenta dos veces.
    expect(await recordOrder(db, { storeId, order: sale('3001', [{ listingId: 'MLA1000001', variationId: null, sku: null, quantity: 2 }]) })).toEqual([]);
    expect(await stockOf(ids.bulon)).toEqual({ '-': 3 });

    // Un combo descuenta sus piezas: 1 kit son 2 bulones.
    await recordOrder(db, { storeId, order: sale('3002', [{ listingId: 'MLA1000004', variationId: null, sku: null, quantity: 1 }]) });
    expect(await stockOf(ids.bulon)).toEqual({ '-': 1 });
    // Una medida: la variante vendida.
    await recordOrder(db, { storeId, order: sale('3003', [{ listingId: 'MLA1000003', variationId: '12', sku: 'AROS-050', quantity: 1 }]) });
    expect(await stockOf(ids.juego)).toEqual({ STD: 3, '0.50': 3 });
    writes.length = 0;
    await syncStock(db, { publicationIds: [ids.p3] });
    expect(pushedTo()).toEqual(['MLA1000003=3/3']);

    // Full tiene su propio stock: no descuenta.
    await recordOrder(db, { storeId, order: sale('3004', [{ listingId: 'MLA1000005', variationId: null, sku: null, quantity: 5 }]) });
    expect(await stockOf(ids.bulon)).toEqual({ '-': 1 });
    expect(await db.channelSale.findFirstOrThrow({ where: { orderId: '3004' } })).toMatchObject({ status: 'SKIPPED' });

    // Más de lo que había: queda negativo y avisa.
    await recordOrder(db, { storeId, order: sale('3005', [{ listingId: 'MLA1000002', variationId: null, sku: null, quantity: 3 }]) });
    expect(await stockOf(ids.bulon)).toEqual({ '-': -2 });
    expect((await db.product.findUniqueOrThrow({ where: { id: ids.bulon } })).stockReview).toContain('Se vendió más de lo que había');
    expect((await plansFor(db, [ids.p1])).get(ids.p1)).toMatchObject({ managed: true, lines: [{ quantity: 0 }] });
  });

  it('cada medida publicada aparte sigue al stock de su medida, por su SKU', async () => {
    items.MLA1000006 = { quantity: 6 };
    items.MLA1000007 = { quantity: 9 };
    const sola = (externalId: string, sku: string, quantity: number) =>
      db.publication.create({ data: { productId: ids.juego, storeId, externalId, title: sku, channelCopy: { create: copy(quantity, [], { details: { skus: [sku] } }) } } });
    const std = await sola('MLA1000006', 'AROS-STD', 6);
    const half = await sola('MLA1000007', 'AROS-050', 9);
    await startStock(db);
    // Con la publicación de las dos medidas: lo más bajo de cada una.
    expect(await stockOf(ids.juego)).toEqual({ STD: 3, '0.50': 4 });
    const plans = await plansFor(db, [std.id, half.id]);
    expect(plans.get(std.id)).toMatchObject({ managed: true, pending: true, lines: [{ quantity: 3 }] });
    const halfPlan = plans.get(half.id)!;
    expect(halfPlan).toMatchObject({ managed: true, pending: true, lines: [{ quantity: 4 }], measure: { label: '0.50', sku: 'AROS-050' } });
    // La pantalla dice qué medida vende y por qué.
    if (!halfPlan.managed) throw new Error('sigue al stock');
    expect(plannedText(halfPlan)).toBe('0.50: 4');
    expect(managedNote(halfPlan, 'Mercado Libre')).toBe(
      'Vende solo la medida 0.50 del producto, por su SKU AROS-050 en Mercado Libre. La cantidad sale del stock del producto: cambiala en el producto y se sube sola.',
    );
    expect(managedNote({ ...halfPlan, measure: { label: 'AROS-050', sku: 'AROS-050' } }, 'Mercado Libre')).toMatch(/^Vende solo la medida AROS-050 del producto\. /);

    // Una venta de la 0.50 descuenta solo esa medida y se sube a las que la tienen.
    await reconcileStock(db, { budgetMs: 10_000 });
    writes.length = 0;
    const products = await recordOrder(db, { storeId, order: sale('3101', [{ listingId: 'MLA1000007', variationId: null, sku: 'AROS-050', quantity: 1 }]) });
    expect(await stockOf(ids.juego)).toEqual({ STD: 3, '0.50': 3 });
    await syncStock(db, { publicationIds: await affectedPublications(db, products) });
    expect(pushedTo().sort()).toEqual(['MLA1000003=3/3', 'MLA1000007=3']);
  });

  it('con la cantidad automática apagada no se le sube nada, se cambia a mano y sus ventas igual descuentan', async () => {
    await startStock(db);
    await reconcileStock(db, { budgetMs: 10_000 });
    const off = await setFollowsStock(db, { accountId, publicationId: ids.p2, on: false, userId: 'ana' });
    expect(off.plan).toMatchObject({ managed: false, off: true, reason: expect.stringContaining('apagada') });
    writes.length = 0;
    await setProductStock(db, { accountId, productId: ids.bulon, userId: 'ana', stock: { '': 9 } });
    // El combo de 2 bulones: con 9 se arman 4.
    expect(pushedTo().sort()).toEqual(['MLA1000001=9', 'MLA1000004=4']);
    // A mano en la publicación, sí.
    expect((await saveQuantities(db, { accountId, publicationIds: [ids.p2], change: { all: 3 } })).skipped).toEqual([]);
    // Sus ventas igual descuentan del producto.
    await recordOrder(db, { storeId, order: sale('3201', [{ listingId: 'MLA1000002', variationId: null, sku: null, quantity: 2 }]) });
    expect(await stockOf(ids.bulon)).toEqual({ '-': 7 });
    // Prendida otra vez: se sube enseguida lo que le toca.
    writes.length = 0;
    const on = await setFollowsStock(db, { accountId, publicationId: ids.p2, on: true, userId: 'ana' });
    expect(on.sync.sent).toBe(1);
    expect(pushedTo()).toContain('MLA1000002=7');
  });

  it('una pausada sin stock que recibe stock: tarea para los administradores, sin repetir, que se cierra al reactivarla', async () => {
    await startStock(db);
    await setProductStock(db, { accountId, productId: ids.bulon, userId: 'ana', stock: { '': 0 } });
    // Mercado Libre las pausa por quedarse sin stock. La segunda la reactiva solo al recibir stock.
    items.MLA1000001.status = 'paused';
    items.MLA1000002.status = 'paused';
    items.MLA1000002.reactivates = true;
    await db.publication.updateMany({ where: { id: { in: [ids.p1, ids.p2] } }, data: { channelStatus: 'PAUSED' } });
    await db.channelCopy.updateMany({ where: { publicationId: { in: [ids.p1, ids.p2] } }, data: { status: 'PAUSED' } });

    await setProductStock(db, { accountId, productId: ids.bulon, userId: 'ana', stock: { '': 4 } });
    const tasks = await db.task.findMany({ include: { assignees: true, publications: true } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ autoKey: `reactivar:${ids.p1}`, status: 'PENDING', createdById: null });
    expect(tasks[0].title).toContain('Reactivar en Mercado Libre');
    expect(tasks[0].description).toContain('se cierra sola');
    expect(tasks[0].assignees.map((a) => a.userId)).toEqual(['ana']);
    expect(tasks[0].publications.map((p) => p.publicationId)).toEqual([ids.p1]);
    expect((await db.publication.findUniqueOrThrow({ where: { id: ids.p2 } })).channelStatus).toBe('ACTIVE');

    // No se repite, y una pausada que ya tenía stock no pide reactivar.
    expect(await afterRestock(db, { publicationId: ids.p1, lines: [{ key: '', label: '', quantity: 4 }] })).toBeNull();
    await setProductStock(db, { accountId, productId: ids.bulon, userId: 'ana', stock: { '': 6 } });
    expect(await db.task.count()).toBe(1);

    // Claude la reactiva: la tarea se cierra sola.
    const tool = STATUS_TOOLS[0];
    const ctx: McpContext = { db, userId: 'ana', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
    expect(await tool.run(ctx, { publicacion: 'MLA1000001', accion: 'reactivar' })).toMatchObject({ listo: true, estado: 'Activa' });
    expect(items.MLA1000001.status).toBe('active');
    expect(await db.task.findFirstOrThrow()).toMatchObject({ status: 'DONE', doneAt: expect.any(Date) });
    await expect(tool.run(ctx, { publicacion: 'MLA1000001', accion: 'reactivar' })).rejects.toThrow('No se pudo reactivar');
    expect(await tool.run(ctx, { publicacion: 'MLA1000001', accion: 'pausar' })).toMatchObject({ estado: 'Pausada' });
  });

  // "Mostrar más de 5": con 5 o menos se ve 6, nunca algo que pause la publicación, y al quedar 1 o 0 salen la alarma y la tarea.
  const task = () => db.task.findFirst({ where: { autoKey: `stock:${ids.bulon}:` }, orderBy: { createdAt: 'desc' }, include: { assignees: true, publications: true } });
  const alarm = () => db.productStock.findUniqueOrThrow({ where: { productId_key: { productId: ids.bulon, key: '' } } });
  // Lo que se le mandó al canal a las publicaciones del bulón.
  const toBulon = () => pushedTo().filter((w) => w.startsWith('MLA1000001') || w.startsWith('MLA1000002'));
  const withShowMore = async () => {
    await startStock(db);
    await setShowMore(db, { accountId, productId: ids.bulon, on: true, userId: 'ana' });
    writes.length = 0;
  };
  const sell = async (orderId: string, quantity: number, listingId = 'MLA1000001', store = storeId) => {
    const products = await recordOrder(db, { storeId: store, order: sale(orderId, [{ listingId, variationId: null, sku: null, quantity }]) });
    return syncStock(db, { publicationIds: await affectedPublications(db, products) });
  };
  // La tarea dice el producto, el SKU, el stock real y las publicaciones con su código.
  const expectRestockTask = async (real: number) => {
    const t = (await task())!;
    expect(t).toMatchObject({ status: 'PENDING', dueOn: null });
    expect(t.assignees.map((a) => a.userId)).toEqual(['ana']);
    const text = plainLinks(t.description);
    expect(text).toContain('Producto: Bulón de tapa');
    expect(text).toContain('SKU: sin cargar en la ficha');
    expect(text).toContain(`Stock real: ${real}.`);
    expect(text).toMatch(/Publicación: Publicación p1 .* · MLA1000001 · /);
    expect(text).toMatch(/Publicación: Publicación p2 .* · MLA1000002 · /);
    expect(text).not.toContain('se pausa la publicación');
    expect(t.publications.map((p) => p.publicationId)).toEqual(expect.arrayContaining([ids.p1, ids.p2]));
  };

  it('una venta de antes de que el producto llevara stock no lo descuenta ni dispara la alarma, aunque el canal avise de ella después', async () => {
    await withShowMore();
    const since = (await db.product.findUniqueOrThrow({ where: { id: ids.bulon } })).stockSince!;
    // Queda la última, cargada a mano.
    await setProductStock(db, { accountId, productId: ids.bulon, userId: 'ana', stock: { '': 1 } });
    expect((await task())!.title).toBe('Queda 1: Bulón de tapa');
    const before = await db.stockMovement.count({ where: { kind: 'SALE' } });

    // El canal avisa de una venta de antes, por ejemplo al liberar la plata: se anota y no se descuenta.
    const old = new Date(since.getTime() - 20 * 86_400_000).toISOString();
    const products = await recordOrder(db, { storeId, order: sale('6001', [{ listingId: 'MLA1000001', variationId: null, sku: null, quantity: 1 }], { orderedAt: old, delivered: true }) });
    expect(products).toEqual([]);
    expect(await stockOf(ids.bulon)).toEqual({ '-': 1 });
    expect(await db.stockMovement.count({ where: { kind: 'SALE' } })).toBe(before);
    const row = await db.channelSale.findFirstOrThrow({ where: { orderId: '6001' } });
    expect(row.status).toBe('SKIPPED');
    expect(row.lines).toMatchObject([{ counted: false, reason: 'Se vendió antes de que el producto llevara stock en la app.' }]);
    expect(await alarm()).toMatchObject({ quantity: 1, outSince: null });
    expect((await task())!.title).toBe('Queda 1: Bulón de tapa');
    // Lo mismo por un combo: sus piezas ya llevaban stock después de la venta.
    await recordOrder(db, { storeId, order: sale('6002', [{ listingId: 'MLA1000004', variationId: null, sku: null, quantity: 1 }], { orderedAt: old }) });
    expect(await stockOf(ids.bulon)).toEqual({ '-': 1 });
    // Si vuelve a avisar, tampoco.
    await recordOrder(db, { storeId, order: sale('6001', [{ listingId: 'MLA1000001', variationId: null, sku: null, quantity: 1 }], { orderedAt: old, delivered: true }) });
    expect(await stockOf(ids.bulon)).toEqual({ '-': 1 });

    // Una venta de después sí descuenta y avisa.
    await sell('6003', 1);
    expect(await stockOf(ids.bulon)).toEqual({ '-': 0 });
    expect((await alarm()).outSince).toEqual(expect.any(Date));
    expect((await task())!.title).toBe('Reponer: Bulón de tapa, sin stock');
  });

  it('mostrar más de 5: una venta en Mercado Libre que deja el stock en 0 sigue mostrando 6, con alarma y tarea, y nunca se pausa', async () => {
    await withShowMore();
    const plan = (await plansFor(db, [ids.p1])).get(ids.p1)!;
    expect(plan).toMatchObject({ managed: true, lines: [{ quantity: 6 }], real: [{ quantity: 5 }] });
    expect(plannedText(plan as Extract<typeof plan, { managed: true }>)).toBe('6 · hay 5');

    // De 5 a 2: nada. Mercado Libre bajó la vendida a 3: se le vuelve a subir 6.
    await sell('4001', 3);
    expect(await task()).toBeNull();
    expect(toBulon()).toEqual(['MLA1000001=6']);
    // Se vende hasta 0: la alarma y la tarea, y se sigue viendo 6.
    writes.length = 0;
    await sell('4002', 2);
    expect((await alarm()).outSince).toEqual(expect.any(Date));
    expect((await task())!.title).toBe('Reponer: Bulón de tapa, sin stock');
    await expectRestockTask(0);
    expect(toBulon()).toEqual(['MLA1000001=6']);
    // Vendidas sin tener: sigue en 6.
    writes.length = 0;
    await sell('4003', 2);
    expect((await task())!.title).toBe('Reponer: Bulón de tapa, faltan 2 para entregar');
    expect((await plansFor(db, [ids.p1, ids.p2])).get(ids.p2)).toMatchObject({ lines: [{ quantity: 6 }] });
    expect(toBulon()).toEqual(['MLA1000001=6']);

    // Sin reponer: al día, otro aviso; a los dos días, ni pausa ni 0.
    const later = (hours: number) => new Date(Date.now() + hours * 3600_000);
    expect(await stockAlarmPass(db, { budgetMs: 10_000, now: later(25) })).toEqual({ reminded: 1, pending: false });
    expect((await task())!.description).toContain('Pasó un día sin reponer.');
    expect(await stockAlarmPass(db, { budgetMs: 10_000, now: later(49) })).toEqual({ reminded: 0, pending: false });
    writes.length = 0;
    await reconcileStock(db, { budgetMs: 10_000 });
    expect(toBulon()).toEqual([]);
    expect((await alarm()).cutAt).toBeNull();
    expect(writes.filter((w) => w.body.available_quantity === 0 && (w.path.endsWith('MLA1000001') || w.path.endsWith('MLA1000002')))).toEqual([]);

    // Al cargar el stock, la alarma se borra y la tarea se cierra.
    await setProductStock(db, { accountId, productId: ids.bulon, userId: 'ana', stock: { '': 3 } });
    expect(await alarm()).toMatchObject({ quantity: 3, outSince: null, remindedAt: null, lowAt: null });
    expect(await task()).toMatchObject({ status: 'DONE' });
  });

  it('mostrar más de 5: una venta por otro canal que deja el stock en 0 sigue mostrando 6 en Mercado Libre, con alarma y tarea', async () => {
    // Otra tienda del mismo producto, en otro canal de venta.
    const channel = await db.channel.findFirstOrThrow();
    const other = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'OTRA TIENDA', salesSince: new Date(Date.now() - 3600_000) } })).id;
    await db.channelConnection.create({
      data: {
        storeId: other,
        appId: '1234567890',
        appSecret: encrypt('secreto-de-prueba'),
        appSecretHint: 'ueba',
        status: 'ACTIVE',
        externalUserId: '7',
        accessToken: encrypt('llave'),
        refreshToken: encrypt('renovar'),
        expiresAt: new Date(Date.now() + 6 * 3600_000),
      },
    });
    items.MLA2000001 = { quantity: 5 };
    await db.publication.create({ data: { productId: ids.bulon, storeId: other, externalId: 'MLA2000001', title: 'En la otra tienda', channelCopy: { create: copy(5) } } });
    await withShowMore();
    writes.length = 0;
    await sell('4101', 5, 'MLA2000001', other);
    expect((await alarm()).quantity).toBe(0);
    expect((await task())!.title).toBe('Reponer: Bulón de tapa, sin stock');
    await expectRestockTask(0);
    // Las de Mercado Libre siguen mostrando 6: no se les manda nada que las pause.
    expect((await plansFor(db, [ids.p1])).get(ids.p1)).toMatchObject({ lines: [{ quantity: 6 }], pending: false });
    expect(toBulon()).toEqual([]);
  });

  it('mostrar más de 5: un ajuste a mano a 0, en la pantalla o por Claude, sigue mostrando 6, con alarma y tarea', async () => {
    await withShowMore();
    items.MLA1000001.pausesAtZero = true;
    await setProductStock(db, { accountId, productId: ids.bulon, userId: 'ana', stock: { '': 0 } });
    // Ya mostraban 6: no se les manda nada, y menos un 0.
    expect(toBulon()).toEqual([]);
    expect(items.MLA1000001).toMatchObject({ quantity: 6 });
    expect((await plansFor(db, [ids.p1])).get(ids.p1)).toMatchObject({ lines: [{ quantity: 6 }], real: [{ quantity: 0 }] });
    expect(items.MLA1000001.status ?? 'active').toBe('active');
    expect((await alarm()).outSince).toEqual(expect.any(Date));
    expect((await task())!.title).toBe('Reponer: Bulón de tapa, sin stock');
    await expectRestockTask(0);
    // Guardar 0 otra vez no repite el aviso.
    const first = (await task())!.remindAt;
    await setProductStock(db, { accountId, productId: ids.bulon, userId: 'ana', stock: { '': 0 } });
    expect((await task())!.remindAt).toEqual(first);
    expect(await db.task.count({ where: { autoKey: { startsWith: 'stock:' } } })).toBe(1);

    // Por Claude, con set_product_stock: lo mismo.
    await setProductStock(db, { accountId, productId: ids.bulon, userId: 'ana', stock: { '': 4 } });
    expect(await task()).toMatchObject({ status: 'DONE' });
    writes.length = 0;
    const tool = STOCK_TOOLS.find((t) => t.name === 'set_product_stock')!;
    const ctx: McpContext = { db, userId: 'ana', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
    await tool.run(ctx, tool.input.parse({ publicacion: 'MLA1000001', unidades: 0 }));
    expect(toBulon()).toEqual([]);
    expect((await plansFor(db, [ids.p1])).get(ids.p1)).toMatchObject({ lines: [{ quantity: 6 }] });
    expect(await db.task.count({ where: { autoKey: `stock:${ids.bulon}:`, status: { in: ['PENDING', 'IN_PROGRESS'] } } })).toBe(1);
    expect(items.MLA1000001.status ?? 'active').toBe('active');
  });

  it('mostrar más de 5: con stock en 1, el aviso de que queda 1 y se sigue viendo 6', async () => {
    await withShowMore();
    // Por un ajuste a mano.
    await setProductStock(db, { accountId, productId: ids.bulon, userId: 'ana', stock: { '': 1 } });
    expect((await alarm()).lowAt).toEqual(expect.any(Date));
    expect(await task()).toMatchObject({ title: 'Queda 1: Bulón de tapa', status: 'PENDING', remindAt: expect.any(Date) });
    expect(plainLinks((await task())!.description)).toContain('Stock real: 1.');
    expect((await plansFor(db, [ids.p1])).get(ids.p1)).toMatchObject({ lines: [{ quantity: 6 }] });
    // Por una venta que deja 1.
    await setProductStock(db, { accountId, productId: ids.bulon, userId: 'ana', stock: { '': 3 } });
    expect(await task()).toMatchObject({ status: 'DONE' });
    writes.length = 0;
    await sell('4201', 2);
    expect(await task()).toMatchObject({ title: 'Queda 1: Bulón de tapa', status: 'PENDING' });
    expect(toBulon()).toEqual(['MLA1000001=6']);
    // Una cancelada que vuelve de 0 a 1 también avisa que queda 1.
    await sell('4202', 1);
    expect((await task())!.title).toBe('Reponer: Bulón de tapa, sin stock');
    await recordOrder(db, { storeId, order: sale('4202', [{ listingId: 'MLA1000001', variationId: null, sku: null, quantity: 1 }], { cancelled: true }) });
    expect(await task()).toMatchObject({ title: 'Queda 1: Bulón de tapa', status: 'PENDING' });
    expect((await alarm()).outSince).toBeNull();

    // Apagarla: se ve lo que hay, y la tarea se cierra.
    await setShowMore(db, { accountId, productId: ids.bulon, on: false, userId: 'ana' });
    expect((await plansFor(db, [ids.p1])).get(ids.p1)).toMatchObject({ lines: [{ quantity: 1 }] });
    expect(await task()).toMatchObject({ status: 'DONE' });
    await expect(setShowMore(db, { accountId, productId: ids.kit, on: true, userId: 'ana' })).rejects.toThrow('todas sus piezas');
  });

  it('una publicación que el canal pausó sin stock: la app lee el estado al momento, y el 6 de "Mostrar más de 5" no la reactiva sola', async () => {
    await startStock(db);
    // Sin la opción, cargar 0 manda 0 y Mercado Libre la pausa: la app lo lee enseguida.
    items.MLA1000001.pausesAtZero = true;
    await setProductStock(db, { accountId, productId: ids.bulon, userId: 'ana', stock: { '': 0 } });
    expect(items.MLA1000001.status).toBe('paused');
    expect((await db.publication.findUniqueOrThrow({ where: { id: ids.p1 } })).channelStatus).toBe('PAUSED');

    // Prender la opción con 0: no se le sube 6, así no se reactiva sin que una persona lo decida.
    writes.length = 0;
    await setShowMore(db, { accountId, productId: ids.bulon, on: true, userId: 'ana' });
    expect(pushedTo()).not.toContain('MLA1000001=6');
    expect((await plansFor(db, [ids.p1])).get(ids.p1)).toMatchObject({ lines: [{ quantity: 6 }], pending: false, held: true });
    // Con stock de verdad, sí.
    await setProductStock(db, { accountId, productId: ids.bulon, userId: 'ana', stock: { '': 2 } });
    expect(pushedTo()).toContain('MLA1000001=6');

    // Si la app todavía la ve activa, pausar o reactivar lee antes el estado del canal.
    items.MLA1000002.status = 'paused';
    const tool = STATUS_TOOLS[0];
    const ctx: McpContext = { db, userId: 'ana', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
    expect((await db.publication.findUniqueOrThrow({ where: { id: ids.p2 } })).channelStatus).toBe('ACTIVE');
    expect(await tool.run(ctx, { publicacion: 'MLA1000002', accion: 'reactivar' })).toMatchObject({ listo: true, estado: 'Activa' });
    expect(items.MLA1000002.status).toBe('active');
  });

  it('una venta cancelada antes de entregarse vuelve; entregada, no', async () => {
    await startStock(db);
    await recordOrder(db, { storeId, order: sale('4001', [{ listingId: 'MLA1000001', variationId: null, sku: null, quantity: 2 }]) });
    expect(await stockOf(ids.bulon)).toEqual({ '-': 3 });
    const back = await recordOrder(db, { storeId, order: sale('4001', [], { counts: false, cancelled: true }) });
    expect(back).toEqual([ids.bulon]);
    expect(await stockOf(ids.bulon)).toEqual({ '-': 5 });
    expect(await db.stockMovement.findFirstOrThrow({ where: { kind: 'CANCEL' } })).toMatchObject({ delta: 2, after: 5 });
    // Llega de nuevo: no la devuelve dos veces.
    await recordOrder(db, { storeId, order: sale('4001', [], { counts: false, cancelled: true }) });
    expect(await stockOf(ids.bulon)).toEqual({ '-': 5 });

    await recordOrder(db, { storeId, order: sale('4002', [{ listingId: 'MLA1000001', variationId: null, sku: null, quantity: 1 }]) });
    await recordOrder(db, { storeId, order: sale('4002', [], { counts: false, cancelled: true, delivered: true }) });
    expect(await stockOf(ids.bulon)).toEqual({ '-': 4 });
    expect(await db.channelSale.findFirstOrThrow({ where: { orderId: '4002' } })).toMatchObject({ status: 'KEPT' });
    expect((await db.product.findUniqueOrThrow({ where: { id: ids.bulon } })).stockReview).toContain('ya se había entregado');
    // Una que se canceló antes de confirmarse no se anota.
    expect(await recordOrder(db, { storeId, order: sale('4003', [], { counts: false, cancelled: true }) })).toEqual([]);
    expect(await db.channelSale.count({ where: { orderId: '4003' } })).toBe(0);
  });

  it('sin leer las ventas no sigue al stock, y la venta de antes de empezar se cuenta al empezar', async () => {
    // Una venta mientras el producto todavía no llevaba stock en la app.
    await recordOrder(db, { storeId, order: sale('5001', [{ listingId: 'MLA1000001', variationId: null, sku: null, quantity: 1 }]) });
    expect(await db.channelSale.findFirstOrThrow({ where: { orderId: '5001' } })).toMatchObject({ status: 'SKIPPED' });
    await startStock(db);
    // La lectura de las publicaciones fue antes de la venta: se descuenta al empezar.
    expect(await stockOf(ids.bulon)).toEqual({ '-': 4 });
    expect(await db.channelSale.findFirstOrThrow({ where: { orderId: '5001' } })).toMatchObject({ status: 'COUNTED' });

    await db.store.update({ where: { id: storeId }, data: { salesError: 'Falta el permiso.' } });
    expect((await plansFor(db, [ids.p1])).get(ids.p1)).toMatchObject({ managed: false, reason: expect.stringContaining('todavía no lee las ventas') });
    expect((await reconcileStock(db, { budgetMs: 10_000 })).sent).toBe(0);
    expect(writes).toEqual([]);
  });

  it('a mano: empieza o cambia el stock y lo sube a todas', async () => {
    const r = await setProductStock(db, { accountId, productId: ids.juego, userId: 'ana', stock: { 'sku:AROS-STD medida:std': '10', 'sku:AROS-050 medida:0.50': '0' } });
    expect(r).toMatchObject({ changed: 2, sync: { sent: 1 } });
    expect(pushedTo()).toEqual(['MLA1000003=10/0']);
    expect(await db.stockMovement.findMany({ where: { productId: ids.juego }, select: { kind: true, delta: true, userId: true } })).toEqual([
      { kind: 'INITIAL', delta: 10, userId: 'ana' },
      { kind: 'INITIAL', delta: 0, userId: 'ana' },
    ]);
    await setProductStock(db, { accountId, productId: ids.juego, userId: 'ana', stock: { 'sku:AROS-STD medida:std': 8 } });
    expect(await db.stockMovement.findFirstOrThrow({ where: { kind: 'MANUAL' } })).toMatchObject({ delta: -2, after: 8 });
    await expect(setProductStock(db, { accountId, productId: ids.kit, userId: 'ana', stock: { '': 3 } })).rejects.toThrow('El stock de un combo sale de sus piezas');
  });

  it('la pasada de cada hora y el aviso de Mercado Libre leen las ventas', async () => {
    await startStock(db);
    writes.length = 0;
    const paid = (id: number, listing: string, quantity: number) => ({
      id,
      status: 'paid',
      date_created: new Date().toISOString(),
      date_closed: new Date().toISOString(),
      seller: { id: 7 },
      tags: ['paid', 'not_delivered'],
      order_items: [{ item: { id: listing, variation_id: null, seller_sku: null }, quantity }],
    });
    search = [paid(6001, 'MLA1000002', 1)];
    const r = await readSales(db, { budgetMs: 10_000 });
    // Las dos del bulón pasan a 4; el combo sigue en 2.
    expect(r).toMatchObject({ orders: 1, sent: 2 });
    expect(pushedTo().sort()).toEqual(['MLA1000001=4', 'MLA1000002=4']);
    expect(await stockOf(ids.bulon)).toEqual({ '-': 4 });
    expect((await db.store.findUniqueOrThrow({ where: { id: storeId } })).salesCheckedAt).toBeInstanceOf(Date);

    // El aviso trae una venta nueva: se pide y se descuenta.
    orders['6002'] = paid(6002, 'MLA1000001', 2);
    expect(await handleSalesNotice(db, 'MERCADOLIBRE', { topic: 'orders_v2', resource: '/orders/6002', user_id: 7 })).toMatchObject({ products: 1 });
    expect(await stockOf(ids.bulon)).toEqual({ '-': 2 });

    // Sin el permiso de Ventas: queda el motivo y las publicaciones vuelven a seguir al canal.
    search = 'forbidden';
    await readSales(db, { budgetMs: 10_000 });
    expect((await db.store.findUniqueOrThrow({ where: { id: storeId } })).salesError).toContain('falta el permiso de Ventas');
  });
});
