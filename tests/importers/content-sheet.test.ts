import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { mercadolibre } from '@/channels/mercadolibre';
import { loadContent, type ContentSnapshot } from '@/domain/content';
import { saveProduct } from '@/domain/products';
import { createPublication } from '@/domain/publications';
import { applyRows, previewRows, undoImportRun } from '@/importers/apply';
import { buildContentSheet, compatLine, CONTENT_COLUMNS } from '@/importers/content-sheet';
import { extractRows, suggestMapping } from '@/importers/mapping';
import { readSpreadsheet } from '@/importers/spreadsheet';

// Datos inventados: ningún precio, costo ni dato real de un cliente.

async function readCsv(csv: string) {
  const bytes = new TextEncoder().encode(csv);
  const table = await readSpreadsheet('planilla.csv', bytes.buffer.slice(0) as ArrayBuffer);
  const sheet = table.sheets[0];
  return { sheet, rows: extractRows(sheet, suggestMapping(sheet.headers)) };
}

describe('planilla de contenido', () => {
  it('el importador reconoce todas sus columnas solo', () => {
    const headers = CONTENT_COLUMNS.map((c) => c.header);
    const mapping = suggestMapping(headers);
    for (const c of CONTENT_COLUMNS) expect(mapping[c.header], c.header).toBe(c.field);
  });

  it('escribe las compatibilidades sin barras de más', () => {
    const base = { vehicleBrand: 'Marca A', model: 'Modelo 1', engine: '1.6', yearFrom: null, yearTo: null, note: null };
    expect(compatLine(base)).toBe('Marca A | Modelo 1 | 1.6');
    expect(compatLine({ ...base, yearFrom: 1995, yearTo: 2012 })).toBe('Marca A | Modelo 1 | 1.6 | 1995-2012');
    expect(compatLine({ ...base, yearFrom: 2010, yearTo: 2010 })).toBe('Marca A | Modelo 1 | 1.6 | 2010');
    expect(compatLine({ ...base, note: 'con aire' })).toBe('Marca A | Modelo 1 | 1.6 |  | con aire');
    // Solo la marca: igual lleva la barra, si no se leería como nota.
    expect(compatLine({ ...base, model: null, engine: null })).toBe('Marca A |');
    expect(compatLine({ ...base, vehicleBrand: null, engine: null })).toBe('| Modelo 1');
  });

  it('no lleva precios', async () => {
    const csv = buildContentSheet([]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.toLowerCase()).not.toContain('precio');
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('importar la planilla de contenido', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';
  let userId = '';
  let productId = '';
  let publicationId = '';
  const dataDate = new Date('2026-10-16T00:00:00Z');

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE import_runs, import_mappings, measurements, stage_movements, publications, products, stores, channels, accounts, users CASCADE',
    );
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    const user = await db.user.create({ data: { id: 'u1', name: 'Persona', email: 'persona@example.com' } });
    accountId = account.id;
    storeId = store.id;
    userId = user.id;

    productId = (
      await saveProduct(db, {
        accountId,
        productId: null,
        data: {
          name: 'Kit de prueba A',
          brand: 'Marca X',
          partNumber: null,
          productType: null,
          engineSystem: null,
          line: null,
          origin: null,
          warranty: null,
          kitContents: null,
          notes: null,
          specs: [],
          variants: [
            { sku: 'ABC-1', measure: null },
            { sku: 'ABC-2', measure: '0.5' },
          ],
          compatibilities: [],
          assets: [],
        },
      })
    ).id;
    publicationId = (
      await createPublication(db, {
        productId,
        storeId,
        userId,
        data: {
          externalId: 'MLA1000000001',
          url: 'https://articulo.mercadolibre.com.ar/MLA-1000000001',
          title: 'Kit de prueba A',
          description: 'Texto de prueba.\nSegunda línea.',
          attributes: [],
          price: null,
          channelStatus: 'ACTIVE',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function snapshot(): Promise<ContentSnapshot> {
    return loadContent(db, productId, publicationId);
  }

  async function sheetWith(content: ContentSnapshot, externalId = 'MLA1000000001') {
    const csv = buildContentSheet([
      { externalId, url: `https://articulo.mercadolibre.com.ar/${externalId.replace('MLA', 'MLA-')}`, content },
    ]);
    return (await readCsv(csv)).rows;
  }

  async function importRows(rows: Awaited<ReturnType<typeof sheetWith>>, mode: 'FILL_EMPTY' | 'REPLACE') {
    const run = await db.importRun.create({
      data: {
        accountId,
        storeId,
        userId,
        fileName: 'planilla.csv',
        sheetName: 'planilla',
        dataDate,
        rowsTotal: rows.length,
        updateMode: mode,
      },
    });
    const result = await applyRows(
      db,
      { accountId, storeId, adapter: mercadolibre, runId: run.id, userId, dataDate, mode },
      rows,
    );
    return { runId: run.id, result };
  }

  const filled = (base: ContentSnapshot): ContentSnapshot => ({
    ...base,
    title: 'Kit de prueba A con otro título',
    warranty: '6 meses',
    measures: base.measures.map((m) => (m.sku === 'ABC-1' ? { ...m, measure: 'STD' } : { ...m, measure: '0,50 mm' })),
    specs: [
      { name: 'Diámetro', value: '82,5 mm' },
      { name: 'Material', value: 'aluminio' },
    ],
    compatibilities: [
      { vehicleBrand: 'Marca A', model: 'Modelo 1', engine: '1.6 8v', yearFrom: 1995, yearTo: 2012, note: null },
    ],
    photos: Array.from({ length: 6 }, (_, i) => `https://example.com/foto-${i + 1}.jpg`),
    videos: ['https://example.com/video.mp4'],
  });

  it('bajar la planilla e importarla sin tocar no cambia nada', async () => {
    const rows = await sheetWith(await snapshot());
    const { result } = await importRows(rows, 'REPLACE');
    expect(result).toMatchObject({ publicationsExisting: 1, publicationsUpdated: 0, fieldsChanged: 0, errors: [] });
    expect(await db.importChange.count()).toBe(0);
  });

  it('las compatibilidades incompletas también vuelven iguales', async () => {
    await db.compatibility.createMany({
      data: [
        { productId, vehicleBrand: 'Marca Z', position: 0 },
        { productId, model: 'Modelo 9', engine: '1.4', position: 1 },
        { productId, vehicleBrand: 'Marca Y', model: 'Modelo 8', yearFrom: 2010, position: 2 },
      ],
    });
    const { result } = await importRows(await sheetWith(await snapshot()), 'REPLACE');
    expect(result).toMatchObject({ fieldsChanged: 0, errors: [] });
  });

  it('la vista previa dice lo mismo que después pasa', async () => {
    const rows = await sheetWith(filled(await snapshot()));
    const [preview] = await previewRows(db, { accountId, storeId, adapter: mercadolibre }, rows);
    expect(preview.fill.sort()).toEqual(['compatibilities', 'measures', 'photos', 'specs', 'videos', 'warranty']);
    expect(preview.replace.sort()).toEqual(['measures', 'title']);
    // La vista previa no guarda nada.
    expect((await snapshot()).warranty).toBeNull();
  });

  it('solo completar: carga lo vacío, deja lo que había y se puede deshacer', async () => {
    const before = await snapshot();
    const { runId, result } = await importRows(await sheetWith(filled(before)), 'FILL_EMPTY');
    expect(result).toMatchObject({ publicationsExisting: 1, publicationsUpdated: 1, fieldsChanged: 6, errors: [] });

    const after = await snapshot();
    expect(after.title).toBe('Kit de prueba A');
    expect(after.warranty).toBe('6 meses');
    expect(after.measures.map((m) => m.measure)).toEqual(['STD', '0.5']);
    expect(after.specs).toHaveLength(2);
    expect(after.compatibilities[0]).toMatchObject({ vehicleBrand: 'Marca A', yearFrom: 1995, yearTo: 2012 });
    expect(after.photos).toHaveLength(6);
    expect(after.videos).toEqual(['https://example.com/video.mp4']);
    // La etapa no cambia.
    expect((await db.publication.findUniqueOrThrow({ where: { id: publicationId } })).stage).toBe('IMPORTED');

    // Alguien cambia la garantía a mano después de importar.
    await db.product.update({ where: { id: productId }, data: { warranty: '12 meses' } });

    const undone = await undoImportRun(db, { runId, accountId });
    expect(undone).toMatchObject({ products: 0, publications: 0, restored: 5, kept: 1 });
    const restored = await snapshot();
    expect(restored).toEqual({ ...before, warranty: '12 meses' });
    expect(await db.publication.count()).toBe(1);
  });

  it('completar y reemplazar: gana la planilla, y deshacer lo devuelve', async () => {
    const before = await snapshot();
    const { runId, result } = await importRows(await sheetWith(filled(before)), 'REPLACE');
    expect(result.fieldsChanged).toBe(7);
    const after = await snapshot();
    expect(after.title).toBe('Kit de prueba A con otro título');
    expect(after.measures.map((m) => m.measure)).toEqual(['STD', '0,50 mm']);

    await undoImportRun(db, { runId, accountId });
    expect(await snapshot()).toEqual(before);
  });

  it('otra publicación del mismo producto solo completa la ficha, aunque se elija reemplazar', async () => {
    await importRows(await sheetWith(filled(await snapshot())), 'REPLACE');
    const before = await snapshot();
    const other: ContentSnapshot = {
      ...before,
      title: 'Kit de prueba A para Modelo 2',
      brand: 'Marca W',
      kitContents: 'Disco y placa',
      compatibilities: [{ vehicleBrand: 'Marca B', model: 'Modelo 2', engine: '1.4', yearFrom: null, yearTo: null, note: null }],
    };
    const rows = await sheetWith(other, 'MLA1000000009');
    const [preview] = await previewRows(db, { accountId, storeId, adapter: mercadolibre }, rows);
    expect(preview).toMatchObject({ fill: ['kitContents'], replace: [], newProduct: false });
    expect(preview.notes).toEqual(['Es otra publicación de «Kit de prueba A»: en la ficha solo completa lo vacío, aunque elijas reemplazar.']);

    const { result } = await importRows(rows, 'REPLACE');
    expect(result).toMatchObject({ publicationsLinked: 1, fieldsChanged: 1, errors: [] });
    const after = await snapshot();
    expect(after.brand).toBe('Marca X');
    expect(after.compatibilities).toEqual(before.compatibilities);
    expect(after.kitContents).toBe('Disco y placa');
    const pub = await db.publication.findFirstOrThrow({ where: { externalId: 'MLA1000000009' } });
    expect(pub).toMatchObject({ productId, title: 'Kit de prueba A para Modelo 2' });
  });

  it('si los SKU de la fila son de productos distintos, crea una ficha nueva y avisa', async () => {
    const other = await db.product.create({
      data: { accountId, name: 'Disco de prueba', variants: { create: [{ sku: 'XYZ-1' }] } },
    });
    const content: ContentSnapshot = {
      ...(await snapshot()),
      title: 'Combo de prueba',
      measures: [
        { id: 'a', sku: 'ABC-1', measure: null },
        { id: 'b', sku: 'XYZ-1', measure: null },
      ],
    };
    const rows = await sheetWith(content, 'MLA1000000010');
    const [preview] = await previewRows(db, { accountId, storeId, adapter: mercadolibre }, rows);
    expect(preview.newProduct).toBe(true);
    expect(preview.notes[0]).toContain('son de productos distintos («Kit de prueba A» y «Disco de prueba»)');

    const { result } = await importRows(rows, 'REPLACE');
    expect(result).toMatchObject({ productsCreated: 1, publicationsLinked: 0, fieldsChanged: 0, errors: [] });
    const pub = await db.publication.findFirstOrThrow({ where: { externalId: 'MLA1000000010' } });
    expect([productId, other.id]).not.toContain(pub.productId);
  });

  it('con un SKU repetido en dos fichas, se suma a la más antigua', async () => {
    await db.product.create({
      data: { accountId, name: 'Copia más nueva', createdAt: new Date(Date.now() + 60_000), variants: { create: [{ sku: 'ABC-1' }] } },
    });
    const content: ContentSnapshot = { ...(await snapshot()), measures: [{ id: 'a', sku: 'ABC-1', measure: null }] };
    await importRows(await sheetWith(content, 'MLA1000000011'), 'FILL_EMPTY');
    const pub = await db.publication.findFirstOrThrow({ where: { externalId: 'MLA1000000011' } });
    expect(pub.productId).toBe(productId);
  });

  it('una celda vacía no borra nada', async () => {
    const base = filled(await snapshot());
    await importRows(await sheetWith(base), 'REPLACE');
    const loaded = await snapshot();
    const blank: ContentSnapshot = {
      ...loaded,
      title: null,
      description: null,
      brand: null,
      warranty: null,
      measures: loaded.measures.map((m) => ({ ...m, measure: null })),
      specs: [],
      compatibilities: [],
      photos: [],
      videos: [],
    };
    // Sin título la fila no se puede leer: se deja el título y se vacía el resto.
    const { result } = await importRows(await sheetWith({ ...blank, title: loaded.title }), 'REPLACE');
    expect(result.fieldsChanged).toBe(0);
    expect(await snapshot()).toEqual(loaded);
  });
});
