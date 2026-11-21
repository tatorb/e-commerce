import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { branchOrder, flexSaleBranch, flexWanted, type BranchLike } from '@/domain/branches';
import { stockSlots, type StockSource } from '@/domain/stock';
import type { ChannelOrder } from '@/channels/sales';

// Las sucursales: el stock de cada una, de cuál sale cada venta y Envíos Flex
// según el stock de las sucursales con Flex, contra un Mercado Libre
// simulado. Los datos son inventados.

const url = process.env.TEST_DATABASE_URL;

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { encrypt } = await import('@/lib/crypto');
const { saveBranch, branchStockText } = await import('@/lib/branches');
const { afterBranchFlex, flexPlans, reconcileFlex, setFlexFollowsStock } = await import('@/lib/branch-flex');
const { setPublicationsFlex } = await import('@/lib/flex');
const { recordOrder, setProductStock, loadProductStock } = await import('@/lib/stock');
const { assignSaleBranch, salesWithoutBranch } = await import('@/lib/sale-branch');
const { setStockBulk } = await import('@/lib/stock-bulk');

const norte: BranchLike = { id: 'norte', name: 'Norte', position: 0, flex: true, main: false };
const sur: BranchLike = { id: 'sur', name: 'Sur', position: 1, flex: false, main: false };

describe('las sucursales sin la base', () => {
  it('las sucursales van en su orden', () => {
    expect(branchOrder([sur, norte]).map((b) => b.id)).toEqual(['norte', 'sur']);
  });

  it('una venta Flex sale de la sucursal con Flex, aunque quede en negativo; las demás no tienen sucursal hasta que se elige', () => {
    const otraFlex: BranchLike = { ...sur, id: 'oeste', name: 'Oeste', flex: true, position: 2 };
    expect(flexSaleBranch([norte, sur], { norte: 3, sur: 10 }, true)?.id).toBe('norte');
    expect(flexSaleBranch([norte, sur], { norte: 0, sur: 10 }, true)?.id).toBe('norte');
    // Con dos sucursales con Flex, la que más tiene.
    expect(flexSaleBranch([norte, sur, otraFlex], { norte: 1, oeste: 4 }, true)?.id).toBe('oeste');
    expect(flexSaleBranch([norte, sur], { norte: 3 }, false)).toBeNull();
    expect(flexSaleBranch([{ ...norte, flex: false }, sur], { norte: 3 }, true)).toBeNull();
  });

  it('Flex: prendido si una sucursal con Flex tiene de todas las medidas que vende', () => {
    const aros = [
      { sku: 'AR-STD', measure: 'STD' },
      { sku: 'AR-050', measure: '0.50' },
    ];
    const slots = stockSlots(aros);
    const [std, half] = slots.map((s) => s.key);
    const source: StockSource = { kind: 'INDIVIDUAL', product: { id: 'p', name: 'Aros', slots, stock: { [std]: 5, [half]: 5 } } };
    const inNorte = (stock: Record<string, number>) => [{ branch: norte, stock: new Map([['p', stock]]) }];
    expect(flexWanted(source, [aros[0]], inNorte({ [std]: 1, [half]: 0 }))).toMatchObject({ on: true, branch: 'Norte' });
    expect(flexWanted(source, [aros[1]], inNorte({ [std]: 1, [half]: 0 }))).toMatchObject({ on: false, reason: 'No hay stock en Norte.' });
    expect(flexWanted(source, aros, inNorte({ [std]: 1, [half]: 0 }))).toMatchObject({ on: false, reason: 'No hay stock de todas sus medidas en Norte.' });
    expect(flexWanted(source, [aros[0]], [])).toMatchObject({ on: false, reason: 'Ninguna sucursal tiene Flex prendido.' });
    // Un combo con 2 de la pieza: con 1 en la sucursal no se arma.
    const combo: StockSource = { kind: 'COMBO', parts: [{ product: { id: 'p', name: 'Aros', slots, stock: { [std]: 9 } }, quantity: 2 }] };
    expect(flexWanted(combo, [{ sku: 'KIT', measure: 'STD' }], inNorte({ [std]: 1 }))).toMatchObject({ on: false });
    expect(flexWanted(combo, [{ sku: 'KIT', measure: 'STD' }], inNorte({ [std]: 2 }))).toMatchObject({ on: true });
  });
});

describe.skipIf(!url)('las sucursales en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let server: http.Server;
  let accountId = '';
  let storeId = '';
  let userId = '';
  // Lo que tiene Flex en el Mercado Libre simulado, y los envíos.
  let flex: Record<string, boolean> = {};
  let shipments: Record<string, string> = {};
  let refuse = false;
  let tries = 0;

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    server = http.createServer(async (req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      const json = (status: number, body: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(body === null ? '' : JSON.stringify(body));
      if (req.headers.authorization !== 'Bearer llave') return json(401, {});
      const item = u.pathname.match(/^\/flex\/sites\/MLA\/items\/(MLA\d+)\/v2$/);
      if (item) {
        const id = item[1];
        tries++;
        if (refuse) return json(403, { message: 'forbidden' });
        if (req.method === 'GET') return json(200, { has_flex: flex[id] === true });
        if (req.method === 'POST') {
          if (flex[id]) return json(400, { message: 'item is already in flex' });
          flex[id] = true;
          return json(204, null);
        }
        if (req.method === 'DELETE') {
          flex[id] = false;
          return json(204, null);
        }
      }
      const ship = u.pathname.match(/^\/shipments\/(\d+)$/);
      if (ship && shipments[ship[1]]) return json(200, { id: Number(ship[1]), status: 'ready_to_ship', mode: 'me2', logistic_type: shipments[ship[1]] });
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

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE tasks, branch_stock, branches, stock_movements, channel_sales, product_stock, channel_sync_changes, channel_copies, sales, channel_connections, publications, products, stores, channels, accounts, users CASCADE',
    );
    flex = { MLA1: false, MLA2: true, MLA3: false };
    shipments = {};
    refuse = false;
    tries = 0;
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    await db.channelConnection.create({
      data: {
        storeId: store.id,
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
    const user = await db.user.create({ data: { id: 'persona', email: 'persona@ejemplo.com', name: 'Persona', isAdmin: true } });
    accountId = account.id;
    storeId = store.id;
    userId = user.id;
  });

  /** Un producto sin medidas con stock en la app, y su publicación activa en el canal. */
  const product = async (name: string, quantity: number, externalId: string, copyFlex: boolean | null) => {
    const p = await db.product.create({ data: { accountId, name, stockSince: new Date('2026-11-01T00:00:00Z') } });
    await db.productStock.create({ data: { productId: p.id, key: '', quantity } });
    const pub = await db.publication.create({ data: { productId: p.id, storeId, externalId, title: name } });
    await db.channelCopy.create({ data: { publicationId: pub.id, readAt: new Date(), status: 'ACTIVE', flex: copyFlex } });
    return { productId: p.id, publicationId: pub.id };
  };

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

  const branchStock = async (productId: string) =>
    Object.fromEntries(
      (await db.branchStock.findMany({ where: { productId }, select: { quantity: true, branch: { select: { name: true } } } })).map((r) => [r.branch.name, r.quantity]),
    );
  const total = async (productId: string) => (await db.productStock.findUniqueOrThrow({ where: { productId_key: { productId, key: '' } } })).quantity;

  it('la primera sucursal se queda con el stock cargado; la segunda empieza en 0 y cada carga suma al total', async () => {
    const a = await product('Bomba BA-1', 4, 'MLA1', false);
    // Sin Flex en ninguna, crear una sucursal no toca el canal.
    const first = await saveBranch(db, { accountId, branch: { name: 'Norte' } });
    expect(first).toMatchObject({ created: true, tookStock: 1, flexChanged: false });
    const second = await saveBranch(db, { accountId, branch: { name: 'Sur' } });
    expect(second).toMatchObject({ tookStock: 0 });
    expect(await branchStock(a.productId)).toEqual({ Norte: 4 });
    await expect(saveBranch(db, { accountId, branch: { name: 'norte' } })).rejects.toThrow('Ya hay una sucursal norte.');

    // Con dos sucursales hay que decir de cuál es.
    await expect(setProductStock(db, { accountId, productId: a.productId, userId, stock: { '': 6 } })).rejects.toThrow('Elegí la sucursal: Norte o Sur.');
    await setProductStock(db, { accountId, productId: a.productId, userId, stock: { '': 6 }, branchId: second.branch.id });
    expect(await branchStock(a.productId)).toEqual({ Norte: 4, Sur: 6 });
    expect(await total(a.productId)).toBe(10);
    await setProductStock(db, { accountId, productId: a.productId, userId, stock: { '': 1 }, branchId: first.branch.id });
    expect(await total(a.productId)).toBe(7);
    const moves = await db.stockMovement.findMany({ where: { productId: a.productId }, orderBy: { id: 'asc' }, select: { delta: true, after: true, note: true, branches: true } });
    expect(moves).toEqual([
      { delta: 6, after: 10, note: 'En Sur.', branches: { [second.branch.id]: 6 } },
      { delta: -3, after: 7, note: 'En Norte.', branches: { [first.branch.id]: -3 } },
    ]);
    expect(await branchStockText(db, a.productId, stockSlots([]))).toBe('Norte 1 · Sur 6');
    const view = await loadProductStock(db, { accountId, productId: a.productId });
    expect(view!.branches.map((b) => [b.name, b.lines[0].quantity])).toEqual([
      ['Norte', 1],
      ['Sur', 6],
    ]);
  });

  it('una venta Flex sale de la sucursal con Flex; otra baja el total y abre una tarea para elegir la sucursal; la cancelada vuelve a la misma', async () => {
    const a = await product('Bomba BA-1', 5, 'MLA1', false);
    const north = (await saveBranch(db, { accountId, branch: { name: 'Norte' } })).branch;
    const south = (await saveBranch(db, { accountId, branch: { name: 'Sur' } })).branch;
    await saveBranch(db, { accountId, branch: { id: north.id, flex: true } });
    await setProductStock(db, { accountId, productId: a.productId, userId, stock: { '': 3 }, branchId: south.id });
    expect(await branchStock(a.productId)).toEqual({ Norte: 5, Sur: 3 });

    // Flex, leído de Ventas.
    await db.sale.create({ data: { storeId, orderId: '9001', state: 'PAID', orderedAt: new Date(), itemsAmount: 100, shipKind: 'flex', checkedAt: new Date() } });
    await recordOrder(db, { storeId, order: order('9001', 'MLA1', 2) });
    expect(await branchStock(a.productId)).toEqual({ Norte: 3, Sur: 3 });
    // Flex, leído del envío en el canal.
    shipments['55'] = 'self_service';
    await recordOrder(db, { storeId, order: order('9002', 'MLA1', 1, { shipmentId: '55' }) });
    expect(await branchStock(a.productId)).toEqual({ Norte: 2, Sur: 3 });
    expect(await db.task.count()).toBe(0);

    // Otra que no es Flex: baja el total, ninguna sucursal, y una tarea para elegirla.
    shipments['56'] = 'cross_docking';
    await recordOrder(db, { storeId, order: order('9003', 'MLA1', 2, { shipmentId: '56' }) });
    expect(await branchStock(a.productId)).toEqual({ Norte: 2, Sur: 3 });
    expect(await total(a.productId)).toBe(3);
    const task = await db.task.findFirstOrThrow({ select: { title: true, description: true, status: true, assignees: { select: { userId: true } }, publications: { select: { publicationId: true } } } });
    expect(task).toMatchObject({ title: 'Elegir de qué sucursal sale la venta 9003', status: 'PENDING', assignees: [{ userId }], publications: [{ publicationId: a.publicationId }] });
    expect(task.description).toContain('2 unidades de Bomba BA-1');
    expect(await branchStockText(db, a.productId, stockSlots([]))).toBe('Norte 2 · Sur 3 · 2 vendidas sin elegir sucursal');
    expect((await salesWithoutBranch(db, accountId)).map((x) => x.orderId)).toEqual(['9003']);
    // Cargar stock en una sucursal mientras tanto no devuelve lo vendido al total.
    await setProductStock(db, { accountId, productId: a.productId, userId, stock: { '': 4 }, branchId: south.id });
    expect(await total(a.productId)).toBe(4);

    // Se elige Sur: baja Sur, el total queda igual y la tarea se cierra.
    const sale = await db.channelSale.findFirstOrThrow({ where: { orderId: '9003' }, select: { id: true } });
    const r = await assignSaleBranch(db, { accountId, saleId: sale.id, branchId: south.id, userId });
    expect(r.assigned.map((x) => [x.branch, x.part.units])).toEqual([['Sur', 2]]);
    expect(await branchStock(a.productId)).toEqual({ Norte: 2, Sur: 2 });
    expect(await total(a.productId)).toBe(4);
    expect((await db.task.findFirstOrThrow({ select: { status: true } })).status).toBe('DONE');
    await expect(assignSaleBranch(db, { accountId, saleId: sale.id, branchId: south.id, userId })).rejects.toThrow('no tiene nada para elegir');

    // Se cancela antes de entregarse: vuelve a la misma sucursal.
    await recordOrder(db, { storeId, order: order('9003', 'MLA1', 2, { cancelled: true, counts: false }) });
    expect(await branchStock(a.productId)).toEqual({ Norte: 2, Sur: 4 });
    expect(await total(a.productId)).toBe(6);
    const note = await db.stockMovement.findFirst({ where: { productId: a.productId, kind: 'SALE', note: { contains: '9001' } }, select: { note: true } });
    expect(note!.note).toBe('Venta 9001 por Flex');
  });

  it('una venta sin sucursal que se cancela antes de elegirla vuelve solo al total y cierra su tarea', async () => {
    const a = await product('Bomba BA-1', 5, 'MLA1', false);
    await saveBranch(db, { accountId, branch: { name: 'Norte', flex: true } });
    await saveBranch(db, { accountId, branch: { name: 'Sur' } });
    await recordOrder(db, { storeId, order: order('9200', 'MLA1', 1), flex: false });
    expect(await total(a.productId)).toBe(4);
    expect((await db.task.findFirstOrThrow({ select: { status: true } })).status).toBe('PENDING');
    await recordOrder(db, { storeId, order: order('9200', 'MLA1', 1, { cancelled: true, counts: false }) });
    expect(await total(a.productId)).toBe(5);
    expect(await branchStock(a.productId)).toEqual({ Norte: 5 });
    expect((await db.task.findFirstOrThrow({ select: { status: true } })).status).toBe('DONE');
    expect(await salesWithoutBranch(db, accountId)).toEqual([]);
  });

  it('Flex se prende y se apaga solo con el stock de la sucursal con Flex, lo anota, y lo cambiado a mano no lo sigue', async () => {
    const withStock = await product('Bomba BA-1', 2, 'MLA1', false);
    const without = await product('Bomba BA-2', 0, 'MLA2', true);
    const north = (await saveBranch(db, { accountId, branch: { name: 'Norte' } })).branch;
    const south = (await saveBranch(db, { accountId, branch: { name: 'Sur' } })).branch;
    await setProductStock(db, { accountId, productId: without.productId, userId, stock: { '': 5 }, branchId: south.id });
    // Sin Flex en ninguna sucursal, todavía no se tocó nada en el canal.
    expect(flex).toMatchObject({ MLA1: false, MLA2: true });

    // Prender Flex en Norte: la que tiene stock en Norte lo prende; la que solo tiene en Sur lo apaga.
    await saveBranch(db, { accountId, branch: { id: north.id, flex: true } });
    const r = await reconcileFlex(db, { budgetMs: 10_000 });
    expect(r.changed).toEqual(expect.arrayContaining([{ publicationId: withStock.publicationId, on: true }, { publicationId: without.publicationId, on: false }]));
    expect(flex).toMatchObject({ MLA1: true, MLA2: false });
    const log = await db.channelSyncChange.findFirst({ where: { publicationId: withStock.publicationId, field: 'flex' }, select: { kind: true, after: true, message: true } });
    expect(log).toEqual({ kind: 'STATUS_CHANGED', after: true, message: 'Por el stock de las sucursales: Hay stock en Norte.' });

    // Se vende lo último de Norte por Flex: al subir la cantidad nueva, como después de cada venta, se apaga solo.
    await recordOrder(db, { storeId, order: order('9100', 'MLA1', 2), flex: true });
    const { syncStock } = await import('@/lib/stock');
    const s = await syncStock(db, { publicationIds: [withStock.publicationId] });
    expect(s.flex).toEqual([{ publicationId: withStock.publicationId, on: false }]);
    expect(flex.MLA1).toBe(false);
    // Entra mercadería en Norte: se prende solo al cargarla.
    const loaded = await setProductStock(db, { accountId, productId: withStock.productId, userId, stock: { '': 3 }, branchId: north.id });
    expect(loaded.sync.flex).toEqual([{ publicationId: withStock.publicationId, on: true }]);
    expect(flex.MLA1).toBe(true);

    // Una persona lo apaga a mano: deja de seguir al stock hasta volver a seguirlo.
    await setPublicationsFlex(db, { accountId, publicationIds: [withStock.publicationId], on: false, userId });
    expect((await flexPlans(db, [withStock.publicationId])).get(withStock.publicationId)).toMatchObject({ follows: false });
    await reconcileFlex(db, { budgetMs: 10_000 });
    expect(flex.MLA1).toBe(false);
    await setFlexFollowsStock(db, { accountId, publicationIds: [withStock.publicationId], on: true, userId });
    expect(flex.MLA1).toBe(true);

    // Se apaga Flex en Norte: sin sucursales con Flex, se apaga en todas y después se cambia a mano.
    await saveBranch(db, { accountId, branch: { id: north.id, flex: false } });
    const off = await afterBranchFlex(db, { accountId, userId, budgetMs: 10_000 });
    expect(off.changed).toEqual([{ publicationId: withStock.publicationId, on: false }]);
    expect(flex).toMatchObject({ MLA1: false, MLA2: false });
    expect((await flexPlans(db, [withStock.publicationId])).get(withStock.publicationId)).toMatchObject({ follows: false, reason: 'Ninguna sucursal tiene Flex: Flex se cambia a mano.' });
  });

  it('carga en tanda: muchos productos, cada uno en su sucursal, por número de pieza o por el SKU de la medida', async () => {
    const a = await product('Bomba BA-1', 4, 'MLA1', false);
    await db.product.update({ where: { id: a.productId }, data: { partNumber: 'BA 1-00' } });
    const rings = await db.product.create({
      data: {
        accountId,
        name: 'Aros AR-9',
        partNumber: 'AR-9',
        variants: { create: [{ sku: 'AR-9-STD', measure: 'STD', position: 0 }, { sku: 'AR-9-050', measure: '0.50', position: 1 }] },
      },
    });
    // Dos con el mismo código, ninguno publicado: no se puede saber cuál es.
    await db.product.createMany({ data: [{ accountId, name: 'Repetido uno', partNumber: 'DUP-1' }, { accountId, name: 'Repetido dos', partNumber: 'DUP-1' }] });
    const north = (await saveBranch(db, { accountId, branch: { name: 'Norte', flex: true } })).branch;
    await saveBranch(db, { accountId, branch: { name: 'Sur' } });
    const rows = [
      { product: 'ba1-00', branch: 'norte', units: 0 },
      { product: 'BA 1-00', branch: 'Sur', units: 7 },
      { product: 'AR-9-050', branch: 'Norte', units: 3 },
      { product: 'AR-9', branch: 'Sur', measure: 'STD', units: 5 },
      { product: 'AR-9', branch: 'Sur', units: 1 },
      { product: 'NO-EXISTE', branch: 'Sur', units: 1 },
      { product: 'DUP-1', branch: 'Sur', units: 1 },
      { product: 'BA 1-00', units: 1 },
    ];
    // Solo mostrar: dice qué haría y no guarda nada.
    const preview = await setStockBulk(db, { accountId, userId, rows, preview: true });
    expect(preview).toMatchObject({ saved: 4, failed: 4, products: 0, sync: null });
    expect(await branchStock(a.productId)).toEqual({ Norte: 4 });

    const r = await setStockBulk(db, { accountId, userId, rows });
    expect(r.rows.map((x) => [x.row, x.result, x.before ?? null, x.after ?? null])).toEqual([
      [1, 'guardada', 4, 0],
      [2, 'guardada', 0, 7],
      [3, 'guardada', 0, 3],
      [4, 'guardada', 0, 5],
      [5, 'error', null, null],
      [6, 'error', null, null],
      [7, 'error', null, null],
      [8, 'error', null, null],
    ]);
    expect(r.rows[4].message).toContain('El producto tiene medidas: falta la medida.');
    expect(r.rows[5].message).toBe('No hay un producto con ese número de pieza ni con ese SKU.');
    expect(r.rows[6].message).toContain('Hay más de un producto con ese código');
    expect(r.rows[7].message).toContain('Falta la sucursal.');
    expect(r.products).toBe(2);
    expect(await branchStock(a.productId)).toEqual({ Norte: 0, Sur: 7 });
    expect(await total(a.productId)).toBe(7);
    expect(await branchStock(rings.id)).toEqual({ Norte: 3, Sur: 5 });
    expect((await db.product.findUniqueOrThrow({ where: { id: rings.id } })).stockSince).not.toBeNull();
    // Córdoba quedó en 0: Flex no se prende en esa publicación. Cargar lo mismo otra vez no cambia nada.
    expect(flex.MLA1).toBe(false);
    expect((await setStockBulk(db, { accountId, userId, rows: rows.slice(0, 4) })).same).toBe(4);
    // Entra en Norte: una sola revisión de Flex al final lo prende.
    const again = await setStockBulk(db, { accountId, userId, rows: [{ product: 'BA1-00', branch: north.name, units: 2 }] });
    expect(again.sync?.flex).toEqual([{ publicationId: a.publicationId, on: true }]);
    expect(flex.MLA1).toBe(true);
  });

  it('si el canal no deja cambiar Flex, no lo vuelve a intentar igual hasta el día siguiente', async () => {
    const a = await product('Bomba BA-1', 2, 'MLA3', false);
    await saveBranch(db, { accountId, branch: { name: 'Norte', flex: true } });
    refuse = true;
    const first = await reconcileFlex(db, { budgetMs: 10_000 });
    expect(first.failed.map((f) => f.publicationId)).toEqual([a.publicationId]);
    const before = tries;
    const again = await reconcileFlex(db, { budgetMs: 10_000 });
    expect(again.failed).toEqual([]);
    expect(tries).toBe(before);
  });
});
