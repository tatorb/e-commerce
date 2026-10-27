import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { familyDetails } from '@/domain/families';
import { planFamilies } from '@/lib/families';

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
