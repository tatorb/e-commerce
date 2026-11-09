import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { parseVehicles, parseValues } from '@/channels/mercadolibre/compatibilities';
import {
  auditCompatibilities,
  excludedOf,
  fuelOf,
  isExcluded,
  judgeVehicle,
  lineRule,
  pickByName,
  pickPower,
  pickYears,
  powerOf,
  yearOf,
  type FichaCompatibility,
  type TranslatedLine,
} from '@/domain/compatibilities';
import { auditAccountCompatibilities } from '@/lib/compatibilities';
import { encrypt } from '@/lib/crypto';

// Las compatibilidades con vehículos: las reglas para traducir la ficha, la
// comparación con lo cargado y la auditoría contra un Mercado Libre simulado.
// Los códigos, las publicaciones y lo cargado son inventados.

const ficha = (c: Partial<FichaCompatibility>): FichaCompatibility => ({
  vehicleBrand: null,
  model: null,
  engine: null,
  displacement: null,
  fuel: null,
  power: null,
  excludedVersions: null,
  yearFrom: null,
  yearTo: null,
  note: null,
  ...c,
});

describe('cómo se lee una línea de la ficha', () => {
  it('saca el combustible, la cilindrada y la potencia del motor si no vienen aparte', () => {
    const r = lineRule(ficha({ vehicleBrand: 'Peugeot', model: '308', engine: '1.6 HDi 115 cv', yearFrom: 2012, yearTo: 2019 }), 0);
    expect(r).toMatchObject({ brand: 'Peugeot', models: ['308'], fuel: 'diesel', displacement: '1.6', power: 115, from: 2012, to: 2019, exclude: [] });
    expect(r.label).toBe('Peugeot 308 1.6 HDi 115 cv diésel 115 cv 2012 a 2019');
  });

  it('la potencia y las versiones que no van, del campo o de la nota', () => {
    expect(lineRule(ficha({ vehicleBrand: 'Peugeot', model: '308', fuel: 'Nafta', power: '115' }), 0).power).toBe(115);
    expect(excludedOf({ excludedVersions: 'THP, VTi', note: null })).toEqual(['THP', 'VTi']);
    expect(excludedOf({ excludedVersions: null, note: 'Sirve para el 1.6, no THP. Excepto GTi.' })).toEqual(['THP', 'GTi']);
    // "No sirve" no es una versión.
    expect(excludedOf({ excludedVersions: null, note: 'No sirve para el aspirado.' })).toEqual([]);
  });

  it('varios modelos en una línea, separados por barra o coma', () => {
    expect(lineRule(ficha({ vehicleBrand: 'Peugeot', model: '207 / 307, Partner' }), 0).models).toEqual(['207', '307', 'Partner']);
  });

  it('reconoce combustibles y potencias como los escribe el canal', () => {
    expect(fuelOf('Diésel')).toBe('diesel');
    expect(fuelOf('Gasolina')).toBe('nafta');
    expect(fuelOf('Nafta/GNC')).toBe('gnc');
    expect(fuelOf('1.6')).toBeNull();
    expect(powerOf('115 hp')).toBe(115);
    expect(pickPower([{ id: '1', name: '115 hp' }, { id: '2', name: '165 hp' }, { id: '3', name: '115' }], 115).map((v) => v.id)).toEqual(['1', '3']);
  });

  it('elige del catálogo por nombre, sin importar mayúsculas, acentos ni guiones', () => {
    const brands = [
      { id: '1', name: 'Mercedes-Benz' },
      { id: '2', name: 'Volkswagen' },
    ];
    expect(pickByName(brands, 'Mercedes Benz', { brand: true })?.id).toBe('1');
    expect(pickByName(brands, 'VW', { brand: true })?.id).toBe('2');
    expect(pickByName([{ id: '9', name: '3008' }], '308')).toBeNull();
    expect(pickYears([{ id: 'a', name: '2011' }, { id: 'b', name: '2015' }, { id: 'c', name: '2020' }], 2012, 2019).map((y) => y.year)).toEqual([2015]);
    expect(isExcluded('1.6 THP 165cv GT', ['THP'])).toBe(true);
    expect(isExcluded('1.6 VTi 115cv Active', ['THP'])).toBe(false);
  });
});

describe('lo cargado contra lo que sale de la ficha', () => {
  const amarok: TranslatedLine = {
    rule: lineRule(ficha({ vehicleBrand: 'Volkswagen', model: 'Amarok', engine: '2.0 TDI', yearFrom: 2010, yearTo: 2016 }), 0),
    status: 'ok',
    reason: null,
    brandName: 'Volkswagen',
    modelNames: ['Amarok'],
    groups: [2014, 2015].map((year) => ({
      line: 0,
      brand: 'Volkswagen',
      model: 'Amarok',
      year,
      fuel: 'diesel' as const,
      displacement: '2.0',
      power: null,
      versions: null,
      filters: [],
      label: `Volkswagen Amarok ${year} 2.0 diésel`,
    })),
    notes: [],
  };
  const truck: TranslatedLine = { ...amarok, rule: lineRule(ficha({ vehicleBrand: 'Mercedes Benz', model: '1620' }), 1), status: 'review', reason: 'No está.', brandName: 'Mercedes-Benz', modelNames: [], groups: [] };
  const v = (name: string, extra: Partial<{ byChannel: boolean; total: number }> = {}) => ({ id: 'c', vehicleId: 'v', name, byChannel: false, total: null, ...extra });

  it('un vehículo de otra marca, de otro año o de otra cilindrada sobra, con el motivo', () => {
    expect(judgeVehicle(v('Volkswagen Amarok 2015 2.0 TDI 180cv Highline'), [amarok])).toMatchObject({ kind: 'covered', year: 2015 });
    expect(judgeVehicle(v('Ford Mustang 2024 5.0 V8 GT'), [amarok])).toEqual({ kind: 'extra', reason: 'No sale de la ficha: esa marca y ese modelo no están.' });
    expect(judgeVehicle(v('Volkswagen Amarok 2018 3.0 V6 TDI'), [amarok])).toMatchObject({ kind: 'extra', reason: expect.stringContaining('el año 2018 está fuera') });
    expect(judgeVehicle(v('Volkswagen Amarok 2015 3.0 V6 TDI'), [amarok])).toMatchObject({ kind: 'extra', reason: expect.stringContaining('es 3.0 y la ficha dice 2.0') });
  });

  it('lo que cargó el canal solo trae la marca: se borra a mano si la ficha no la tiene, si no queda a revisar', () => {
    expect(judgeVehicle(v('Toyota', { byChannel: true, total: 2 }), [amarok])).toMatchObject({ kind: 'extra', reason: expect.stringContaining('se borran a mano') });
    expect(judgeVehicle(v('Volkswagen', { byChannel: true, total: 8 }), [amarok])).toMatchObject({ kind: 'review' });
  });

  it('lo que coincide con una línea a revisar no se propone borrar', () => {
    expect(judgeVehicle(v('Mercedes-Benz 1620 1995 OM 366'), [amarok, truck])).toMatchObject({ kind: 'review', reason: expect.stringContaining('a revisar') });
    expect(judgeVehicle(v('Mercedes-Benz Sprinter 2015 415 CDI'), [amarok, truck])).toMatchObject({ kind: 'extra' });
  });

  it('un modelo que parece un año, como el Peugeot 2008, no se toma por el año', () => {
    expect(yearOf('Peugeot 2008 2019 1.6 Allure AR')).toBe(2019);
    expect(yearOf('Peugeot 2008 2019 1.6 Allure AR', '2008')).toBe(2019);
    expect(yearOf('Volkswagen Amarok 2015 2.0 Cd Tdi', 'Amarok')).toBe(2015);
    expect(yearOf('Peugeot 308 2018 1.6 Allure Pack AR')).toBe(2018);
    expect(yearOf('Toyota')).toBeNull();
    const peugeot2008: TranslatedLine = {
      ...amarok,
      rule: lineRule(ficha({ vehicleBrand: 'Peugeot', model: '2008', engine: '1.6', fuel: 'Nafta' }), 2),
      brandName: 'Peugeot',
      modelNames: ['2008'],
      groups: [2019, 2020].map((year) => ({
        line: 2,
        brand: 'Peugeot',
        model: '2008',
        year,
        fuel: 'nafta' as const,
        displacement: '1.6',
        power: null,
        versions: null,
        filters: [],
        label: `Peugeot 2008 ${year} 1.6 nafta`,
      })),
    };
    expect(judgeVehicle(v('Peugeot 2008 2019 1.6 Allure AR'), [peugeot2008])).toMatchObject({ kind: 'covered', year: 2019 });
    const a = auditCompatibilities([peugeot2008], [v('Peugeot 2008 2019 1.6 Allure AR'), v('Peugeot 2008 2020 1.6 Active AR')]);
    expect(a).toMatchObject({ covered: 2, missing: [], extra: [] });
  });

  it('dice qué grupos faltan y qué sobra', () => {
    const a = auditCompatibilities([amarok], [v('Volkswagen Amarok 2015 2.0 TDI 180cv Highline'), v('Ford Mustang 2024 5.0 V8 GT'), v('Toyota', { byChannel: true, total: 2 })]);
    expect(a.covered).toBe(1);
    expect(a.missing.map((g) => g.label)).toEqual(['Volkswagen Amarok 2014 2.0 diésel']);
    expect(a.extra.map((x) => x.vehicle.name)).toEqual(['Ford Mustang 2024 5.0 V8 GT']);
    expect(a.extraByChannel.map((x) => x.vehicle.name)).toEqual(['Toyota']);
  });
});

describe('cómo responde Mercado Libre', () => {
  it('lee las compatibilidades de la tienda y las que cargó Mercado Libre, que vienen solo con la marca', () => {
    expect(
      parseVehicles({
        products: [
          { id: 'c-1', domain_id: 'MLA-CARS_AND_VANS', catalog_product_id: 'MLA900', catalog_product_name: 'Volkswagen Amarok 2015 2.0', source: 'SELLER', note: null },
          { id: null, domain_id: null, catalog_product_id: null, catalog_product_name: 'Toyota', source: 'CATALOGO', reputation: null, total: 2 },
        ],
      }),
    ).toEqual([
      { id: 'c-1', vehicleId: 'MLA900', name: 'Volkswagen Amarok 2015 2.0', byChannel: false, total: null, note: null },
      { id: null, vehicleId: null, name: 'Toyota', byChannel: true, total: 2, note: null },
    ]);
    expect(parseValues([{ id: '60249', name: 'Volkswagen', metric: 10 }, { id: '60249', name: 'Volkswagen' }, { name: 'sin código' }])).toEqual([{ id: '60249', name: 'Volkswagen' }]);
  });
});

// ───────────────────────────── La auditoría contra un Mercado Libre simulado ─────────────────────────────

const url = process.env.TEST_DATABASE_URL;

// Un catálogo de vehículos chico, inventado para la prueba.
type Vehicle = Record<string, [string, string]>;
const car = (brand: [string, string], model: [string, string], year: number, fuel: [string, string], engine: [string, string], power: [string, string], version: [string, string]): Vehicle => ({
  BRAND: brand,
  MODEL: model,
  VEHICLE_YEAR: [`Y${year}`, String(year)],
  FUEL_TYPE: fuel,
  ENGINE: engine,
  POWER: power,
  SHORT_VERSION: version,
});
const VW: [string, string] = ['B1', 'Volkswagen'];
const PEUGEOT: [string, string] = ['B2', 'Peugeot'];
const FORD: [string, string] = ['B3', 'Ford'];
const MB: [string, string] = ['B4', 'Mercedes-Benz'];
const DIESEL: [string, string] = ['F1', 'Diésel'];
const NAFTA: [string, string] = ['F2', 'Nafta'];
const CATALOG: Vehicle[] = [
  ...[2010, 2011, 2012].map((y) => car(VW, ['M1', 'Amarok'], y, DIESEL, ['E1', '2.0'], ['P1', '180 hp'], ['V1', '2.0 TDI 180cv Highline'])),
  car(VW, ['M1', 'Amarok'], 2018, DIESEL, ['E2', '3.0'], ['P2', '224 hp'], ['V2', '3.0 V6 TDI Highline']),
  ...[2013, 2014].flatMap((y) => [
    car(PEUGEOT, ['M2', '308'], y, DIESEL, ['E3', '1.6'], ['P3', '115 hp'], ['V3', '1.6 HDi 115cv Allure']),
    car(PEUGEOT, ['M2', '308'], y, NAFTA, ['E3', '1.6'], ['P3', '115 hp'], ['V4', '1.6 VTi 115cv Active']),
    car(PEUGEOT, ['M2', '308'], y, NAFTA, ['E3', '1.6'], ['P4', '165 hp'], ['V5', '1.6 THP 165cv GT']),
  ]),
  // Un modelo que parece un año.
  ...[2019, 2020].map((y) => car(PEUGEOT, ['M5', '2008'], y, NAFTA, ['E3', '1.6'], ['P3', '115 hp'], ['V8', '1.6 Allure'])),
  car(FORD, ['M3', 'Mustang'], 2024, NAFTA, ['E4', '5.0'], ['P5', '450 hp'], ['V6', '5.0 V8 GT']),
  car(MB, ['M4', 'Sprinter'], 2015, DIESEL, ['E5', '2.1'], ['P6', '163 hp'], ['V7', '415 CDI']),
];

describe.skipIf(!url)('auditar contra Mercado Libre simulado', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let server: http.Server;
  let accountId = '';
  let storeId = '';
  let catalogCalls = 0;
  // Cuánto tarda cada lista del catálogo, para probar el corte por tiempo.
  let catalogDelay = 0;
  // Lo cargado en cada publicación y en cada producto del canal, tal cual lo devuelve Mercado Libre.
  const loaded: Record<string, unknown[]> = {};
  const tags: Record<string, string[]> = {};

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    server = http.createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const send = (status: number, data: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(data));
        const top = u.pathname.match(/^\/catalog_domains\/MLA-CARS_AND_VANS\/attributes\/(\w+)\/top_values$/);
        if (top && req.method === 'POST') {
          catalogCalls++;
          const known = ((raw ? JSON.parse(raw) : {}).known_attributes ?? []) as { id: string; value_id: string }[];
          const values = new Map<string, string>();
          for (const v of CATALOG) if (known.every((k) => v[k.id]?.[0] === k.value_id)) values.set(v[top[1]][0], v[top[1]][1]);
          const body = [...values].map(([id, name]) => ({ id, name, metric: 1 }));
          return catalogDelay > 0 ? void setTimeout(() => send(200, body), catalogDelay) : send(200, body);
        }
        const item = u.pathname.match(/^\/items\/(\w+)$/);
        if (item && item[1] === 'MLA9000099') return res.writeHead(429, { 'Retry-After': '0' }).end('{}');
        if (item) return send(200, { id: item[1], tags: tags[item[1]] ?? [], domain_id: 'MLA-ENGINE_PARTS', user_product_id: null });
        const compat = u.pathname.match(/^\/(items|user-products)\/(\w+)\/compatibilities$/);
        if (compat) return loaded[compat[2]] ? send(200, { products: loaded[compat[2]] }) : send(404, { message: 'not found' });
        if (u.pathname === '/products/search') return send(200, { paging: { total: 0 }, results: [] });
        send(404, {});
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    process.env.MERCADOLIBRE_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    delete process.env.MERCADOLIBRE_API_URL;
    await new Promise((r) => server.close(r));
    await db.$disconnect();
  });

  beforeEach(async () => {
    catalogCalls = 0;
    catalogDelay = 0;
    for (const k of Object.keys(loaded)) delete loaded[k];
    for (const k of Object.keys(tags)) delete tags[k];
    await db.$executeRawUnsafe('TRUNCATE channel_catalog_values, publication_compatibilities, channel_copies, publications, products, channel_connections, stores, channels, accounts, users CASCADE');
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
        expiresAt: new Date(Date.now() + 6 * 3600_000),
      },
    });
  });

  async function product(name: string, compatibilities: Partial<FichaCompatibility>[], brand: string | null = null) {
    return db.product.create({
      data: { accountId, name, brand, compatibilities: { create: compatibilities.map((c, position) => ({ ...ficha(c), position })) } },
    });
  }

  async function pub(productId: string, externalId: string, opts: { main?: string; up?: string } = {}) {
    const p = await db.publication.create({ data: { productId, storeId, externalId, title: `Publicación ${externalId}`, mainOptionId: opts.main ?? null } });
    await db.channelCopy.create({ data: { publicationId: p.id, readAt: new Date(), status: 'ACTIVE', channelProductId: opts.up ?? null } });
    return p;
  }

  it('la Amarok con un Mustang y Toyotas de más: dice qué sale de la ficha, qué falta y qué sobra, y suma la otra opción de venta', async () => {
    const amarok = await product('Subconjunto de prueba Amarok', [{ vehicleBrand: 'Volkswagen', model: 'Amarok', engine: '2.0 TDI', yearFrom: 2010, yearTo: 2016 }]);
    const main = await pub(amarok.id, 'MLA9000001', { up: 'MLAU1' });
    await pub(amarok.id, 'MLA9000002', { main: main.id, up: 'MLAU1' });
    tags.MLA9000001 = ['incomplete_compatibilities'];
    loaded.MLA9000001 = [
      { id: 'c-1', domain_id: 'MLA-CARS_AND_VANS', catalog_product_id: 'MLA800', catalog_product_name: 'Volkswagen Amarok 2011 2.0 TDI 180cv Highline', source: 'SELLER' },
      { id: 'c-2', domain_id: 'MLA-CARS_AND_VANS', catalog_product_id: 'MLA801', catalog_product_name: 'Ford Mustang 2024 5.0 V8 GT', source: 'SELLER' },
      { id: null, domain_id: null, catalog_product_id: null, catalog_product_name: 'Toyota', source: 'CATALOGO', total: 2 },
    ];
    // El producto del canal comparte lo de la principal con la otra opción.
    loaded.MLAU1 = [{ id: 'c-1', domain_id: 'MLA-CARS_AND_VANS', catalog_product_id: 'MLA800', catalog_product_name: 'Volkswagen Amarok 2011 2.0 TDI 180cv Highline', source: 'SELLER' }];

    const r = await auditAccountCompatibilities(db, { accountId, publicationIds: [main.id] });
    expect(r.fichas).toEqual([
      {
        producto: 'Subconjunto de prueba Amarok',
        lineas: [
          {
            linea: 'Volkswagen Amarok 2.0 TDI diésel 2010 a 2016',
            estado: 'traducida',
            grupos: 3,
            ejemplos: ['Volkswagen Amarok 2010 2.0 diésel', 'Volkswagen Amarok 2011 2.0 diésel', 'Volkswagen Amarok 2012 2.0 diésel'],
          },
        ],
      },
    ]);
    expect(r.publicaciones.map((p) => p.publicacion)).toEqual(['MLA9000001', 'MLA9000002']);
    expect(r.publicaciones[0]).toMatchObject({
      aviso_del_canal: true,
      en_el_canal: { en_la_publicacion: 3, en_el_producto: 1, cargadas_por_el_canal: [{ marca: 'Toyota', cantidad: 2 }] },
      salen_de_la_ficha: 1,
      faltan: { cantidad: 2, ejemplos: ['Volkswagen Amarok 2010 2.0 diésel', 'Volkswagen Amarok 2012 2.0 diésel'] },
      sobran: { cantidad: 1, ejemplos: [{ vehiculo: 'Ford Mustang 2024 5.0 V8 GT', motivo: 'No sale de la ficha: esa marca y ese modelo no están.' }] },
      sobran_cargadas_por_el_canal: [{ marca: 'Toyota', cantidad: 2, motivo: expect.stringContaining('se borran a mano') }],
      a_revisar: { cantidad: 0, ejemplos: [] },
    });
    // La otra opción no tiene nada propio, pero el producto del canal sí.
    expect(r.publicaciones[1]).toMatchObject({ en_el_canal: { en_la_publicacion: 0, en_el_producto: 1 }, salen_de_la_ficha: 1, faltan: { cantidad: 2 }, sobran: { cantidad: 0 } });
    // Queda guardado para la subida y los filtros.
    expect(await db.publicationCompatibility.findUniqueOrThrow({ where: { publicationId: main.id } })).toMatchObject({ needed: true, missing: 2, extra: 2, review: 0, noData: false });

    // La segunda vez, las listas del catálogo salen de lo guardado.
    const calls = catalogCalls;
    await auditAccountCompatibilities(db, { accountId, publicationIds: [main.id] });
    expect(catalogCalls).toBe(calls);
  });

  it('filtra por combustible y potencia, y deja afuera las versiones que no van', async () => {
    const kit = await product('Kit de prueba 308', [
      { vehicleBrand: 'Peugeot', model: '308', engine: '1.6 HDi', power: '115 cv' },
      { vehicleBrand: 'Peugeot', model: '308', engine: '1.6', fuel: 'Nafta', note: 'No THP.' },
    ]);
    const p = await pub(kit.id, 'MLA9000010');
    loaded.MLA9000010 = [
      { id: 'c-3', catalog_product_id: 'MLA810', catalog_product_name: 'Peugeot 308 2013 1.6 HDi 115cv Allure', source: 'SELLER' },
      { id: 'c-4', catalog_product_id: 'MLA811', catalog_product_name: 'Peugeot 308 2013 1.6 THP 165cv GT', source: 'SELLER' },
    ];
    const r = await auditAccountCompatibilities(db, { accountId, publicationIds: [p.id] });
    expect(r.fichas[0].lineas).toEqual([
      expect.objectContaining({ estado: 'traducida', grupos: 2, ejemplos: ['Peugeot 308 2013 1.6 diésel 115 cv', 'Peugeot 308 2014 1.6 diésel 115 cv'] }),
      expect.objectContaining({ estado: 'traducida', grupos: 2, ejemplos: ['Peugeot 308 2013 1.6 nafta (1.6 VTi 115cv Active)', 'Peugeot 308 2014 1.6 nafta (1.6 VTi 115cv Active)'] }),
    ]);
    expect(r.publicaciones[0]).toMatchObject({
      salen_de_la_ficha: 1,
      sobran: { cantidad: 1, ejemplos: [{ vehiculo: 'Peugeot 308 2013 1.6 THP 165cv GT', motivo: 'No sale de la ficha: tiene 165 cv y la ficha dice 115 cv.' }] },
    });
    expect(r.publicaciones[0].faltan.ejemplos).toContain('Peugeot 308 2014 1.6 diésel 115 cv');
  });

  it('lo que no se puede traducir queda a revisar, y la ficha sin compatibilidades va aparte', async () => {
    const truck = await product('Subconjunto de prueba 1620', [
      { vehicleBrand: 'Mercedes Benz', model: '1620', engine: 'OM 366 LA', fuel: 'Diésel' },
      { vehicleBrand: 'Mercedes Benz', engine: 'OM 366 A', fuel: 'Diésel' },
      { vehicleBrand: 'Peugeot', model: '308', engine: '1.6' },
    ]);
    const empty = await product('Producto de prueba sin ficha', []);
    const a = await pub(truck.id, 'MLA9000020');
    const b = await pub(empty.id, 'MLA9000021');
    loaded.MLA9000021 = [{ id: 'c-5', catalog_product_id: 'MLA820', catalog_product_name: 'Volkswagen Amarok 2011 2.0', source: 'SELLER' }];
    const r = await auditAccountCompatibilities(db, { accountId, publicationIds: [a.id, b.id] });
    expect(r.fichas[0].lineas.map((l) => [l.estado, l.motivo])).toEqual([
      ['a revisar', 'El modelo 1620 no está en el catálogo de Mercedes-Benz del canal.'],
      ['a revisar', 'Falta el modelo: sin modelo no se sabe con qué vehículos es.'],
      ['a revisar', 'La ficha no dice el combustible y Peugeot 308 tiene más de uno (Diésel, Nafta): completalo en la ficha.'],
    ]);
    expect(r.fichas_sin_compatibilidades).toEqual([{ producto: 'Producto de prueba sin ficha', publicaciones: ['MLA9000021'] }]);
    // Sin ficha no se propone borrar nada.
    expect(r.publicaciones.find((p) => p.publicacion === 'MLA9000021')).toMatchObject({ ficha_sin_compatibilidades: true, sobran: { cantidad: 0 }, en_el_canal: { en_la_publicacion: 1 } });
  });

  it('con poco tiempo, lo que no entra vuelve en quedan', async () => {
    const amarok = await product('Subconjunto de prueba Amarok', [{ vehicleBrand: 'Volkswagen', model: 'Amarok', fuel: 'Diésel' }]);
    const a = await pub(amarok.id, 'MLA9000030');
    const b = await pub(amarok.id, 'MLA9000031');
    const r = await auditAccountCompatibilities(db, { accountId, publicationIds: [a.id, b.id], budgetMs: -1 });
    expect(r.quedan).toEqual(['MLA9000030', 'MLA9000031']);
    expect(r.publicaciones).toEqual([]);
  });

  it('con una ficha larga corta a tiempo, y la vuelta siguiente sigue con lo ya pedido', async () => {
    const kit = await product('Kit de prueba largo', [
      { vehicleBrand: 'Volkswagen', model: 'Amarok', fuel: 'Diésel' },
      { vehicleBrand: 'Peugeot', model: '308', engine: '1.6 HDi' },
      { vehicleBrand: 'Ford', model: 'Mustang', fuel: 'Nafta' },
    ]);
    const p = await pub(kit.id, 'MLA9000060');
    // Cuántas listas hacen falta para la ficha entera.
    await auditAccountCompatibilities(db, { accountId, publicationIds: [p.id] });
    const all = catalogCalls;
    await db.channelCatalogValue.deleteMany();
    catalogCalls = 0;

    // Cada lista tarda 150 ms y hay 200 ms: corta en el medio de la traducción, sin esperar a terminarla.
    catalogDelay = 150;
    const begun = Date.now();
    const r = await auditAccountCompatibilities(db, { accountId, publicationIds: [p.id], budgetMs: 200 });
    // Terminar la primera línea sola lleva 600 ms: corta antes.
    expect(Date.now() - begun).toBeLessThan(550);
    expect(r.quedan).toEqual(['MLA9000060']);
    expect(r.publicaciones).toEqual([]);
    const first = catalogCalls;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(all);

    // Con tiempo, termina pidiendo solo lo que faltaba.
    catalogDelay = 0;
    const r2 = await auditAccountCompatibilities(db, { accountId, publicationIds: [p.id] });
    expect(r2.publicaciones.map((x) => x.publicacion)).toEqual(['MLA9000060']);
    expect(r2.quedan).toEqual([]);
    expect(catalogCalls).toBe(all);
  });

  it('por marca del repuesto, y sin lista sigue donde quedó la vuelta anterior', async () => {
    const persan = await product('Kit de prueba Persan', [{ vehicleBrand: 'Peugeot', model: '2008', engine: '1.6', fuel: 'Nafta' }], 'Persan');
    const other = await product('Kit de prueba de otra marca', [{ vehicleBrand: 'Volkswagen', model: 'Amarok', fuel: 'Diésel' }], 'Otra');
    const a = await pub(persan.id, 'MLA9000070');
    await pub(other.id, 'MLA9000071');
    loaded.MLA9000070 = [2019, 2020].map((y) => ({ id: `c-${y}`, catalog_product_id: `MLA87${y}`, catalog_product_name: `Peugeot 2008 ${y} 1.6 Allure AR`, source: 'SELLER' }));
    const hourAgo = () => new Date(Date.now() - 3_600_000);

    const r = await auditAccountCompatibilities(db, { accountId, brand: 'persan', freshSince: hourAgo() });
    expect(r.publicaciones.map((x) => x.publicacion)).toEqual(['MLA9000070']);
    // El 2008 es el modelo, no el año: lo cargado sale de la ficha y no falta nada.
    expect(r.publicaciones[0]).toMatchObject({ salen_de_la_ficha: 2, faltan: { cantidad: 0 }, sobran: { cantidad: 0 } });

    // La vuelta siguiente sin lista no repite lo auditado.
    expect((await auditAccountCompatibilities(db, { accountId, brand: 'Persan', freshSince: hourAgo() })).publicaciones).toEqual([]);
    // Pedida por su código, se audita igual.
    const listed = await auditAccountCompatibilities(db, { accountId, publicationIds: [a.id], brand: 'Persan' });
    expect(listed.publicaciones.map((x) => x.publicacion)).toEqual(['MLA9000070']);
  });

  it('si el canal pide esperar, lo que falta queda en quedan sin cortar lo hecho', async () => {
    const amarok = await product('Subconjunto de prueba Amarok', [{ vehicleBrand: 'Volkswagen', model: 'Amarok', fuel: 'Diésel' }]);
    const a = await pub(amarok.id, 'MLA9000050');
    const b = await pub(amarok.id, 'MLA9000099');
    const c = await pub(amarok.id, 'MLA9000100');
    const r = await auditAccountCompatibilities(db, { accountId, publicationIds: [a.id, b.id, c.id] });
    // Van varias a la vez: la que el canal frenó queda para después, lo terminado no se pierde.
    const done = r.publicaciones.map((p) => p.publicacion);
    expect(done).toContain('MLA9000050');
    expect(r.quedan).toContain('MLA9000099');
    expect(done).not.toContain('MLA9000099');
    expect([...done, ...r.quedan].sort()).toEqual(['MLA9000050', 'MLA9000099', 'MLA9000100']);
    expect(r.busy).toBe(true);
  });

  it('con mostrar la respuesta, suma lo que respondió el canal y las listas recorridas', async () => {
    const amarok = await product('Subconjunto de prueba Amarok', [{ vehicleBrand: 'VW', model: 'Amarok', fuel: 'Diesel', yearFrom: 2012 }]);
    const p = await pub(amarok.id, 'MLA9000040');
    const r = await auditAccountCompatibilities(db, { accountId, publicationIds: [p.id], raw: true });
    expect(r.publicaciones[0].respuesta_del_canal).toMatchObject({ publicacion: { id: 'MLA9000040' }, compatibilidades_de_la_publicacion: { error: 404 } });
    expect(r.catalogo?.pasos.map((s) => s.lista)).toEqual(['brand', 'model', 'fuel', 'year']);
    expect(r.catalogo?.busqueda_de_vehiculos).toEqual({ paging: { total: 0 }, results: [] });
    // Desde 2012: el 2012 y el 2018.
    expect(r.fichas[0].lineas[0]).toMatchObject({ estado: 'traducida', grupos: 2 });
  });
});
