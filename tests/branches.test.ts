import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { branchOrder, flexWanted, saleSplit, type BranchLike } from '@/domain/branches';
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

const norte: BranchLike = { id: 'norte', name: 'Norte', position: 0, flex: true, main: false };
const sur: BranchLike = { id: 'sur', name: 'Sur', position: 1, flex: false, main: true };

describe('las sucursales sin la base', () => {
  it('la principal va primero', () => {
    expect(branchOrder([norte, sur]).map((b) => b.id)).toEqual(['sur', 'norte']);
  });

  it('una venta Flex sale de la sucursal con Flex, aunque quede en negativo', () => {
    expect(saleSplit([norte, sur], { norte: 3, sur: 10 }, 2, true)).toEqual({ norte: -2 });
    expect(saleSplit([norte, sur], { norte: 0, sur: 10 }, 1, true)).toEqual({ norte: -1 });
  });

  it('las demás salen de la principal y, si no alcanza, de las otras; lo que falta queda en la principal', () => {
    expect(saleSplit([norte, sur], { norte: 3, sur: 10 }, 2, false)).toEqual({ sur: -2 });
    expect(saleSplit([norte, sur], { norte: 3, sur: 1 }, 2, false)).toEqual({ sur: -1, norte: -1 });
    expect(saleSplit([norte, sur], { norte: 1, sur: 0 }, 3, false)).toEqual({ norte: -1, sur: -2 });
    // Sin sucursal con Flex, una venta Flex sale como las demás.
    expect(saleSplit([{ ...norte, flex: false }, sur], { norte: 0, sur: 5 }, 1, true)).toEqual({ sur: -1 });
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
      'TRUNCATE branch_stock, branches, stock_movements, channel_sales, product_stock, channel_sync_changes, channel_copies, sales, channel_connections, publications, products, stores, channels, accounts, users CASCADE',
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
    const user = await db.user.create({ data: { id: 'persona', email: 'persona@ejemplo.com', name: 'Persona' } });
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
    expect(first).toMatchObject({ created: true, tookStock: 1, flexChanged: false, branch: { main: true } });
    const second = await saveBranch(db, { accountId, branch: { name: 'Sur' } });
    expect(second).toMatchObject({ tookStock: 0, branch: { main: false } });
    expect(await branchStock(a.productId)).toEqual({ Norte: 4 });
    await expect(saveBranch(db, { accountId, branch: { name: 'norte' } })).rejects.toThrow('Ya hay una sucursal norte.');
    await expect(saveBranch(db, { accountId, branch: { id: first.branch.id, main: false } })).rejects.toThrow('Tiene que haber una principal');

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

  it('una venta Flex sale de la sucursal con Flex; las demás de la principal; la cancelada vuelve a la misma', async () => {
    const a = await product('Bomba BA-1', 5, 'MLA1', false);
    const north = (await saveBranch(db, { accountId, branch: { name: 'Norte' } })).branch;
    const south = (await saveBranch(db, { accountId, branch: { name: 'Sur', main: true } })).branch;
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
    // Otra que no es Flex: de la principal (Sur) y lo que falta de Norte.
    shipments['56'] = 'cross_docking';
    await recordOrder(db, { storeId, order: order('9003', 'MLA1', 4, { shipmentId: '56' }) });
    expect(await branchStock(a.productId)).toEqual({ Norte: 1, Sur: 0 });
    expect(await total(a.productId)).toBe(1);

    // Se cancela antes de entregarse: vuelve a las mismas.
    await recordOrder(db, { storeId, order: order('9003', 'MLA1', 4, { cancelled: true, counts: false }) });
    expect(await branchStock(a.productId)).toEqual({ Norte: 2, Sur: 3 });
    expect(await total(a.productId)).toBe(5);
    const note = await db.stockMovement.findFirst({ where: { productId: a.productId, kind: 'SALE', note: { contains: '9001' } }, select: { note: true } });
    expect(note!.note).toBe('Venta 9001 por Flex');
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
