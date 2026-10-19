import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { mercadolibre } from '@/channels/mercadolibre';
import { applyRows, undoImportRun } from '@/importers/apply';
import { extractRows, suggestMapping } from '@/importers/mapping';
import { readSpreadsheet } from '@/importers/spreadsheet';
import { saveProduct } from '@/domain/products';
import { buildWorkbook, CONFIDENTIAL_VALUES } from './fixture';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('importación en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';
  let userId = '';
  const dataDate = new Date('2026-10-15T00:00:00Z');

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
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function rows() {
    const table = await readSpreadsheet('auditoria.xlsx', await buildWorkbook());
    const sheet = table.sheets.find((s) => s.name === 'Base')!;
    return extractRows(sheet, suggestMapping(sheet.headers));
  }

  async function run() {
    const r = await db.importRun.create({
      data: { accountId, storeId, userId, fileName: 'auditoria.xlsx', sheetName: 'Base', dataDate, rowsTotal: 5 },
    });
    const result = await applyRows(
      db,
      { accountId, storeId, adapter: mercadolibre, runId: r.id, userId, dataDate },
      await rows(),
    );
    return { runId: r.id, result };
  }

  it('crea productos y publicaciones, y vincula por SKU', async () => {
    const { result } = await run();
    expect(result).toMatchObject({
      processed: 5,
      productsCreated: 3,
      publicationsCreated: 4,
      publicationsLinked: 1,
      publicationsExisting: 0,
      measurementsSaved: 3,
    });
    expect(result.errors).toEqual([{ row: 5, message: 'Falta el título o el nombre del producto.' }]);

    const pubs = await db.publication.findMany({ include: { stageMovements: true } });
    expect(pubs).toHaveLength(4);
    for (const p of pubs) {
      expect(p.stage).toBe('IMPORTED');
      expect(p.source).toBe('IMPORT');
      expect(p.stageMovements).toHaveLength(1);
      expect(p.stageMovements[0].userId).toBe(userId);
    }
    // Las dos publicaciones con el SKU PA-1-00 son del mismo producto.
    const a = pubs.find((p) => p.externalId === 'MLA1000000001')!;
    const b = pubs.find((p) => p.externalId === 'MLA1000000002')!;
    expect(a.productId).toBe(b.productId);
    expect(await db.productVariant.count({ where: { productId: a.productId } })).toBe(2);

    const unpublished = pubs.find((p) => p.externalId === null)!;
    expect(unpublished.channelStatus).toBe('UNPUBLISHED');
  });

  it('no guarda ningún dato de las columnas confidenciales', async () => {
    await run();
    const dump = await db.$queryRawUnsafe<{ t: string }[]>(`
      SELECT concat_ws(' ',
        (SELECT string_agg(x::text, ' ') FROM products x),
        (SELECT string_agg(x::text, ' ') FROM publications x),
        (SELECT string_agg(x::text, ' ') FROM measurements x),
        (SELECT string_agg(x::text, ' ') FROM product_variants x),
        (SELECT string_agg(x::text, ' ') FROM compatibilities x)
      ) AS t`);
    for (const value of CONFIDENTIAL_VALUES) expect(dump[0].t).not.toContain(String(value));
  });

  it('importar de nuevo no duplica ni pisa lo editado', async () => {
    await run();
    const product = await db.product.findFirstOrThrow({ where: { name: 'Kit de prueba' } });
    await db.product.update({ where: { id: product.id }, data: { name: 'Kit editado a mano' } });

    const { result } = await run();
    expect(result).toMatchObject({
      productsCreated: 0,
      publicationsCreated: 0,
      publicationsExisting: 4,
      measurementsSaved: 3,
    });
    expect(await db.product.count()).toBe(3);
    expect(await db.publication.count()).toBe(4);
    expect(await db.measurement.count()).toBe(3);
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).name).toBe('Kit editado a mano');
  });

  it('se suma a un producto cargado a mano con el mismo SKU', async () => {
    const manual = await saveProduct(db, {
      accountId,
      productId: null,
      data: {
        name: 'Kit cargado a mano',
        brand: null,
        partNumber: null,
        productType: null,
        engineSystem: null,
        line: null,
        origin: null,
        warranty: null,
        kitContents: null,
        notes: null,
        specs: [],
        variants: [{ measure: null, sku: 'pd-1' }],
        compatibilities: [],
        assets: [],
      },
    });
    const { result } = await run();
    expect(result).toMatchObject({ productsCreated: 2, publicationsLinked: 2 });
    const pub = await db.publication.findFirstOrThrow({ where: { externalId: 'MLA1000000004' } });
    expect(pub.productId).toBe(manual.id);
  });

  it('deshacer borra solo lo que creó esa importación', async () => {
    const manual = await db.product.create({ data: { accountId, name: 'Producto que ya estaba' } });
    const { runId } = await run();
    const undone = await undoImportRun(db, { runId, accountId });
    expect(undone).toMatchObject({ products: 3, publications: 4, measurements: 3 });
    const left = await db.product.findMany();
    expect(left.map((p) => p.id)).toEqual([manual.id]);
    expect(await db.publication.count()).toBe(0);
    expect((await db.importRun.findUniqueOrThrow({ where: { id: runId } })).status).toBe('UNDONE');
  });

  it('deshacer deja un producto importado que después se puso en un combo armado a mano', async () => {
    const { runId } = await run();
    const imported = await db.product.findFirstOrThrow({ where: { importRunId: runId } });
    const combo = await db.product.create({ data: { accountId, name: 'Combo armado a mano', kind: 'COMBO' } });
    await db.comboItem.create({ data: { comboId: combo.id, productId: imported.id, quantity: 2 } });
    const undone = await undoImportRun(db, { runId, accountId });
    expect(undone).toMatchObject({ products: 2, productsKept: 1 });
    expect(await db.product.findUnique({ where: { id: imported.id } })).toMatchObject({ importRunId: null });
    expect(await db.comboItem.count({ where: { comboId: combo.id } })).toBe(1);
    // Queda anotado para el historial.
    expect((await db.importRun.findUniqueOrThrow({ where: { id: runId } })).productsKept).toBe(1);
  });

  it('deshacer borra un combo armado con productos de la misma importación', async () => {
    const { runId } = await run();
    const [combo, ...parts] = await db.product.findMany({ where: { importRunId: runId }, orderBy: { createdAt: 'asc' } });
    await db.product.update({ where: { id: combo.id }, data: { kind: 'COMBO' } });
    await db.comboItem.createMany({ data: parts.map((p) => ({ comboId: combo.id, productId: p.id, quantity: 1 })) });
    const undone = await undoImportRun(db, { runId, accountId });
    expect(undone).toMatchObject({ products: 3, productsKept: 0 });
    expect(await db.product.count()).toBe(0);
    expect(await db.comboItem.count()).toBe(0);
  });

  it('deshacer deja un producto importado al que después se le sumó una publicación a mano', async () => {
    const { runId } = await run();
    const imported = await db.product.findFirstOrThrow({ where: { importRunId: runId } });
    const manual = await db.publication.create({ data: { productId: imported.id, storeId, title: 'Publicación cargada a mano' } });
    const undone = await undoImportRun(db, { runId, accountId });
    expect(undone).toMatchObject({ products: 2, productsKept: 1 });
    expect(await db.product.findUnique({ where: { id: imported.id } })).toMatchObject({ importRunId: null });
    expect((await db.publication.findMany()).map((p) => p.id)).toEqual([manual.id]);
  });

  it('se puede borrar una cuenta con combos', async () => {
    const part = await db.product.create({ data: { accountId, name: 'Disco' } });
    const combo = await db.product.create({ data: { accountId, name: 'Combo', kind: 'COMBO' } });
    await db.comboItem.create({ data: { comboId: combo.id, productId: part.id, quantity: 2 } });
    await db.account.delete({ where: { id: accountId } });
    expect(await db.product.count()).toBe(0);
  });

  it('la base no deja borrar un producto que está en un combo', async () => {
    const part = await db.product.create({ data: { accountId, name: 'Disco' } });
    const combo = await db.product.create({ data: { accountId, name: 'Combo', kind: 'COMBO' } });
    await db.comboItem.create({ data: { comboId: combo.id, productId: part.id, quantity: 2 } });
    await expect(db.product.delete({ where: { id: part.id } })).rejects.toThrow();
    expect(await db.product.count()).toBe(2);
  });

  it('deshacer una reimportación no borra las mediciones de antes', async () => {
    await run();
    const second = await run();
    await undoImportRun(db, { runId: second.runId, accountId });
    expect(await db.measurement.count()).toBe(3);
    expect(await db.publication.count()).toBe(4);
  });
});
