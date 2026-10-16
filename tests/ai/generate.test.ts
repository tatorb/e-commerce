import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { buildProposalRequest, ProposalError, type ProposalInput, type ProposalOutput } from '@/ai/proposal';
import { usageOf } from '@/ai/claude';
import { saveProduct } from '@/domain/products';
import { createPublication } from '@/domain/publications';
import { moveToStage } from '@/domain/stages';
import { generateProposal } from '@/lib/proposals';

// Datos inventados. La IA está simulada: no se llama a la API.

const url = process.env.TEST_DATABASE_URL;

const none = { value: null, reason: '', toConfirm: [] };
const noList = { items: null, reason: '', toConfirm: [] };
const answer: ProposalOutput = {
  summary: 'Suma garantía a confirmar y ordena el título.',
  title: { value: 'Kit de prueba Marca A Modelo 1 1.6 STD', reason: 'Más claro.', toConfirm: [] },
  description: { value: 'Kit de prueba.\nGarantía\n- [A CONFIRMAR: plazo]', reason: 'No tenía.', toConfirm: [] },
  brand: none,
  partNumber: none,
  kitContents: none,
  warranty: none,
  measures: noList,
  specs: { items: [{ name: 'Material', value: 'acero' }], reason: 'Faltaba.', toConfirm: [] },
  compatibilities: noList,
};

describe.skipIf(!url)('generar propuestas', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let publicationId = '';
  const userId = 'u1';

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE import_runs, import_mappings, measurements, stage_movements, publications, products, stores, channels, accounts, users, standard_rules, proposals CASCADE',
    );
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    await db.user.create({ data: { id: userId, name: 'Persona', email: 'persona@example.com' } });
    await db.standardRule.create({
      data: { accountId: account.id, channelId: channel.id, name: 'Garantía declarada', check: 'warranty', weight: 10 },
    });
    accountId = account.id;
    const productId = (
      await saveProduct(db, {
        accountId,
        productId: null,
        data: {
          name: 'Kit de prueba',
          brand: null,
          partNumber: null,
          productType: null,
          engineSystem: null,
          line: null,
          origin: null,
          warranty: null,
          kitContents: null,
          notes: null,
          specs: [],
          variants: [{ sku: 'ABC-1', measure: 'STD' }],
          compatibilities: [],
          assets: [],
        },
      })
    ).id;
    publicationId = (
      await createPublication(db, {
        productId,
        storeId: store.id,
        userId,
        data: {
          externalId: 'MLA1000000001',
          url: null,
          title: 'Kit de prueba',
          description: null,
          attributes: [],
          price: 98765,
          channelStatus: 'ACTIVE',
        },
      })
    ).id;
    await db.measurement.create({
      data: {
        publicationId,
        takenAt: new Date('2026-10-15T00:00:00Z'),
        metrics: { visits_90d: 54321, sales_90d: 4242, conversion_90d: 0.0777, photo_count: 4 },
      },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const usage = usageOf('claude-opus-5-5', { input_tokens: 5000, output_tokens: 3000 });

  it('guarda la propuesta, mueve la etapa y no le manda precios ni ventas a la IA', async () => {
    let seen: ProposalInput | null = null;
    const outcome = await generateProposal(db, { accountId, publicationId, userId }, async (input) => {
      seen = input;
      return { output: answer, usage, model: 'claude-opus-5-5' };
    });
    expect(outcome).toMatchObject({ ok: true, fieldsChanged: 3, costUsd: 0.08 });

    const body = JSON.stringify(buildProposalRequest(seen!));
    for (const secret of ['98765', '54321', '4242', '0.0777']) expect(body).not.toContain(secret);
    expect(body).toContain('Garantía declarada');
    expect(seen!.listing.photoCount).toBe(4);

    const pub = await db.publication.findUniqueOrThrow({ where: { id: publicationId }, include: { proposals: true } });
    expect(pub.stage).toBe('PROPOSAL_GENERATED');
    expect(pub.proposals).toHaveLength(1);
    expect(pub.proposals[0]).toMatchObject({ status: 'ACTIVE', createdById: userId, model: 'claude-opus-5-5' });
    // La propuesta no toca la publicación.
    expect(pub.title).toBe('Kit de prueba');
  });

  it('volver a generar reemplaza la anterior sin repetir la etapa', async () => {
    const fake = async () => ({ output: answer, usage, model: 'claude-opus-5-5' });
    await generateProposal(db, { accountId, publicationId, userId }, fake);
    await generateProposal(db, { accountId, publicationId, userId }, fake);
    const proposals = await db.proposal.findMany({ orderBy: { createdAt: 'asc' } });
    expect(proposals.map((p) => p.status)).toEqual(['SUPERSEDED', 'ACTIVE']);
    expect(await db.stageMovement.count({ where: { publicationId, stage: 'PROPOSAL_GENERATED' } })).toBe(1);
  });

  it('no genera si la publicación está en revisión', async () => {
    await db.$transaction((tx) => moveToStage(tx, { publicationId, stage: 'IN_REVIEW', userId }));
    let called = false;
    const outcome = await generateProposal(db, { accountId, publicationId, userId }, async () => {
      called = true;
      return { output: answer, usage, model: 'claude-opus-5-5' };
    });
    expect(outcome.ok).toBe(false);
    expect(called).toBe(false);
  });

  it('si la IA falla, avisa, cuenta lo gastado y no cambia nada', async () => {
    const outcome = await generateProposal(db, { accountId, publicationId, userId }, async () => {
      throw new ProposalError('La respuesta de Claude quedó cortada. Probá de nuevo.', usage);
    });
    expect(outcome).toEqual({
      ok: false,
      error: 'La respuesta de Claude quedó cortada. Probá de nuevo.',
      costUsd: 0.08,
      retryable: false,
    });
    expect(await db.proposal.count()).toBe(0);
    expect((await db.publication.findUniqueOrThrow({ where: { id: publicationId } })).stage).toBe('IMPORTED');
  });

  it('no encuentra publicaciones de otra cuenta', async () => {
    const other = await db.account.create({ data: { slug: 'otra', name: 'Otra' } });
    const outcome = await generateProposal(db, { accountId: other.id, publicationId, userId }, async () => {
      throw new Error('no debería llamarse');
    });
    expect(outcome).toMatchObject({ ok: false, error: 'La publicación no existe en esta cuenta.' });
  });
});
