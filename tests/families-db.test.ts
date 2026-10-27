import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { fingerprint } from '@/domain/channel-sync';
import { writeContentField } from '@/domain/content';
import { familyDetails } from '@/domain/families';
import { addToPipeline, advanceStep, removeFromPipeline } from '@/domain/pipeline';
import { applyFamilies } from '@/lib/family-apply';
import { familyByMeasure, fillFamilyCode, joinKnownFamilies, planFamilies } from '@/lib/families';
import { savePriceDecision, setMeasurePrice } from '@/lib/pricing';
import { saveQaTexts } from '@/lib/publication-qa';

// La vista previa de las familias contra la base de prueba: qué se junta, qué
// falta traer, qué se separa y qué hay que revisar. Datos inventados.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('la vista previa de las familias', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';
  const now = new Date('2026-11-11T12:00:00Z');

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE listing_families, channel_copies, publications, product_variants, products, stores, channels, accounts CASCADE');
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    accountId = account.id;
    storeId = store.id;
  });

  const product = (name: string, variants: { sku: string; measure: string | null }[]) =>
    db.product.create({ data: { accountId, name, variants: { create: variants.map((v, i) => ({ ...v, position: i })) } } });

  /** Una publicación leída del canal, con su SKU y su familia. */
  async function listing(
    productId: string,
    externalId: string,
    opts: { sku?: string; family?: { id: string; listings: string[] } | null; data?: Record<string, unknown>; productIdInChannel?: string } = {},
  ) {
    const p = await db.publication.create({ data: { productId, storeId, externalId, title: 'Subconjunto de prueba', ...opts.data } });
    const read = opts.family === undefined ? undefined : opts.family === null ? null : { familyId: opts.family.id, channelProductIds: [], listingIds: opts.family.listings };
    await db.channelCopy.create({
      data: {
        publicationId: p.id,
        readAt: now,
        status: 'ACTIVE',
        details: { skus: opts.sku ? [opts.sku] : [], channelProductId: opts.productIdInChannel ?? `UP-${externalId}`, ...familyDetails(read, null, now) },
      },
    });
    return p;
  }

  it('junta las medidas del canal, dice cuáles faltan traer y qué pasa al juntarlas', async () => {
    const sp741 = await product('Subconjunto SP-741', [
      { sku: 'SP-741-00', measure: 'STD' },
      { sku: 'SP-741-50', measure: '0.50' },
    ]);
    // La 0.50 está en la app y la STD no.
    const half = await listing(sp741.id, 'MLA10', { sku: 'SP-741-50', family: { id: 'F1', listings: ['MLA10', 'MLA11'] } });

    const sp808 = await product('Subconjunto SP-808', [
      { sku: 'SP-808-00', measure: 'STD' },
      { sku: 'SP-808-50', measure: '0.50' },
    ]);
    const std = await listing(sp808.id, 'MLA20', {
      sku: 'SP-808-00',
      family: { id: 'F2', listings: ['MLA20', 'MLA21'] },
      data: { faq: '<p>¿Sirve para Amarok? Sí.</p>', price: 1000 },
    });
    const halfInPipeline = await listing(sp808.id, 'MLA21', {
      sku: 'SP-808-50',
      family: { id: 'F2', listings: ['MLA20', 'MLA21'] },
      data: { pipelineStatus: 'IN_PIPELINE', pipelineStep: 'TITLE', faq: '<p>Envío en el día.</p>', price: 1200 },
    });

    const [plan] = await planFamilies(db, accountId);
    expect(plan.counts).toMatchObject({ families: 2, grouped: 3, missing: 1, splits: 0, unknown: 0, decisions: 1, conflicts: 0 });

    const f1 = plan.families.find((f) => f.key === 'F1')!;
    expect(f1).toMatchObject({ kind: 'group', state: 'new', code: 'SP-741', missing: ['MLA11'], notes: [] });
    expect(f1.members).toEqual([{ id: half.id, externalId: 'MLA10', title: 'Subconjunto de prueba', measure: '0.50', pipeline: 'Sin tocar', lead: true }]);

    const f2 = plan.families.find((f) => f.key === 'F2')!;
    // La STD primero, como en la ficha; la principal es la que está en el pipeline.
    expect(f2.members.map((m) => [m.id, m.measure, m.lead])).toEqual([
      [std.id, 'STD', false],
      [halfInPipeline.id, '0.50', true],
    ]);
    expect(f2.notes).toEqual([
      'Estaban en lugares distintos del pipeline: la familia queda en el paso Título, donde está la más avanzada.',
      'Tenían preguntas frecuentes distintas: se juntan una debajo de la otra para que las revises.',
      'Tenían precios distintos: cada medida queda con el suyo.',
    ]);
  });

  it('las medidas que no se saben por el SKU, las de productos distintos y las que ya están juntas', async () => {
    // Las dos medidas con el mismo SKU: no se sabe cuál es cuál.
    const same = await product('Subconjunto SP-365', [
      { sku: 'SP-365', measure: 'STD' },
      { sku: 'SP-365', measure: '0.50' },
    ]);
    await listing(same.id, 'MLA30', { sku: 'SP-365', family: { id: 'F3', listings: ['MLA30', 'MLA31'] } });
    await listing(same.id, 'MLA31', { sku: 'SP-365', family: { id: 'F3', listings: ['MLA30', 'MLA31'] } });

    // En el canal juntas, en la app de productos distintos.
    const a = await product('Aros A', [{ sku: 'AR-A', measure: null }]);
    const b = await product('Aros B', [{ sku: 'AR-B', measure: null }]);
    await listing(a.id, 'MLA40', { sku: 'AR-A', family: { id: 'F4', listings: ['MLA40', 'MLA41'] } });
    await listing(b.id, 'MLA41', { sku: 'AR-B', family: { id: 'F4', listings: ['MLA40', 'MLA41'] } });

    // Ya juntas.
    const done = await product('Subconjunto SP-900', [
      { sku: 'SP-900-00', measure: 'STD' },
      { sku: 'SP-900-50', measure: '0.50' },
    ]);
    const d1 = await listing(done.id, 'MLA50', { sku: 'SP-900-00', family: { id: 'F5', listings: ['MLA50', 'MLA51'] } });
    const d2 = await listing(done.id, 'MLA51', { sku: 'SP-900-50', family: { id: 'F5', listings: ['MLA50', 'MLA51'] } });
    await db.listingFamily.create({ data: { storeId, productId: done.id, channelFamilyId: 'F5', leadId: d1.id, members: { connect: [{ id: d1.id }, { id: d2.id }] } } });

    // Sola en su familia, sin leer y sin familia: no cuentan como familia.
    await listing(done.id, 'MLA60', { family: { id: 'F6', listings: ['MLA60'] } });
    await listing(done.id, 'MLA61');
    await listing(done.id, 'MLA62', { family: null });

    const [plan] = await planFamilies(db, accountId);
    expect(plan.counts).toMatchObject({ families: 1, unknown: 2, conflicts: 1, done: 1 });
    expect(plan.unread).toBe(1);
    expect(plan.families.find((f) => f.key === 'F3')).toMatchObject({ state: 'new', unknownMeasures: 2 });
    expect(plan.families.find((f) => f.key === 'F3')!.notes[0]).toBe('De 2 publicaciones no se sabe la medida por su SKU: las vas a elegir a mano.');
    expect(plan.families.find((f) => f.key === 'F4')).toMatchObject({ state: 'conflict', productId: null });
    expect(plan.families.some((f) => f.key === 'F5' || f.key === 'F6')).toBe(false);
  });

  it('las familias que creó la app se separan en una publicación por medida, y sus medidas no faltan', async () => {
    const p = await product('Subconjunto SP-413', [
      { sku: 'SP-413-00', measure: 'STD' },
      { sku: 'SP-413-50', measure: '0.50' },
    ]);
    await listing(p.id, 'MLA70', {
      family: { id: 'F7', listings: ['MLA70', 'MLA71'] },
      data: {
        variantListings: [
          { externalId: 'MLA70', sku: 'SP-413-00', measure: 'STD' },
          { externalId: 'MLA71', sku: 'SP-413-50', measure: '0.50' },
        ],
      },
    });
    const [plan] = await planFamilies(db, accountId);
    expect(plan.counts).toMatchObject({ families: 1, splits: 1, splitNew: 1, missing: 0, decisions: 0 });
    expect(plan.families[0]).toMatchObject({ kind: 'split', code: 'SP-413' });
    expect(plan.families[0].members.map((m) => [m.externalId, m.measure, m.lead])).toEqual([
      ['MLA70', 'STD', true],
      ['MLA71', '0.50', false],
    ]);
  });
});

describe.skipIf(!url)('juntar y separar familias', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';
  const now = new Date('2026-11-11T12:00:00Z');

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE listing_families, channel_copies, pipeline_movements, stage_movements, buyer_questions, price_decisions, publications, product_variants, products, stores, channels, accounts, users CASCADE',
    );
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    accountId = account.id;
    storeId = store.id;
  });

  const product = (variants: { sku: string; measure: string | null }[]) =>
    db.product.create({ data: { accountId, name: 'Subconjunto de prueba', variants: { create: variants.map((v, i) => ({ ...v, position: i })) } } });

  async function listing(
    productId: string,
    externalId: string,
    sku: string | null,
    family: string | null,
    data: Record<string, unknown> = {},
    familyName?: string,
    listingIds: string[] = [],
  ) {
    const p = await db.publication.create({ data: { productId, storeId, externalId, title: `Subconjunto de prueba ${externalId}`, ...data } });
    await db.channelCopy.create({
      data: {
        publicationId: p.id,
        readAt: now,
        status: 'ACTIVE',
        title: p.title,
        fingerprints: { title: 'viejo' },
        agreed: { title: 'viejo' },
        details: {
          skus: sku ? [sku] : [],
          channelProductId: `UP-${externalId}`,
          ...(familyName ? { channelFamilyName: familyName } : {}),
          ...(family ? familyDetails({ familyId: family, channelProductIds: [], listingIds }, null, now) : {}),
        },
      },
    });
    return p;
  }

  it('junta las medidas: lo de la familia queda igual en todas, el pipeline se alinea y cada una conserva su precio distinto', async () => {
    const p = await product([
      { sku: 'SP-1-00', measure: 'STD' },
      { sku: 'SP-1-50', measure: '0.50' },
    ]);
    const std = await listing(p.id, 'MLA1', 'SP-1-00', 'F1', { price: 1000, faq: '<p>Trae juntas.</p>', description: 'Descripción STD' }, 'Subconjunto De Prueba');
    const half = await listing(
      p.id,
      'MLA2',
      'SP-1-50',
      'F1',
      { price: 1200, faq: '<p>Envío en el día.</p>', description: 'Descripción 0.50', pipelineStatus: 'IN_PIPELINE', pipelineStep: 'DESCRIPTION', autoAnswer: true },
      'Subconjunto De Prueba',
    );
    await db.pipelineMovement.create({ data: { publicationId: half.id, step: 'DESCRIPTION', enteredAt: now } });

    const result = await applyFamilies(db, { accountId, storeId, userId: null, now: () => now });
    expect(result).toMatchObject({ families: 1, joined: 2, split: 0, skipped: [] });

    const family = await db.listingFamily.findFirstOrThrow({ include: { members: { orderBy: { externalId: 'asc' } } } });
    expect(family).toMatchObject({ channelFamilyId: 'F1', leadId: half.id, productId: p.id });
    const [a, b] = family.members;
    for (const m of [a, b]) {
      expect(m).toMatchObject({
        title: 'Subconjunto De Prueba',
        description: 'Descripción 0.50',
        faq: '<p>Envío en el día.</p>\n<p>Trae juntas.</p>',
        autoAnswer: true,
        pipelineStatus: 'IN_PIPELINE',
        pipelineStep: 'DESCRIPTION',
      });
    }
    expect(a).toMatchObject({ id: std.id, variantKey: 'sku:SP-1-00 medida:std', ownPrice: true });
    expect(b).toMatchObject({ id: half.id, variantKey: 'sku:SP-1-50 medida:0.50', ownPrice: false });
    // La STD entró al pipeline donde está la familia.
    expect(await db.pipelineMovement.findFirst({ where: { publicationId: std.id, exitedAt: null } })).toMatchObject({ step: 'DESCRIPTION' });
    // El título en el canal es el nombre de la familia: no queda como cambio.
    const copy = await db.channelCopy.findUniqueOrThrow({ where: { publicationId: std.id } });
    expect((copy.fingerprints as Record<string, string>).title).toBe(fingerprint('title', 'Subconjunto De Prueba'));
    expect((copy.agreed as Record<string, string>).title).toBe(fingerprint('title', 'Subconjunto De Prueba'));

    // Después, se mueven y se guardan juntas.
    await db.$transaction((tx) => advanceStep(tx, { publicationId: half.id, expected: 'DESCRIPTION', userId: null }));
    expect((await db.publication.findMany({ select: { pipelineStep: true } })).map((r) => r.pipelineStep)).toEqual(['QA', 'QA']);
    await saveQaTexts(db, { accountId, publicationId: std.id, faq: '<p>Una sola respuesta.</p>' });
    expect((await db.publication.findMany({ select: { faq: true } })).map((r) => r.faq)).toEqual(['<p>Una sola respuesta.</p>', '<p>Una sola respuesta.</p>']);
    await db.$transaction((tx) => writeContentField(tx, { productId: p.id, publicationId: half.id }, 'description', 'Nueva para las dos'));
    expect((await db.publication.findMany({ select: { description: true } })).map((r) => r.description)).toEqual(['Nueva para las dos', 'Nueva para las dos']);
    await db.$transaction((tx) => removeFromPipeline(tx, { publicationId: std.id, expected: 'QA', reason: 'LATER', userId: null }));
    expect((await db.publication.findMany({ select: { pipelineStatus: true } })).map((r) => r.pipelineStatus)).toEqual(['DISCARDED', 'DISCARDED']);
    // Volver a agregar una agrega la familia entera, en el mismo paso.
    const added = await db.$transaction((tx) => addToPipeline(tx, { accountId, publicationIds: [std.id], userId: null }));
    expect(added).toMatchObject({ resumed: 2, related: [] });
  });

  it('el precio de la familia va a las medidas sin precio propio, y una medida puede tener el suyo', async () => {
    const p = await product([
      { sku: 'SP-2-00', measure: 'STD' },
      { sku: 'SP-2-50', measure: '0.50' },
      { sku: 'SP-2-75', measure: '0.75' },
    ]);
    await db.product.update({ where: { id: p.id }, data: { replacementCost: 100 } });
    const a = await listing(p.id, 'MLA11', 'SP-2-00', 'F2', { price: 500 });
    const b = await listing(p.id, 'MLA12', 'SP-2-50', 'F2', { price: 500 });
    const c = await listing(p.id, 'MLA13', 'SP-2-75', 'F2', { price: 500 });
    await applyFamilies(db, { accountId, storeId, userId: null, now: () => now });
    const family = await db.listingFamily.findFirstOrThrow();
    await setMeasurePrice(db, { accountId, publicationId: c.id === family.leadId ? a.id : c.id, own: true, price: 700 });
    const own = c.id === family.leadId ? a.id : c.id;

    await savePriceDecision(db, { accountId, publicationId: b.id, userId: null, listPrice: 900, discountPct: 10, plan: 0, cost: 100, overrides: {}, confirmBelowMin: true });
    const rows = await db.publication.findMany({ select: { id: true, price: true, discount: true } });
    for (const r of rows) {
      expect(Number(r.price)).toBe(r.id === own ? 700 : 900);
      expect(Number(r.discount)).toBe(10);
    }
    // La decisión queda en la principal.
    expect(await db.priceDecision.findFirstOrThrow()).toMatchObject({ publicationId: family.leadId });
    // Sin precio propio, vuelve al de la familia.
    await setMeasurePrice(db, { accountId, publicationId: own, own: false });
    expect(await db.publication.findUniqueOrThrow({ where: { id: own } })).toMatchObject({ ownPrice: false });
    expect(Number((await db.publication.findUniqueOrThrow({ where: { id: own } })).price)).toBe(900);
  });

  it('separa una familia que creó la app: una publicación por medida, con sus fotos y sus preguntas', async () => {
    const p = await product([
      { sku: 'SP-3-00', measure: 'STD' },
      { sku: 'SP-3-50', measure: '0.50' },
    ]);
    const STD = 'sku:SP-3-00 medida:std';
    const HALF = 'sku:SP-3-50 medida:0.50';
    const head = await listing(p.id, 'MLA21', null, 'F3', {
      pipelineStatus: 'IN_PIPELINE',
      pipelineStep: 'PRICE',
      price: 800,
      variantListings: [
        { externalId: 'MLA21', sku: 'SP-3-00', measure: 'STD' },
        { externalId: 'MLA22', sku: 'SP-3-50', measure: '0.50' },
      ],
      media: [
        { kind: 'channel', id: 'F1', url: 'https://foto/1.jpg' },
        { kind: 'channel', id: 'F2', url: 'https://foto/2.jpg', variants: [STD] },
        { kind: 'channel', id: 'F3', url: 'https://foto/3.jpg', variants: [HALF] },
      ],
    });
    const question = await db.buyerQuestion.create({
      data: { storeId, externalId: 'Q1', listingId: 'MLA22', publicationId: head.id, text: '¿Sirve para el motor de prueba?', askedAt: now, readAt: now, status: 'UNANSWERED' },
    });

    const result = await applyFamilies(db, { accountId, storeId, userId: null, now: () => now });
    expect(result).toMatchObject({ split: 1, created: 1 });
    const half = await db.publication.findFirstOrThrow({ where: { externalId: 'MLA22' } });
    expect(half).toMatchObject({ variantKey: HALF, title: head.title, pipelineStatus: 'IN_PIPELINE', pipelineStep: 'PRICE' });
    expect(Number(half.price)).toBe(800);
    expect((half.media as { id: string }[]).map((r) => r.id)).toEqual(['F3', 'F1']);
    const after = await db.publication.findUniqueOrThrow({ where: { id: head.id } });
    expect(after).toMatchObject({ variantKey: STD, variantListings: [] });
    expect((after.media as { id: string }[]).map((r) => r.id)).toEqual(['F2', 'F1']);
    expect(await db.listingFamily.findFirstOrThrow()).toMatchObject({ leadId: head.id, channelFamilyId: 'F3' });
    expect(await db.buyerQuestion.findUniqueOrThrow({ where: { id: question.id } })).toMatchObject({ publicationId: half.id });
    expect(await db.pipelineMovement.count({ where: { publicationId: half.id, exitedAt: null, step: 'PRICE' } })).toBe(1);
  });

  it('una publicación nueva de un producto con medidas nace como familia, una por medida, con las fotos de su medida', async () => {
    const p = await product([
      { sku: 'SP-5-00', measure: 'STD' },
      { sku: 'SP-5-50', measure: '0.50' },
    ]);
    const half = 'sku:SP-5-50 medida:0.50';
    const pub = await db.publication.create({
      data: {
        productId: p.id,
        storeId,
        title: 'Subconjunto nuevo',
        description: '<p>Pistones.</p>',
        channelStatus: 'UNPUBLISHED',
        pipelineStatus: 'IN_PIPELINE',
        pipelineStep: 'INFO',
        media: [
          { kind: 'asset', url: 'https://fotos/todas.jpg' },
          { kind: 'asset', url: 'https://fotos/050.jpg', variants: [half] },
        ],
      },
    });
    const made = await db.$transaction((tx) => familyByMeasure(tx, { publicationId: pub.id, userId: null, now }));
    expect(made).toHaveLength(1);
    const lead = await db.publication.findUniqueOrThrow({ where: { id: pub.id }, include: { family: true } });
    const other = await db.publication.findUniqueOrThrow({ where: { id: made[0] } });
    expect(lead).toMatchObject({ variantKey: 'sku:SP-5-00 medida:std', family: { leadId: pub.id, channelFamilyId: null } });
    expect(other).toMatchObject({
      familyId: lead.familyId,
      variantKey: half,
      externalId: null,
      channelStatus: 'UNPUBLISHED',
      title: 'Subconjunto nuevo',
      description: '<p>Pistones.</p>',
      pipelineStatus: 'IN_PIPELINE',
      pipelineStep: 'INFO',
    });
    const urls = (media: unknown) => (media as { url: string }[]).map((r) => r.url);
    expect(urls(lead.media)).toEqual(['https://fotos/todas.jpg']);
    expect(urls(other.media)).toEqual(['https://fotos/050.jpg', 'https://fotos/todas.jpg']);
    expect(await db.pipelineMovement.findMany({ where: { publicationId: other.id }, select: { step: true, exitedAt: true } })).toEqual([{ step: 'INFO', exitedAt: null }]);

    // Ya tiene todas: no se repite. Una medida nueva en la ficha se suma mientras nada esté publicado.
    expect(await db.$transaction((tx) => familyByMeasure(tx, { publicationId: other.id, userId: null }))).toEqual([]);
    await db.productVariant.create({ data: { productId: p.id, sku: 'SP-5-100', measure: '1.00', position: 2 } });
    const added = await db.$transaction((tx) => familyByMeasure(tx, { publicationId: other.id, userId: null }));
    expect(added).toHaveLength(1);
    expect(await db.publication.findUniqueOrThrow({ where: { id: added[0] } })).toMatchObject({ familyId: lead.familyId, variantKey: 'sku:SP-5-100 medida:1.00' });

    // Con algo publicado, las medidas que faltan llegan del canal.
    await db.publication.update({ where: { id: pub.id }, data: { externalId: 'MLA50', channelStatus: 'ACTIVE' } });
    await db.productVariant.create({ data: { productId: p.id, sku: 'SP-5-150', measure: '1.50', position: 3 } });
    expect(await db.$transaction((tx) => familyByMeasure(tx, { publicationId: pub.id, userId: null }))).toEqual([]);

    // Una publicación de un producto con una sola medida queda como está.
    const single = await product([{ sku: 'SP-6', measure: null }]);
    const lone = await db.publication.create({ data: { productId: single.id, storeId, channelStatus: 'UNPUBLISHED' } });
    expect(await db.$transaction((tx) => familyByMeasure(tx, { publicationId: lone.id, userId: null }))).toEqual([]);
    expect((await db.publication.findUniqueOrThrow({ where: { id: lone.id } })).familyId).toBeNull();
  });

  it('la familia que creó la app toma el código que le dio el canal, si no lo tiene otra', async () => {
    const p = await product([
      { sku: 'SP-7-00', measure: 'STD' },
      { sku: 'SP-7-50', measure: '0.50' },
    ]);
    const a = await listing(p.id, 'MLA71', 'SP-7-00', 'F7', {}, undefined, ['MLA71', 'MLA72']);
    const b = await listing(p.id, 'MLA72', 'SP-7-50', 'F7', {}, undefined, ['MLA71', 'MLA72']);
    const family = await db.listingFamily.create({ data: { storeId, productId: p.id, leadId: a.id } });
    await db.publication.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { familyId: family.id } });
    // Otra familia ya tiene ese código: no se pisa.
    const taken = await db.listingFamily.create({ data: { storeId, productId: p.id, channelFamilyId: 'F7' } });
    expect(await fillFamilyCode(db, family.id)).toBe(false);
    await db.listingFamily.delete({ where: { id: taken.id } });
    expect(await fillFamilyCode(db, family.id)).toBe(true);
    expect((await db.listingFamily.findUniqueOrThrow({ where: { id: family.id } })).channelFamilyId).toBe('F7');
    // La vista previa la da por armada.
    const [plan] = await planFamilies(db, accountId);
    expect(plan.counts).toMatchObject({ done: 1, families: 0 });
  });

  it('una medida que llega después a una familia que ya está en la app se suma sola', async () => {
    const p = await product([
      { sku: 'SP-4-00', measure: 'STD' },
      { sku: 'SP-4-50', measure: '0.50' },
    ]);
    const first = await listing(p.id, 'MLA31', 'SP-4-50', 'F4', { pipelineStatus: 'IN_PIPELINE', pipelineStep: 'TITLE', faq: '<p>Hola.</p>' }, undefined, ['MLA31', 'MLA32']);
    await applyFamilies(db, { accountId, storeId, userId: null, now: () => now });
    const later = await listing(p.id, 'MLA32', 'SP-4-00', 'F4');
    expect(await joinKnownFamilies(db, storeId, [later.id])).toBe(1);
    expect(await db.publication.findUniqueOrThrow({ where: { id: later.id } })).toMatchObject({
      familyId: (await db.publication.findUniqueOrThrow({ where: { id: first.id } })).familyId,
      faq: '<p>Hola.</p>',
      pipelineStep: 'TITLE',
    });
  });
});
