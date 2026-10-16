import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { usageOf } from '@/ai/claude';
import type { ProposalOutput } from '@/ai/proposal';
import { markApplied, undoApplied } from '@/domain/applications';
import { saveProduct } from '@/domain/products';
import { createPublication } from '@/domain/publications';
import { approveProposal, startReview } from '@/domain/proposals';
import { generateProposal } from '@/lib/proposals';

// Datos inventados; la IA está simulada.

const url = process.env.TEST_DATABASE_URL;
const timeZone = 'America/Argentina/Buenos_Aires';

const none = { value: '', reason: '', toConfirm: [] };
const noList = { items: [], reason: '', toConfirm: [] };
const answer: ProposalOutput = {
  summary: 'Ordena el título.',
  title: { value: 'Kit de prueba Marca A Modelo 1', reason: 'Más claro.', toConfirm: [] },
  description: none,
  brand: none,
  partNumber: none,
  kitContents: none,
  warranty: none,
  measures: noList,
  specs: { items: [{ name: 'Material', value: 'acero' }], reason: 'Faltaba.', toConfirm: [] },
  compatibilities: noList,
};

describe.skipIf(!url)('marcar como aplicada', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const userId = 'u1';
  let publicationId = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE import_runs, import_mappings, measurements, stage_movements, publications, products, stores, channels, accounts, users, standard_rules, proposals, channel_applications CASCADE',
    );
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    await db.user.create({ data: { id: userId, name: 'Persona', email: 'persona@example.com' } });
    const productId = (
      await saveProduct(db, {
        accountId: account.id,
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
          variants: [],
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
          price: null,
          channelStatus: 'ACTIVE',
        },
      })
    ).id;
    await generateProposal(db, { accountId: account.id, publicationId, userId }, async () => ({
      output: answer,
      usage: usageOf('claude-opus-5-5', { input_tokens: 1, output_tokens: 1 }),
      model: 'claude-opus-5-5',
    }));
    const proposal = await db.proposal.findFirstOrThrow({ where: { publicationId, status: 'ACTIVE' } });
    await db.$transaction((tx) => startReview(tx, { proposalId: proposal.id, userId }));
    await db.$transaction((tx) =>
      approveProposal(tx, {
        proposalId: proposal.id,
        userId,
        titleMaxLength: 60,
        fields: [
          { field: 'title', value: 'Kit de prueba Marca A Modelo 1', included: true, fromAi: true },
          { field: 'specs', value: [{ name: 'Material', value: 'acero' }], included: false, fromAi: true },
        ],
      }),
    );
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const stages = async () =>
    (await db.stageMovement.findMany({ where: { publicationId }, orderBy: { enteredAt: 'asc' } })).map((m) => [
      m.stage,
      m.exitedAt === null,
    ]);

  it('registra la aplicación con los campos aprobados y pasa a Aplicado con esa fecha', async () => {
    const now = new Date(Date.now() + 1000);
    const day = new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(now);
    const r = await db.$transaction((tx) =>
      markApplied(tx, { publicationId, userId, method: 'MANUAL', day, timeZone, now }),
    );
    expect(r.appliedAt).toEqual(now);
    const app = await db.channelApplication.findUniqueOrThrow({ where: { id: r.id } });
    expect(app).toMatchObject({ method: 'MANUAL', fields: ['title'], createdById: userId });
    expect(app.proposalId).not.toBeNull();
    const pub = await db.publication.findUniqueOrThrow({ where: { id: publicationId } });
    expect(pub.stage).toBe('APPLIED');
    const applied = await db.stageMovement.findFirstOrThrow({ where: { publicationId, stage: 'APPLIED' } });
    expect(applied.enteredAt).toEqual(now);

    // Otra vez no: ya no está aprobada.
    await expect(
      db.$transaction((tx) => markApplied(tx, { publicationId, userId, method: 'MANUAL', day, timeZone, now })),
    ).rejects.toThrow('aprobada');
  });

  it('volver a Aprobado deja el historial como antes', async () => {
    const before = await stages();
    const day = new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(new Date());
    await db.$transaction((tx) => markApplied(tx, { publicationId, userId, method: 'MANUAL', day, timeZone }));
    await db.$transaction((tx) => undoApplied(tx, { publicationId }));
    expect(await stages()).toEqual(before);
    expect((await db.publication.findUniqueOrThrow({ where: { id: publicationId } })).stage).toBe('APPROVED');
    expect(await db.channelApplication.count()).toBe(0);
  });

  it('no se puede volver atrás si ya hay una medición posterior', async () => {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(new Date());
    await db.$transaction((tx) => markApplied(tx, { publicationId, userId, method: 'MANUAL', day, timeZone }));
    await db.measurement.create({
      data: { publicationId, takenAt: new Date(Date.now() + 2 * 86400000), metrics: { visits_90d: 10 } },
    });
    await expect(db.$transaction((tx) => undoApplied(tx, { publicationId }))).rejects.toThrow('medición posterior');
  });
});
