import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { getChannelResearch } from '@/channels/research';
import { listingIds, parseSearchIds, parseSuggestions, toPagePosition } from '@/channels/mercadolibre/research';
import { autoAvailable, readPosition, readSuggestions, runProbe } from '@/lib/research';

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

  it('pasa el puesto a página y posición, de a 48 por página', () => {
    expect(toPagePosition(1)).toEqual({ page: 1, position: 1 });
    expect(toPagePosition(48)).toEqual({ page: 1, position: 48 });
    expect(toPagePosition(62)).toEqual({ page: 2, position: 14 });
  });
});

describe('leer de Mercado Libre', () => {
  let server: http.Server;
  let requests: string[] = [];
  let blockAfter = Infinity;
  const ids = Array.from({ length: 150 }, (_, i) => `MLA${1000000000 + i}`);

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url!, 'http://x');
      requests.push(u.pathname + u.search);
      if (requests.length > blockAfter) {
        res.writeHead(429).end();
        return;
      }
      if (u.pathname === '/sugerencias') {
        const q = u.searchParams.get('q') ?? '';
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ q, suggested_queries: [{ q: `${q} gol` }, { q: `${q} fiesta` }] }));
      } else if (u.pathname === '/api/sites/MLA/search') {
        const offset = Number(u.searchParams.get('offset') ?? 0);
        const limit = Number(u.searchParams.get('limit') ?? 50);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ results: ids.slice(offset, offset + limit).map((id) => ({ id })) }));
      } else {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html>Verificá que no sos un robot</html>');
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
    blockAfter = Infinity;
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
      expect(await autoAvailable(db, channel)).toEqual({ suggestions: false, positions: false });
      await runProbe(db, channel);
      expect(await autoAvailable(db, channel)).toEqual({ suggestions: true, positions: true });
      expect(await db.channelProbe.count()).toBe(3);
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

    it('lee la posición y la guarda', async () => {
      const r = await readPosition(db, { channel, publicationId, externalId: 'MLA1000000061', query: 'Kit' });
      expect(r).toEqual({ ok: true, page: 2, position: 14 });
      expect(await db.searchPosition.findFirstOrThrow()).toMatchObject({ query: 'kit', page: 2, position: 14, source: 'AUTO' });
    });
  });
});
