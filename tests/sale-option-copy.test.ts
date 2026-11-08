import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';

// Igualar las opciones de venta con la buena y crear las formas de cobro que
// faltan. El canal está simulado. Datos inventados.

const url = process.env.TEST_DATABASE_URL;

const created: { listingType: string; title: string; price: number; sku: string | null; pictures: unknown[]; channelProductId?: string | null }[] = [];
const installments: [string, number][] = [];
const locked = new Set<string>();
let nextCode = 900;
let joinAs = 'UP-1';

vi.mock('@/lib/connections', () => ({ withAccessToken: async (_db: unknown, _store: string, run: (t: string, u: string) => unknown) => run('llave', '7') }));
vi.mock('@/channels/publish', async (orig) => {
  const real = await orig<typeof import('@/channels/publish')>();
  return {
    ...real,
    getChannelPublisher: () => ({
      listingTypeFor: (plan: number) => (plan >= 3 ? 'premium' : 'clasica'),
      create: async (_t: string, l: { listingType: string; title: string; pictures: unknown[]; members: { price: number; sku: string | null; channelProductId?: string | null }[] }) => {
        created.push({ listingType: l.listingType, title: l.title, price: l.members[0].price, sku: l.members[0].sku, pictures: l.pictures, channelProductId: l.members[0].channelProductId });
        return { members: [{ externalId: `MLA${nextCode++}`, url: 'https://canal/nueva', pictureIds: null }], warnings: [] };
      },
      setInstallments: async (_t: string, id: string, plan: number) => {
        installments.push([id, plan]);
      },
    }),
  };
});
vi.mock('@/lib/catalog-data', () => ({
  loadCatalogData: async () => ({ category: { id: 'CAT-1', name: 'Subconjuntos' }, fields: [], fromProduct: [], values: {} }),
}));
vi.mock('@/lib/channel-push', () => ({ isTitleLocked: async (_db: unknown, _a: string, id: string) => locked.has(id) }));
vi.mock('@/lib/channel-sync', () => ({
  readOne: async (db: PrismaClient, args: { publicationId: string }) => {
    await db.channelCopy.upsert({
      where: { publicationId: args.publicationId },
      create: { publicationId: args.publicationId, readAt: new Date(), status: 'ACTIVE', channelProductId: joinAs },
      update: { channelProductId: joinAs },
    });
    return [];
  },
}));

const { normalizeSaleOptions, createSaleOption, SaleOptionCopyError } = await import('@/lib/sale-option-copy');

describe.skipIf(!url)('igualar y crear opciones de venta', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';
  let productId = '';

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    created.length = 0;
    installments.length = 0;
    locked.clear();
    joinAs = 'UP-1';
    await db.$executeRawUnsafe('TRUNCATE listing_families, channel_copies, channel_sync_changes, price_decisions, pipeline_movements, publications, products, stores, channels, accounts, users CASCADE');
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } })).id;
    productId = (await db.product.create({ data: { accountId, name: 'Subconjunto SP-1', variants: { create: [{ sku: 'SP-1-00', measure: 'STD', position: 0 }] } } })).id;
  });

  const listing = async (code: string, plan: number, extra: Record<string, unknown> = {}, copy: Record<string, unknown> = {}) => {
    const p = await db.publication.create({ data: { productId, storeId, externalId: code, title: `Subconjunto ${code}`, installments: plan, ...extra } });
    await db.channelCopy.create({ data: { publicationId: p.id, readAt: new Date(), status: 'ACTIVE', installments: plan, channelProductId: 'UP-1', photoIds: ['F1', 'F2'], quantity: 4, ...copy } });
    return p;
  };

  const good = (extra: Record<string, unknown> = {}) =>
    listing('MLA1', 0, {
      pipelineStatus: 'IN_PIPELINE',
      pipelineStep: 'QA',
      title: 'Subconjunto Persan SP-1 STD',
      description: 'La descripción buena.',
      attributes: [{ name: 'Marca', value: 'Persan' }],
      faq: '<p>Preguntas</p>',
      answerRules: '<p>Reglas</p>',
      warranty: { type: 'factory', amount: 15, unit: 'days' },
      ...extra,
    });

  it('copia de la buena a las otras opciones, sin tocar las finalizadas ni el título bloqueado, y dice qué formas faltan', async () => {
    const main = await good();
    const low = await listing('MLA2', 1, { mainOptionId: main.id, description: 'Vieja' });
    const closed = await listing('MLA3', 3, { mainOptionId: main.id }, { status: 'CLOSED' });
    const sold = await listing('MLA4', 6, { mainOptionId: main.id });
    locked.add(sold.id);

    const dry = await normalizeSaleOptions(db, { accountId, publicationId: low.id, apply: false, userId: null });
    expect(dry).toHaveLength(1);
    expect(dry[0]).toMatchObject({ main: 'MLA1', source: 'MLA1', missing: ['3 cuotas', '9 cuotas', '12 cuotas'] });
    const byCode = Object.fromEntries(dry[0].targets.map((t) => [t.externalId, t]));
    expect(byCode.MLA2.changes).toEqual(expect.arrayContaining(['título', 'descripción', 'datos de catálogo', 'preguntas frecuentes', 'reglas del bot', 'garantía']));
    expect(byCode.MLA3.untouched).toContain('finalizada');
    expect(byCode.MLA4.changes).not.toContain('título');
    expect(byCode.MLA4.skipped[0]).toContain('bloqueado');
    // Solo mostrar no cambia nada.
    expect((await db.publication.findUniqueOrThrow({ where: { id: low.id } })).description).toBe('Vieja');

    const copied: string[] = [];
    await normalizeSaleOptions(db, {
      accountId,
      publicationId: main.id,
      apply: true,
      userId: null,
      copyMedia: async (_from, to) => {
        copied.push(to);
        return { fotos: 2 };
      },
    });
    const after = await db.publication.findUniqueOrThrow({ where: { id: low.id } });
    expect(after).toMatchObject({ title: 'Subconjunto Persan SP-1 STD', description: 'La descripción buena.', faq: '<p>Preguntas</p>', answerRules: '<p>Reglas</p>', installments: 1 });
    expect(after.attributes).toEqual([{ name: 'Marca', value: 'Persan' }]);
    expect((await db.publication.findUniqueOrThrow({ where: { id: sold.id } })).title).toBe('Subconjunto MLA4');
    expect((await db.publication.findUniqueOrThrow({ where: { id: closed.id } })).description).toBeNull();
    expect(copied.sort()).toEqual([low.id, sold.id].sort());
  });

  it('crea la forma de cobro que falta copiada de la buena, unida a la medida', async () => {
    const main = await good();
    await listing('MLA2', 1, { mainOptionId: main.id });

    const r = await createSaleOption(db, { accountId, publicationId: main.id, plan: 3, price: 500_000, userId: null });
    expect(r).toMatchObject({ externalId: 'MLA900', plan: '3 cuotas', price: 500_000, joined: true, warnings: [] });
    expect(created[0]).toMatchObject({ listingType: 'premium', title: 'Subconjunto Persan SP-1 STD', price: 500_000, sku: 'SP-1-00', channelProductId: 'UP-1' });
    expect(created[0].pictures).toEqual([{ kind: 'existing', id: 'F1' }, { kind: 'existing', id: 'F2' }]);
    expect(installments).toEqual([['MLA900', 3]]);
    const row = await db.publication.findUniqueOrThrow({ where: { id: r.id } });
    expect(row).toMatchObject({ mainOptionId: main.id, installments: 3, description: 'La descripción buena.', faq: '<p>Preguntas</p>' });

    // La que ya tiene no se vuelve a crear.
    await expect(createSaleOption(db, { accountId, publicationId: main.id, plan: 1, price: 1, userId: null })).rejects.toThrow('ya tiene cuota promocionada');
    // Si el canal la deja como producto aparte, avisa.
    joinAs = 'UP-OTRO';
    const apart = await createSaleOption(db, { accountId, publicationId: main.id, plan: 6, price: 600_000, userId: null });
    expect(apart.joined).toBe(false);
    expect(apart.warnings[0]).toContain('no la juntó');
  });

  it('sin una buena en el pipeline, pide cuál es', async () => {
    const main = await listing('MLA1', 0);
    await expect(normalizeSaleOptions(db, { accountId, publicationId: main.id, apply: false, userId: null })).rejects.toBeInstanceOf(SaleOptionCopyError);
    const r = await normalizeSaleOptions(db, { accountId, publicationId: main.id, sourceId: main.id, apply: false, userId: null });
    expect(r[0].source).toBe('MLA1');
  });
});
