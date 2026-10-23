import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getChannelListings } from '@/channels/listings';
import { mercadolibreListings, parseItem, resetVisitsTogether } from '@/channels/mercadolibre/listings';

// Leer las publicaciones propias desde Mercado Libre, contra un Mercado Libre
// simulado. Los datos son de prueba.

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
const ACTIVE = ['MLA1', 'MLA2', 'MLA3'];
const PAUSED = ids('MLP', 250);
const CLOSED = ids('MLC', 1205);

const ITEMS: Record<string, object> = {
  // De otro vendedor.
  MLA8: { id: 'MLA8', seller_id: 99, title: 'Ajena', status: 'active' },
  MLA1: {
    id: 'MLA1',
    seller_id: 7,
    title: 'Kit Embrague Ford Ka 1.6',
    price: 100,
    status: 'active',
    permalink: 'https://articulo.mercadolibre.com.ar/MLA-1-kit',
    sold_quantity: 12,
    category_id: 'MLA373460',
    pictures: [{ secure_url: 'https://foto/1.jpg', url: 'http://foto/1.jpg' }, { url: 'http://foto/2.jpg' }],
    video_id: null,
    health: 0.756,
    attributes: [
      { id: 'BRAND', name: 'Marca', value_name: 'Sachs' },
      { id: 'PART_NUMBER', name: 'Número de pieza', value_name: '3000 951 001' },
      { id: 'SELLER_SKU', name: 'SKU', value_name: 'EMB-001' },
      { id: 'CLUTCH_TYPE', name: 'Tipo de embrague', value_name: 'Monodisco' },
      { id: 'OEM', name: 'Código OEM', value_name: null, values: [{ name: 'AB12' }, { name: 'CD34' }] },
      { id: 'INCLUDES_DISC', name: 'Incluye disco', value_name: null, values: [] },
    ],
  },
  MLA2: {
    id: 'MLA2',
    title: 'Aros de pistón',
    price: 50,
    status: 'paused',
    permalink: 'https://articulo.mercadolibre.com.ar/MLA-2-aros',
    sold_quantity: 0,
    category_id: 'MLA999',
    pictures: [],
    video_id: 'abc',
    health: null,
    attributes: [{ id: 'ORIGIN', name: 'Origen', value_name: 'Brasil' }],
    seller_custom_field: 'AROS',
    variations: [
      {
        id: 1,
        attribute_combinations: [{ id: 'SIZE', name: 'Medida', value_name: 'STD' }],
        attributes: [{ id: 'SELLER_SKU', value_name: 'AROS-STD' }],
        picture_ids: ['F1', 'F3'],
      },
      { id: 2, attribute_combinations: [{ id: 'SIZE', name: 'Medida', value_name: '0.50' }], seller_custom_field: 'AROS-050', picture_ids: ['F2', 'F3'] },
      { id: 3, attribute_combinations: [] },
    ],
  },
};

describe('de Mercado Libre al formato neutro', () => {
  it('separa marca, número de pieza, origen y SKU de los demás datos', () => {
    const l = parseItem(ITEMS.MLA1 as Record<string, unknown>);
    expect(l).toMatchObject({
      externalId: 'MLA1',
      url: 'https://articulo.mercadolibre.com.ar/MLA-1-kit',
      title: 'Kit Embrague Ford Ka 1.6',
      price: 100,
      status: 'ACTIVE',
      sold: 12,
      photos: ['https://foto/1.jpg', 'http://foto/2.jpg'],
      hasVideo: false,
      quality: 76,
      categoryId: 'MLA373460',
      brand: 'Sachs',
      partNumber: '3000 951 001',
      origin: null,
      skus: ['EMB-001'],
      measures: [],
      attributeCount: 5,
    });
    expect(l.attributes).toEqual([
      { id: 'CLUTCH_TYPE', name: 'Tipo de embrague', value: 'Monodisco' },
      // Vino con varios valores: se suben como lista.
      { id: 'OEM', name: 'Código OEM', value: 'AB12, CD34', multiple: true },
    ]);
  });

  it('las variantes dan el SKU y la medida, y cada estado como lo maneja Mercado Libre', () => {
    const l = parseItem(ITEMS.MLA2 as Record<string, unknown>);
    expect(l.status).toBe('PAUSED');
    expect(l.hasVideo).toBe(true);
    expect(l.quality).toBeNull();
    expect(l.skus).toEqual(['AROS', 'AROS-STD', 'AROS-050']);
    expect(l.measures).toEqual([
      { sku: 'AROS-STD', measure: 'STD' },
      { sku: 'AROS-050', measure: '0.50' },
    ]);
    // Cada variante con sus fotos, aunque le falte el SKU o la medida.
    expect(l.variations).toEqual([
      { sku: 'AROS-STD', measure: 'STD', photoIds: ['F1', 'F3'] },
      { sku: 'AROS-050', measure: '0.50', photoIds: ['F2', 'F3'] },
      { sku: null, measure: null, photoIds: [] },
    ]);
    expect(parseItem({ id: 'MLA9', status: 'closed' }).status).toBe('CLOSED');
    expect(parseItem({ id: 'MLA9', status: 'under_review' }).status).toBe('UNDER_REVIEW');
    expect(parseItem({ id: 'MLA9', status: 'inactive' }).status).toBe('INACTIVE');
  });
});

describe('con la cuenta conectada', () => {
  let server: http.Server;
  const paths: string[] = [];
  // Si el Mercado Libre simulado acepta las visitas de varias juntas.
  let visitsTogether = false;
  let busy = false;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      paths.push(u.pathname + u.search);
      const json = (status: number, body: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      if (req.headers.authorization !== 'Bearer llave') return json(401, {});
      if (busy && u.pathname.endsWith('/description')) return json(429, {});

      if (u.pathname === '/users/7/items/search') {
        const status = u.searchParams.get('status');
        const all = status === 'active' ? ACTIVE : status === 'paused' ? PAUSED : status === 'closed' ? CLOSED : [];
        const limit = Number(u.searchParams.get('limit'));
        if (u.searchParams.get('search_type') === 'scan') {
          const from = Number(u.searchParams.get('scroll_id') ?? 0);
          const page = all.slice(from, from + limit);
          return json(200, { scroll_id: String(from + limit), results: page, paging: { total: all.length, limit } });
        }
        const offset = Number(u.searchParams.get('offset') ?? 0);
        // Como Mercado Libre: más allá de 1000 no pagina por posición.
        if (offset + limit > 1000 && all.length > 1000) return json(400, { message: 'use scan' });
        return json(200, { results: all.slice(offset, offset + limit), paging: { total: all.length, offset, limit } });
      }
      if (u.pathname === '/items/bulk') {
        const wanted = (u.searchParams.get('ids') ?? '').split(',');
        return json(
          200,
          wanted.map((id) => (ITEMS[id] ? { code: 200, body: ITEMS[id] } : { code: 404, body: { message: 'not found' } })),
        );
      }
      if (u.pathname === '/items/MLA1/description') return json(200, { plain_text: 'Kit completo.\nIncluye disco.' });
      if (u.pathname === '/items/MLA2/description') return json(404, { message: 'no description' });
      if (u.pathname === '/items/visits' && visitsTogether) {
        expect(u.searchParams.get('date_from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        return json(
          200,
          (u.searchParams.get('ids') ?? '').split(',').map((id) => ({ item_id: id, total_visits: id === 'MLA1' ? 341 : 12 })),
        );
      }
      if (u.pathname === '/items/MLA1/visits/time_window') return json(200, { item_id: 'MLA1', total_visits: 340 });
      if (u.pathname === '/items/MLA2/visits/time_window') return json(403, {});
      if (u.pathname === '/categories/MLA999') return json(200, { id: 'MLA999', name: 'Aros de Pistón' });
      return json(404, {});
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    process.env.MERCADOLIBRE_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
    delete process.env.MERCADOLIBRE_API_URL;
  });

  it('está en la lista de canales', () => {
    expect(getChannelListings('MERCADOLIBRE')).toBe(mercadolibreListings);
  });

  it('cuenta las de cada estado', async () => {
    expect(await mercadolibreListings.countByStatus('llave', '7')).toEqual({ active: 3, paused: 250, closed: 1205 });
  });

  it('lista los códigos de a 100 y, con más de 1000, los recorre', async () => {
    paths.length = 0;
    const found = await mercadolibreListings.listIds('llave', '7', ['active', 'paused']);
    expect(found).toEqual([...ACTIVE, ...PAUSED]);
    expect(paths.filter((p) => p.includes('status=paused'))).toHaveLength(3);

    paths.length = 0;
    const closed = await mercadolibreListings.listIds('llave', '7', ['closed']);
    expect(closed).toEqual(CLOSED);
    expect(paths.filter((p) => p.includes('search_type=scan'))).toHaveLength(13);
  });

  it('lee cada publicación con su descripción, visitas y categoría', async () => {
    paths.length = 0;
    const { listings, missing } = await mercadolibreListings.readListings('llave', '7', ['MLA1', 'MLA2', 'MLA404', 'MLA8']);
    expect(missing).toEqual(['MLA404', 'MLA8']);
    expect(paths.some((p) => p.startsWith('/items/bulk') && p.includes('include_attributes=all'))).toBe(true);
    const [a, b] = listings;
    expect(a).toMatchObject({ externalId: 'MLA1', description: 'Kit completo.\nIncluye disco.', visits90d: 340, categoryName: 'Kits de Embrague' });
    // Lo que falla queda vacío.
    expect(b).toMatchObject({ externalId: 'MLA2', description: null, visits90d: null, categoryName: 'Aros de Pistón' });
    // Las categorías que ya conoce la app no se piden.
    expect(paths.filter((p) => p.startsWith('/categories/'))).toEqual(['/categories/MLA999']);
  });

  it('las visitas de varias van en un solo pedido cuando Mercado Libre lo acepta', async () => {
    resetVisitsTogether();
    visitsTogether = true;
    paths.length = 0;
    const { listings } = await mercadolibreListings.readListings('llave', '7', ['MLA1', 'MLA2']);
    expect(listings.map((l) => l.visits90d)).toEqual([341, 12]);
    expect(paths.filter((p) => p.includes('/visits'))).toHaveLength(1);
    expect(paths.some((p) => p.includes('/visits/time_window'))).toBe(false);
    visitsTogether = false;
    resetVisitsTogether();
  });

  it('una llave que no sirve corta y pide volver a conectar', async () => {
    await expect(mercadolibreListings.readListings('otra', '7', ['MLA1'])).rejects.toMatchObject({ reauth: true });
  });

  it('si Mercado Libre pide esperar, avisa que se puede probar más tarde', async () => {
    busy = true;
    try {
      await expect(mercadolibreListings.readListings('llave', '7', ['MLA1'])).rejects.toMatchObject({ busy: true, reauth: false });
    } finally {
      busy = false;
    }
  }, 20_000);
});
