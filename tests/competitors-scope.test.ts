import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import type { McpContext } from '@/lib/mcp/tool';
import { competitorKey, mergeCompetitors, type CompetitorsOutput } from '@/domain/competitors';

// La competencia por producto o por publicación, según el tipo de producto:
// cambiar el ajuste junta o copia las listas sin perder nada, guardar desde
// cualquier publicación del producto cambia la lista de todas, y la
// comparación de precios sigue con el precio de cada publicación. Los datos
// son inventados.

const url = process.env.TEST_DATABASE_URL;

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { changeScope, competitorOwner, loadCompetitors, previewScopeChange, saveCompetitorsFrom } = await import('@/lib/competitors');
const { removeOption } = await import('@/lib/product-options');
const { loadPriceStep } = await import('@/lib/pricing');
const { loadTitleContext } = await import('@/lib/queries/title-step');
const { handleRpc } = await import('@/lib/mcp/server');

const row = (title: string, link: string | null, surveyedAt: string | null, listPrice: number | null = 100000): CompetitorsOutput[number] => ({
  title,
  url: link,
  soldQuantity: null,
  sellerName: 'VENDEDOR',
  brand: 'Persan',
  listPrice,
  discountPct: 0,
  installments: 0,
  freeShipping: true,
  surveyedAt,
  notes: null,
});

describe('juntar listas de competencia', () => {
  it('el mismo link es el mismo competidor, aunque cambie lo de después de "?"; sin link, el mismo título y vendedor', () => {
    expect(competitorKey(row('A', 'https://articulo.mercadolibre.com.ar/MLA-1-x?tracking=1#foto', null))).toBe(competitorKey(row('Otro', 'http://www.articulo.mercadolibre.com.ar/MLA-1-x/', null)));
    expect(competitorKey(row('Pistón SP-918', null, null))).toBe(competitorKey(row('pistón  sp-918', null, null)));
    expect(competitorKey(row('Pistón SP-918', null, null))).not.toBe(competitorKey({ ...row('Pistón SP-918', null, null), sellerName: 'OTRO' }));
  });

  it('de dos versiones queda la de fecha más nueva, en el lugar de la primera', () => {
    const { rows, repeated } = mergeCompetitors([
      [row('A vieja', 'https://x.com/a', '2026-10-01', 90000), row('B', 'https://x.com/b', '2026-10-01')],
      [row('C', 'https://x.com/c', null), row('A nueva', 'https://x.com/a?ref=2', '2026-11-01', 95000)],
    ]);
    expect(repeated).toBe(1);
    expect(rows.map((r) => r.title)).toEqual(['A nueva', 'B', 'C']);
    expect(rows[0].listPrice).toBe(95000);
  });
});

describe.skipIf(!url)('competencia por producto o por publicación', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const TYPE = 'Subconjunto (pistones + aros)';
  let accountId = '';
  let productId = '';
  let pubs: string[] = [];

  afterAll(() => db.$disconnect());

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE competitor_listings, product_options, publications, products, stores, channels, accounts, users CASCADE');
    await db.user.create({ data: { id: 'ana', name: 'Ana', email: 'ana@prueba.com', isAdmin: true } });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    const storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } })).id;
    await db.productOption.createMany({ data: [{ accountId, kind: 'TYPE', name: TYPE }, { accountId, kind: 'TYPE', name: 'Kit de embrague' }] });
    productId = (await db.product.create({ data: { accountId, name: 'Subconjunto SP-918', productType: TYPE } })).id;
    // La principal y dos opciones de venta de la misma medida, cada una con su precio.
    const main = await db.publication.create({ data: { productId, storeId, externalId: 'MLA9180000001', title: 'Subconjunto SP-918', price: 200000, installments: 0 } });
    const second = await db.publication.create({ data: { productId, storeId, externalId: 'MLA9180000002', title: 'Subconjunto SP-918 6 cuotas', price: 230000, installments: 6, mainOptionId: main.id } });
    const third = await db.publication.create({ data: { productId, storeId, externalId: 'MLA9180000003', title: 'Subconjunto SP-918 12 cuotas', price: 260000, installments: 12, mainOptionId: main.id } });
    pubs = [main.id, second.id, third.id];
    await db.$transaction(async (tx) => {
      await saveCompetitorsFrom(tx, main.id, [row('A', 'https://x.com/a', '2026-10-01', 90000), row('B', 'https://x.com/b', '2026-10-01'), row('C', 'https://x.com/c', '2026-10-01')]);
      await saveCompetitorsFrom(tx, second.id, [row('A más nueva', 'https://x.com/a', '2026-11-01', 95000), row('D', 'https://x.com/d', '2026-11-01')]);
    });
  });

  const titlesOf = async (publicationId: string) => {
    const owner = (await competitorOwner(db, publicationId))!;
    return (await loadCompetitors(db, owner, { title: true })).map((c) => c.title);
  };

  it('por publicación, cada una ve la suya, como siempre', async () => {
    expect(await competitorOwner(db, pubs[0])).toMatchObject({ scope: 'PUBLICATION', publications: 3 });
    expect(await titlesOf(pubs[0])).toEqual(['A', 'B', 'C']);
    expect(await titlesOf(pubs[1])).toEqual(['A más nueva', 'D']);
    expect(await titlesOf(pubs[2])).toEqual([]);
  });

  it('al pasar a "Por producto" se juntan sin repetidos, y guardar desde cualquiera cambia la de todas', async () => {
    expect(await previewScopeChange(db, accountId, TYPE, 'PRODUCT')).toMatchObject({ from: 'PUBLICATION', products: 1, productsWithCompetitors: 1, competitors: 5, repeated: 1 });
    // Ver cuánto se mueve no cambia nada.
    expect(await titlesOf(pubs[2])).toEqual([]);

    await changeScope(db, accountId, TYPE, 'PRODUCT');
    for (const id of pubs) expect(await titlesOf(id)).toEqual(['A más nueva', 'B', 'C', 'D']);
    expect(await db.competitorListing.count({ where: { productId } })).toBe(4);
    expect(await db.competitorListing.count({ where: { publicationId: { in: pubs } } })).toBe(0);

    // Desde la tercera, que no tenía nada: queda para las tres.
    const owner = await db.$transaction((tx) => saveCompetitorsFrom(tx, pubs[2], [row('E', 'https://x.com/e', '2026-11-10'), row('F', null, null, null)]));
    expect(owner).toMatchObject({ scope: 'PRODUCT', publications: 3 });
    for (const id of pubs) expect(await titlesOf(id)).toEqual(['E', 'F']);

    // La comparación de precios: la misma lista, con el precio de cada publicación.
    const [a, b] = await Promise.all([loadPriceStep(db, accountId, pubs[0]), loadPriceStep(db, accountId, pubs[1])]);
    expect(a!.competitors.map((c) => c.title)).toEqual(['E']);
    expect(b!.competitors.map((c) => c.title)).toEqual(['E']);
    expect(a!.competitorsWithoutPrice).toBe(1);
    expect(a!.competitorsShared).toBe('Compartida por las 3 publicaciones de este producto.');

    // El paso Título suma las palabras de la lista del producto.
    const ctx = await loadTitleContext(db, accountId, pubs[1]);
    expect(ctx!.competitors.map((c) => c.title)).toEqual(['E', 'F']);
    expect(ctx!.competitorsOwner).toEqual({ scope: 'PRODUCT', publications: 3 });
  });

  it('al volver a "Por publicación", la lista del producto se copia a cada una', async () => {
    await changeScope(db, accountId, TYPE, 'PRODUCT');
    expect(await previewScopeChange(db, accountId, TYPE, 'PUBLICATION')).toMatchObject({ from: 'PRODUCT', productsWithCompetitors: 1, competitors: 4, publications: 3 });
    await changeScope(db, accountId, TYPE, 'PUBLICATION');
    for (const id of pubs) expect(await titlesOf(id)).toEqual(['A más nueva', 'B', 'C', 'D']);
    expect(await db.competitorListing.count({ where: { productId } })).toBe(0);
    // Ahora cada una es independiente.
    await db.$transaction((tx) => saveCompetitorsFrom(tx, pubs[0], [row('G', 'https://x.com/g', null)]));
    expect(await titlesOf(pubs[0])).toEqual(['G']);
    expect(await titlesOf(pubs[1])).toEqual(['A más nueva', 'B', 'C', 'D']);
  });

  it('si el producto se queda sin un tipo que la compartía, la lista pasa a sus publicaciones', async () => {
    await changeScope(db, accountId, TYPE, 'PRODUCT');
    await removeOption(db, accountId, 'TYPE', TYPE);
    expect(await db.product.findUniqueOrThrow({ where: { id: productId } })).toMatchObject({ productType: null });
    for (const id of pubs) expect(await titlesOf(id)).toEqual(['A más nueva', 'B', 'C', 'D']);
    expect(await db.competitorListing.count({ where: { productId } })).toBe(0);
  });

  it('Claude ve de quién es la competencia y la guarda donde corresponde', async () => {
    await changeScope(db, accountId, TYPE, 'PRODUCT');
    const admin: McpContext = { db, userId: 'ana', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
    const call = async (name: string, args: Record<string, unknown>) => {
      const r = (await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, admin)) as {
        result: { content: { text: string }[]; isError?: boolean };
      };
      return { isError: r.result.isError === true, text: r.result.content[0].text, data: r.result.isError ? null : JSON.parse(r.result.content[0].text) };
    };
    const pub = await call('get_publication', { publicacion: 'MLA9180000003' });
    if (pub.isError) throw new Error(pub.text);
    expect(pub.data).toMatchObject({ competencia_de: 'producto', competencia_compartida_por: 3 });
    expect(pub.data.competencia.map((c: { titulo: string }) => c.titulo)).toEqual(['A más nueva', 'B', 'C', 'D']);

    const saved = await call('save_competitors', { publicacion: 'MLA9180000002', competencia: [{ titulo: 'H', link: 'https://x.com/h' }] });
    expect(saved.data).toMatchObject({ guardadas: 1, competencia_de: 'producto', compartida_por: 3 });
    expect(await titlesOf(pubs[0])).toEqual(['H']);

    // Entre publicaciones que comparten la lista, copiar no cambia nada.
    const copied = await call('copy_publication_data', { publicacion: 'MLA9180000003', desde: 'MLA9180000001', copiar: ['competencia'] });
    expect(copied.isError).toBe(false);
    expect(await titlesOf(pubs[2])).toEqual(['H']);

    await changeScope(db, accountId, TYPE, 'PUBLICATION');
    expect((await call('get_publication', { publicacion: 'MLA9180000001' })).data).toMatchObject({ competencia_de: 'publicacion' });
  });
});
