import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { mercadolibreCatalog } from '@/channels/mercadolibre/catalog';
import {
  CatalogError,
  cleanCatalogValue,
  cleanCatalogValues,
  findCategory,
  mergeCatalogAttributes,
  readCatalogValues,
  resolveCatalog,
  type CatalogField,
} from '@/domain/catalog-data';
import { loadCatalogData, saveCatalogData } from '@/lib/catalog-data';

// Datos inventados.

const INSUR_FAMILIES = [
  'Subconjunto (pistones + aros)',
  'Kit de embrague',
  'Kit de distribución',
  'Juego de juntas / descarbonización',
  'Camisas',
  'Aros',
  'Pistones',
  'Cigüeñal',
  'Cojinetes de biela y bancada',
  'Bielas',
  'Tapa de cilindros',
  'Válvulas, guías y botadores',
  'Bomba de aceite',
  'Conjunto (con camisas)',
  'Bomba de agua',
  'Junta de tapa de cilindros',
  'Otras juntas',
];

describe('categorías de Mercado Libre', () => {
  it('cada familia tiene su categoría, salvo Otros', () => {
    for (const family of INSUR_FAMILIES) {
      const id = mercadolibreCatalog.categoryForFamily(family);
      expect(id, family).toMatch(/^MLA\d+$/);
      expect(mercadolibreCatalog.category(id!), family).not.toBeNull();
    }
    expect(mercadolibreCatalog.categoryForFamily('Otros')).toBeNull();
    expect(mercadolibreCatalog.categoryForFamily(null)).toBeNull();
    // Sin la aclaración o con otras mayúsculas y tildes.
    expect(mercadolibreCatalog.categoryForFamily('subconjunto')).toBe('MLA373289');
    expect(mercadolibreCatalog.categoryForFamily('KIT DE DISTRIBUCION')).toBe('MLA373298');
  });

  it('solo los campos que se cargan a mano, con marca, número de pieza y origen desde la ficha', () => {
    expect(mercadolibreCatalog.categories).toHaveLength(16);
    for (const { id } of mercadolibreCatalog.categories) {
      const c = mercadolibreCatalog.category(id)!;
      const ids = c.fields.map((f) => f.id);
      expect(ids).toEqual(expect.arrayContaining(['BRAND', 'PART_NUMBER']));
      for (const hidden of ['ITEM_CONDITION', 'VEHICLE_TYPE', 'GTIN', 'SELLER_SKU', 'PACKAGE_WEIGHT']) {
        expect(ids, `${c.name} ${hidden}`).not.toContain(hidden);
      }
      // El paquete lo pide Mercado Libre para el envío, en cm y g.
      for (const size of ['SELLER_PACKAGE_HEIGHT', 'SELLER_PACKAGE_WIDTH', 'SELLER_PACKAGE_LENGTH']) {
        expect(c.fields.find((f) => f.id === size), `${c.name} ${size}`).toMatchObject({ type: 'number_unit', units: ['cm'], required: true });
      }
      expect(c.fields.find((f) => f.id === 'SELLER_PACKAGE_WEIGHT')).toMatchObject({ type: 'number_unit', units: ['g'], required: true });
      // Los impuestos los pide Mercado Libre y suelen ser los mismos en toda la tienda.
      for (const tax of ['VALUE_ADDED_TAX', 'IMPORT_DUTY']) {
        expect(c.fields.find((f) => f.id === tax), `${c.name} ${tax}`).toMatchObject({ type: 'list', required: true, sameInStore: true });
      }
      expect(c.fields.find((f) => f.id === 'BRAND')?.fromProduct).toBe('brand');
      expect(new Set(c.fields.map((f) => f.label.toLowerCase())).size, c.name).toBe(c.fields.length);
      for (const f of c.fields) {
        if (f.type === 'list') expect(f.options?.length, `${c.name} ${f.id}`).toBeGreaterThan(0);
        if (f.type === 'number_unit') expect(f.units).toContain(f.defaultUnit);
      }
    }
    const clutch = mercadolibreCatalog.category('MLA373460')!;
    expect(clutch.fields.find((f) => f.id === 'CLUTCH_TYPE')).toMatchObject({ type: 'list', options: ['Multidisco', 'Bidisco', 'Monodisco'] });
    expect(clutch.fields.find((f) => f.id === 'OEM')).toMatchObject({ multiple: true });
  });

  it('se busca por código o por nombre', () => {
    expect(findCategory(mercadolibreCatalog, 'mla47083')?.name).toBe('Bielas');
    expect(findCategory(mercadolibreCatalog, 'bombas de agua')?.id).toBe('MLA60598');
    expect(findCategory(mercadolibreCatalog, 'Escapes')).toBeNull();
  });
});

describe('valores de catálogo', () => {
  const field = (f: Partial<CatalogField>): CatalogField => ({ id: 'X', label: 'Campo', type: 'text', ...f });

  it('opciones: solo las del canal, con su forma exacta', () => {
    const f = field({ label: 'Tipo de embrague', type: 'list', options: ['Multidisco', 'Bidisco', 'Monodisco'] });
    expect(cleanCatalogValue(f, ' monodisco ')).toBe('Monodisco');
    expect(() => cleanCatalogValue(f, 'Tridisco')).toThrow('Tipo de embrague: «Tridisco» no es una opción. Puede ser Multidisco, Bidisco o Monodisco.');
  });

  it('sí o no', () => {
    const f = field({ type: 'boolean' });
    expect(cleanCatalogValue(f, 'si')).toBe('Sí');
    expect(cleanCatalogValue(f, 'NO')).toBe('No');
    expect(() => cleanCatalogValue(f, 'tal vez')).toThrow(CatalogError);
  });

  it('números, con coma o punto, y con la unidad del canal', () => {
    expect(cleanCatalogValue(field({ type: 'number' }), '4')).toBe('4');
    expect(() => cleanCatalogValue(field({ type: 'number' }), 'cuatro')).toThrow('Campo: tiene que ser un número.');
    const f = field({ label: 'Largo', type: 'number_unit', units: ['"', 'cm', 'mm'], defaultUnit: 'mm' });
    expect(cleanCatalogValue(f, '76,5')).toBe('76.5 mm');
    expect(cleanCatalogValue(f, '7.65 CM')).toBe('7.65 cm');
    expect(cleanCatalogValue(f, '3"')).toBe('3 "');
    expect(cleanCatalogValue(f, '3 pulgadas')).toBe('3 "');
    expect(() => cleanCatalogValue(f, '76 km')).toThrow('Largo: la unidad tiene que ser ", cm o mm.');
  });

  it('texto: las sugerencias con su forma, y cualquier otro texto', () => {
    const f = field({ label: 'Material', options: ['Acero inoxidable', 'Aluminio'] });
    expect(cleanCatalogValue(f, 'aluminio')).toBe('Aluminio');
    expect(cleanCatalogValue(f, 'Hierro   fundido')).toBe('Hierro fundido');
    expect(cleanCatalogValue(f, '  ')).toBeNull();
    expect(cleanCatalogValue(f, null)).toBeNull();
  });

  it('varios valores: separados por coma o en lista, sin repetir', () => {
    const f = field({ label: 'Código OEM', multiple: true });
    expect(cleanCatalogValue(f, 'A-1, B-2; a-1\nC-3')).toBe('A-1, B-2, C-3');
    expect(cleanCatalogValue(f, ['X', ' Y '])).toBe('X, Y');
    expect(() => cleanCatalogValue(field({ label: 'Modelo' }), ['A', 'B'])).toThrow('Modelo acepta un solo valor.');
  });

  it('lo que sale de la ficha no se carga acá, y no acepta campos de otra categoría', () => {
    const fields = [field({ id: 'BRAND', label: 'Marca', fromProduct: 'brand' }), field({ id: 'MODEL', label: 'Modelo' })];
    expect(() => cleanCatalogValues(fields, { BRAND: 'Otra' })).toThrow('Marca sale de la ficha del producto: se cambia ahí.');
    expect(() => cleanCatalogValues(fields, { CLUTCH_TYPE: 'Monodisco' })).toThrow('No hay un campo «CLUTCH_TYPE» en esta categoría. Los campos son MODEL.');
    expect(cleanCatalogValues(fields, { modelo: 'G3' })).toEqual({ MODEL: 'G3' });
  });

  it('se guardan en los atributos sin tocar los demás', () => {
    const fields = [
      field({ id: 'A', label: 'Incluye disco', type: 'boolean' }),
      field({ id: 'B', label: 'Tipo de embrague' }),
      field({ id: 'C', label: 'Código OEM', multiple: true }),
    ];
    const before = [
      { name: 'Garantía', value: '6 meses' },
      { name: 'tipo de embrague', value: 'Bidisco' },
      { name: 'Incluye disco', value: 'No' },
    ];
    expect(readCatalogValues(fields, before)).toEqual({ A: 'No', B: 'Bidisco' });
    const after = mergeCatalogAttributes(before, fields, { A: 'Sí', C: 'X, Y' });
    expect(after).toEqual([
      { name: 'Incluye disco', value: 'Sí' },
      { name: 'tipo de embrague', value: 'Bidisco' },
      { name: 'Código OEM', value: 'X, Y' },
      { name: 'Garantía', value: '6 meses' },
    ]);
    expect(mergeCatalogAttributes(after, fields, { B: null })).not.toContainEqual(expect.objectContaining({ value: 'Bidisco' }));
  });

  it('la categoría elegida a mano manda sobre la de la familia', () => {
    expect(resolveCatalog(mercadolibreCatalog, 'Kit de embrague', null)).toMatchObject({ category: { id: 'MLA373460' }, source: 'family' });
    expect(resolveCatalog(mercadolibreCatalog, 'Kit de embrague', 'MLA47083')).toMatchObject({
      category: { id: 'MLA47083' },
      source: 'manual',
      familyCategory: { id: 'MLA373460' },
    });
    expect(resolveCatalog(mercadolibreCatalog, 'Otros', null)).toMatchObject({ category: null, source: null });
    expect(resolveCatalog(mercadolibreCatalog, 'Otros', 'MLA0')).toMatchObject({ category: null });
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('datos de catálogo de una publicación', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let kitId = '';
  let otherId = '';
  let webId = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE publications, products, stores, channels, accounts CASCADE');
    const ml = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const web = await db.channel.create({ data: { kind: 'WEB_STORE', name: 'Tienda web' } });
    const accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    const store = await db.store.create({ data: { accountId, channelId: ml.id, name: 'TIENDA' } });
    const webStore = await db.store.create({ data: { accountId, channelId: web.id, name: 'WEB' } });
    const kit = await db.product.create({
      data: { accountId, name: 'Kit de embrague Gol', productType: 'Kit de embrague', brand: 'Marca Uno', partNumber: 'P-100', origin: 'Brasil' },
    });
    const other = await db.product.create({ data: { accountId, name: 'Tornillo', productType: 'Otros' } });
    kitId = (
      await db.publication.create({
        data: { productId: kit.id, storeId: store.id, externalId: 'MLA1110001', attributes: [{ name: 'Garantía', value: '6 meses' }] },
      })
    ).id;
    otherId = (await db.publication.create({ data: { productId: other.id, storeId: store.id, externalId: 'MLA1110002' } })).id;
    webId = (await db.publication.create({ data: { productId: kit.id, storeId: webStore.id } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('la categoría sale de la familia, y marca, número de pieza y origen de la ficha', async () => {
    const data = (await loadCatalogData(db, kitId))!;
    expect(data).toMatchObject({ channelName: 'Mercado Libre', family: 'Kit de embrague', category: { id: 'MLA373460', name: 'Kits de Embrague' }, source: 'family' });
    expect(data.fromProduct.map((p) => [p.field.label, p.value])).toEqual([
      ['Marca', 'Marca Uno'],
      ['Número de pieza', 'P-100'],
    ]);
    expect(data.fields.map((f) => f.id)).toContain('CLUTCH_TYPE');
    expect(data.fields.map((f) => f.id)).not.toContain('BRAND');
    expect(await loadCatalogData(db, webId)).toBeNull();
  });

  it('guarda solo valores válidos y deja los otros atributos', async () => {
    const r = await saveCatalogData(db, {
      publicationId: kitId,
      expectedCategoryId: 'MLA373460',
      values: { CLUTCH_TYPE: 'monodisco', INCLUDES_DISC: 'si', OEM: 'A-1, B-2', INCLUDES_FLYWHEEL: '' },
    });
    expect(r.values).toEqual({ CLUTCH_TYPE: 'Monodisco', INCLUDES_DISC: 'Sí', OEM: 'A-1, B-2' });
    const pub = await db.publication.findUniqueOrThrow({ where: { id: kitId } });
    expect(pub.attributes).toEqual([
      { name: 'Tipo de embrague', value: 'Monodisco' },
      { name: 'Incluye disco', value: 'Sí' },
      { name: 'Código OEM', value: 'A-1, B-2' },
      { name: 'Garantía', value: '6 meses' },
    ]);

    await expect(saveCatalogData(db, { publicationId: kitId, values: { CLUTCH_TYPE: 'Tridisco' } })).rejects.toThrow(CatalogError);
    await expect(saveCatalogData(db, { publicationId: kitId, expectedCategoryId: 'MLA47083', values: { CLUTCH_TYPE: 'Bidisco' } })).rejects.toThrow(
      'La categoría de la publicación cambió. Recargá la página.',
    );
    // Lo que falló no cambió nada.
    expect((await loadCatalogData(db, kitId))!.values.CLUTCH_TYPE).toBe('Monodisco');
  });

  it('la categoría se elige a mano, y la de la familia no queda fijada', async () => {
    await expect(saveCatalogData(db, { publicationId: otherId, values: { MODEL: 'X' } })).rejects.toThrow('elegí una primero');
    const r = await saveCatalogData(db, { publicationId: otherId, category: 'Juntas de Motor', values: { HEAD_BOLTS_INCLUDED: 'No' } });
    expect(r).toMatchObject({ category: { id: 'MLA373322' }, source: 'manual', values: { HEAD_BOLTS_INCLUDED: 'No' } });
    expect((await db.publication.findUniqueOrThrow({ where: { id: otherId } })).channelCategory).toBe('MLA373322');

    await saveCatalogData(db, { publicationId: kitId, category: 'MLA373460', values: {} });
    expect((await db.publication.findUniqueOrThrow({ where: { id: kitId } })).channelCategory).toBeNull();
    await saveCatalogData(db, { publicationId: kitId, category: 'MLA47083', values: {} });
    expect((await loadCatalogData(db, kitId))!).toMatchObject({ source: 'manual', category: { id: 'MLA47083' }, familyCategory: { id: 'MLA373460' } });
    await saveCatalogData(db, { publicationId: kitId, category: null, values: {} });
    expect((await loadCatalogData(db, kitId))!).toMatchObject({ source: 'family', category: { id: 'MLA373460' } });

    await expect(saveCatalogData(db, { publicationId: kitId, category: 'Escapes', values: {} })).rejects.toThrow('No hay una categoría «Escapes»');
    await expect(saveCatalogData(db, { publicationId: webId, values: { A: 'b' } })).rejects.toThrow('Tienda web todavía no tiene datos de catálogo');
  });
});
