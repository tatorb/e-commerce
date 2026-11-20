import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { categoryFromApi } from '@/channels/mercadolibre/catalog/remote';
import { forgetSavedCategories } from '@/lib/catalog-categories';
import { catalogForClaude } from '@/lib/mcp/catalog';
import { encrypt } from '@/lib/crypto';

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

describe('cualquier categoría de Mercado Libre', () => {
  it('lee la categoría y su formulario de la API, con los mismos criterios que la lista fija', () => {
    const info = { id: 'MLA458790', name: 'Kits de Reconstrucción', children_categories: [], settings: { listing_allowed: true }, path_from_root: [{ name: 'Accesorios para Vehículos' }, { name: 'Kits de Reconstrucción' }] };
    const attributes = [
      { id: 'BRAND', name: 'Marca', value_type: 'string', tags: { required: true } },
      { id: 'KIT_TYPE', name: 'Tipo de kit', value_type: 'list', values: [{ name: 'Completo' }, { name: 'Parcial' }], tags: { required: true } },
      { id: 'INCLUDES_GASKETS', name: 'Incluye juntas', value_type: 'boolean', tags: {} },
      { id: 'BORE', name: 'Diámetro', value_type: 'number_unit', allowed_units: [{ id: 'mm', name: 'mm' }, { id: 'cm', name: 'cm' }], default_unit: 'mm', tags: {} },
      { id: 'OEM', name: 'Código OEM', value_type: 'string', tags: { multivalued: true } },
      { id: 'HIDDEN_ONE', name: 'Oculto', value_type: 'string', tags: { hidden: true } },
      { id: 'ITEM_CONDITION', name: 'Condición', value_type: 'list', values: [{ name: 'Nuevo' }], tags: {} },
      { id: 'SELLER_PACKAGE_WEIGHT', name: 'Peso', value_type: 'number_unit', tags: {} },
    ];
    const c = categoryFromApi('mla458790', info, attributes)!;
    expect(c).toMatchObject({ id: 'MLA458790', name: 'Kits de Reconstrucción', path: 'Accesorios para Vehículos > Kits de Reconstrucción', leaf: true });
    expect(c.fields.slice(0, 5)).toEqual([
      { id: 'BRAND', label: 'Marca', type: 'text', required: true, fromProduct: 'brand' },
      { id: 'KIT_TYPE', label: 'Tipo de kit', type: 'list', options: ['Completo', 'Parcial'], required: true },
      { id: 'INCLUDES_GASKETS', label: 'Incluye juntas', type: 'boolean' },
      { id: 'BORE', label: 'Diámetro', type: 'number_unit', units: ['mm', 'cm'], defaultUnit: 'mm' },
      { id: 'OEM', label: 'Código OEM', type: 'text', multiple: true },
    ]);
    // Los que el formulario esconde van aparte, al final; sin la condición; el paquete y los impuestos van siempre, una sola vez.
    expect(c.fields[5]).toEqual({ id: 'HIDDEN_ONE', label: 'Oculto', type: 'text', extra: true });
    expect(c.fields.map((f) => f.id)).not.toContain('ITEM_CONDITION');
    expect(c.fields.filter((f) => f.id === 'SELLER_PACKAGE_WEIGHT')).toHaveLength(1);
    expect(c.fields.map((f) => f.id)).toContain('VALUE_ADDED_TAX');
    expect(categoryFromApi('MLA1', { ...info, children_categories: [{ id: 'x' }] }, [])!.leaf).toBe(false);
    expect(categoryFromApi('MLA1', { error: 'not_found' }, [])).toBeNull();
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
    await db.$executeRawUnsafe('TRUNCATE publications, products, stores, channels, accounts, channel_categories CASCADE');
    forgetSavedCategories();
    const ml = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const web = await db.channel.create({ data: { kind: 'WEB_STORE', name: 'Tienda web' } });
    const accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    const store = await db.store.create({ data: { accountId, channelId: ml.id, name: 'TIENDA' } });
    const webStore = await db.store.create({ data: { accountId, channelId: web.id, name: 'WEB' } });
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    await db.channelConnection.create({
      data: { storeId: store.id, appId: '1', appSecret: encrypt('s'), appSecretHint: 's', status: 'ACTIVE', externalUserId: '77', accessToken: encrypt('acc'), refreshToken: encrypt('ref'), expiresAt: new Date(Date.now() + 3 * 3600_000) },
    });
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

  it('cualquier categoría del canal: la trae, la guarda y ofrece usar la del canal', async () => {
    const remote = {
      id: 'MLA458790',
      name: 'Kits de Reconstrucción',
      path: 'Accesorios > Kits de Reconstrucción',
      leaf: true,
      fields: [{ id: 'KIT_TYPE', label: 'Tipo de kit', type: 'list' as const, options: ['Completo', 'Parcial'] }],
    };
    const fetch = vi.spyOn(mercadolibreCatalog, 'fetchCategory').mockImplementation(async (id) =>
      id === 'MLA458790' ? remote : id === 'MLA1747' ? { ...remote, id, name: 'Accesorios', leaf: false } : null,
    );
    // El canal la tiene en una categoría que la app no conoce: el aviso ofrece usarla.
    await db.channelCopy.create({ data: { publicationId: otherId, readAt: new Date(), status: 'ACTIVE', categoryId: 'MLA458790' } });
    await saveCatalogData(db, { publicationId: otherId, category: 'MLA47083', values: {} });
    const before = catalogForClaude(await loadCatalogData(db, otherId))!;
    expect(before.aviso_de_categoria).toContain('MLA458790');
    expect(before.usar_la_del_canal).toMatchObject({ herramienta: 'save_catalog_data', categoria: 'MLA458790' });

    // Con el código, la lee del canal con la llave de la tienda, la guarda y trae su formulario.
    await saveCatalogData(db, { publicationId: otherId, category: 'mla458790', values: { KIT_TYPE: 'Completo' } });
    const after = (await loadCatalogData(db, otherId))!;
    expect(after).toMatchObject({ category: { id: 'MLA458790', name: 'Kits de Reconstrucción' }, values: { KIT_TYPE: 'Completo' }, categoryWarning: null });
    expect(catalogForClaude(after)).not.toHaveProperty('usar_la_del_canal');
    expect(await db.channelCategory.findUniqueOrThrow({ where: { kind_categoryId: { kind: 'MERCADOLIBRE', categoryId: 'MLA458790' } } })).toMatchObject({ name: 'Kits de Reconstrucción' });
    expect(fetch.mock.calls.filter(([id]) => id === 'MLA458790')).toHaveLength(1);
    // Ya guardada, no se vuelve a pedir, aunque el servidor arranque de cero.
    forgetSavedCategories();
    await saveCatalogData(db, { publicationId: kitId, category: 'MLA458790', values: {} });
    expect(fetch.mock.calls.filter(([id]) => id === 'MLA458790')).toHaveLength(1);

    // Un código que no existe, o una categoría con subcategorías, no se usa.
    await expect(saveCatalogData(db, { publicationId: kitId, category: 'MLA999999', values: {} })).rejects.toThrow('no es una categoría de Mercado Libre');
    await expect(saveCatalogData(db, { publicationId: kitId, category: 'MLA1747', values: {} })).rejects.toThrow('tiene subcategorías');
    fetch.mockRestore();
  });

  it('kits de embrague: suma los atributos que el canal acepta y la lista fija no tiene, los propone de la ficha técnica y deja vaciarlos', async () => {
    // Lo que devuelve la API de categorías: el formulario y, escondidos, los datos del disco.
    const info = { id: 'MLA373460', name: 'Kits de Embrague', children_categories: [], settings: { listing_allowed: true } };
    const units = [{ id: 'mm', name: 'mm' }, { id: 'cm', name: 'cm' }];
    const attributes = [
      { id: 'BRAND', name: 'Marca', value_type: 'string', tags: { required: true } },
      { id: 'CLUTCH_TYPE', name: 'Tipo de embrague', value_type: 'list', values: [{ name: 'Monodisco' }], tags: {} },
      { id: 'DISC_DIAMETER', name: 'Diámetro del disco', value_type: 'number_unit', allowed_units: units, default_unit: 'mm', tags: { hidden: true } },
      { id: 'SPLINES_NUMBER', name: 'Cantidad de estrías', value_type: 'number', tags: { others: true } },
      { id: 'TEETH_NUMBER', name: 'Cantidad de dientes', value_type: 'number', tags: { hidden: true } },
      { id: 'INPUT_SHAFT_DIAMETER', name: 'Diámetro del eje de entrada', value_type: 'number_unit', allowed_units: units, default_unit: 'mm', tags: { hidden: true } },
      { id: 'IS_KIT', name: 'Es kit', value_type: 'boolean', tags: { read_only: true } },
    ];
    const fetch = vi.spyOn(mercadolibreCatalog, 'fetchCategory').mockImplementation(async (id) => (id === 'MLA373460' ? categoryFromApi(id, info, attributes) : null));
    const { productId } = await db.publication.findUniqueOrThrow({ where: { id: kitId }, select: { productId: true } });
    await db.product.update({
      where: { id: productId },
      data: { specs: [{ name: 'Diámetro', value: '180' }, { name: 'Cantidad de estrías del disco', value: '26' }, { name: 'Peso', value: '4 kg' }] },
    });

    const data = (await loadCatalogData(db, kitId))!;
    const ids = data.fields.map((f) => f.id);
    // Los de la lista fija siguen, los nuevos van después y antes del paquete; los de solo lectura no entran.
    expect(ids.slice(0, 2)).toEqual(['CLUTCH_TYPE', 'INCLUDES_CLUTCH_PLATE']);
    expect(ids).toEqual(expect.arrayContaining(['DISC_DIAMETER', 'SPLINES_NUMBER', 'TEETH_NUMBER', 'INPUT_SHAFT_DIAMETER']));
    expect(ids).not.toContain('IS_KIT');
    expect(ids.indexOf('DISC_DIAMETER')).toBeLessThan(ids.indexOf('SELLER_PACKAGE_HEIGHT'));
    expect(data.fields.find((f) => f.id === 'DISC_DIAMETER')).toMatchObject({ label: 'Diámetro del disco', type: 'number_unit', extra: true });
    // La ficha técnica los propone, con la unidad del campo; no quedan guardados.
    expect(data.fromSpecs).toEqual({ DISC_DIAMETER: { value: '180 mm', spec: 'Diámetro' }, SPLINES_NUMBER: { value: '26', spec: 'Cantidad de estrías del disco' } });
    expect(data.values.DISC_DIAMETER).toBeUndefined();
    const claude = catalogForClaude(data)!;
    expect(claude.campos.find((c) => c.campo === 'DISC_DIAMETER')).toMatchObject({ fuera_del_formulario_del_canal: true, valor: null, propuesto_de_la_ficha_tecnica: '180 mm', sale_del_dato: 'Diámetro' });
    expect((await db.channelCategory.findUniqueOrThrow({ where: { kind_categoryId: { kind: 'MERCADOLIBRE', categoryId: 'MLA373460' } } })).full).toBe(true);

    // Se guardan como cualquier campo, por código o por nombre, y uno que no aplica se vacía.
    await db.publication.update({ where: { id: kitId }, data: { attributes: [{ name: 'Diámetro del eje de entrada', value: '25 mm' }, { name: 'Diámetro del disco', value: '210 mm' }] } });
    const saved = await saveCatalogData(db, { publicationId: kitId, values: { 'Diámetro del disco': '180 mm', SPLINES_NUMBER: '26', INPUT_SHAFT_DIAMETER: null } });
    expect(saved.values).toMatchObject({ DISC_DIAMETER: '180 mm', SPLINES_NUMBER: '26' });
    expect(saved.values.INPUT_SHAFT_DIAMETER).toBeUndefined();
    expect((await loadCatalogData(db, kitId))!.fromSpecs).toEqual({});
    // Leída una vez: aunque el servidor arranque de cero, sale de lo guardado.
    forgetSavedCategories();
    expect((await loadCatalogData(db, kitId))!.fields.map((f) => f.id)).toContain('TEETH_NUMBER');
    expect(fetch.mock.calls.filter(([id]) => id === 'MLA373460')).toHaveLength(1);
    fetch.mockRestore();
  });
});
