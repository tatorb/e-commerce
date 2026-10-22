import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import type { ChannelListing } from '@/channels/listings-types';
import { mercadolibre } from '@/channels/mercadolibre';
import { applyRows, previewRows, undoImportRun } from '@/importers/apply';
import { listingToRow } from '@/importers/channel-listings';
import { toRecord } from '@/importers/transform';
import { latestMetrics } from '@/domain/measurements';

// Importar lo que se leyó del canal: las mismas reglas que una planilla, más
// el estado, el link y el precio, que se actualizan siempre. Datos de prueba.

function listing(over: Partial<ChannelListing> = {}): ChannelListing {
  return {
    externalId: 'MLA1000000111',
    url: 'https://articulo.mercadolibre.com.ar/MLA-1000000111-kit',
    title: 'Kit Embrague Ford Ka 1.6 Sachs',
    description: 'Kit completo.',
    price: 100,
    status: 'ACTIVE',
    sold: 12,
    visits90d: 340,
    photos: ['https://foto/1.jpg', 'https://foto/2.jpg'],
    hasVideo: false,
    quality: 76,
    categoryId: 'MLA373460',
    categoryName: 'Kits de Embrague',
    brand: 'Sachs',
    partNumber: '3000 951 001',
    origin: null,
    skus: ['EMB-001'],
    measures: [],
    variations: [],
    attributes: [
      { id: 'CLUTCH_TYPE', name: 'Tipo de embrague', value: 'monodisco' },
      { id: 'INCLUDES_DISC', name: 'Incluye disco', value: 'Si' },
      { id: 'ITEM_CONDITION', name: 'Condición del ítem', value: 'Nuevo; sin uso' },
    ],
    attributeCount: 6,
    updatedAt: null,
    ...over,
  };
}

describe('del canal a una fila', () => {
  it('lleva cada dato a su campo, como una planilla', () => {
    const record = toRecord(listingToRow(listing(), 1, mercadolibre), mercadolibre);
    expect(record.error).toBeNull();
    expect(record.skus).toEqual(['EMB-001']);
    expect(record.product).toMatchObject({ name: 'Kit de embrague 3000 951 001', brand: 'Sachs', partNumber: '3000 951 001', productType: 'Kit de embrague' });
    expect(record.product?.assets.map((a) => a.url)).toEqual(['https://foto/1.jpg', 'https://foto/2.jpg']);
    expect(record.publication).toMatchObject({
      externalId: 'MLA1000000111',
      url: 'https://articulo.mercadolibre.com.ar/MLA-1000000111-kit',
      description: 'Kit completo.',
      price: 100,
      channelStatus: 'ACTIVE',
    });
    // Con el nombre del campo de la categoría y el valor limpio; los demás, como vinieron.
    expect(record.publication.attributes).toEqual([
      { name: 'Tipo de embrague', value: 'Monodisco' },
      { name: 'Incluye disco', value: 'Sí' },
      { name: 'Condición del ítem', value: 'Nuevo, sin uso' },
    ]);
    expect(record.metrics).toEqual({
      sold_visible: 12,
      visits_90d: 340,
      photo_count: 2,
      has_video: false,
      attribute_count: 6,
      channel_quality: 76,
    });
    expect(record.warnings).toEqual([]);
  });

  it('el tipo sale de la familia, el título desempata, y sin familia es el nombre de la categoría', () => {
    const type = (over: Partial<ChannelListing>) => toRecord(listingToRow(listing(over), 1, mercadolibre), mercadolibre).product?.productType;
    expect(type({ categoryId: 'MLA373289', title: 'Subconjunto pistones aros Fiat' })).toBe('Subconjunto (pistones + aros)');
    expect(type({ categoryId: 'MLA373289', title: 'Conjunto pistones aros camisas Fiat' })).toBe('Conjunto (con camisas)');
    expect(type({ categoryId: 'MLA999', categoryName: 'Retenes' })).toBe('Retenes');
  });

  it('las variantes dan SKU y medida, y lo que el canal no informa no viaja', () => {
    const row = listingToRow(
      listing({ skus: ['AROS-STD', 'AROS-050'], measures: [{ sku: 'AROS-STD', measure: 'STD' }, { sku: 'AROS-050', measure: '0.50' }], visits90d: null, price: null, description: null }),
      7,
      mercadolibre,
    );
    expect(row.rowNumber).toBe(7);
    expect(row.values).not.toHaveProperty('metric.visits_90d');
    expect(row.values).not.toHaveProperty('pub.price');
    expect(row.values).not.toHaveProperty('pub.description');
    const record = toRecord(row, mercadolibre);
    expect(record.product?.variants).toEqual([
      { sku: 'AROS-STD', measure: 'STD' },
      { sku: 'AROS-050', measure: '0.50' },
    ]);
  });
});

describe('el último dato de cada métrica', () => {
  it('toma la más nueva que tiene cada una', () => {
    expect(
      latestMetrics([
        { metrics: { visits_90d: 340, sold_visible: 12 } },
        { metrics: { visits_90d: 100, sales_90d: 4 } },
        { metrics: { sales_90d: 9, reviews: 2 } },
      ]),
    ).toEqual({ visits_90d: 340, sold_visible: 12, sales_90d: 4, reviews: 2 });
    expect(latestMetrics([])).toEqual({});
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('importar desde el canal en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';
  const userId = 'u1';
  const dataDate = new Date('2026-10-19T00:00:00Z');

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE import_runs, import_mappings, measurements, stage_movements, publications, products, stores, channels, accounts, users CASCADE',
    );
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    await db.user.create({ data: { id: userId, name: 'Persona', email: 'persona@example.com' } });
    accountId = account.id;
    storeId = store.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function run(listings: ChannelListing[], mode: 'FILL_EMPTY' | 'REPLACE' = 'FILL_EMPTY', fromChannel = true) {
    const r = await db.importRun.create({
      data: {
        accountId,
        storeId,
        userId,
        origin: fromChannel ? 'CHANNEL_API' : 'FILE',
        fileName: 'Mercado Libre · TIENDA',
        sheetName: 'Mercado Libre',
        dataDate,
        rowsTotal: listings.length,
        updateMode: mode,
      },
    });
    const ctx = { accountId, storeId, adapter: mercadolibre, runId: r.id, userId, dataDate, mode, fromChannel };
    const result = await applyRows(db, ctx, listings.map((l, i) => listingToRow(l, i + 1, mercadolibre)));
    return { runId: r.id, result };
  }

  it('crea las nuevas con sus datos de catálogo y su medición', async () => {
    const { result } = await run([listing()]);
    expect(result).toMatchObject({ productsCreated: 1, publicationsCreated: 1, measurementsSaved: 1, errors: [] });
    const pub = await db.publication.findFirstOrThrow({ include: { product: true, measurements: true } });
    expect(pub).toMatchObject({ externalId: 'MLA1000000111', channelStatus: 'ACTIVE', description: 'Kit completo.' });
    expect(Number(pub.price)).toBe(100);
    expect(pub.attributes).toEqual([
      { name: 'Tipo de embrague', value: 'Monodisco' },
      { name: 'Incluye disco', value: 'Sí' },
      { name: 'Condición del ítem', value: 'Nuevo, sin uso' },
    ]);
    expect(pub.product).toMatchObject({ brand: 'Sachs', productType: 'Kit de embrague' });
    expect(pub.measurements[0].metrics).toMatchObject({ sold_visible: 12, visits_90d: 340 });
  });

  it('en las que ya estaban actualiza estado, link y precio, y la ficha solo se completa aunque se elija reemplazar', async () => {
    await run([listing({ attributes: [], brand: null })]);
    const { runId, result } = await run(
      [
        listing({
          status: 'PAUSED',
          price: 120,
          url: 'https://articulo.mercadolibre.com.ar/MLA-1000000111-nuevo',
          title: 'Kit Embrague Ka 1.6 Monodisco',
          brand: 'Luk',
          categoryId: 'MLA999',
          categoryName: 'Otra categoría',
        }),
      ],
      'REPLACE',
    );
    expect(result).toMatchObject({ productsCreated: 0, publicationsExisting: 1, errors: [] });
    const pub = await db.publication.findFirstOrThrow({ include: { product: true } });
    expect(pub).toMatchObject({ channelStatus: 'PAUSED', url: 'https://articulo.mercadolibre.com.ar/MLA-1000000111-nuevo', title: 'Kit Embrague Ka 1.6 Monodisco' });
    expect(Number(pub.price)).toBe(120);
    // Los datos de catálogo no estaban: se cargan.
    expect(pub.attributes).toHaveLength(3);
    // La marca estaba vacía: se completa. El tipo ya estaba: no se reemplaza.
    expect(pub.product).toMatchObject({ brand: 'Luk', productType: 'Kit de embrague' });

    // Deshacer devuelve todo.
    await undoImportRun(db, { runId, accountId });
    const back = await db.publication.findFirstOrThrow({ include: { product: true } });
    expect(back).toMatchObject({ channelStatus: 'ACTIVE', url: 'https://articulo.mercadolibre.com.ar/MLA-1000000111-kit', title: 'Kit Embrague Ford Ka 1.6 Sachs' });
    expect(Number(back.price)).toBe(100);
    expect(back.attributes).toEqual([]);
    expect(back.product.brand).toBeNull();
  });

  it('los datos de catálogo que ya estaban solo se reemplazan si se elige reemplazar, y la revisión lo muestra', async () => {
    await run([listing()]);
    const changed = listing({ attributes: [{ id: 'CLUTCH_TYPE', name: 'Tipo de embrague', value: 'Bidisco' }] });
    const [preview] = await previewRows(db, { accountId, storeId, adapter: mercadolibre, fromChannel: true }, [listingToRow(changed, 1, mercadolibre)]);
    expect(preview.fill).toEqual([]);
    expect(preview.replace).toEqual(['attributes']);

    await run([changed]);
    expect((await db.publication.findFirstOrThrow()).attributes).toHaveLength(3);
    await run([changed], 'REPLACE');
    expect((await db.publication.findFirstOrThrow()).attributes).toEqual([{ name: 'Tipo de embrague', value: 'Bidisco' }]);
  });

  it('la medición del canal se suma a la de una planilla del mismo día', async () => {
    await run([listing()], 'FILL_EMPTY', false);
    const pub = await db.publication.findFirstOrThrow();
    await db.measurement.update({ where: { publicationId_takenAt: { publicationId: pub.id, takenAt: dataDate } }, data: { metrics: { sales_90d: 4, visits_90d: 1 } } });
    await run([listing({ visits90d: 500 })]);
    const m = await db.measurement.findFirstOrThrow({ where: { publicationId: pub.id } });
    expect(m.metrics).toMatchObject({ sales_90d: 4, visits_90d: 500, sold_visible: 12 });
  });

  it('desde una planilla, el estado y el precio de lo que ya estaba no se tocan', async () => {
    await run([listing()], 'FILL_EMPTY', false);
    await run([listing({ status: 'PAUSED', price: 999 })], 'REPLACE', false);
    const pub = await db.publication.findFirstOrThrow();
    expect(pub.channelStatus).toBe('ACTIVE');
    expect(Number(pub.price)).toBe(100);
  });
});
