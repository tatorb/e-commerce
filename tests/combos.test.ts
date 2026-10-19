import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { assertNotInCombos, ComboError, setComboItems, setProductKind } from '@/domain/combos';
import { productInputSchema, saveProduct } from '@/domain/products';
import { loadCombo, searchComboCandidates } from '@/lib/queries/combos';

// Datos inventados.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('individuales y combos', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let otherAccountId = '';
  let piston = '';
  let aros = '';
  let combo = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE products, accounts CASCADE');
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Prueba' } })).id;
    otherAccountId = (await db.account.create({ data: { slug: 'otra', name: 'Otra' } })).id;
    piston = (await db.product.create({ data: { accountId, name: 'Pistón 1.6', partNumber: 'P-16', variants: { create: [{ sku: 'SKU-P' }] } } })).id;
    aros = (await db.product.create({ data: { accountId, name: 'Juego de aros 1.6', partNumber: 'A-16' } })).id;
    combo = (await db.product.create({ data: { accountId, name: 'Subconjunto 1.6', kind: 'COMBO' } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const set = (items: { productId: string; quantity: number | string }[], comboId = combo) =>
    db.$transaction((tx) => setComboItems(tx, { accountId, comboId, items }));

  it('arma el combo con individuales y su cantidad, en orden', async () => {
    await set([
      { productId: piston, quantity: 4 },
      { productId: aros, quantity: '1' },
    ]);
    const data = (await loadCombo(db, combo))!;
    expect(data.kind).toBe('COMBO');
    expect(data.items.map((i) => [i.name, i.quantity])).toEqual([
      ['Pistón 1.6', 4],
      ['Juego de aros 1.6', 1],
    ]);
    expect((await loadCombo(db, piston))!.inCombos).toEqual([{ id: combo, name: 'Subconjunto 1.6', quantity: 4 }]);
    // Reemplaza la lista entera.
    await set([{ productId: aros, quantity: 2 }]);
    expect((await loadCombo(db, combo))!.items.map((i) => i.name)).toEqual(['Juego de aros 1.6']);
  });

  it('controla lo que entra en un combo', async () => {
    const other = await db.product.create({ data: { accountId: otherAccountId, name: 'De otra cuenta' } });
    const otherCombo = await db.product.create({ data: { accountId, name: 'Otro combo', kind: 'COMBO' } });
    await expect(set([{ productId: combo, quantity: 1 }])).rejects.toThrow('no puede incluirse a sí mismo');
    await expect(set([{ productId: otherCombo.id, quantity: 1 }])).rejects.toThrow('un combo se arma solo con productos individuales');
    await expect(set([{ productId: other.id, quantity: 1 }])).rejects.toThrow('ya no existe en esta cuenta');
    await expect(
      set([
        { productId: piston, quantity: 1 },
        { productId: piston, quantity: 2 },
      ]),
    ).rejects.toThrow('está más de una vez');
    await expect(set([{ productId: piston, quantity: 0 }])).rejects.toThrow('La cantidad mínima es 1.');
    await expect(set([{ productId: piston, quantity: 100 }])).rejects.toThrow('La cantidad máxima es 99.');
    await expect(set([{ productId: aros, quantity: 1 }], piston)).rejects.toThrow('cambialo a Combo primero');
    expect(await db.comboItem.count()).toBe(0);
  });

  it('un individual dentro de un combo no puede ser combo ni borrarse; un combo que pasa a individual pierde su lista', async () => {
    await set([{ productId: piston, quantity: 4 }]);
    await expect(db.$transaction((tx) => setProductKind(tx, { accountId, productId: piston, kind: 'COMBO' }))).rejects.toThrow(
      'Forma parte de «Subconjunto 1.6»',
    );
    await expect(db.$transaction((tx) => assertNotInCombos(tx, piston))).rejects.toThrow(ComboError);
    await db.$transaction((tx) => assertNotInCombos(tx, aros));

    await db.$transaction((tx) => setProductKind(tx, { accountId, productId: combo, kind: 'INDIVIDUAL' }));
    expect(await db.comboItem.count()).toBe(0);
    await db.$transaction((tx) => assertNotInCombos(tx, piston));
  });

  it('la ficha guarda el tipo; sin mandarlo, queda como estaba', async () => {
    const text = { brand: '', partNumber: '', productType: '', engineSystem: '', line: '', origin: '', warranty: '', kitContents: '', notes: '' };
    const base = { ...text, specs: [], variants: [], compatibilities: [], assets: [] };
    const { id } = await saveProduct(db, { accountId, productId: null, data: productInputSchema.parse({ ...base, name: 'Combo nuevo', kind: 'COMBO' }) });
    expect((await db.product.findUniqueOrThrow({ where: { id } })).kind).toBe('COMBO');
    // Como una ficha abierta antes de que le sumaran productos: guardarla sin el tipo no borra la lista.
    await set([{ productId: aros, quantity: 2 }], id);
    await saveProduct(db, { accountId, productId: id, data: productInputSchema.parse({ ...base, name: 'Combo nuevo editado' }) });
    expect((await db.product.findUniqueOrThrow({ where: { id } })).kind).toBe('COMBO');
    expect(await db.comboItem.count({ where: { comboId: id } })).toBe(1);
    const plain = await saveProduct(db, { accountId, productId: null, data: productInputSchema.parse({ ...base, name: 'Suelto' }) });
    expect((await db.product.findUniqueOrThrow({ where: { id: plain.id } })).kind).toBe('INDIVIDUAL');
    await set([{ productId: piston, quantity: 1 }]);
    await expect(
      saveProduct(db, { accountId, productId: piston, data: productInputSchema.parse({ ...base, name: 'Pistón 1.6', kind: 'COMBO' }) }),
    ).rejects.toThrow(ComboError);
  });

  it('para sumar busca solo individuales de la cuenta, sin el combo', async () => {
    expect((await searchComboCandidates(db, accountId, combo, '1.6')).map((p) => p.name).sort()).toEqual(['Juego de aros 1.6', 'Pistón 1.6']);
    expect((await searchComboCandidates(db, accountId, combo, 'sku-p')).map((p) => p.name)).toEqual(['Pistón 1.6']);
    expect(await searchComboCandidates(db, accountId, combo, 'p')).toEqual([]);
    expect(await searchComboCandidates(db, otherAccountId, combo, '1.6')).toEqual([]);
  });
});
