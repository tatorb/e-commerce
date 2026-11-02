import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { encrypt } from '@/lib/crypto';
import type { McpContext } from '@/lib/mcp/tool';

// La sección Ventas contra un Mercado Libre y un Mercado Pago simulados: las
// ventas viejas por tramos, las que cambiaron, el envío compartido de un
// carrito, la plata que se libera, una cancelación, los avisos, las tareas y
// lo que ve Claude. Los datos son inventados.

const url = process.env.TEST_DATABASE_URL;

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { readStoreSales, handleSaleNotice } = await import('@/lib/sales/read');
const { listSales, cashPage, shipmentGroups, dispatchDueCount, readerStatus, getSale, findSaleId } = await import('@/lib/sales/queries');
const { saleAlarmPass } = await import('@/lib/sales/alarms');
const { parsePeriod } = await import('@/domain/sales');
const { handleRpc } = await import('@/lib/mcp/server');

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

type Order = Record<string, unknown> & { id: number; status: string; date_created: string; date_last_updated: string };

describe.skipIf(!url)('las ventas en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let server: http.Server;
  let orders: Order[] = [];
  // Lo que el buscador todavía muestra, aunque la venta ya cambió: el de Mercado Libre no devuelve las canceladas.
  let hidden = new Set<number>();
  let shipments: Record<string, { shipment: object; costs: object | null }> = {};
  let payments: Record<string, object> = {};
  let mpDenied = false;
  const requests: string[] = [];
  let accountId = '';
  let storeId = '';
  const now = Date.now();

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    server = http.createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      const json = (status: number, body: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      if (req.headers.authorization !== 'Bearer llave') return json(401, {});
      requests.push(u.pathname);
      const pay = u.pathname.match(/^\/mp\/v1\/payments\/(\d+)$/);
      if (pay) return mpDenied ? json(403, {}) : payments[pay[1]] ? json(200, payments[pay[1]]) : json(404, {});
      if (u.pathname === '/orders/search') {
        const from = u.searchParams.get('order.date_created.from');
        const to = u.searchParams.get('order.date_created.to');
        const changed = u.searchParams.get('order.date_last_updated.from');
        const hour = (s: string) => Date.parse(s.replace('.000-00:00', 'Z'));
        const found = orders
          .filter((o) => o.status !== 'cancelled' && !hidden.has(o.id))
          .filter((o) => (!from || Date.parse(o.date_created) >= hour(from)) && (!to || Date.parse(o.date_created) < hour(to)))
          .filter((o) => !changed || Date.parse(o.date_last_updated) >= hour(changed))
          .sort((a, b) => Date.parse(a.date_created) - Date.parse(b.date_created));
        const offset = Number(u.searchParams.get('offset') ?? 0);
        const limit = Number(u.searchParams.get('limit') ?? 50);
        return json(200, { results: found.slice(offset, offset + limit), paging: { total: found.length, offset, limit } });
      }
      const order = u.pathname.match(/^\/orders\/(\d+)$/);
      if (order) {
        const o = orders.find((x) => String(x.id) === order[1]);
        return o ? json(200, o) : json(404, {});
      }
      const costs = u.pathname.match(/^\/shipments\/(\d+)\/costs$/);
      if (costs) return shipments[costs[1]]?.costs ? json(200, shipments[costs[1]].costs) : json(404, {});
      const ship = u.pathname.match(/^\/shipments\/(\d+)$/);
      if (ship) return shipments[ship[1]] ? json(200, shipments[ship[1]].shipment) : json(404, {});
      return json(404, {});
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.MERCADOLIBRE_API_URL = base;
    process.env.MERCADOPAGO_API_URL = `${base}/mp`;
  });

  afterAll(async () => {
    server.close();
    delete process.env.MERCADOLIBRE_API_URL;
    delete process.env.MERCADOPAGO_API_URL;
    await db.$disconnect();
  });

  const order = (id: number, ageDays: number, items: { listing: string; variation?: number; sku?: string; qty: number; price: number; fee: number; title: string }[], extra: Partial<Order> = {}): Order => ({
    id,
    status: 'paid',
    date_created: iso(now - ageDays * DAY),
    date_closed: iso(now - ageDays * DAY + 60_000),
    date_last_updated: iso(now - ageDays * DAY + 120_000),
    currency_id: 'ARS',
    seller: { id: 7 },
    buyer: { id: 900 + id, nickname: `COMPRADOR${id}` },
    tags: ['paid', 'not_delivered'],
    order_items: items.map((i) => ({ item: { id: i.listing, title: i.title, variation_id: i.variation ?? null, seller_sku: i.sku ?? null }, quantity: i.qty, unit_price: i.price, full_unit_price: i.price, sale_fee: i.fee })),
    total_amount: items.reduce((s, i) => s + i.qty * i.price, 0),
    payments: [],
    mediations: [],
    ...extra,
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE tasks, sales, sale_readers, stock_movements, channel_sales, product_costs, channel_copies, channel_connections, product_variants, publications, products, stores, channels, accounts, users CASCADE',
    );
    requests.length = 0;
    hidden = new Set();
    mpDenied = false;
    await db.user.create({ data: { id: 'ana', name: 'Ana', email: 'ana@prueba.com', isAdmin: true } });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } })).id;
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
        expiresAt: new Date(now + 6 * 3600_000),
      },
    });
    const piston = await db.product.create({
      data: {
        accountId,
        name: 'Subconjunto SP-900',
        variants: { create: [{ sku: 'SP-900-00', measure: 'STD', position: 0 }, { sku: 'SP-900-50', measure: '0.50', position: 1 }] },
      },
    });
    await db.productCost.createMany({
      data: [
        { productId: piston.id, key: 'sku:SP-900-00 medida:std', cost: 7000 },
        { productId: piston.id, key: 'sku:SP-900-50 medida:0.50', cost: 8000 },
      ],
    });
    const bomba = await db.product.create({ data: { accountId, name: 'Bomba de agua BA-1' } });
    await db.publication.create({
      data: {
        productId: piston.id,
        storeId,
        externalId: 'MLA9100001',
        title: 'Subconjunto Pistón SP-900',
        channelCopy: {
          create: {
            readAt: new Date(),
            status: 'ACTIVE',
            variations: [
              { sku: 'SP-900-00', measure: 'STD', photoIds: [], variationId: '11', quantity: 3 },
              { sku: 'SP-900-50', measure: '0.50', photoIds: [], variationId: '12', quantity: 4 },
            ],
          },
        },
      },
    });
    await db.publication.create({ data: { productId: bomba.id, storeId, externalId: 'MLA9200001', title: 'Bomba de Agua BA-1' } });

    // A y B: un carrito de hace 2 días, con un envío para despachar ya vencido. C: de hace 200 días, entregada.
    // D: con reclamo. E: pagada, y después cancelada.
    orders = [
      order(2000000001, 2, [{ listing: 'MLA9100001', variation: 12, sku: 'SP-900-50', qty: 2, price: 15000, fee: 2100, title: 'Subconjunto Pistón SP-900' }], {
        pack_id: 3000000001,
        shipping: { id: 44000001 },
        payments: [{ id: 555001, status: 'approved', transaction_amount: 30000, installments: 6, payment_type: 'credit_card' }],
      }),
      order(2000000002, 2, [{ listing: 'MLA9200001', qty: 1, price: 10000, fee: 1400, title: 'Bomba de Agua BA-1' }], {
        pack_id: 3000000001,
        shipping: { id: 44000001 },
        payments: [{ id: 555002, status: 'approved', transaction_amount: 10000, installments: 1, payment_type: 'account_money' }],
      }),
      order(2000000003, 200, [{ listing: 'MLA9200001', qty: 1, price: 9000, fee: 1260, title: 'Bomba de Agua BA-1' }], {
        tags: ['paid', 'delivered'],
        shipping: { id: 44000003 },
        payments: [{ id: 555003, status: 'approved', transaction_amount: 9000 }],
      }),
      order(2000000004, 5, [{ listing: 'MLA9200001', qty: 1, price: 10000, fee: 1400, title: 'Bomba de Agua BA-1' }], { mediations: [{ id: 1 }] }),
      order(2000000005, 3, [{ listing: 'MLA7777777', qty: 1, price: 5000, fee: 700, title: 'Algo que no está en la app' }]),
    ];
    shipments = {
      '44000001': {
        shipment: { id: 44000001, status: 'ready_to_ship', substatus: 'printed', mode: 'me2', logistic_type: 'cross_docking', shipping_option: { estimated_handling_limit: { date: iso(now - 3600_000) } } },
        costs: { senders: [{ cost: 3000 }], receiver: { cost: 0 } },
      },
      '44000003': { shipment: { id: 44000003, status: 'delivered' }, costs: { senders: [{ cost: 1000 }] } },
    };
    payments = {
      '555001': { id: 555001, money_release_date: iso(now + 5 * DAY), money_release_status: 'pending', transaction_details: { net_received_amount: 23000 } },
      '555002': { id: 555002, money_release_date: iso(now - DAY), money_release_status: 'released', transaction_details: { net_received_amount: 7850 } },
    };
  });

  const byOrder = async (orderId: string) => db.sale.findUniqueOrThrow({ where: { storeId_orderId: { storeId, orderId } } });

  it('trae los 12 meses por tramos y completa el envío y el pago, sin tocar el stock', async () => {
    const r = await readStoreSales(db, storeId, { budgetMs: 60_000 });
    expect(r).toMatchObject({ status: 'done', added: 5 });
    expect(await db.sale.count()).toBe(5);
    const reader = await db.saleReader.findUniqueOrThrow({ where: { storeId } });
    expect(reader.historyCursor).toBeNull();
    expect(reader.historyDoneAt).not.toBeNull();
    expect(reader.leaseUntil).toBeNull();
    // El stock no se entera: eso lo hace la lectura del stock.
    expect(await db.channelSale.count()).toBe(0);
    expect(await db.stockMovement.count()).toBe(0);

    const a = await byOrder('2000000001');
    expect(a).toMatchObject({ state: 'PAID', packId: '3000000001', buyerNickname: 'COMPRADOR2000000001', shipState: 'TO_SHIP', shipKind: 'pickup', shipKindLabel: 'Colecta', shipDetail: 'Etiqueta impresa' });
    expect(Number(a.itemsAmount)).toBe(30000);
    expect(Number(a.fee)).toBe(4200);
    // El envío del carrito se reparte: 30.000 y 10.000 de 3.000.
    expect(Number(a.shippingCost)).toBe(2250);
    expect(Number((await byOrder('2000000002')).shippingCost)).toBe(750);
    // Lo de Mercado Pago: lo que deposita y cuándo se libera.
    expect(Number(a.netReceived)).toBe(23000);
    expect(a.released).toBe(false);
    expect(a.releaseAt?.getTime()).toBe(Date.parse(iso(now + 5 * DAY)));
    // La línea sabe de qué publicación, producto y medida es.
    const [line] = a.lines as { productId: string; key: string; measure: string; publicationId: string }[];
    expect(line).toMatchObject({ key: 'sku:SP-900-50 medida:0.50', measure: '0.50' });
    expect(line.publicationId).not.toBeNull();
    expect(a.searchText).toContain('subconjunto sp-900');

    // La vieja: solo el costo del envío, sin pedir el envío ni el pago, y la plata ya liberada.
    const c = await byOrder('2000000003');
    expect(c).toMatchObject({ shipState: 'DELIVERED', released: true, delivered: true });
    expect(Number(c.shippingCost)).toBe(1000);
    expect(requests).not.toContain('/shipments/44000003');
    expect(requests).not.toContain('/mp/v1/payments/555003');
    expect((await byOrder('2000000004')).claim).toBe(true);
    // Lo que no está en la app queda igual, sin producto.
    expect((await byOrder('2000000005')).lines).toMatchObject([{ productId: null, key: null }]);
    expect((await byOrder('2000000005')).searchText).toContain('mla7777777');

    // La segunda vez no hay nada nuevo: no repite las viejas.
    requests.length = 0;
    const again = await readStoreSales(db, storeId, { budgetMs: 60_000 });
    expect(again).toMatchObject({ status: 'done', added: 0 });
    expect(requests.filter((p) => p === '/orders/search')).toHaveLength(1);
  });

  it('una venta abierta que se canceló se entera al volver a mirarla, aunque el buscador no la muestre', async () => {
    await readStoreSales(db, storeId, { budgetMs: 60_000 });
    const e = orders.find((o) => o.id === 2000000005)!;
    e.status = 'cancelled';
    e.cancel_detail = { requested_by: 'seller', description: 'Sin stock' };
    // Tres horas y pico después.
    const later = () => new Date(Date.now() + 4 * 3600_000);
    await readStoreSales(db, storeId, { budgetMs: 60_000, now: later });
    expect(await byOrder('2000000005')).toMatchObject({ state: 'CANCELLED', cancelBy: 'seller', cancelReason: 'Sin stock' });
  });

  it('sin acceso a Mercado Pago, la venta queda sin ese dato y nada más', async () => {
    mpDenied = true;
    const r = await readStoreSales(db, storeId, { budgetMs: 60_000 });
    expect(r.status).toBe('done');
    const a = await byOrder('2000000001');
    expect(a.netReceived).toBeNull();
    expect(a.released).toBeNull();
    expect((await db.channelConnection.findUniqueOrThrow({ where: { storeId } })).status).toBe('ACTIVE');
  });

  it('una publicación que vende una sola medida: la venta toma la medida por el SKU y su costo, aunque se haya guardado sin la medida', async () => {
    const p = await db.product.create({
      data: { accountId, name: 'Subconjunto SP-564', variants: { create: [{ sku: 'SP-564-50', measure: '0.50', position: 0 }, { sku: 'SP-564-00', measure: 'STD', position: 1 }] } },
    });
    await db.productCost.createMany({
      data: [
        { productId: p.id, key: 'sku:SP-564-50 medida:0.50', cost: 1478 },
        { productId: p.id, key: 'sku:SP-564-00 medida:std', cost: 1478 },
      ],
    });
    await db.publication.create({ data: { productId: p.id, storeId, externalId: 'MLA9300001', title: 'Subconjunto SP-564 0.50', channelCopy: { create: { readAt: new Date(), status: 'ACTIVE', variations: [] } } } });
    orders = [order(2000000009, 0, [{ listing: 'MLA9300001', sku: 'SP-564-50', qty: 1, price: 3030, fee: 690, title: 'Subconjunto SP-564 0.50' }], { payments: [{ id: 555009, status: 'approved', transaction_amount: 3030 }] })];
    await readStoreSales(db, storeId, { budgetMs: 60_000 });
    const sale = await byOrder('2000000009');
    expect(sale.lines).toEqual([expect.objectContaining({ key: 'sku:SP-564-50 medida:0.50', measure: '0.50' })]);

    // Una venta que se guardó sin la medida, por ejemplo porque se leyó antes de cargar los SKU: se busca de nuevo por el SKU vendido.
    const lines = sale.lines as Record<string, unknown>[];
    await db.sale.update({ where: { id: sale.id }, data: { lines: [{ ...lines[0], key: null, measure: null }] } });
    const tz = 'America/Argentina/Buenos_Aires';
    const all = await listSales(db, accountId, { period: parsePeriod({ periodo: '30d' }, new Date(), tz), state: 'todas', ship: 'todos', q: '' });
    const row = all.rows.find((r) => r.orderId === '2000000009')!;
    expect(row.lines[0]).toMatchObject({ measure: '0.50', unitCost: 1478 });
    expect(row.money.cost).toBe(1478);
    // Lo mismo si la medida guardada ya no está en el producto.
    await db.sale.update({ where: { id: sale.id }, data: { lines: [{ ...lines[0], key: 'sku:SP-564-50 medida:0,50 vieja', measure: 'vieja' }] } });
    const again = await listSales(db, accountId, { period: parsePeriod({ periodo: '30d' }, new Date(), tz), state: 'todas', ship: 'todos', q: '' });
    expect(again.rows.find((r) => r.orderId === '2000000009')!.lines[0]).toMatchObject({ measure: '0.50', unitCost: 1478 });
  });

  it('las cuentas: la lista con filtros, la ganancia con el costo de la medida, la caja y los envíos', async () => {
    await readStoreSales(db, storeId, { budgetMs: 60_000 });
    const tz = 'America/Argentina/Buenos_Aires';
    const period = parsePeriod({ periodo: '30d' }, new Date(), tz);
    const all = await listSales(db, accountId, { period, state: 'todas', ship: 'todos', q: '' });
    // La de hace 200 días queda afuera del período.
    expect(all.total).toBe(4);
    const a = all.rows.find((r) => r.orderId === '2000000001')!;
    // 30.000 − 4.200 − 2.250 = 23.550; menos IVA 5.206,61, impuestos 4,9 % (1.470) y el costo de la 0.50 (2 × 8.000).
    expect(a.money).toMatchObject({ sold: 30000, fee: 4200, shipping: 2250, net: 23550, received: 23000, withheld: 550, cost: 16000 });
    expect(a.money.profit).toBe(873.39);
    expect(a.lines[0].unitCost).toBe(8000);
    // La bomba no tiene costo: sin ganancia.
    expect(all.rows.find((r) => r.orderId === '2000000002')!.money.profit).toBeNull();
    expect(all.summary).toMatchObject({ count: 4, withoutCost: 3, claims: 1 });

    expect((await listSales(db, accountId, { period, state: 'todas', ship: 'todos', q: 'SP-900 cOMPRADOR2000000001' })).rows.map((r) => r.orderId)).toEqual(['2000000001']);
    expect((await listSales(db, accountId, { period, state: 'reclamos', ship: 'todos', q: '' })).rows.map((r) => r.orderId)).toEqual(['2000000004']);
    expect((await listSales(db, accountId, { period, state: 'todas', ship: 'despachar', q: '' })).total).toBe(2);
    expect((await listSales(db, accountId, { period: null, state: 'todas', ship: 'entregados', q: '' })).rows.map((r) => r.orderId)).toEqual(['2000000003']);

    const cash = await cashPage(db, accountId, period, new Date(), tz);
    // B ya se liberó; A se libera en 5 días; D y E sin el dato del medio de pago.
    expect(cash.cash.released).toEqual({ amount: 7850, count: 1 });
    expect(cash.cash.waiting.amount).toBe(23000 + 8600 + 4300);
    expect(cash.cash.waiting.days).toHaveLength(1);
    expect(cash.cash.waiting.undated.count).toBe(2);
    expect(cash.products[0]).toMatchObject({ name: 'Subconjunto SP-900', units: 2, sold: 30000, cost: 16000, profit: 873.39 });
    expect(cash.products.find((p) => p.productId === null)).toMatchObject({ name: 'Algo que no está en la app' });

    const groups = await shipmentGroups(db, accountId, new Date());
    expect(groups.toShip.map((r) => r.orderId).sort()).toEqual(['2000000001', '2000000002']);
    expect(await dispatchDueCount(db, accountId, new Date(), tz)).toBe(2);

    const detail = (await getSale(db, accountId, a.id))!;
    expect(detail.packSales.map((p) => p.orderId)).toEqual(['2000000002']);
    expect(detail.url).toBe('https://www.mercadolibre.com.ar/ventas/2000000001/detalle');
    expect(await findSaleId(db, accountId, '3000000001')).not.toBeNull();

    const [status] = await readerStatus(db, accountId);
    expect(status).toMatchObject({ connected: true, sales: 5, incomplete: 0, history: { done: true, pct: 100 } });
  });

  it('las tareas de despachar y de reclamos, que se cierran solas; y los avisos del envío y del pago', async () => {
    await readStoreSales(db, storeId, { budgetMs: 60_000 });
    expect(await saleAlarmPass(db)).toEqual({ opened: 3, closed: 0 });
    const tasks = await db.task.findMany({ orderBy: { title: 'asc' }, include: { assignees: true, publications: true } });
    expect(tasks.map((t) => t.title)).toEqual([
      'Despachar la venta 2000000001: Subconjunto Pistón SP-900',
      'Despachar la venta 2000000002: Bomba de Agua BA-1',
      'Reclamo en la venta 2000000004: Bomba de Agua BA-1',
    ]);
    expect(tasks[0].assignees.map((x) => x.userId)).toEqual(['ana']);
    expect(tasks[0].publications).toHaveLength(1);
    // No se repiten.
    expect(await saleAlarmPass(db)).toEqual({ opened: 0, closed: 0 });

    // Sale el envío del carrito: llega el aviso, se lee y se cierran las dos de despachar.
    shipments['44000001'].shipment = { id: 44000001, status: 'shipped', mode: 'me2', logistic_type: 'cross_docking', status_history: { date_shipped: iso(now) }, tracking_number: 'TRK-9' };
    expect(await handleSaleNotice(db, 'MERCADOLIBRE', { topic: 'shipments', resource: '/shipments/44000001', user_id: 7, application_id: 1234567890 })).toBe(2);
    expect(await byOrder('2000000002')).toMatchObject({ shipState: 'SHIPPED', tracking: 'TRK-9' });
    expect(await saleAlarmPass(db)).toEqual({ opened: 0, closed: 2 });

    // Se libera la plata de A: llega el aviso del pago.
    payments['555001'] = { id: 555001, money_release_date: iso(now), money_release_status: 'released', transaction_details: { net_received_amount: 23000 } };
    expect(await handleSaleNotice(db, 'MERCADOLIBRE', { topic: 'payments', resource: '/collections/555001', user_id: 7 })).toBe(1);
    expect((await byOrder('2000000001')).released).toBe(true);

    // Una venta nueva por el aviso de la venta: se guarda y se completa en el momento.
    orders.push(order(2000000006, 0, [{ listing: 'MLA9100001', variation: 11, sku: 'SP-900-00', qty: 1, price: 14000, fee: 1960, title: 'Subconjunto Pistón SP-900' }]));
    expect(await handleSaleNotice(db, 'MERCADOLIBRE', { topic: 'orders_v2', resource: '/orders/2000000006', user_id: 7 })).toBe(1);
    expect(await byOrder('2000000006')).toMatchObject({ state: 'PAID', shipState: 'NONE' });
    // De otro vendedor, no.
    expect(await handleSaleNotice(db, 'MERCADOLIBRE', { topic: 'orders_v2', resource: '/orders/2000000006', user_id: 8 })).toBe(0);
    expect((await db.saleReader.findUniqueOrThrow({ where: { storeId } })).noticeAt).not.toBeNull();
  });

  it('Claude ve las ventas, una venta, la caja y los envíos, con el permiso de Ventas', async () => {
    await readStoreSales(db, storeId, { budgetMs: 60_000 });
    const admin: McpContext = { db, userId: 'ana', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
    const call = async (name: string, args: Record<string, unknown>, ctx = admin) => {
      const r = (await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, ctx)) as {
        result: { content: { text: string }[]; isError?: boolean };
      };
      return { isError: r.result.isError === true, text: r.result.content[0].text, data: r.result.isError ? null : JSON.parse(r.result.content[0].text) };
    };
    const list = await call('list_sales', { periodo: '30d', envio: 'despachar' });
    expect(list.data).toMatchObject({ total: 2, resumen: { ventas_pagadas: 2 } });
    expect(list.data.ventas[0]).toMatchObject({ envio: 'Para despachar · Colecta · Etiqueta impresa', link_app: expect.stringContaining('/a/prueba/ventas/') });

    const sale = await call('get_sale', { venta: '2000000001' });
    expect(sale.data).toMatchObject({ venta: '2000000001', cuenta: { vendido: 30000, ganancia: 873.39, deposita_el_medio_de_pago: 23000 }, envio_detalle: { como: 'Colecta' } });
    expect(sale.data.productos[0]).toMatchObject({ medida: '0.50', costo_unitario: 8000, producto: 'Subconjunto SP-900' });
    expect((await call('get_sale', { venta: '1' })).isError).toBe(true);

    const cash = await call('get_cash_summary', { periodo: '12m' });
    expect(cash.data.resultado).toMatchObject({ ventas_pagadas: 5, vendido: 64000 });
    expect(cash.data.plata.liberada_en_el_periodo).toBeGreaterThan(0);

    const ships = await call('get_shipments', {});
    expect(ships.data.para_despachar).toHaveLength(2);

    const seller: McpContext = { ...admin, userId: 'ana', access: { isAdmin: false, permissions: { publicaciones: 'read' }, accountIds: [accountId] } };
    const denied = await call('list_sales', {}, seller);
    expect(denied.isError).toBe(true);
    expect(denied.text).toContain('Ventas');
  });
});
