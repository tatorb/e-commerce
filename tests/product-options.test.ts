import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { matchOption, optionKey, optionNameProblem } from '@/domain/product-options';
import { productInputSchema, saveProduct } from '@/domain/products';
import { addOption, loadProductOptions, OptionError, optionUsage, removeOption, renameOption, resolveOrDrop, resolveProductOptions } from '@/lib/product-options';

// Las listas fijas de tipos de producto y marcas, con datos de prueba.

// Una ficha con lo mínimo, como la manda el formulario.
const product = (over: Record<string, unknown>) =>
  productInputSchema.parse({
    ...{ brand: '', partNumber: '', productType: '', engineSystem: '', line: '', origin: '', warranty: '', kitContents: '', notes: '' },
    ...{ name: 'Kit', specs: [], variants: [], compatibilities: [], assets: [] },
    ...over,
  });

describe('opciones de la lista', () => {
  it('mayúsculas, acentos y espacios no cuentan', () => {
    expect(optionKey('  Sabó ')).toBe(optionKey('SABO'));
    expect(matchOption(['LuK', 'Persan'], 'luk')).toBe('LuK');
    expect(matchOption(['Subconjunto (pistones + aros)'], 'subconjunto  (pistones + aros)')).toBe('Subconjunto (pistones + aros)');
    expect(matchOption(['Persan'], 'Persa')).toBeNull();
  });

  it('un nombre nuevo no puede estar vacío ni repetido', () => {
    expect(optionNameProblem('TYPE', ' ', ['Aros'])).toContain('Escribí');
    expect(optionNameProblem('BRAND', 'SABÓ', ['Sabo'])).toBe('Ya está «Sabo» en la lista.');
    // Al renombrar, el mismo nombre con otra forma vale.
    expect(optionNameProblem('BRAND', 'SABO', ['Sabo'], 'Sabo')).toBeNull();
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('las listas en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';

  afterAll(() => db.$disconnect());

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE product_options, title_rule_sets, products, channels, accounts CASCADE');
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
  });

  const lists = () => loadProductOptions(db, accountId);

  it('lo que se guarda en la ficha sale de la lista, con su forma', async () => {
    await addOption(db, accountId, 'TYPE', 'Kit de embrague');
    await addOption(db, accountId, 'BRAND', 'Sabó');
    const p = await saveProduct(db, { accountId, productId: null, data: product({ productType: 'kit de EMBRAGUE', brand: 'sabo' }) });
    expect(await db.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ productType: 'Kit de embrague', brand: 'Sabó' });
    // Lo que no está en la lista no se guarda.
    await expect(saveProduct(db, { accountId, productId: p.id, data: product({ productType: 'Bujía', brand: 'Sabó' }) })).rejects.toThrow(OptionError);
    await expect(resolveProductOptions(db, accountId, { brand: 'Otra' })).rejects.toThrow('Las que hay: Sabó.');
    // Vacío es sin dato.
    expect(await resolveProductOptions(db, accountId, { productType: '  ', brand: null })).toEqual({ productType: null, brand: null });
  });

  it('una cuenta nueva arma su lista con lo primero que se carga', async () => {
    expect(await resolveProductOptions(db, accountId, { productType: 'Aros ' })).toEqual({ productType: 'Aros', brand: undefined });
    expect((await lists()).types).toEqual(['Aros']);
    await expect(resolveProductOptions(db, accountId, { productType: 'Pistones' })).rejects.toThrow(OptionError);
    // En una importación con la lista vacía al empezar, entra todo lo que trae.
    const l = await lists();
    expect(await resolveOrDrop(db, accountId, l, 'BRAND', 'Persan', true)).toEqual({ value: 'Persan', warning: null });
    expect(await resolveOrDrop(db, accountId, l, 'BRAND', 'Mahle', true)).toEqual({ value: 'Mahle', warning: null });
    expect((await resolveOrDrop(db, accountId, l, 'TYPE', 'Pistones', false)).warning).toBe('Tipo de producto «Pistones»: no está en la lista, no se cargó.');
    expect((await lists()).brands).toEqual(['Mahle', 'Persan']);
  });

  it('lo que el producto ya tenía y no cambia no frena otros cambios', async () => {
    await addOption(db, accountId, 'TYPE', 'Aros');
    const product = await db.product.create({ data: { accountId, name: 'Viejo', productType: 'Algo de antes' } });
    expect(await resolveProductOptions(db, accountId, { productType: 'Algo de antes' }, undefined, { productType: 'Algo de antes', brand: null })).toMatchObject({
      productType: 'Algo de antes',
    });
    expect(product.productType).toBe('Algo de antes');
  });

  it('renombrar cambia todos los productos y las reglas de título; borrar los deja sin dato', async () => {
    await addOption(db, accountId, 'TYPE', 'Subconjunto');
    await addOption(db, accountId, 'TYPE', 'Aros');
    await db.product.createMany({
      data: [
        { accountId, name: 'A', productType: 'Subconjunto' },
        { accountId, name: 'B', productType: 'Subconjunto' },
        { accountId, name: 'C', productType: 'Aros' },
      ],
    });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    await db.titleRuleSet.create({ data: { accountId, channelId: channel.id, structures: [{ family: 'Subconjunto', structure: 'Tipo Marca Modelo' }] } });

    expect(await renameOption(db, accountId, 'TYPE', 'Subconjunto', 'Subconjunto (pistones + aros)')).toBe(2);
    expect(await db.product.count({ where: { productType: 'Subconjunto (pistones + aros)' } })).toBe(2);
    expect((await db.titleRuleSet.findFirstOrThrow()).structures).toEqual([{ family: 'Subconjunto (pistones + aros)', structure: 'Tipo Marca Modelo' }]);
    await expect(renameOption(db, accountId, 'TYPE', 'Aros', 'subconjunto (PISTONES + aros)')).rejects.toThrow('Ya está');
    expect(Object.fromEntries((await optionUsage(db, accountId)).types)).toEqual({ 'Subconjunto (pistones + aros)': 2, Aros: 1 });

    expect(await removeOption(db, accountId, 'TYPE', 'Aros')).toBe(1);
    expect(await db.product.findFirstOrThrow({ where: { name: 'C' } })).toMatchObject({ productType: null });
    expect((await lists()).types).toEqual(['Subconjunto (pistones + aros)']);
  });
});
