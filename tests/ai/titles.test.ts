import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { usageOf } from '@/ai/claude';
import { ProposalError } from '@/ai/request';
import { buildTitleRequest, cleanTitleProposals, type TitleInput } from '@/ai/titles';
import { getChannelAdapter } from '@/channels';
import { addToPipeline, advanceStep } from '@/domain/pipeline';
import { saveSuggestions, setWordStatus } from '@/domain/title-work';
import { generateTitles } from '@/lib/titles';

// Datos inventados; la IA está simulada.

const input: TitleInput = {
  channelName: 'Mercado Libre',
  rules: getChannelAdapter('MERCADOLIBRE').titleRules,
  structure: 'Tipo + Modelo',
  product: { productType: 'Kit de prueba', brand: 'Marca R', partNumber: null, line: null, compatibilities: [] },
  currentTitle: 'Kit viejo',
  words: ['kit', 'gol'],
  suggestions: ['kit gol', 'kit gol trend'],
  competitorTitles: ['Kit Gol Trend Otro Vendedor'],
};

describe('pedido de títulos', () => {
  it('manda las reglas, las palabras y las búsquedas, sin precios, visitas ni ventas', () => {
    const req = buildTitleRequest(input);
    const text = JSON.stringify(req);
    expect(text).toContain('Largo máximo: 60 caracteres');
    expect(text).toContain('palabras_elegidas');
    expect(text).not.toMatch(/precio|visitas|ventas|vendidos|price|sold/i);
    expect(req.output_config.format.schema).toBeDefined();
  });

  it('limpia lo que devuelve: sin vacíos ni repetidos, hasta 3', () => {
    expect(
      cleanTitleProposals({
        proposals: [
          { title: ' Kit  Gol ', reason: 'a' },
          { title: 'kit gol', reason: 'b' },
          { title: '', reason: 'c' },
          { title: 'Kit Gol Trend', reason: 'd' },
          { title: 'Kit Trend', reason: 'e' },
          { title: 'Kit Trend Gol', reason: 'f' },
        ],
      }),
    ).toEqual([
      { title: 'Kit Gol', reason: 'a' },
      { title: 'Kit Gol Trend', reason: 'd' },
      { title: 'Kit Trend', reason: 'e' },
    ]);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('generar títulos', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let publicationId = '';
  let channelId = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE title_works, search_suggestions, competitor_listings, pipeline_movements, publications, products, stores, channels, accounts CASCADE',
    );
    channelId = (await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } })).id;
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Prueba' } })).id;
    const store = await db.store.create({ data: { accountId, channelId, name: 'TIENDA' } });
    const product = await db.product.create({
      data: {
        accountId,
        name: 'Kit',
        productType: 'Kit de prueba',
        compatibilities: { create: [{ vehicleBrand: 'Marca', model: 'Gol', engine: '1.6', displacement: '1.6' }] },
      },
    });
    publicationId = (
      await db.publication.create({ data: { productId: product.id, storeId: store.id, externalId: 'MLA1', title: 'Kit viejo', price: 99999 } })
    ).id;
    await db.measurement.create({ data: { publicationId, takenAt: new Date('2026-10-01'), metrics: { visits_90d: 777, sales_90d: 33 } } });
    await db.competitorListing.create({ data: { publicationId, title: 'Kit Gol Otro', soldQuantity: 4321 } });
    await db.$transaction((tx) => addToPipeline(tx, { accountId, publicationIds: [publicationId], userId: null }));
    await db.$transaction((tx) => advanceStep(tx, { publicationId, expected: 'INFO', userId: null }));
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('sin palabras tildadas no pide nada', async () => {
    let called = false;
    const r = await generateTitles(db, { accountId, publicationId }, async () => {
      called = true;
      throw new Error('no');
    });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('Tildá al menos una palabra') });
    expect(called).toBe(false);
  });

  it('pide con las palabras tildadas en el orden de las sugerencias y guarda las 3 propuestas', async () => {
    await saveSuggestions(db, {
      accountId,
      channelId,
      seed: 'kit de prueba gol',
      query: 'kit de prueba gol',
      suggestions: ['kit gol trend', 'kit gol power'],
      source: 'MANUAL',
      publicationId,
    });
    for (const w of ['power', 'kit', 'gol']) await db.$transaction((tx) => setWordStatus(tx, publicationId, w, 'use'));
    let sent: TitleInput | null = null;
    const r = await generateTitles(db, { accountId, publicationId }, async (i) => {
      sent = i;
      return {
        output: { proposals: [{ title: 'Kit Gol Power', reason: 'r1' }, { title: 'Kit Gol', reason: 'r2' }, { title: 'Gol Kit', reason: 'r3' }] },
        usage: usageOf('claude-opus-5-5', { input_tokens: 1000, output_tokens: 200 }),
        model: 'claude-opus-5-5',
      };
    });
    expect(r).toMatchObject({ ok: true, count: 3 });
    expect(sent!.words).toEqual(['kit', 'gol', 'power']);
    expect(sent!.suggestions).toEqual(['kit gol trend', 'kit gol power']);
    expect(sent!.competitorTitles).toEqual(['Kit Gol Otro']);
    // Nada de precios, visitas ni ventas en lo que se manda.
    const text = JSON.stringify(buildTitleRequest(sent!));
    for (const secret of ['99999', '777', '4321']) expect(text).not.toContain(secret);
    expect(text).not.toMatch(/"33"|: 33\b/);
    const work = await db.titleWork.findUniqueOrThrow({ where: { publicationId } });
    expect(work.proposals).toEqual([
      { title: 'Kit Gol Power', reason: 'r1' },
      { title: 'Kit Gol', reason: 'r2' },
      { title: 'Gol Kit', reason: 'r3' },
    ]);
  });

  it('se puede pedir desde otro paso del pipeline, pero no fuera del pipeline', async () => {
    await db.$transaction((tx) => setWordStatus(tx, publicationId, 'kit', 'use'));
    const ok = async () => ({
      output: { proposals: [{ title: 'Kit Gol', reason: 'r' }] },
      usage: usageOf('claude-opus-5-5', { input_tokens: 10, output_tokens: 10 }),
      model: 'claude-opus-5-5',
    });
    await db.publication.update({ where: { id: publicationId }, data: { pipelineStep: 'INFO' } });
    expect(await generateTitles(db, { accountId, publicationId }, ok)).toMatchObject({ ok: true });
    await db.publication.update({ where: { id: publicationId }, data: { pipelineStatus: 'CORRECTED', pipelineStep: null } });
    expect(await generateTitles(db, { accountId, publicationId }, ok)).toMatchObject({ ok: false, error: expect.stringContaining('no está en el pipeline') });
  });

  it('si Claude falla, avisa con su mensaje', async () => {
    await db.$transaction((tx) => setWordStatus(tx, publicationId, 'kit', 'use'));
    // Una palabra tildada que no está en ningún lado no cuenta: hace falta que esté en el mapa.
    await db.competitorListing.updateMany({ data: { title: 'Kit Otro' } });
    const r = await generateTitles(db, { accountId, publicationId }, async () => {
      throw new ProposalError('Claude tardó demasiado en responder. Probá de nuevo.');
    });
    expect(r).toEqual({ ok: false, error: 'Claude tardó demasiado en responder. Probá de nuevo.', costUsd: 0 });
  });
});
