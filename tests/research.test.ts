import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { getChannelResearch } from '@/channels/research';
import { listingIds, listingPageUrl, parseListingPage, parseSearchIds, parseSearchResults, parseSuggestions, toPagePosition } from '@/channels/mercadolibre/research';
import { autoAvailable, measureSearchPositions, readPosition, readSuggestions, runProbe } from '@/lib/research';
import { encrypt } from '@/lib/crypto';

// Mercado Libre simulado en la computadora: desde las pruebas no se llega al
// real. Datos inventados.

describe('respuestas de Mercado Libre', () => {
  it('lee las sugerencias en la forma conocida y en la estándar', () => {
    expect(parseSuggestions({ q: 'kit', suggested_queries: [{ q: 'Kit  Distribucion' }, { q: 'kit distribucion' }, { q: 'kit embrague' }] })).toEqual([
      'kit distribucion',
      'kit embrague',
    ]);
    expect(parseSuggestions(['kit', ['kit gol', 'kit fiesta']])).toEqual(['kit gol', 'kit fiesta']);
    expect(parseSuggestions({ otra: 'cosa' })).toEqual([]);
  });

  it('lee los códigos de la búsqueda y de la página de resultados', () => {
    expect(parseSearchIds({ results: [{ id: 'MLA1' }, { id: 2 }, { id: 'MLA3' }] })).toEqual(['MLA1', 'MLA3']);
    expect(listingIds('<a href="/MLA-123456789-kit">x</a><a href="/MLA-123456789-kit">y</a> MLA987654321')).toEqual([
      'MLA123456789',
      'MLA987654321',
    ]);
  });

  it('lee los resultados de la búsqueda con su vendedor y su producto del canal', () => {
    expect(parseSearchResults({ results: [{ id: 'mla1', title: 'Kit', seller: { nickname: 'TIENDA' }, user_product_id: 'mlau9' }, { id: 2 }, { title: 'sin código' }] })).toEqual([
      { code: 'MLA1', title: 'Kit', seller: 'TIENDA', productCode: 'MLAU9' },
      { code: '2', title: '', seller: null, productCode: null },
    ]);
  });

  it('lee la página pública de resultados: código, producto, publicidad y título, y reconoce la página anti robots', () => {
    const card = (id: string, pad: boolean, title: string, up = '') =>
      `{"polycard":{"metadata":{"id":"${id}","product_id":"MLA99","is_pad":"${pad}"${up ? `,"user_product_id":"${up}"` : ''},"url":"x"},"components":[{"type":"title","title":{"text":"${title}"}}]}}`;
    const html = `<script>window.__PRELOADED_STATE__={"results":[${card('MLA1110000001', true, 'Subconjunto \\u00d1and\\u00fa')},${card('MLA2220000002', false, 'Otro', 'MLAU9')},${card('MLA1110000001', true, 'Repetido')}]}</script>`;
    expect(parseListingPage(html)).toEqual({
      blocked: false,
      results: [
        { code: 'MLA1110000001', title: 'Subconjunto Ñandú', seller: null, productCode: null, sponsored: true },
        { code: 'MLA2220000002', title: 'Otro', seller: null, productCode: 'MLAU9', sponsored: false },
      ],
    });
    expect(parseListingPage('<html><div id="micro-landing">Verificá que no sos un robot</div></html>')).toEqual({ results: [], blocked: true });
    expect(parseListingPage('<html>Sin resultados</html>')).toEqual({ results: [], blocked: false });
    expect(listingPageUrl('Subconjunto  THP', 1)).toBe('https://listado.mercadolibre.com.ar/subconjunto-thp_NoIndex_True');
    expect(listingPageUrl('pistón 1.6', 49)).toBe('https://listado.mercadolibre.com.ar/pist%C3%B3n-1.6_Desde_49_NoIndex_True');
  });

  it('pasa el puesto a página y posición, de a 48 por página', () => {
    expect(toPagePosition(1)).toEqual({ page: 1, position: 1 });
    expect(toPagePosition(48)).toEqual({ page: 1, position: 48 });
    expect(toPagePosition(62)).toEqual({ page: 2, position: 14 });
  });
});

describe('leer de Mercado Libre', () => {
  let server: http.Server;
  let requests: string[] = [];
  let authorized: string[] = [];
  let blockAfter = Infinity;
  // Como hoy en Mercado Libre: la búsqueda sin cuenta da 403.
  let searchNeedsAccount = false;
  // Como pasa con algunas apps: la búsqueda da 403 aunque vaya con la cuenta.
  let searchClosed = false;
  const ids = Array.from({ length: 150 }, (_, i) => `MLA${1000000000 + i}`);

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url!, 'http://x');
      requests.push(u.pathname + u.search);
      const bearer = req.headers.authorization ?? '';
      if (bearer) authorized.push(u.pathname);
      if (requests.length > blockAfter) {
        res.writeHead(429).end();
        return;
      }
      if (u.pathname === '/sugerencias') {
        const q = u.searchParams.get('q') ?? '';
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ q, suggested_queries: [{ q: `${q} gol` }, { q: `${q} fiesta` }] }));
      } else if (u.pathname === '/api/users/me') {
        res.writeHead(bearer ? 200 : 401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 77, nickname: 'TIENDA' }));
      } else if (u.pathname === '/api/users/77/items/search') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ paging: { total: 3 }, results: ['MLA1'] }));
      } else if (u.pathname === '/api/sites/MLA/search') {
        if (searchClosed || (searchNeedsAccount && !bearer)) {
          res.writeHead(403).end();
          return;
        }
        const offset = Number(u.searchParams.get('offset') ?? 0);
        const limit = Number(u.searchParams.get('limit') ?? 50);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ results: ids.slice(offset, offset + limit).map((id) => ({ id, title: `Kit ${id}`, seller: { nickname: 'OTRO' }, ...(id === 'MLA1000000070' ? { user_product_id: 'MLAU555' } : {}) })) }));
      } else if (u.pathname.startsWith('/listado/kit-gol')) {
        // La página de resultados: 48 por página, la primera con una publicidad arriba.
        const from = Number(/_Desde_(\d+)/.exec(u.pathname)?.[1] ?? 1);
        const cards = ids.slice(from - 1, from - 1 + 48).map((id, i) => `{"metadata":{"id":"${id}","is_pad":"${from === 1 && i === 0}"${id === 'MLA1000000070' ? ',"user_product_id":"MLAU555"' : ''}},"x":{"title":{"text":"Kit ${id}"}}}`);
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(`<script>var s={"results":[${cards.join(',')}]}</script>`);
      } else {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html><div class="micro-landing">Verificá que no sos un robot</div></html>');
      }
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    process.env.MERCADOLIBRE_SUGGEST_URL = `http://127.0.0.1:${port}/sugerencias`;
    process.env.MERCADOLIBRE_API_URL = `http://127.0.0.1:${port}/api`;
    process.env.MERCADOLIBRE_LISTING_URL = `http://127.0.0.1:${port}/listado`;
  });

  beforeEach(() => {
    requests = [];
    authorized = [];
    blockAfter = Infinity;
    searchNeedsAccount = false;
    searchClosed = false;
  });

  afterAll(async () => {
    delete process.env.MERCADOLIBRE_SUGGEST_URL;
    delete process.env.MERCADOLIBRE_API_URL;
    delete process.env.MERCADOLIBRE_LISTING_URL;
    await new Promise((r) => server.close(r));
  });

  const ml = getChannelResearch('MERCADOLIBRE')!;

  it('trae las sugerencias de lo que se escribe', async () => {
    expect(await ml.suggest('kit')).toEqual(['kit gol', 'kit fiesta']);
  });

  it('encuentra la página y la posición recorriendo los resultados', async () => {
    expect(await ml.findPosition('kit', 'MLA1000000061', 3)).toEqual({ page: 2, position: 14 });
    expect(requests.filter((r) => r.startsWith('/api'))).toHaveLength(2);
    // Más allá de la página 3, no aparece.
    expect(await ml.findPosition('kit', 'MLA1000000149', 3)).toBeNull();
  });

  it('la prueba dice qué se puede leer y qué no', async () => {
    const r = await ml.probe();
    expect(r.map((x) => [x.check, x.ok])).toEqual([
      ['suggestions', true],
      ['search_api', true],
      ['search_page', false],
    ]);
    expect(r[2].detail).toContain('anti robots');
  });

  it('si el canal frena, avisa sin romper', async () => {
    blockAfter = 0;
    await expect(ml.suggest('kit')).rejects.toThrow('no dejó leer (código 429)');
  });

  const url = process.env.TEST_DATABASE_URL;
  describe.skipIf(!url)('con la base', () => {
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    let accountId = '';
    let channel = { id: '', kind: 'MERCADOLIBRE' as const };
    let publicationId = '';

    beforeEach(async () => {
      await db.$executeRawUnsafe('TRUNCATE channel_probes, search_suggestions, search_positions, publications, products, stores, channels, accounts CASCADE');
      const ch = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
      channel = { id: ch.id, kind: 'MERCADOLIBRE' };
      accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Prueba' } })).id;
      const store = await db.store.create({ data: { accountId, channelId: ch.id, name: 'TIENDA' } });
      const product = await db.product.create({ data: { accountId, name: 'Kit' } });
      publicationId = (await db.publication.create({ data: { productId: product.id, storeId: store.id, externalId: 'MLA1000000061' } })).id;
    });

    afterAll(async () => {
      await db.$disconnect();
    });

    it('la prueba de conexión habilita lo que salió bien', async () => {
      expect(await autoAvailable(db, channel)).toEqual({ suggestions: false, positions: false, positionsWithAccount: false });
      await runProbe(db, { channel, storeId: null });
      expect(await autoAvailable(db, channel)).toEqual({ suggestions: true, positions: true, positionsWithAccount: false });
      expect(await db.channelProbe.count()).toBe(3);
    });

    it('con la cuenta conectada, prueba la cuenta y lee la posición con ella si la búsqueda pública está cerrada', async () => {
      process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
      searchNeedsAccount = true;
      const store = await db.store.findFirstOrThrow();
      await db.channelConnection.create({
        data: {
          storeId: store.id,
          appId: '1234567890',
          appSecret: encrypt('secreto'),
          appSecretHint: 'reto',
          status: 'ACTIVE',
          externalUserId: '77',
          accessToken: encrypt('acc-1'),
          refreshToken: encrypt('ref-1'),
          expiresAt: new Date(Date.now() + 3 * 3600_000),
        },
      });
      const results = await runProbe(db, { channel, storeId: store.id });
      expect(results.map((r) => [r.check, r.ok])).toEqual([
        ['suggestions', true],
        ['search_api', false],
        ['search_page', false],
        ['connected_user', true],
        ['connected_items', true],
        ['search_connected', true],
      ]);
      expect(results[4].detail).toBe('Se pueden leer: 3 publicaciones.');
      // Sin la tienda, la búsqueda no anda; con la tienda conectada, sí.
      expect(await autoAvailable(db, channel)).toMatchObject({ positions: false });
      expect(await autoAvailable(db, channel, store.id)).toEqual({ suggestions: true, positions: true, positionsWithAccount: true });
      authorized = [];
      const r = await readPosition(db, { channel, storeId: store.id, publicationId, externalId: 'MLA1000000061', query: 'kit' });
      expect(r).toEqual({ ok: true, page: 2, position: 14 });
      expect(authorized.every((p) => p === '/api/sites/MLA/search')).toBe(true);
      expect(authorized.length).toBeGreaterThan(0);
    });

    it('guarda lo leído con fecha y no lo vuelve a pedir', async () => {
      const args = { accountId, channel, publicationId, seed: 'Kit Gol', expand: false };
      expect(await readSuggestions(db, args)).toEqual({ read: 1, cached: 0, empty: 0, error: null });
      expect(await readSuggestions(db, args)).toEqual({ read: 0, cached: 1, empty: 0, error: null });
      expect(requests).toHaveLength(1);
      const saved = await db.searchSuggestion.findFirstOrThrow();
      expect(saved).toMatchObject({ seed: 'kit gol', query: 'kit gol', source: 'AUTO', suggestions: ['kit gol gol', 'kit gol fiesta'] });
    });

    it('al ampliar con letras, si el canal frena para y guarda lo que alcanzó', async () => {
      blockAfter = 3;
      const r = await readSuggestions(db, { accountId, channel, publicationId, seed: 'kit', expand: true });
      expect(r.read).toBe(3);
      expect(r.error).toContain('no dejó leer');
      expect(requests).toHaveLength(4);
      expect((await db.searchSuggestion.findMany({ orderBy: { capturedAt: 'asc' } })).map((s) => s.query)).toEqual(['kit a', 'kit b', 'kit c']);
    });

    it('mide las búsquedas principales con la cuenta conectada, por cualquier código de la medida, y guarda el histórico', async () => {
      process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
      const store = await db.store.findFirstOrThrow();
      await db.channelConnection.create({
        data: { storeId: store.id, appId: '1', appSecret: encrypt('s'), appSecretHint: 's', status: 'ACTIVE', externalUserId: '77', accessToken: encrypt('acc'), refreshToken: encrypt('ref'), expiresAt: new Date(Date.now() + 3 * 3600_000) },
      });
      const pub = await db.publication.findUniqueOrThrow({ where: { id: publicationId } });
      // Otra opción de venta de la misma medida aparece antes que la principal.
      await db.publication.create({ data: { productId: pub.productId, storeId: store.id, externalId: 'MLA1000000030', mainOptionId: publicationId } });
      await db.titleWork.create({ data: { publicationId, mainSearches: ['Kit', 'kit gol'] } });
      await expect(measureSearchPositions(db, { accountId, publicationId: 'otra' })).rejects.toThrow('no está en la cuenta');
      authorized = [];
      const first = await measureSearchPositions(db, { accountId, publicationId });
      expect(first.codes.sort()).toEqual(['MLA1000000030', 'MLA1000000061']);
      expect(first.searches[0]).toMatchObject({ query: 'kit', found: { page: 1, position: 31, code: 'MLA1000000030', organic: true }, before: null, error: null });
      expect(first.searches[0].top.map((t) => t.code)).toEqual(ids.slice(0, 5));
      expect(first.searches[0].top[0]).toMatchObject({ title: 'Kit MLA1000000000', seller: 'OTRO' });
      expect(authorized.length).toBeGreaterThan(0);
      const saved = await db.searchPosition.findFirstOrThrow({ where: { query: 'kit' } });
      expect(saved).toMatchObject({ page: 1, position: 31, matchedCode: 'MLA1000000030', organic: true, source: 'AUTO' });
      expect((saved.top as unknown[]).length).toBe(5);

      // Por el código del producto del canal, y con la medición anterior para comparar.
      await db.publication.deleteMany({ where: { externalId: 'MLA1000000030' } });
      // Su propio código no está en la búsqueda: aparece por el del producto.
      await db.publication.update({ where: { id: publicationId }, data: { externalId: 'MLA9999999999' } });
      await db.channelCopy.create({ data: { publicationId, readAt: new Date(), status: 'ACTIVE', channelProductId: 'MLAU555' } });
      const second = await measureSearchPositions(db, { accountId, publicationId, queries: ['kit'] });
      expect(second.searches[0]).toMatchObject({ found: { page: 2, position: 23, code: 'MLAU555' }, before: { page: 1, position: 31 } });
      expect(await db.searchPosition.count({ where: { publicationId, query: 'kit' } })).toBe(2);

      // La API no deja buscar ni con la cuenta: lee la página pública. Si muestra la página
      // anti robots, lo dice en esa búsqueda y sigue con las demás.
      searchClosed = true;
      const third = await measureSearchPositions(db, { accountId, publicationId, queries: ['kit', 'kit gol'] });
      expect(third.searches[0]).toMatchObject({ query: 'kit', found: null, source: null });
      expect(third.searches[0].error).toContain('anti robots');
      expect(third.searches[1]).toMatchObject({ query: 'kit gol', source: 'listado', found: { page: 2, position: 23, code: 'MLAU555', organic: true }, error: null });
      expect(third.searches[1].top[0]).toMatchObject({ code: 'MLA1000000000', sponsored: true });
    });

    it('lee la posición y la guarda', async () => {
      const r = await readPosition(db, { channel, publicationId, externalId: 'MLA1000000061', query: 'Kit' });
      expect(r).toEqual({ ok: true, page: 2, position: 14 });
      expect(await db.searchPosition.findFirstOrThrow()).toMatchObject({ query: 'kit', page: 2, position: 14, source: 'AUTO' });
    });
  });
});
