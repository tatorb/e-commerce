import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { writeContentField } from '@/domain/content';
import { competitorsSchema, saveCompetitors } from '@/domain/competitors';
import { addToPipeline, advanceStep } from '@/domain/pipeline';
import { productInfoSchema, updateProductInfo } from '@/domain/product-info';
import { approveTitle, decideLock, savePosition, setMainSearches, setWordStatus, TitleError } from '@/domain/title-work';
import { wordKey } from '@/domain/titles';

// Datos inventados.

const url = process.env.TEST_DATABASE_URL;
const rules = getChannelAdapter('MERCADOLIBRE').titleRules;

describe.skipIf(!url)('paso Título', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const userId = 'u1';
  let accountId = '';
  let productId = '';
  let publicationId = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE title_approvals, title_works, search_positions, search_suggestions, competitor_listings, pipeline_movements, publications, products, stores, channels, accounts, users CASCADE',
    );
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    const store = await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } });
    await db.user.create({ data: { id: userId, name: 'Persona', email: 'persona@example.com' } });
    productId = (await db.product.create({ data: { accountId, name: 'Kit A', productType: 'Kit de prueba' } })).id;
    publicationId = (
      await db.publication.create({ data: { productId, storeId: store.id, externalId: 'MLA1', title: 'Kit viejo' } })
    ).id;
    await db.$transaction((tx) => addToPipeline(tx, { accountId, publicationIds: [publicationId], userId }));
    await db.$transaction((tx) => advanceStep(tx, { publicationId, expected: 'INFO', userId }));
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const approve = (title: string, extra: Partial<Parameters<typeof approveTitle>[1]> = {}) =>
    db.$transaction((tx) =>
      approveTitle(tx, { publicationId, title, aiTitle: null, locked: false, rules, userId, ...extra }),
    );
  const pub = () => db.publication.findUniqueOrThrow({ where: { id: publicationId } });

  it('aprobar escribe el título, guarda lo que propuso la IA y pasa a Imágenes', async () => {
    await db.titleWork.create({ data: { publicationId, proposals: [{ title: 'Kit Prueba Modelo 1', reason: 'r' }] } });
    const r = await approve('Kit Prueba Modelo 1 Nafta', { aiTitle: 'Kit Prueba Modelo 1' });
    expect(r.outcome).toBe('WRITTEN');
    const p = await pub();
    expect(p.title).toBe('Kit Prueba Modelo 1 Nafta');
    expect(p.pipelineStep).toBe('IMAGES');
    const a = await db.titleApproval.findFirstOrThrow({ where: { publicationId } });
    expect(a).toMatchObject({
      outcome: 'WRITTEN',
      before: 'Kit viejo',
      title: 'Kit Prueba Modelo 1 Nafta',
      aiTitle: 'Kit Prueba Modelo 1',
      edited: true,
      userId,
    });
    expect(a.aiProposals).toEqual([{ title: 'Kit Prueba Modelo 1', reason: 'r' }]);
  });

  it('no deja aprobar un título que no cumple las reglas', async () => {
    await expect(approve('Kit Oferta!')).rejects.toThrow('Para aprobar falta');
    expect((await pub()).pipelineStep).toBe('TITLE');
  });

  it('con el título bloqueado, primero hay que decidir', async () => {
    await expect(approve('Kit Prueba Modelo', { locked: true })).rejects.toThrow('primero elegí');
  });

  it('probar en la copia guarda el título sin tocar la publicación', async () => {
    await db.$transaction((tx) => decideLock(tx, { publicationId, decision: 'TRY_IN_COPY', userId }));
    const r = await approve('Kit Prueba Modelo 2', { locked: true, aiTitle: 'Kit Prueba Modelo 2' });
    expect(r.outcome).toBe('COPY');
    const p = await pub();
    expect(p.title).toBe('Kit viejo');
    expect(p.pipelineStep).toBe('IMAGES');
    expect(await db.titleApproval.findFirstOrThrow({ where: { publicationId } })).toMatchObject({
      outcome: 'COPY',
      title: 'Kit Prueba Modelo 2',
      edited: false,
    });
  });

  it('mantener el título completa el paso sin cambios', async () => {
    await db.$transaction((tx) => decideLock(tx, { publicationId, decision: 'KEEP', userId }));
    const p = await pub();
    expect(p.title).toBe('Kit viejo');
    expect(p.pipelineStep).toBe('IMAGES');
    expect(await db.titleApproval.findFirstOrThrow({ where: { publicationId } })).toMatchObject({ outcome: 'KEPT', title: 'Kit viejo' });
    const work = await db.titleWork.findUniqueOrThrow({ where: { publicationId } });
    expect(work).toMatchObject({ lockDecision: 'KEEP', lockDecidedById: userId });
    // Ya no está en Título.
    await expect(approve('Kit Prueba')).rejects.toThrow(TitleError);
  });

  it('las palabras se marcan de a una, aunque lleguen juntas', async () => {
    await Promise.all(
      ['Pistones', 'aros', 'peugeot', '405'].map((w, i) =>
        db.$transaction((tx) => setWordStatus(tx, publicationId, w, i % 2 ? 'discard' : 'use')),
      ),
    );
    await db.$transaction((tx) => setWordStatus(tx, publicationId, '405', null));
    const work = await db.titleWork.findUniqueOrThrow({ where: { publicationId } });
    expect(work.words).toEqual({ [wordKey('pistones')]: 'use', [wordKey('aros')]: 'discard', [wordKey('peugeot')]: 'use' });
  });

  it('hasta 5 búsquedas principales, y la posición con su fecha', async () => {
    await expect(
      db.$transaction((tx) => setMainSearches(tx, publicationId, ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'])),
    ).rejects.toThrow('hasta 5');
    expect(await db.$transaction((tx) => setMainSearches(tx, publicationId, ['Kit  Gol', 'kit gol', 'kit fiesta']))).toEqual([
      'kit gol',
      'kit fiesta',
    ]);
    await db.$transaction((tx) => savePosition(tx, { publicationId, query: 'kit gol', page: 2, position: 14, source: 'MANUAL' }));
    await db.$transaction((tx) => savePosition(tx, { publicationId, query: 'kit fiesta', page: null, position: 7, source: 'MANUAL' }));
    await expect(
      db.$transaction((tx) => savePosition(tx, { publicationId, query: 'kit gol', page: 4, position: 1, source: 'MANUAL' })),
    ).rejects.toThrow('de 1 a 3');
    const rows = await db.searchPosition.findMany({ where: { publicationId }, orderBy: { checkedAt: 'asc' } });
    expect(rows.map((r) => [r.query, r.page, r.position])).toEqual([
      ['kit gol', 2, 14],
      ['kit fiesta', null, null],
    ]);
  });
});

describe.skipIf(!url)('paso Información', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let productId = '';
  let publicationId = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE competitor_listings, publications, products, stores, channels, accounts CASCADE');
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    const store = await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } });
    productId = (
      await db.product.create({
        data: {
          accountId,
          name: 'Kit A',
          variants: { create: [{ sku: 'A1', measure: 'STD', position: 0 }, { sku: 'A2', measure: '0.25', position: 1 }] },
          compatibilities: { create: [{ vehicleBrand: 'Marca', model: 'Modelo', engine: '1.9 Diesel', displacement: '1.9', fuel: 'Diesel' }] },
        },
      })
    ).id;
    publicationId = (await db.publication.create({ data: { productId, storeId: store.id, externalId: 'MLA1' } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('guarda en la ficha y conserva el id de las medidas que siguen', async () => {
    const [a1] = await db.productVariant.findMany({ where: { productId }, orderBy: { position: 'asc' } });
    const data = productInfoSchema.parse({
      productType: 'Kit de prueba',
      brand: 'Marca R',
      partNumber: '',
      line: 'Liviano',
      variants: [
        { id: a1.id, measure: 'STD', sku: 'A1-B' },
        { id: null, measure: '0.50', sku: 'A3' },
      ],
      compatibilities: [{ vehicleBrand: 'Marca', model: 'Otro', engine: '2.0', displacement: '2.0', fuel: '', yearFrom: '2001', yearTo: '', note: '' }],
    });
    await db.$transaction((tx) => updateProductInfo(tx, { accountId, productId, data }));
    const p = await db.product.findUniqueOrThrow({
      where: { id: productId },
      include: { variants: { orderBy: { position: 'asc' } }, compatibilities: true },
    });
    expect(p).toMatchObject({ productType: 'Kit de prueba', brand: 'Marca R', partNumber: null, line: 'Liviano' });
    expect(p.variants.map((v) => [v.sku, v.measure])).toEqual([
      ['A1-B', 'STD'],
      ['A3', '0.50'],
    ]);
    expect(p.variants[0].id).toBe(a1.id);
    expect(p.compatibilities).toHaveLength(1);
    expect(p.compatibilities[0]).toMatchObject({ model: 'Otro', displacement: '2.0', fuel: null, yearFrom: 2001 });
    // Vacíos, se completan con el motor.
    const again = productInfoSchema.parse({
      productType: 'Kit de prueba',
      brand: '',
      partNumber: '',
      line: '',
      variants: [],
      compatibilities: [{ vehicleBrand: 'M', model: 'X', engine: '1.9 TD', displacement: '', fuel: '', yearFrom: '', yearTo: '', note: '' }],
    });
    await db.$transaction((tx) => updateProductInfo(tx, { accountId, productId, data: again }));
    expect(await db.compatibility.findFirstOrThrow({ where: { productId } })).toMatchObject({ displacement: '1.9', fuel: 'Diesel' });
  });

  it('las compatibilidades que llegan de una importación o propuesta conservan cilindrada y combustible', async () => {
    await db.$transaction((tx) =>
      writeContentField(tx, { productId, publicationId: null }, 'compatibilities', [
        { vehicleBrand: 'Marca', model: 'Modelo', engine: '1.9 Diesel', yearFrom: 2000, yearTo: null, note: null },
        { vehicleBrand: 'Marca', model: 'Nuevo', engine: '1.6 nafta', yearFrom: null, yearTo: null, note: null },
      ]),
    );
    const list = await db.compatibility.findMany({ where: { productId }, orderBy: { position: 'asc' } });
    expect(list.map((c) => [c.model, c.displacement, c.fuel, c.yearFrom])).toEqual([
      ['Modelo', '1.9', 'Diesel', 2000],
      ['Nuevo', '1.6', 'Nafta', null],
    ]);
  });

  it('la competencia: hasta 5, con título y vendidos', async () => {
    const rows = competitorsSchema.parse([
      { url: 'https://example.com/1', title: 'Kit de otro vendedor', soldQuantity: '1.500' },
      { url: '', title: 'Otro kit', soldQuantity: '' },
    ]);
    await db.$transaction((tx) => saveCompetitors(tx, publicationId, rows));
    const saved = await db.competitorListing.findMany({ where: { publicationId }, orderBy: { position: 'asc' } });
    expect(saved.map((c) => [c.url, c.title, c.soldQuantity])).toEqual([
      ['https://example.com/1', 'Kit de otro vendedor', 1500],
      [null, 'Otro kit', null],
    ]);
    expect(competitorsSchema.safeParse(Array(6).fill({ url: '', title: 't', soldQuantity: '' })).success).toBe(false);
    expect(competitorsSchema.safeParse([{ url: 'ftp://x', title: 't', soldQuantity: '' }]).success).toBe(false);
  });
});
