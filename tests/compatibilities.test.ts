import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { familyBody, parseVehicles, parseValues, writeRejection } from '@/channels/mercadolibre/compatibilities';
import { MercadoLibreRequestError } from '@/channels/mercadolibre/http';
import {
  auditCompatibilities,
  excludedOf,
  fuelOf,
  groupByModel,
  isExcluded,
  judgeVehicle,
  lineRule,
  pickByName,
  pickPower,
  pickYears,
  powerOf,
  splitVehicleName,
  yearOf,
  type FichaCompatibility,
  type TranslatedLine,
} from '@/domain/compatibilities';
import { auditAccountCompatibilities } from '@/lib/compatibilities';
import { listCompatibilitiesToPush, pushCompatibilities } from '@/lib/compatibility-push';
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

  it('"S/aa" es sin aire: no es la versión S que la ficha deja afuera', () => {
    const ecosport: TranslatedLine = {
      ...amarok,
      rule: lineRule(ficha({ vehicleBrand: 'Ford', model: 'Ecosport', engine: '1.6 8v Rocam', fuel: 'Nafta', excludedVersions: 'S, Se, Titanium', yearTo: 2012 }), 3),
      brandName: 'Ford',
      modelNames: ['Ecosport'],
    };
    expect(judgeVehicle(v('Ford Ecosport 2010 1.6 My10 Xls 4x2 S/aa AR'), [ecosport])).toMatchObject({ kind: 'covered', year: 2010 });
    expect(judgeVehicle(v('Ford Ecosport 2011 1.6 Xl Plus C/aa AR'), [ecosport])).toMatchObject({ kind: 'covered' });
    expect(judgeVehicle(v('Ford Ecosport 2010 1.6 S 4x2 AR'), [ecosport])).toMatchObject({ kind: 'extra', reason: expect.stringContaining('deja afuera (S)') });
    expect(isExcluded('Xls S/aa', ['S'])).toBe(false);
    expect(isExcluded('S C/aa', ['S'])).toBe(true);
  });

  it('una versión GNC de fábrica va en la línea de nafta, salvo que la ficha diga que no va', () => {
    const fire = (excludedVersions: string | null): TranslatedLine => ({
      ...amarok,
      rule: lineRule(ficha({ vehicleBrand: 'Fiat', model: 'Siena', engine: '1.3 8v Fire', fuel: 'Nafta', excludedVersions }), 4),
      brandName: 'Fiat',
      modelNames: ['Siena'],
    });
    expect(judgeVehicle(v('Fiat Siena 2006 1.3 Fire Suite Gnc AR'), [fire(null)])).toMatchObject({ kind: 'covered', year: 2006 });
    expect(judgeVehicle(v('Fiat Siena 2006 1.3 Fire Suite Gnc AR'), [fire('Gnc')])).toMatchObject({ kind: 'extra', reason: expect.stringContaining('deja afuera (Gnc)') });
    expect(judgeVehicle(v('Fiat Siena 2006 1.3 Jtd AR'), [fire(null)])).toMatchObject({ kind: 'extra', reason: expect.stringContaining('es diésel') });
  });

  it('lo cargado se agrupa por marca y modelo, con años, cuentas y motivos sin repetir', () => {
    expect(splitVehicleName('Chevrolet Corsa Classic 2003 1.7 D Gls AR')).toEqual({ model: 'Chevrolet Corsa Classic', year: 2003, rest: '1.7 D Gls' });
    expect(splitVehicleName('Peugeot 2008 2019 1.6 Allure AR')).toEqual({ model: 'Peugeot 2008', year: 2019, rest: '1.6 Allure' });
    expect(splitVehicleName('Toyota')).toEqual({ model: 'Toyota', year: null, rest: '' });
    const groups = groupByModel([
      { name: 'Chevrolet Cruze 2019 1.8 Lt Mt AR', mark: 'extra', reason: 'No sale de la ficha: el año 2019 está fuera de la ficha (hasta 2016).' },
      { name: 'Chevrolet Cruze 2015 1.8 Lt AR', mark: 'covered' },
      { name: 'Chevrolet Cruze 2020 1.8 Ltz AR', mark: 'extra', reason: 'No sale de la ficha: el año 2020 está fuera de la ficha (hasta 2016).' },
      { name: 'Chevrolet Astra 1998 1.7 Gls AR', mark: 'review', reason: 'Coincide con una línea a revisar.' },
    ]);
    expect(groups.map((g) => g.model)).toEqual(['Chevrolet Astra', 'Chevrolet Cruze']);
    expect(groups[1]).toMatchObject({ total: 3, covered: 1, extra: 2, review: 0, from: 2015, to: 2020, reasons: ['el año está fuera de la ficha (hasta 2016).'] });
    expect(groups[1].vehicles.map((v) => v.year)).toEqual([2015, 2019, 2020]);
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

  it('con el número del catálogo, un grupo con menos vehículos cargados queda incompleto', () => {
    // La ficha da 2014 y 2015: del 2014 hay uno de 3, del 2015 los dos que tiene el catálogo.
    const loadedOnes = [v('Volkswagen Amarok 2014 2.0 TDI 180cv Highline'), v('Volkswagen Amarok 2015 2.0 TDI 180cv Highline'), v('Volkswagen Amarok 2015 2.0 TDI 140cv Trendline')];
    const a = auditCompatibilities([amarok], loadedOnes, new Map([['0|2014|2.0', 3], ['0|2015|2.0', 2]]));
    expect(a.missing).toEqual([]);
    expect(a.incomplete).toEqual([expect.objectContaining({ loaded: 1, expected: 3, label: 'Volkswagen Amarok 2014 2.0 diésel: hay 1 de 3' })]);
    // Sin el número, no se juzga.
    expect(auditCompatibilities([amarok], loadedOnes).incomplete).toEqual([]);
  });

  it('un grupo sin nada cargado, en el que el catálogo no tiene nada para cargar, no falta', () => {
    const a = auditCompatibilities([amarok], [v('Volkswagen Amarok 2015 2.0 TDI 180cv Highline')], new Map([['0|2014|2.0', 0], ['0|2015|2.0', 1]]));
    expect(a.missing).toEqual([]);
    expect(a.incomplete).toEqual([]);
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

describe('lo que se manda a Mercado Libre', () => {
  it('un grupo con varias versiones las manda juntas, con el origen que pide el canal', () => {
    expect(
      familyBody('MLA', [
        { field: 'brand', id: '60279' },
        { field: 'model', id: '9301' },
        { field: 'year', id: '436662' },
        { field: 'version', id: 'V1' },
        { field: 'version', id: 'V2' },
      ]),
    ).toEqual({
      domain_id: 'MLA-CARS_AND_VANS',
      creation_source: 'DEFAULT',
      attributes: [
        { id: 'BRAND', value_id: '60279' },
        { id: 'MODEL', value_id: '9301' },
        { id: 'VEHICLE_YEAR', value_id: '436662' },
        { id: 'SHORT_VERSION', value_ids: ['V1', 'V2'] },
      ],
    });
  });

  it('el rechazo dice el motivo de Mercado Libre y su respuesta', () => {
    const body = { message: 'Invalid', cause: [{ type: 'warning', message: 'Solo un aviso' }, { type: 'error', message: 'Se especificaron más de 10 dominios.' }] };
    expect(writeRejection(new MercadoLibreRequestError('x', 400, body))).toBe(
      `Mercado Libre no aceptó las compatibilidades: Se especificaron más de 10 dominios. Respuesta completa: ${JSON.stringify(body)}`,
    );
    expect(writeRejection(new MercadoLibreRequestError('x', 403, null))).toContain('no deja cambiar');
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
  // Un grupo con dos versiones, para probar los grupos incompletos.
  car(VW, ['M6', 'Saveiro'], 2015, NAFTA, ['E6', '1.6'], ['P8', '101 hp'], ['V10', '1.6 Cross']),
  car(VW, ['M6', 'Saveiro'], 2015, NAFTA, ['E6', '1.6'], ['P8', '101 hp'], ['V11', '1.6 Trendline']),
  // Un modelo que parece un año.
  ...[2019, 2020].map((y) => car(PEUGEOT, ['M5', '2008'], y, NAFTA, ['E3', '1.6'], ['P3', '115 hp'], ['V8', '1.6 Allure'])),
  // Un grupo donde el catálogo tiene con motor 1.6 un vehículo que se llama 1.2.
  car(PEUGEOT, ['M7', '208'], 2022, NAFTA, ['E3', '1.6'], ['P3', '115 hp'], ['V20', '1.6 Allure']),
  car(PEUGEOT, ['M7', '208'], 2022, NAFTA, ['E3', '1.6'], ['P3', '115 hp'], ['V21', '1.6 Active']),
  car(PEUGEOT, ['M7', '208'], 2022, NAFTA, ['E3', '1.6'], ['P9', '130 hp'], ['V22', '1.2 Gt']),
  // Un grupo donde todo lo que tiene el catálogo no sale de la ficha.
  car(PEUGEOT, ['M8', 'Partner'], 2018, NAFTA, ['E3', '1.6'], ['P3', '115 hp'], ['V30', '1.2 Confort']),
  // Un grupo donde el catálogo cuenta un vehículo que el canal no carga al mandar el grupo.
  car(FORD, ['M9', 'Ka'], 2020, NAFTA, ['E8', '1.5'], ['P10', '105 hp'], ['V31', '1.5 S']),
  { ...car(FORD, ['M9', 'Ka'], 2020, NAFTA, ['E8', '1.5'], ['P10', '105 hp'], ['V32', '1.5 Se']), NOADD: ['1', '1'] },
  // Un grupo cuyo único vehículo es turbo, aunque la versión corta no lo diga: sobra en una ficha y va en otra.
  { ...car(['B5', 'Citroën'], ['M10', 'BX'], 1990, DIESEL, ['E9', '1.9'], ['P11', '90 hp'], ['V40', 'Tzd']), NAME: ['n', 'Citroën BX 1990 1.9 Tzd Turbo'] },
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
  // El producto de usuario de cada publicación: lo cargado ahí lo comparten sus opciones de venta.
  const upOf: Record<string, string> = {};
  // Lo que se mandó a cada publicación, en orden.
  const writes: {
    item: string;
    path: string;
    body: {
      domain_id?: string;
      category_id?: string;
      create?: { products_families: { attributes: { id: string; value_id?: string; value_ids?: string[] }[] }[] };
      delete?: { products: { id: string }[] };
    };
  }[] = [];
  // Un grupo que el canal no acepta: el año que tenga este código.
  let rejectYear: string | null = null;

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
        if (u.pathname === '/catalog_compatibilities/products_search/count_family_products' && req.method === 'POST') {
          const attrs = (JSON.parse(raw) as { attributes: { id: string; value_id?: string; value_ids?: string[] }[] }).attributes;
          return send(200, { count: CATALOG.filter((v) => attrs.every((a) => (a.value_ids ?? [a.value_id]).includes(v[a.id]?.[0]))).length });
        }
        const item = u.pathname.match(/^\/items\/(\w+)$/);
        if (item && item[1] === 'MLA9000099') return res.writeHead(429, { 'Retry-After': '0' }).end('{}');
        if (item) return send(200, { id: item[1], tags: tags[item[1]] ?? [], domain_id: 'MLA-ENGINE_PARTS', category_id: 'MLA373289', user_product_id: upOf[item[1]] ?? null });
        const compat = u.pathname.match(/^\/(items|user-products)\/(\w+)\/compatibilities$/);
        // Lo de una publicación con producto de usuario vive en el producto.
        const listOf = (id: string) => (compat?.[1] === 'items' && upOf[id] ? upOf[id] : id);
        if (compat && req.method === 'PUT') {
          const body = JSON.parse(raw) as (typeof writes)[number]['body'];
          // Como Mercado Libre: con producto de usuario, en la publicación no acepta cambios.
          if (compat[1] === 'items' && upOf[compat[2]]) {
            return send(400, {
              error: 'bad_request',
              message: `This Item ${compat[2]} has User Product compatibilities. Use the corresponding User Product resources.`,
              status: 400,
            });
          }
          const families = body.create?.products_families ?? [];
          const year = (f: (typeof families)[number]) => f.attributes.find((a) => a.id === 'VEHICLE_YEAR')?.value_id;
          if (rejectYear && families.some((f) => year(f) === rejectYear)) {
            return send(400, { message: 'Invalid compatibilities', error: 'bad_request', cause: [{ type: 'error', code: 'invalid.family', message: 'El grupo no tiene vehículos para esta categoría.' }] });
          }
          writes.push({ item: compat[2], path: compat[1], body });
          const key = listOf(compat[2]);
          const gone = new Set((body.delete?.products ?? []).map((p) => p.id));
          const list = (loaded[key] ?? []).filter((v) => !gone.has((v as { catalog_product_id?: string }).catalog_product_id ?? ''));
          for (const f of families) {
            for (const [i, v] of CATALOG.entries()) {
              const fits = f.attributes.every((a) => (a.value_ids ?? [a.value_id]).includes(v[a.id]?.[0]));
              const id = `MLA7${i}`;
              if (fits && !v.NOADD && !list.some((x) => (x as { catalog_product_id?: string }).catalog_product_id === id)) {
                const name = v.NAME?.[1] ?? `${v.BRAND[1]} ${v.MODEL[1]} ${v.VEHICLE_YEAR[1]} ${v.SHORT_VERSION[1]}`;
                list.push({ id: `c-new-${i}`, catalog_product_id: id, catalog_product_name: name, source: 'SELLER' });
              }
            }
          }
          loaded[key] = list;
          return send(200, { create: body.create ?? null, delete: body.delete ?? null });
        }
        if (compat) {
          const key = listOf(compat[2]);
          return loaded[key] ? send(200, { products: loaded[key] }) : send(404, { message: 'not found' });
        }
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
    for (const k of Object.keys(upOf)) delete upOf[k];
    writes.length = 0;
    rejectYear = null;
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
  // ───────────────────────────── La subida ─────────────────────────────

  // La Amarok de la ficha, con dos opciones de venta que comparten el producto de usuario MLAU1.
  async function amarokWithExtras() {
    const amarok = await product('Subconjunto de prueba Amarok', [{ vehicleBrand: 'Volkswagen', model: 'Amarok', engine: '2.0 TDI', yearFrom: 2010, yearTo: 2016 }]);
    const main = await pub(amarok.id, 'MLA9000201', { up: 'MLAU1' });
    const option = await pub(amarok.id, 'MLA9000202', { main: main.id, up: 'MLAU1' });
    upOf.MLA9000201 = 'MLAU1';
    upOf.MLA9000202 = 'MLAU1';
    loaded.MLAU1 = [
      { id: 'c-1', catalog_product_id: 'MLA71', catalog_product_name: 'Volkswagen Amarok 2011 2.0 TDI 180cv Highline', source: 'SELLER' },
      { id: 'c-2', catalog_product_id: 'MLA801', catalog_product_name: 'Ford Mustang 2024 5.0 V8 GT', source: 'SELLER' },
      { id: null, catalog_product_id: null, catalog_product_name: 'Toyota', source: 'CATALOGO', total: 2 },
    ];
    await auditAccountCompatibilities(db, { accountId, publicationIds: [main.id] });
    return { amarok, main, option };
  }

  it('Por subir muestra lo que falta y lo que sobra una vez por producto de usuario, y la subida agrega y borra en la misma subida', async () => {
    const { main, option } = await amarokWithExtras();
    const rows = await listCompatibilitiesToPush(db, accountId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      codes: ['MLA9000201', 'MLA9000202'],
      add: { count: 2, examples: ['Volkswagen Amarok 2010 2.0 diésel', 'Volkswagen Amarok 2012 2.0 diésel'] },
      remove: { count: 1, examples: [{ vehicle: 'Ford Mustang 2024 5.0 V8 GT' }] },
      byChannel: [{ brand: 'Toyota', count: 2 }],
      blocked: null,
    });

    const r = await pushCompatibilities(db, { accountId, publicationIds: [option.id] });
    expect(r.quedan).toEqual([]);
    expect(r.subidas).toEqual([
      expect.objectContaining({
        publicaciones: ['MLA9000201', 'MLA9000202'],
        resultado: 'subido',
        agregados: { grupos: 2, ejemplos: ['Volkswagen Amarok 2010 2.0 diésel', 'Volkswagen Amarok 2012 2.0 diésel'] },
        borrados: { cantidad: 1, ejemplos: ['Ford Mustang 2024 5.0 V8 GT'] },
        // Lo que cargó el canal no se puede borrar desde la app: sigue sobrando.
        despues: { faltan: 0, incompletos: 0, sobran: 1, a_revisar: 0 },
      }),
    ]);
    // Se mandó una vez, al producto de usuario que comparten: primero el borrado, después los grupos, con el origen que pide el canal.
    expect(writes.map((w) => `${w.path}/${w.item}`)).toEqual(['user-products/MLAU1', 'user-products/MLAU1']);
    expect(writes[0].body).toEqual({ domain_id: 'MLA-CARS_AND_VANS', category_id: 'MLA373289', delete: { products: [{ id: 'MLA801' }] } });
    expect(writes[1].body.create?.products_families).toHaveLength(2);
    expect(writes[1].body.create?.products_families[0]).toMatchObject({ domain_id: 'MLA-CARS_AND_VANS', creation_source: 'DEFAULT' });
    // Queda guardado cómo quedó, en las dos opciones, y ya no hay nada por subir.
    expect(await db.publicationCompatibility.findUniqueOrThrow({ where: { publicationId: main.id } })).toMatchObject({ missing: 0, extra: 1 });
    expect(await listCompatibilitiesToPush(db, accountId)).toEqual([]);
  });

  it('manda solo lo que se mostró y sigue haciendo falta', async () => {
    const { amarok } = await amarokWithExtras();
    // Después de la auditoría, alguien cargó el 2010 a mano en el canal.
    loaded.MLAU1.push({ id: 'c-3', catalog_product_id: 'MLA70', catalog_product_name: 'Volkswagen Amarok 2010 2.0 TDI 180cv Highline', source: 'SELLER' });
    const r = await pushCompatibilities(db, { accountId });
    expect(r.subidas[0]).toMatchObject({ resultado: 'subido', agregados: { grupos: 1, ejemplos: ['Volkswagen Amarok 2012 2.0 diésel'] }, borrados: { cantidad: 1 } });

    // Si la ficha cambió después de la auditoría, no se manda nada: hay que mirar lo nuevo antes.
    await auditAccountCompatibilities(db, { accountId });
    loaded.MLAU1.push({ id: 'c-4', catalog_product_id: 'MLA802', catalog_product_name: 'Ford Mustang 2024 5.0 V8 GT Convertible', source: 'SELLER' });
    await auditAccountCompatibilities(db, { accountId });
    await db.compatibility.create({ data: { productId: amarok.id, position: 1, vehicleBrand: 'Peugeot', model: '308', engine: '1.6 HDi' } });
    const sent = writes.length;
    const again = await pushCompatibilities(db, { accountId });
    expect(again.subidas[0]).toMatchObject({ resultado: 'salteada', motivo: expect.stringContaining('La ficha cambió') });
    expect(writes.length).toBe(sent);
  });

  it('si el canal no acepta un grupo, dice cuál y por qué, y sube los demás', async () => {
    await amarokWithExtras();
    rejectYear = 'Y2012';
    const r = await pushCompatibilities(db, { accountId });
    expect(r.subidas[0]).toMatchObject({
      resultado: 'en parte',
      agregados: { grupos: 1, ejemplos: ['Volkswagen Amarok 2010 2.0 diésel'] },
      borrados: { cantidad: 1 },
      rechazos: [expect.stringContaining('Mercado Libre no aceptó las compatibilidades: El grupo no tiene vehículos para esta categoría.')],
      despues: { faltan: 1 },
    });
  });

  it('en una familia sube cada medida por su lado, aunque se pida una sola', async () => {
    const kit = await product('Subconjunto de prueba Amarok en familia', [{ vehicleBrand: 'Volkswagen', model: 'Amarok', engine: '2.0 TDI', yearFrom: 2010, yearTo: 2012 }]);
    const std = await pub(kit.id, 'MLA9000301', { up: 'MLAU31' });
    const half = await pub(kit.id, 'MLA9000302', { up: 'MLAU32' });
    upOf.MLA9000301 = 'MLAU31';
    upOf.MLA9000302 = 'MLAU32';
    await db.listingFamily.create({ data: { storeId, productId: kit.id, channelFamilyId: 'FAM-1', leadId: std.id, members: { connect: [{ id: std.id }, { id: half.id }] } } });
    await auditAccountCompatibilities(db, { accountId, publicationIds: [std.id] });
    const r = await pushCompatibilities(db, { accountId, publicationIds: [half.id] });
    expect(r.subidas.map((x) => [x.publicaciones, x.resultado, x.agregados.grupos])).toEqual([
      [['MLA9000301'], 'subido', 3],
      [['MLA9000302'], 'subido', 3],
    ]);
    expect(new Set(writes.map((w) => w.item))).toEqual(new Set(['MLAU31', 'MLAU32']));
  });

  it('un grupo con algún vehículo cargado pero no todos queda incompleto, y la subida lo completa', async () => {
    const kit = await product('Kit de prueba Saveiro', [{ vehicleBrand: 'Volkswagen', model: 'Saveiro', engine: '1.6', fuel: 'Nafta' }]);
    const p = await pub(kit.id, 'MLA9000601', { up: 'MLAU6' });
    upOf.MLA9000601 = 'MLAU6';
    // Cargado a mano: una de las dos versiones del catálogo.
    loaded.MLAU6 = [{ id: 'c-60', catalog_product_id: 'MLA710', catalog_product_name: 'Volkswagen Saveiro 2015 1.6 Cross', source: 'SELLER' }];
    const r = await auditAccountCompatibilities(db, { accountId, publicationIds: [p.id] });
    expect(r.publicaciones[0]).toMatchObject({ faltan: { cantidad: 0 }, incompletos: { cantidad: 1, ejemplos: ['Volkswagen Saveiro 2015 1.6 nafta: hay 1 de 2'] } });
    expect(await db.publicationCompatibility.findUniqueOrThrow({ where: { publicationId: p.id } })).toMatchObject({ missing: 1 });
    const rows = await listCompatibilitiesToPush(db, accountId);
    expect(rows[0]).toMatchObject({ add: { count: 0 }, complete: { count: 1, examples: ['Volkswagen Saveiro 2015 1.6 nafta: hay 1 de 2'] } });

    const pushed = await pushCompatibilities(db, { accountId });
    expect(pushed.subidas[0]).toMatchObject({ resultado: 'subido', agregados: { grupos: 1 }, despues: { faltan: 0, incompletos: 0 } });
    expect(loaded.MLAU6).toHaveLength(2);
    // Los números del catálogo quedan guardados: la próxima auditoría no los vuelve a pedir.
    expect(await db.channelCatalogValue.count({ where: { key: { contains: ':cantidad:' } } })).toBeGreaterThan(0);
  });

  it('sin producto de usuario, se manda a la publicación', async () => {
    const kit = await product('Subconjunto de prueba Amarok suelto', [{ vehicleBrand: 'Volkswagen', model: 'Amarok', engine: '2.0 TDI', yearFrom: 2010, yearTo: 2010 }]);
    const p = await pub(kit.id, 'MLA9000501');
    await auditAccountCompatibilities(db, { accountId, publicationIds: [p.id] });
    const r = await pushCompatibilities(db, { accountId });
    expect(r.subidas[0]).toMatchObject({ resultado: 'subido', agregados: { grupos: 1 }, despues: { faltan: 0 } });
    expect(writes.map((w) => `${w.path}/${w.item}`)).toEqual(['items/MLA9000501']);
    expect(writes[0].body.domain_id).toBeUndefined();
  });

  it('sin ficha no se sube nada, ni se borra lo cargado', async () => {
    const empty = await product('Producto de prueba sin ficha', []);
    const p = await pub(empty.id, 'MLA9000401');
    loaded.MLA9000401 = [{ id: 'c-9', catalog_product_id: 'MLA820', catalog_product_name: 'Volkswagen Amarok 2011 2.0', source: 'SELLER' }];
    await auditAccountCompatibilities(db, { accountId, publicationIds: [p.id] });
    expect(await listCompatibilitiesToPush(db, accountId)).toEqual([]);
    expect(await pushCompatibilities(db, { accountId })).toEqual({ subidas: [], quedan: [] });
    expect(writes).toEqual([]);
  });

  it('lo ya mandado no se repite sin una auditoría nueva, y no se borra lo que no se mostró', async () => {
    const kit = await product('Subconjunto de prueba Amarok', [{ vehicleBrand: 'Volkswagen', model: 'Amarok', engine: '2.0 TDI', yearFrom: 2010, yearTo: 2016 }]);
    const p = await pub(kit.id, 'MLA9000801', { up: 'MLAU8' });
    upOf.MLA9000801 = 'MLAU8';
    loaded.MLAU8 = [{ id: 'c-1', catalog_product_id: 'MLA71', catalog_product_name: 'Volkswagen Amarok 2011 2.0 TDI 180cv Highline', source: 'SELLER' }];
    await auditAccountCompatibilities(db, { accountId, publicationIds: [p.id] });
    // Después de la auditoría, alguien carga un Mustang a mano: no se mostró, no se borra.
    loaded.MLAU8.push({ id: 'c-2', catalog_product_id: 'MLA801', catalog_product_name: 'Ford Mustang 2024 5.0 V8 GT', source: 'SELLER' });
    const first = await pushCompatibilities(db, { accountId });
    expect(first.subidas[0]).toMatchObject({ resultado: 'subido', agregados: { grupos: 2 }, borrados: { cantidad: 0 }, despues: { faltan: 0, sobran: 1 } });
    // No lo trajeron los grupos: ya estaba antes de mandar.
    expect(first.subidas[0].deshechos).toBeUndefined();

    // Otra vuelta sin auditar: no manda nada, ni borra lo que apareció después.
    const sent = writes.length;
    expect((await listCompatibilitiesToPush(db, accountId))[0]).toMatchObject({ blocked: expect.stringContaining('Ya se mandó'), remove: { count: 0 } });
    const second = await pushCompatibilities(db, { accountId });
    expect(second.subidas[0]).toMatchObject({ resultado: 'salteada', motivo: expect.stringContaining('Ya se mandó') });
    expect(writes.length).toBe(sent);

    // Con una auditoría nueva, que lo muestra, sí se borra.
    await auditAccountCompatibilities(db, { accountId, publicationIds: [p.id] });
    const third = await pushCompatibilities(db, { accountId });
    expect(third.subidas[0]).toMatchObject({ resultado: 'subido', borrados: { cantidad: 1, ejemplos: ['Ford Mustang 2024 5.0 V8 GT'] }, despues: { sobran: 0 } });
  });

  it('con solo agregar, agrega lo que falta y deja lo que sobra para otra subida', async () => {
    const { main } = await amarokWithExtras();
    const r = await pushCompatibilities(db, { accountId, addOnly: true });
    expect(r.subidas[0]).toMatchObject({ resultado: 'subido', agregados: { grupos: 2 }, borrados: { cantidad: 0 }, despues: { faltan: 0, sobran: 2 } });
    expect(writes.every((w) => !w.body.delete)).toBe(true);
    // Otra subida solo para agregar no tiene nada: queda salteada sin pedir nada al canal.
    const sent = writes.length;
    expect((await pushCompatibilities(db, { accountId, addOnly: true })).subidas[0]).toMatchObject({ resultado: 'salteada', motivo: expect.stringContaining('Solo tiene para borrar') });
    expect(writes.length).toBe(sent);
    // Lo que sobra se mostró y no se mandó: una subida normal lo borra sin volver a auditar.
    const full = await pushCompatibilities(db, { accountId, publicationIds: [main.id] });
    expect(full.subidas[0]).toMatchObject({ resultado: 'subido', agregados: { grupos: 0 }, borrados: { cantidad: 1, ejemplos: ['Ford Mustang 2024 5.0 V8 GT'] } });
  });

  it('si todo lo que trae un grupo no sale de la ficha, se saca y el grupo deja de faltar', async () => {
    const kit = await product('Subconjunto de prueba Partner', [{ vehicleBrand: 'Peugeot', model: 'Partner', engine: '1.6', fuel: 'Nafta' }]);
    const p = await pub(kit.id, 'MLA9000901', { up: 'MLAU9' });
    upOf.MLA9000901 = 'MLAU9';
    loaded.MLAU9 = [];
    const r = await auditAccountCompatibilities(db, { accountId, publicationIds: [p.id] });
    expect(r.publicaciones[0]).toMatchObject({ faltan: { cantidad: 1, ejemplos: ['Peugeot Partner 2018 1.6 nafta'] } });
    const pushed = await pushCompatibilities(db, { accountId });
    expect(pushed.subidas[0]).toMatchObject({
      resultado: 'subido',
      deshechos: { cantidad: 1, ejemplos: ['Peugeot Partner 2018 1.2 Confort'] },
      despues: { faltan: 0, incompletos: 0, sobran: 0 },
    });
    expect(loaded.MLAU9).toEqual([]);
    // Una auditoría nueva tampoco lo muestra: no queda nada por subir.
    const again = await auditAccountCompatibilities(db, { accountId, publicationIds: [p.id] });
    expect(again.publicaciones[0]).toMatchObject({ faltan: { cantidad: 0 }, incompletos: { cantidad: 0 } });
    expect(await listCompatibilitiesToPush(db, accountId)).toEqual([]);
  });

  it('lo que el catálogo trae de más se descuenta solo en la ficha que lo deja afuera', async () => {
    // El mismo grupo (BX 1990 1.9 diésel, versión Tzd) en dos fichas: el pistón sin turbo deja afuera el turbo, el turbo no.
    const aspirado = await product('Subconjunto de prueba BX sin turbo', [{ vehicleBrand: 'Citroën', model: 'BX', engine: '1.9', fuel: 'Diésel', excludedVersions: 'Turbo, Gti' }]);
    const turbo = await product('Subconjunto de prueba BX turbo', [{ vehicleBrand: 'Citroën', model: 'BX', engine: '1.9', fuel: 'Diésel', excludedVersions: 'Gti' }]);
    const a = await pub(aspirado.id, 'MLA9001101', { up: 'MLAU11' });
    const b = await pub(turbo.id, 'MLA9001102', { up: 'MLAU12' });
    upOf.MLA9001101 = 'MLAU11';
    upOf.MLA9001102 = 'MLAU12';
    loaded.MLAU11 = [];
    loaded.MLAU12 = [];

    // En la ficha sin turbo, el canal mete el Tzd Turbo: la subida lo saca y lo anota, y el grupo deja de faltar.
    await auditAccountCompatibilities(db, { accountId, publicationIds: [a.id] });
    const first = await pushCompatibilities(db, { accountId, publicationIds: [a.id] });
    expect(first.subidas[0]).toMatchObject({ deshechos: { cantidad: 1, ejemplos: ['Citroën BX 1990 1.9 Tzd Turbo'] }, despues: { faltan: 0, sobran: 0 } });
    expect(loaded.MLAU11).toEqual([]);

    // En la ficha turbo, ese mismo vehículo va: el grupo sigue faltando y la subida lo carga.
    const r = await auditAccountCompatibilities(db, { accountId, publicationIds: [b.id] });
    expect(r.publicaciones[0]).toMatchObject({ faltan: { cantidad: 1 } });
    const second = await pushCompatibilities(db, { accountId, publicationIds: [b.id] });
    expect(second.subidas[0]).toMatchObject({ resultado: 'subido', agregados: { grupos: 1 }, despues: { faltan: 0, incompletos: 0, sobran: 0 } });
    expect(second.subidas[0].deshechos).toBeUndefined();
    expect(loaded.MLAU12.map((v) => (v as { catalog_product_name: string }).catalog_product_name)).toEqual(['Citroën BX 1990 1.9 Tzd Turbo']);
  });

  it('si el canal no carga todo lo que cuenta en un grupo, queda anotado y el grupo deja de estar pendiente', async () => {
    const kit = await product('Subconjunto de prueba Ka', [{ vehicleBrand: 'Ford', model: 'Ka', engine: '1.5', fuel: 'Nafta' }]);
    const p = await pub(kit.id, 'MLA9001001', { up: 'MLAU10' });
    upOf.MLA9001001 = 'MLAU10';
    loaded.MLAU10 = [];
    await auditAccountCompatibilities(db, { accountId, publicationIds: [p.id] });
    const pushed = await pushCompatibilities(db, { accountId });
    // Cuenta dos y carga uno: no queda pendiente para siempre.
    expect(pushed.subidas[0]).toMatchObject({
      resultado: 'subido',
      agregados: { grupos: 1 },
      no_cargados: { grupos: 1, ejemplos: ['Ford Ka 2020 1.5 nafta: hay 1 de 2'] },
      despues: { faltan: 0, incompletos: 0, sobran: 0 },
      aviso: expect.stringContaining('no se muestra más como pendiente'),
    });
    expect(loaded.MLAU10).toHaveLength(1);
    const again = await auditAccountCompatibilities(db, { accountId, publicationIds: [p.id] });
    expect(again.publicaciones[0]).toMatchObject({ faltan: { cantidad: 0 }, incompletos: { cantidad: 0 } });
    expect(await listCompatibilitiesToPush(db, accountId)).toEqual([]);
  });

  it('una auditoría de antes, que no dice qué se mostró, hay que repetirla antes de subir', async () => {
    const { main } = await amarokWithExtras();
    const row = await db.publicationCompatibility.findUniqueOrThrow({ where: { publicationId: main.id } });
    const { shown: _shown, ...old } = row.audit as Record<string, unknown>;
    void _shown;
    await db.publicationCompatibility.update({ where: { publicationId: main.id }, data: { audit: old as object } });
    expect((await listCompatibilitiesToPush(db, accountId))[0]).toMatchObject({ blocked: expect.stringContaining('auditarla de nuevo') });
    const r = await pushCompatibilities(db, { accountId });
    expect(r.subidas[0]).toMatchObject({ resultado: 'salteada', motivo: expect.stringContaining('auditarla de nuevo') });
    expect(writes).toEqual([]);
  });

  it('si el catálogo mete en un grupo un vehículo que no sale de la ficha, la subida lo saca y no lo vuelve a contar', async () => {
    const kit = await product('Subconjunto de prueba 208 en familia', [{ vehicleBrand: 'Peugeot', model: '208', engine: '1.6', fuel: 'Nafta' }]);
    const std = await pub(kit.id, 'MLA9000701', { up: 'MLAU71' });
    const half = await pub(kit.id, 'MLA9000702', { up: 'MLAU72' });
    upOf.MLA9000701 = 'MLAU71';
    upOf.MLA9000702 = 'MLAU72';
    await db.listingFamily.create({ data: { storeId, productId: kit.id, channelFamilyId: 'FAM-7', leadId: std.id, members: { connect: [{ id: std.id }, { id: half.id }] } } });
    const as = (version: string) => {
      const i = CATALOG.findIndex((v) => v.MODEL[1] === '208' && v.SHORT_VERSION[1] === version);
      return { id: `c-${i}`, catalog_product_id: `MLA7${i}`, catalog_product_name: `Peugeot 208 2022 ${version}`, source: 'SELLER' };
    };
    // La medida STD tiene los dos 1.6 que van; la 0,50, uno.
    loaded.MLAU71 = [as('1.6 Allure'), as('1.6 Active')];
    loaded.MLAU72 = [as('1.6 Allure')];
    const r = await auditAccountCompatibilities(db, { accountId, publicationIds: [half.id] });
    // El catálogo cuenta tres con motor 1.6, pero uno se llama 1.2: parece que a la STD le falta uno.
    expect(r.publicaciones.map((x) => [x.publicacion, x.incompletos.ejemplos])).toEqual([
      ['MLA9000701', ['Peugeot 208 2022 1.6 nafta: hay 2 de 3']],
      ['MLA9000702', ['Peugeot 208 2022 1.6 nafta: hay 1 de 3']],
    ]);

    // Se pide una sola medida y van las dos, cada una una vez: la segunda no se queda esperando detrás de la primera.
    const pushed = await pushCompatibilities(db, { accountId, publicationIds: [half.id] });
    expect(pushed.quedan).toEqual([]);
    const clean = { faltan: 0, incompletos: 0, sobran: 0, a_revisar: 0 };
    const intruder = { cantidad: 1, ejemplos: ['Peugeot 208 2022 1.2 Gt'] };
    expect(pushed.subidas.map((x) => [x.publicaciones, x.resultado, x.agregados.grupos, x.borrados.cantidad, x.deshechos, x.despues])).toEqual([
      [['MLA9000701'], 'subido', 1, 0, intruder, clean],
      [['MLA9000702'], 'subido', 1, 0, intruder, clean],
    ]);
    expect(pushed.subidas[0].aviso).toContain('se sacaron en la misma subida');
    // Quedan los 1.6, sin el 1.2.
    const names = (k: string) => loaded[k].map((v) => (v as { catalog_product_name: string }).catalog_product_name).sort();
    expect(names('MLAU71')).toEqual(['Peugeot 208 2022 1.6 Active', 'Peugeot 208 2022 1.6 Allure']);
    expect(names('MLAU72')).toEqual(['Peugeot 208 2022 1.6 Active', 'Peugeot 208 2022 1.6 Allure']);

    // Una auditoría nueva ya no lo cuenta: el grupo está completo y no queda nada por subir.
    const again = await auditAccountCompatibilities(db, { accountId, publicationIds: [half.id] });
    expect(again.publicaciones.map((x) => [x.incompletos.cantidad, x.sobran.cantidad])).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(await listCompatibilitiesToPush(db, accountId)).toEqual([]);
  });
});
