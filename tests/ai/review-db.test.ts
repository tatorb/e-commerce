import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { usageOf } from '@/ai/claude';
import type { ProposalOutput } from '@/ai/proposal';
import { loadContent } from '@/domain/content';
import { saveProduct } from '@/domain/products';
import { createPublication } from '@/domain/publications';
import {
  approveProposal,
  nextPendingProposal,
  parseReview,
  rejectProposal,
  ReviewError,
  ReviewValidationError,
  saveReviewDraft,
  startReview,
} from '@/domain/proposals';
import type { ReviewField } from '@/domain/review';
import { generateProposal } from '@/lib/proposals';

// Datos inventados; la IA está simulada.

const url = process.env.TEST_DATABASE_URL;

const none = { value: '', reason: '', toConfirm: [] };
const noList = { items: [], reason: '', toConfirm: [] };
const answer: ProposalOutput = {
  summary: 'Ordena el título y suma ficha técnica.',
  title: { value: 'Kit de prueba Marca A Modelo 1 1.6', reason: 'Más claro.', toConfirm: [] },
  description: { value: 'Kit de prueba.\nGarantía\n- [A CONFIRMAR: plazo]', reason: 'No tenía.', toConfirm: [] },
  brand: none,
  partNumber: none,
  kitContents: none,
  warranty: none,
  measures: noList,
  specs: { items: [{ name: 'Material', value: 'acero' }], reason: 'Faltaba.', toConfirm: [] },
  compatibilities: noList,
};

describe.skipIf(!url)('revisar propuestas', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  const pubs: string[] = [];
  const products: string[] = [];
  const userId = 'u1';

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE import_runs, import_mappings, measurements, stage_movements, publications, products, stores, channels, accounts, users, standard_rules, proposals CASCADE',
    );
    pubs.length = 0;
    products.length = 0;
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    await db.user.create({ data: { id: userId, name: 'Persona', email: 'persona@example.com' } });
    accountId = account.id;
    for (const n of [1, 2]) {
      const productId = (
        await saveProduct(db, {
          accountId,
          productId: null,
          data: {
            name: `Kit de prueba ${n}`,
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
            variants: [{ sku: `ABC-${n}`, measure: null }],
            compatibilities: [],
            assets: [],
          },
        })
      ).id;
      products.push(productId);
      const publicationId = (
        await createPublication(db, {
          productId,
          storeId: store.id,
          userId,
          data: {
            externalId: `MLA100000000${n}`,
            url: null,
            title: `Kit de prueba ${n}`,
            description: null,
            attributes: [],
            price: null,
            channelStatus: 'ACTIVE',
          },
        })
      ).id;
      pubs.push(publicationId);
      await generateProposal(db, { accountId, publicationId, userId }, async () => ({
        output: answer,
        usage: usageOf('claude-opus-5-5', { input_tokens: 1, output_tokens: 1 }),
        model: 'claude-opus-5-5',
      }));
    }
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const active = (publicationId: string) =>
    db.proposal.findFirstOrThrow({ where: { publicationId, status: 'ACTIVE' } });
  const stage = async (publicationId: string) =>
    (await db.publication.findUniqueOrThrow({ where: { id: publicationId } })).stage;

  const reviewed: ReviewField[] = [
    { field: 'title', value: 'Kit de prueba Marca A Modelo 1 1.6', included: true, fromAi: true },
    { field: 'description', value: 'Kit de prueba.\nGarantía\n- 6 meses', included: true, fromAi: true },
    { field: 'specs', value: [{ name: 'Material', value: 'acero' }], included: false, fromAi: true },
    { field: 'warranty', value: '6 meses', included: true, fromAi: false },
  ];

  it('empezar, guardar borrador y aprobar escribe solo lo marcado y registra lo editado', async () => {
    const p = await active(pubs[0]);
    await expect(
      db.$transaction((tx) => approveProposal(tx, { proposalId: p.id, userId, fields: reviewed, titleMaxLength: 60 })),
    ).rejects.toThrow(ReviewError);

    await db.$transaction((tx) => startReview(tx, { proposalId: p.id, userId }));
    expect(await stage(pubs[0])).toBe('IN_REVIEW');

    await db.$transaction((tx) => saveReviewDraft(tx, { proposalId: p.id, userId, fields: reviewed }));
    const draft = parseReview((await active(pubs[0])).review);
    expect(draft?.kind).toBe('draft');
    expect(draft?.fields).toEqual(reviewed);

    const r = await db.$transaction((tx) =>
      approveProposal(tx, { proposalId: p.id, userId, fields: reviewed, titleMaxLength: 60 }),
    );
    expect(r).toEqual({ publicationId: pubs[0], written: 3, edited: 2 });
    expect(await stage(pubs[0])).toBe('APPROVED');

    const content = await loadContent(db, products[0], pubs[0]);
    expect(content.title).toBe('Kit de prueba Marca A Modelo 1 1.6');
    expect(content.description).toBe('Kit de prueba.\nGarantía\n- 6 meses');
    expect(content.warranty).toBe('6 meses');
    // La ficha técnica se descartó.
    expect(content.specs).toEqual([]);

    const decided = await db.proposal.findUniqueOrThrow({ where: { id: p.id } });
    expect(decided).toMatchObject({ status: 'APPROVED', decidedById: userId });
    const review = parseReview(decided.review);
    expect(review?.kind).toBe('decision');
    const byField = Object.fromEntries((review?.kind === 'decision' ? review.fields : []).map((f) => [f.field, f]));
    expect(byField.title).toMatchObject({ included: true, edited: false, before: 'Kit de prueba 1' });
    expect(byField.description).toMatchObject({ included: true, edited: true });
    expect(byField.warranty).toMatchObject({ included: true, edited: true, aiValue: null, before: null });
    expect(byField.specs).toMatchObject({ included: false });
  });

  it('el servidor no aprueba con marcas a confirmar, aunque la pantalla lo deje pasar', async () => {
    const p = await active(pubs[0]);
    await db.$transaction((tx) => startReview(tx, { proposalId: p.id, userId }));
    const withMark = reviewed.map((f) =>
      f.field === 'description' ? { ...f, value: 'Garantía [A CONFIRMAR: plazo]' } : f,
    );
    await expect(
      db.$transaction((tx) => approveProposal(tx, { proposalId: p.id, userId, fields: withMark, titleMaxLength: 60 })),
    ).rejects.toThrow(ReviewValidationError);
    expect(await stage(pubs[0])).toBe('IN_REVIEW');
    expect((await loadContent(db, products[0], pubs[0])).title).toBe('Kit de prueba 1');
  });

  it('rechazar vuelve a la etapa anterior y deja generar otra', async () => {
    const p = await active(pubs[1]);
    await db.$transaction((tx) => startReview(tx, { proposalId: p.id, userId }));
    const r = await db.$transaction((tx) => rejectProposal(tx, { proposalId: p.id, userId, reason: ' Inventó datos ' }));
    expect(r.stage).toBe('IMPORTED');
    expect(await db.proposal.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({
      status: 'REJECTED',
      rejectReason: 'Inventó datos',
    });
    const again = await generateProposal(db, { accountId, publicationId: pubs[1], userId }, async () => ({
      output: answer,
      usage: usageOf('claude-opus-5-5', { input_tokens: 1, output_tokens: 1 }),
      model: 'claude-opus-5-5',
    }));
    expect(again.ok).toBe(true);
    const movements = await db.stageMovement.findMany({ where: { publicationId: pubs[1] }, orderBy: { enteredAt: 'asc' } });
    expect(movements.map((m) => m.stage)).toEqual([
      'IMPORTED',
      'PROPOSAL_GENERATED',
      'IN_REVIEW',
      'IMPORTED',
      'PROPOSAL_GENERATED',
    ]);
  });

  it('la próxima pendiente es la más vieja de las otras', async () => {
    expect(await nextPendingProposal(db, { accountId, excludePublicationId: pubs[0] })).toMatchObject({
      publicationId: pubs[1],
    });
    const p = await active(pubs[1]);
    await db.$transaction((tx) => rejectProposal(tx, { proposalId: p.id, userId, reason: '' }));
    expect(await nextPendingProposal(db, { accountId, excludePublicationId: pubs[0] })).toBeNull();
  });
});
