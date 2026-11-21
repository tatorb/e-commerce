import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { variantKey } from '@/domain/media';
import { productKey } from '@/domain/product-duplicates';
import type { McpContext } from '@/lib/mcp/tool';

// Los productos duplicados: listarlos, unir dos y que no se pueda crear otro
// igual. Los datos son inventados, con la forma del caso de los aros.

const url = process.env.TEST_DATABASE_URL;

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { listDuplicateProducts, mergeProducts } = await import('@/lib/product-merge');
const { saveProduct } = await import('@/domain/products');
const { updateProductInfo } = await import('@/domain/product-info');
const { DuplicateProductError } = await import('@/domain/product-duplicates');

describe('la clave de un producto, sin la base', () => {
  it('la misma marca y número de pieza, sin importar mayúsculas, acentos, espacios, puntos, guiones ni barras', () => {
    expect(productKey('RIK', 'R43090000')).toBe(productKey(' rik ', 'r-4309.0000'));
    expect(productKey('Sabó', '79 470')).toBe(productKey('SABO', '79470'));
    expect(productKey('RIK', 'R43090000')).not.toBe(productKey('Otra', 'R43090000'));
    // Sin número de pieza no se puede saber.
    expect(productKey('RIK', '')).toBeNull();
    expect(productKey('RIK', null)).toBeNull();
  });
});

describe.skipIf(!url)('los productos duplicados en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';
  const userId = 'persona';
  const measures = [
    { sku: 'R4309-00', measure: 'STD' },
    { sku: 'R4309-50', measure: '0,50' },
  ];
  const [std, half] = measures.map((m) => variantKey(m)!);

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE insur_article_links, insur_settings, activity_logs, publication_notes, buyer_questions, publication_visit_days, tasks, combo_items, listing_families, branch_stock, branches, stock_movements, channel_sales, product_costs, product_stock, channel_copies, sales, publications, compatibilities, product_research, product_variants, products, product_options, stores, channels, accounts, users CASCADE',
    );
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    await db.user.create({ data: { id: userId, email: 'persona@ejemplo.com', name: 'Persona', isAdmin: true } });
    accountId = account.id;
    storeId = store.id;
  });

  /** El caso: el bueno, con su familia activa, stock y cruce con Insur; y el duplicado, sin stock, con una publicación eliminada. */
  async function scene() {
    const good = await db.product.create({
      data: {
        accountId,
        name: 'Aros Marca Uno R43090000',
        brand: 'Marca Uno',
        partNumber: 'R43090000',
        productType: 'Aros',
        origin: 'Japón',
        specs: [{ name: 'Diámetro', value: '79 mm' }],
        stockSince: new Date('2026-11-01T00:00:00Z'),
        variants: { create: measures.map((m, position) => ({ ...m, position })) },
        compatibilities: { create: [{ vehicleBrand: 'Chevrolet', model: 'Corsa', engine: '1.6', position: 0 }] },
        stock: { create: [{ key: std, label: 'STD', quantity: 8 }, { key: half, label: '0,50', quantity: 4 }] },
      },
    });
    const live = await db.publication.create({ data: { productId: good.id, storeId, externalId: 'MLA3311991836', title: 'Aros Corsa STD', channelStatus: 'ACTIVE', variantKey: std, unitsPerSale: 4 } });
    await db.insurSettings.create({ data: { accountId, cutoffAt: new Date('2026-11-18T03:00:00Z') } });
    await db.insurArticleLink.create({ data: { accountId, insurId: 1, code: 'R43090000 STD', status: 'AUTO', productId: good.id, key: std } });
    const copy = await db.product.create({
      data: {
        accountId,
        name: 'Aros R43090000',
        brand: 'marca uno',
        partNumber: 'R-4309.0000',
        productType: 'Aros',
        origin: 'Brasil',
        line: 'Liviano nafta',
        specs: [{ name: 'Diámetro', value: '80 mm' }, { name: 'Espesor', value: '1,5 mm' }],
        variants: { create: [{ sku: 'VIEJO-STD', measure: 'std', position: 0 }] },
        compatibilities: {
          create: [
            { vehicleBrand: 'Chevrolet', model: 'Corsa', engine: '1.6', position: 0 },
            { vehicleBrand: 'Suzuki', model: 'Fun', engine: '1.4', position: 1 },
          ],
        },
        research: { create: { manufacturerText: 'Aros de acero.' } },
      },
    });
    const old = await db.publication.create({
      data: { productId: copy.id, storeId, externalId: 'MLA1786899121', title: 'Aros viejos', channelStatus: 'DELETED', variantKey: variantKey({ sku: 'VIEJO-STD', measure: 'std' }) },
    });
    await db.publicationNote.create({ data: { accountId, publicationId: old.id, text: 'Nota de la publicación vieja', authorId: userId } });
    await db.sale.create({
      data: { storeId, orderId: '900', state: 'PAID', orderedAt: new Date('2026-06-01T12:00:00Z'), itemsAmount: 100, checkedAt: new Date(), lines: [{ listingId: 'MLA1786899121', publicationId: old.id, productId: copy.id, quantity: 1, unitPrice: 100 }] },
    });
    return { good, copy, live, old };
  }

  it('list_duplicate_products los encuentra y sugiere que quede el que tiene publicaciones activas, stock y cruce con Insur', async () => {
    const { good, copy } = await scene();
    // Otro producto con el mismo número de pieza y otra marca no es un duplicado.
    await db.product.create({ data: { accountId, name: 'Otra cosa', brand: 'Marca Dos', partNumber: 'R43090000' } });
    const groups = await listDuplicateProducts(db, accountId);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ partNumber: 'R43090000', suggestedId: good.id, why: 'Queda «Aros Marca Uno R43090000»: tiene publicaciones activas o pausadas, está cruzado con Insur, tiene stock.' });
    expect(groups[0].products).toEqual([
      { id: good.id, name: 'Aros Marca Uno R43090000', brand: 'Marca Uno', partNumber: 'R43090000', stock: 12, insur: ['R43090000 STD'], publications: [expect.objectContaining({ externalId: 'MLA3311991836', status: 'Activa', live: true })] },
      { id: copy.id, name: 'Aros R43090000', brand: 'marca uno', partNumber: 'R-4309.0000', stock: null, insur: [], publications: [expect.objectContaining({ externalId: 'MLA1786899121', live: false })] },
    ]);
  });

  it('une el duplicado con el bueno: primero la vista previa, sin cambiar nada, y después aplicado', async () => {
    const { good, copy, old, live } = await scene();
    const preview = await mergeProducts(db, { accountId, keepId: good.id, goesId: copy.id, preview: true });
    expect(preview).toMatchObject({ done: false, blockers: [], keep: { id: good.id }, goes: { id: copy.id } });
    // La publicación trae su medida: va a la STD del que queda, aunque el SKU sea otro.
    expect(preview.publications).toEqual([{ id: old.id, externalId: 'MLA1786899121', title: 'Aros viejos', status: expect.any(String), measure: 'STD', note: null }]);
    expect(preview.adds).toEqual(['la línea: «Liviano nafta»', '1 dato de la ficha técnica: Espesor', '1 compatibilidad', 'de la investigación, lo del fabricante']);
    // Donde los dos tienen algo distinto, gana el que queda.
    expect(preview.conflicts).toEqual(['el origen: queda «Japón», se descarta «Brasil»', 'ficha técnica, Diámetro: queda «79 mm», se descarta «80 mm»']);
    expect(await db.product.count({ where: { accountId } })).toBe(2);
    expect((await db.publication.findUniqueOrThrow({ where: { id: old.id } })).productId).toBe(copy.id);

    const done = await mergeProducts(db, { accountId, keepId: good.id, goesId: copy.id });
    expect(done.done).toBe(true);
    // El duplicado ya no está.
    expect(await db.product.findUnique({ where: { id: copy.id } })).toBeNull();
    expect(await listDuplicateProducts(db, accountId)).toEqual([]);
    // La publicación pasó, con su medida, su nota y su venta.
    expect(await db.publication.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ productId: good.id, variantKey: std, channelStatus: 'DELETED' });
    expect(await db.publicationNote.count({ where: { publicationId: old.id } })).toBe(1);
    expect((await db.sale.findFirstOrThrow({ where: { orderId: '900' } })).lines).toEqual([expect.objectContaining({ publicationId: old.id, productId: good.id })]);
    // Lo del que queda no se pisó, y se sumó lo que no tenía.
    const kept = await db.product.findUniqueOrThrow({ where: { id: good.id }, include: { compatibilities: { orderBy: { position: 'asc' } }, research: true, stock: true, variants: true, publications: true } });
    expect(kept).toMatchObject({ name: 'Aros Marca Uno R43090000', origin: 'Japón', line: 'Liviano nafta', specs: [{ name: 'Diámetro', value: '79 mm' }, { name: 'Espesor', value: '1,5 mm' }] });
    expect(kept.compatibilities.map((c) => c.model)).toEqual(['Corsa', 'Fun']);
    expect(kept.research?.manufacturerText).toBe('Aros de acero.');
    expect(kept.variants).toHaveLength(2);
    expect(kept.stock.map((s) => s.quantity).sort()).toEqual([4, 8]);
    expect(kept.publications.map((p) => p.id).sort()).toEqual([live.id, old.id].sort());
    expect((await db.insurArticleLink.findFirstOrThrow({ where: { insurId: 1 } })).productId).toBe(good.id);
    expect((await db.publication.findUniqueOrThrow({ where: { id: live.id } })).unitsPerSale).toBe(4);
  });

  it('se niega, sin cambiar nada, si el que se va tiene stock, cruce con Insur o una publicación activa que no se puede pasar', async () => {
    const { good, copy, old } = await scene();
    await db.product.update({ where: { id: copy.id }, data: { stockSince: new Date() } });
    await db.productStock.create({ data: { productId: copy.id, key: '', quantity: 3 } });
    const withStock = await mergeProducts(db, { accountId, keepId: good.id, goesId: copy.id });
    expect(withStock).toMatchObject({ done: false, blockers: ['«Aros R43090000» tiene stock cargado (3 en total). Pasalo a 0 o cargalo en el que queda antes de unir.'] });
    expect(await db.product.count({ where: { accountId } })).toBe(2);
    expect((await db.publication.findUniqueOrThrow({ where: { id: old.id } })).productId).toBe(copy.id);

    await db.productStock.deleteMany({ where: { productId: copy.id } });
    await db.insurArticleLink.create({ data: { accountId, insurId: 2, code: 'R43090000 050', status: 'CONFIRMED', productId: copy.id, key: '' } });
    expect((await mergeProducts(db, { accountId, keepId: good.id, goesId: copy.id })).blockers).toEqual(['«Aros R43090000» está cruzado con el sistema de Insur (R43090000 050). Ignorá o cambiá ese cruce antes de unir.']);

    // Una publicación activa de una medida que el que queda no tiene.
    await db.insurArticleLink.deleteMany({ where: { insurId: 2 } });
    await db.publication.update({ where: { id: old.id }, data: { channelStatus: 'ACTIVE', variantKey: 'sku:OTRO medida:1.00' } });
    const blocked = await mergeProducts(db, { accountId, keepId: good.id, goesId: copy.id });
    expect(blocked.blockers[0]).toContain('La publicación MLA1786899121 está activa y su medida no está en «Aros Marca Uno R43090000»: no se puede pasar.');
    // Eliminada, pasa igual, sin medida, y lo dice.
    await db.publication.update({ where: { id: old.id }, data: { channelStatus: 'DELETED' } });
    const loose = await mergeProducts(db, { accountId, keepId: good.id, goesId: copy.id });
    expect(loose.done).toBe(true);
    expect(loose.publications[0]).toMatchObject({ measure: null, note: 'No se puede saber a qué medida del que queda corresponde: queda sin medida.' });
    expect((await db.publication.findUniqueOrThrow({ where: { id: old.id } })).variantKey).toBeNull();
  });

  it('si el que se va está en un combo, el combo pasa a usar el que queda', async () => {
    const { good, copy } = await scene();
    const combo = await db.product.create({ data: { accountId, name: 'Kit de motor', kind: 'COMBO' } });
    await db.comboItem.create({ data: { comboId: combo.id, productId: copy.id, quantity: 2 } });
    const plan = await mergeProducts(db, { accountId, keepId: good.id, goesId: copy.id });
    expect(plan).toMatchObject({ done: true, combos: ['Kit de motor: pasa a usar «Aros Marca Uno R43090000»'] });
    expect(await db.comboItem.findMany({ where: { comboId: combo.id }, select: { productId: true, quantity: true } })).toEqual([{ productId: good.id, quantity: 2 }]);
    // Un combo no se une.
    const other = await db.product.create({ data: { accountId, name: 'Otro kit', kind: 'COMBO' } });
    expect((await mergeProducts(db, { accountId, keepId: combo.id, goesId: other.id })).blockers).toEqual(['Uno de los dos es un combo: los combos no se unen.']);
  });

  it('crear un duplicado queda bloqueado: al crear se usa el que ya existe, y una ficha no puede quedar igual a otra', async () => {
    const { good } = await scene();
    await db.product.deleteMany({ where: { name: 'Aros R43090000' } });
    const data = { name: 'Aros repetidos', kind: 'INDIVIDUAL' as const, brand: 'MARCA UNO', partNumber: 'r 4309-0000', productType: 'Aros', engineSystem: null, line: null, origin: null, warranty: null, kitContents: null, notes: null, specs: [], variants: [], compatibilities: [], assets: [] };
    await db.productOption.createMany({ data: [{ accountId, kind: 'BRAND', name: 'Marca Uno' }, { accountId, kind: 'TYPE', name: 'Aros' }] });
    // Al crear: no hay un segundo producto, se usa el que está y no se lo toca.
    const made = await saveProduct(db, { accountId, productId: null, data });
    expect(made).toEqual({ id: good.id, existing: { id: good.id, name: 'Aros Marca Uno R43090000' } });
    expect(await db.product.count({ where: { accountId } })).toBe(1);
    expect((await db.product.findUniqueOrThrow({ where: { id: good.id } })).name).toBe('Aros Marca Uno R43090000');
    // Con otro número de pieza sí se crea.
    const other = await saveProduct(db, { accountId, productId: null, data: { ...data, name: 'Aros otros', partNumber: 'R55550000' } });
    expect(other.existing).toBeUndefined();
    // Y esa ficha no puede pasar a tener la marca y el número de pieza del primero.
    await expect(saveProduct(db, { accountId, productId: other.id, data: { ...data, name: 'Aros otros', partNumber: 'R43090000' } })).rejects.toThrow(DuplicateProductError);
    await expect(
      db.$transaction((tx) => updateProductInfo(tx, { accountId, productId: other.id, data: { productType: 'Aros', brand: 'Marca Uno', partNumber: 'R-43090000', line: null, origin: null, variants: [], compatibilities: [] } })),
    ).rejects.toThrow('Ya hay un producto con esa marca y ese número de pieza: «Aros Marca Uno R43090000».');
    expect((await db.product.findUniqueOrThrow({ where: { id: other.id } })).partNumber).toBe('R55550000');
    // Guardar la propia ficha sin cambiar la marca ni el número de pieza no molesta.
    await saveProduct(db, { accountId, productId: good.id, data: { ...data, name: 'Aros Marca Uno R43090000', partNumber: 'R43090000' } });
  });

  it('desde Claude: lista los duplicados y une con vista previa', async () => {
    const { good, copy } = await scene();
    const { TOOLS } = await import('@/lib/mcp/server');
    const ctx: McpContext = { db, userId, access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lo que devuelve cada herramienta es distinto
    const call = async (name: string, args: Record<string, unknown>): Promise<any> => {
      const tool = TOOLS.find((t) => t.name === name)!;
      return tool.run(ctx, tool.input.parse(args));
    };
    const list = await call('list_duplicate_products', {});
    expect(list).toMatchObject({ grupos: 1, duplicados: [{ numero_de_pieza: 'R43090000', queda: good.id }] });
    expect(list.duplicados[0].productos.map((p: { id: string; stock: unknown; cruce_con_insur: unknown }) => [p.id, p.stock, p.cruce_con_insur])).toEqual([
      [good.id, 12, ['R43090000 STD']],
      [copy.id, 'La app todavía no lleva su stock.', 'no'],
    ]);
    // Por el código de una publicación de cada uno, con vista previa.
    const preview = await call('merge_products', { producto_que_queda: 'MLA3311991836', producto_que_se_va: 'MLA1786899121', vista_previa: true });
    expect(preview).toMatchObject({ vista_previa: true, queda: { id: good.id }, se_va: { id: copy.id }, publicaciones_que_pasan: [{ publicacion: 'MLA1786899121', medida_en_el_que_queda: 'STD' }] });
    expect(await db.product.count({ where: { accountId } })).toBe(2);
    const done = await call('merge_products', { producto_que_queda: good.id, producto_que_se_va: copy.id });
    expect(done.unidos).toBe(true);
    expect(await db.product.count({ where: { accountId } })).toBe(1);
    await expect(call('merge_products', { producto_que_queda: good.id, producto_que_se_va: 'No existe' })).rejects.toThrow('No encontré el producto «No existe».');
  });
});
