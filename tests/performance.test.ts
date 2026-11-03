import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { resetVisitsTogether } from '@/channels/mercadolibre/listings';
import { conversionPct, correctionText, lightOf, LIGHT_RULES } from '@/domain/performance';
import { encrypt } from '@/lib/crypto';
import { loadPerformance, parsePerformanceSearch } from '@/lib/queries/performance';
import { importSoldListings, soldListingsMissing } from '@/lib/sold-listings';

// Rendimiento de publicaciones: el semáforo, la última corrección y las
// publicaciones vendidas que faltaban, con datos de prueba.

describe('el semáforo', () => {
  it('sin ventas mandan las visitas; con ventas, la conversión', () => {
    expect(lightOf(5, 0)).toBe('red');
    expect(lightOf(null, 0)).toBe('red');
    expect(lightOf(10, 0)).toBe('gray');
    expect(lightOf(49, 0)).toBe('gray');
    expect(lightOf(50, 0)).toBe('orange');
    expect(lightOf(200, 1)).toBe('yellow');
    expect(lightOf(100, 1)).toBe('green');
    // Pocas visitas pero vende: manda la conversión.
    expect(lightOf(8, 1)).toBe('green');
    expect(lightOf(0, 1)).toBe('green');
    // Los números se cambian en un solo lugar.
    expect(lightOf(30, 0, { ...LIGHT_RULES, manyVisits: 30 })).toBe('orange');
  });

  it('la conversión con un decimal, y lo que se cambió en palabras', () => {
    expect(conversionPct(12, 2)).toBe(16.7);
    expect(conversionPct(0, 1)).toBeNull();
    expect(conversionPct(null, 0)).toBeNull();
    expect(correctionText(['price', 'title', 'photos'])).toBe('título, fotos y precio');
    expect(correctionText(['description'])).toBe('descripción');
  });

  it('los filtros por defecto', () => {
    expect(parsePerformanceSearch({})).toMatchObject({
      period: 30,
      brand: 'Persan',
      type: 'Subconjunto (pistones + aros)',
      status: 'activas',
      light: 'todas',
      correction: 'todas',
      sort: 'visitas',
      dir: 'desc',
    });
    expect(parsePerformanceSearch({ periodo: '45', orden: 'publicacion' })).toMatchObject({ period: 30, sort: 'publicacion', dir: 'asc' });
  });
});

const url = process.env.TEST_DATABASE_URL;
const NOW = new Date('2026-11-03T15:00:00Z');
const DAY = 24 * 3600_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

describe.skipIf(!url)('rendimiento en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let server: http.Server;
  const asked: string[] = [];
  let accountId = '';
  let storeId = '';
  let productId = '';

  // Lo que tiene el canal: la 0,50 que la app no tiene. MLA1000000003 ya no existe.
  const item = (id: string, sku: string, title: string) => ({
    id,
    seller_id: 7,
    title,
    price: 300000,
    status: 'active',
    permalink: `https://articulo.ejemplo/${id}`,
    listing_type_id: 'gold_special',
    available_quantity: 2,
    sold_quantity: 1,
    pictures: [],
    attributes: [
      { id: 'SELLER_SKU', name: 'SKU', value_name: sku },
      { id: 'BRAND', name: 'Marca', value_name: 'Persan' },
    ],
  });
  const channel: Record<string, unknown> = { MLA1000000002: item('MLA1000000002', 'SP-1-50', 'Subconjunto de prueba 0.50') };

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    server = http.createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      const json = (status: number, body: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      if (req.headers.authorization !== 'Bearer llave') return json(401, {});
      if (u.pathname === '/items/bulk') {
        const ids = (u.searchParams.get('ids') ?? '').split(',');
        asked.push(...ids);
        return json(
          200,
          ids.map((id) => (channel[id] ? { code: 200, body: channel[id] } : { code: 404, body: { message: 'not found' } })),
        );
      }
      const desc = u.pathname.match(/^\/items\/(MLA\d+)\/description$/);
      if (desc) return json(200, { plain_text: 'Descripción de prueba.' });
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
      'TRUNCATE channel_listing_misses, channel_sync_changes, publication_visit_days, sales, sale_readers, import_runs, channel_connections, publications, product_variants, products, stores, channels, accounts, users CASCADE',
    );
    asked.length = 0;
    resetVisitsTogether();
    const ch = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: ch.id, name: 'TIENDA' } });
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
    accountId = account.id;
    storeId = store.id;
    const product = await db.product.create({
      data: {
        accountId,
        name: 'Subconjunto SP-1',
        brand: 'Persan',
        productType: 'Subconjunto (pistones + aros)',
        variants: { create: [{ sku: 'SP-1-00', measure: 'STD', position: 0 }, { sku: 'SP-1-50', measure: '0,50', position: 1 }] },
      },
    });
    productId = product.id;
  });

  const sale = (orderId: string, days: number, state: 'PAID' | 'CANCELLED' | 'PENDING', listingId: string, quantity: number) =>
    db.sale.create({
      data: {
        storeId,
        orderId,
        state,
        orderedAt: ago(days),
        itemsAmount: 1000,
        lines: [{ listingId, variationId: null, sku: null, title: 'Algo', quantity, unitPrice: 1000, listPrice: null, fee: null, publicationId: null, productId: null, key: null, measure: null }],
        checkedAt: NOW,
      },
    });

  it('trae del canal las publicaciones vendidas que faltan y une sus ventas', async () => {
    await db.publication.create({ data: { productId, storeId, externalId: 'MLA1000000001', title: 'Subconjunto de prueba STD', channelStatus: 'ACTIVE' } });
    await sale('O1', 10, 'PAID', 'MLA1000000001', 2);
    await sale('O2', 5, 'PAID', 'MLA1000000002', 1);
    await sale('O3', 6, 'PAID', 'MLA1000000003', 1);
    expect(await soldListingsMissing(db, storeId, NOW)).toEqual(['MLA1000000002', 'MLA1000000003']);

    const r = await importSoldListings(db, { budgetMs: 20_000, now: () => NOW });
    expect(r).toMatchObject({ imported: ['MLA1000000002'], notFound: ['MLA1000000003'], pending: false });
    // La 0,50 entró al mismo producto, por su SKU.
    const p2 = await db.publication.findFirstOrThrow({ where: { externalId: 'MLA1000000002' }, select: { id: true, productId: true, title: true } });
    expect(p2).toMatchObject({ productId, title: 'Subconjunto de prueba 0.50' });
    // Su venta quedó unida a ella.
    const o2 = await db.sale.findFirstOrThrow({ where: { orderId: 'O2' } });
    expect((o2.lines as { publicationId: string | null }[])[0].publicationId).toBe(p2.id);
    // La que el canal no devolvió no se vuelve a pedir enseguida.
    asked.length = 0;
    expect(await soldListingsMissing(db, storeId, NOW)).toEqual([]);
    await importSoldListings(db, { budgetMs: 20_000, now: () => NOW });
    expect(asked).toEqual([]);
    expect(await soldListingsMissing(db, storeId, new Date(NOW.getTime() + 8 * DAY))).toEqual(['MLA1000000003']);
  }, 30_000);

  it('visitas y ventas del período, conversión, semáforo y última corrección', async () => {
    const mk = (externalId: string, title: string, extra: object = {}) =>
      db.publication.create({ data: { productId, storeId, externalId, title, channelStatus: 'ACTIVE', visitsReadAt: NOW, ...extra } });
    const a = await mk('MLA1000000001', 'A vende');
    const b = await mk('MLA1000000002', 'B mucha gente, no vende');
    const c = await mk('MLA1000000004', 'C pausada', { channelStatus: 'PAUSED' });
    const other = await db.product.create({ data: { accountId, name: 'Otro', brand: 'Otra marca', productType: 'Subconjunto (pistones + aros)' } });
    await db.publication.create({ data: { productId: other.id, storeId, externalId: 'MLA1000000009', title: 'De otra marca', channelStatus: 'ACTIVE' } });
    // Visitas por día: 12 en A en el último mes, 80 en B, y 40 de A de hace 50 días.
    const visit = (publicationId: string, days: number, visits: number) =>
      db.publicationVisitDay.create({ data: { publicationId, day: new Date(`${ago(days).toISOString().slice(0, 10)}T00:00:00Z`), visits } });
    await visit(a.id, 1, 7);
    await visit(a.id, 20, 5);
    await visit(a.id, 50, 40);
    await visit(b.id, 3, 80);
    // Ventas: solo las pagadas, del período.
    await sale('O1', 2, 'PAID', 'MLA1000000001', 2);
    await sale('O2', 3, 'CANCELLED', 'MLA1000000001', 5);
    await sale('O3', 4, 'PENDING', 'MLA1000000001', 1);
    await sale('O4', 45, 'PAID', 'MLA1000000001', 1);
    await db.saleReader.create({ data: { storeId, readAt: ago(0.1), historyDoneAt: NOW } });
    // El historial: el título cuenta; la cantidad y lo que llegó del canal no.
    await db.channelSyncChange.createMany({
      data: [
        { publicationId: a.id, field: 'title', kind: 'SENT', createdAt: ago(5) },
        { publicationId: a.id, field: 'price', kind: 'SENT', createdAt: new Date(ago(5).getTime() - 3600_000) },
        { publicationId: a.id, field: 'description', kind: 'SENT', createdAt: ago(9) },
        { publicationId: a.id, field: 'quantity', kind: 'SENT', createdAt: ago(1) },
        { publicationId: a.id, field: 'description', kind: 'TAKEN', createdAt: ago(2) },
        { publicationId: b.id, field: 'quantity', kind: 'SENT', createdAt: ago(1) },
        { publicationId: b.id, field: 'title', kind: 'REJECTED', createdAt: ago(1) },
      ],
    });

    const load = (s: Record<string, string> = {}) => loadPerformance(db, accountId, parsePerformanceSearch(s), NOW);
    const d = await load();
    expect(d.rows.map((r) => [r.externalId, r.visits, r.sales, r.conversion, r.light])).toEqual([
      ['MLA1000000002', 80, 0, 0, 'orange'],
      ['MLA1000000001', 12, 2, 16.7, 'green'],
    ]);
    expect(d.rows[1].lastCorrection).toEqual({ at: ago(5), fields: expect.arrayContaining(['title', 'price']) });
    expect(d.rows[1].lastCorrection?.fields).toHaveLength(2);
    expect(d.rows[0].lastCorrection).toBeNull();
    expect(d.totals).toEqual({ count: 2, visits: 92, sales: 2, conversion: 2.2 });
    expect(d.updatedAt).toEqual(ago(0.1));
    expect(d.options.brands).toEqual(['Otra marca', 'Persan']);

    // 60 días: entran las visitas y la venta de hace 45 y 50 días.
    const d60 = await load({ periodo: '60' });
    expect(d60.rows.find((r) => r.externalId === 'MLA1000000001')).toMatchObject({ visits: 52, sales: 3 });
    // Todas: entra la pausada, sin visitas leídas en el período.
    const all = await load({ estado: 'todas' });
    expect(all.rows.map((r) => r.externalId)).toContain('MLA1000000004');
    expect(all.rows.find((r) => r.id === c.id)).toMatchObject({ visits: 0, light: 'red', channelStatus: 'PAUSED' });
    // Filtros de semáforo y de corrección, y el orden.
    expect((await load({ luz: 'green' })).rows.map((r) => r.externalId)).toEqual(['MLA1000000001']);
    expect((await load({ correccion: '30d' })).rows.map((r) => r.externalId)).toEqual(['MLA1000000001']);
    expect((await load({ correccion: 'sin' })).rows.map((r) => r.externalId)).toEqual(['MLA1000000002']);
    expect((await load({ orden: 'ventas' })).rows.map((r) => r.externalId)).toEqual(['MLA1000000001', 'MLA1000000002']);
    expect((await load({ orden: 'publicacion' })).rows.map((r) => r.externalId)).toEqual(['MLA1000000001', 'MLA1000000002']);
    expect((await load({ marca: 'todas' })).rows.map((r) => r.externalId)).toContain('MLA1000000009');
  });

  it('sin las visitas por día, a 90 días usa el total leído del canal', async () => {
    const p = await db.publication.create({ data: { productId, storeId, externalId: 'MLA1000000001', title: 'Sin días', channelStatus: 'ACTIVE' } });
    await db.measurement.create({ data: { publicationId: p.id, takenAt: ago(1), metrics: { visits_90d: 33 } } });
    expect((await loadPerformance(db, accountId, parsePerformanceSearch({ periodo: '90' }), NOW)).rows[0].visits).toBe(33);
    expect((await loadPerformance(db, accountId, parsePerformanceSearch({ periodo: '30' }), NOW)).rows[0].visits).toBeNull();
  });
});
