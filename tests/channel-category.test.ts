import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { adoptChannelCategory, clashText, listCategoryClashes, productChannelCategories } from '@/lib/channel-category';
import { loadCatalogData } from '@/lib/catalog-data';

// La categoría de cada publicación en el canal, aparte de la de la app. Datos inventados.

const SUB = 'MLA373289';
const PISTONES = 'MLA47093';
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('la categoría en el canal', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const adapter = getChannelAdapter('MERCADOLIBRE', 'Mercado Libre');
  let accountId = '';
  let storeId = '';
  let productId = '';
  const ids: Record<string, string> = {};

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE channel_copies, channel_sync_changes, listing_families, publications, products, stores, channels, accounts CASCADE');
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Prueba' } })).id;
    storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } })).id;
    productId = (await db.product.create({ data: { accountId, name: 'Subconjunto SP-1', productType: 'Subconjunto (pistones + aros)' } })).id;
    const pub = async (code: string, categoryId: string, extra: object = {}, status: 'ACTIVE' | 'CLOSED' = 'ACTIVE') =>
      (
        await db.publication.create({
          data: { productId, storeId, externalId: code, title: 'Subconjunto', ...extra, channelCopy: { create: { readAt: new Date(), status, categoryId } } },
        })
      ).id;
    // La principal y sus opciones: Mercado Libre pasó dos a Pistones y dejó una en Subconjuntos.
    ids.main = await pub('MLA1', PISTONES);
    ids.cuotas3 = await pub('MLA2', PISTONES, { mainOptionId: ids.main });
    ids.cuotas6 = await pub('MLA3', SUB, { mainOptionId: ids.main });
    // Finalizada: no cuenta.
    ids.closed = await pub('MLA4', SUB, { mainOptionId: ids.main }, 'CLOSED');
  });

  it('dice en qué categorías están las activas del producto y lista el producto para corregir', async () => {
    const groups = await productChannelCategories(db, { productId, storeId });
    expect(groups).toEqual([
      { categoryId: PISTONES, name: 'Pistones', externalIds: ['MLA1', 'MLA2'] },
      { categoryId: SUB, name: 'Subconjuntos de Motor', externalIds: ['MLA3'] },
    ]);
    expect(clashText(groups, 'Mercado Libre')).toContain('Pistones (MLA47093) en MLA1, MLA2; Subconjuntos de Motor (MLA373289) en MLA3');
    const clashes = await listCategoryClashes(db, accountId);
    expect(clashes.map((c) => [c.product, c.groups.map((g) => g.categoryId)])).toEqual([['Subconjunto SP-1', [PISTONES, SUB]]]);

    // En los datos de catálogo: la de la app, la del canal y el aviso.
    const data = (await loadCatalogData(db, ids.main))!;
    expect(data.category?.id).toBe(SUB);
    expect(data.inChannel).toEqual({ id: PISTONES, name: 'Pistones' });
    expect(data.categoryWarning).toContain('categorías distintas');

    // Ya todas en Pistones: no hay que corregir nada, pero la app sigue en Subconjuntos.
    await db.channelCopy.update({ where: { publicationId: ids.cuotas6 }, data: { categoryId: PISTONES } });
    expect(await listCategoryClashes(db, accountId)).toEqual([]);
    expect((await loadCatalogData(db, ids.main))!.categoryWarning).toContain('en la app la categoría es Subconjuntos de Motor'.replace('en la app', 'En la app'));
  });

  it('si el canal le cambia la categoría, la app la toma en la familia y sus opciones, y lo anota', async () => {
    const other = (await db.publication.create({ data: { productId, storeId, externalId: 'MLA9', title: 'Subconjunto 0,50' } })).id;
    const family = await db.listingFamily.create({ data: { storeId, productId, leadId: ids.main } });
    await db.publication.updateMany({ where: { id: { in: [ids.main, other] } }, data: { familyId: family.id } });
    const changed = await db.$transaction((tx) => adoptChannelCategory(tx, { publicationId: ids.cuotas6, before: SUB, after: PISTONES, adapter, details: {}, syncId: null }));
    expect(changed.sort()).toEqual([ids.main, ids.cuotas3, ids.cuotas6, ids.closed, other].sort());
    const rows = await db.publication.findMany({ where: { id: { in: changed } }, select: { channelCategory: true } });
    expect(rows.every((r) => r.channelCategory === PISTONES)).toBe(true);
    const log = await db.channelSyncChange.findFirstOrThrow({ where: { publicationId: ids.cuotas6, field: 'category' } });
    expect(log).toMatchObject({ kind: 'TAKEN', before: 'Subconjuntos de Motor', after: 'Pistones' });
    expect(log.message).toContain('Mercado Libre cambió la categoría a Pistones');
    // Sin cambio en el canal, no hace nada.
    expect(await db.$transaction((tx) => adoptChannelCategory(tx, { publicationId: ids.main, before: PISTONES, after: PISTONES, adapter, details: {}, syncId: null }))).toEqual([]);
    // Una categoría que la app no tiene: solo lo anota.
    expect(await db.$transaction((tx) => adoptChannelCategory(tx, { publicationId: ids.main, before: PISTONES, after: 'MLA000', adapter, details: { categoryName: 'Otra' }, syncId: null }))).toEqual([]);
    expect((await db.publication.findUniqueOrThrow({ where: { id: ids.main } })).channelCategory).toBe(PISTONES);
  });
});
