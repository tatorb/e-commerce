import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import {
  addToPipeline,
  advanceStep,
  backStep,
  completePipeline,
  removeFromPipeline,
} from '@/domain/pipeline';
import { createPipelinePublication } from '@/domain/pipeline-publications';
import { savePublicationCode } from '@/lib/publication-code';
import { resolveExternalIds } from '@/lib/catalog';

// Datos inventados.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('pipeline de una publicación', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const userId = 'u1';
  let accountId = '';
  let storeId = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE pipeline_movements, stage_movements, publications, products, stores, channels, accounts, users CASCADE',
    );
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } })).id;
    await db.user.create({ data: { id: userId, name: 'Persona', email: 'persona@example.com' } });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function publication(title: string, externalId: string | null, productId?: string) {
    const pid = productId ?? (await db.product.create({ data: { accountId, name: title } })).id;
    const pub = await db.publication.create({ data: { productId: pid, storeId, title, externalId } });
    return { id: pub.id, productId: pid };
  }

  const add = (ids: string[], now?: Date) => db.$transaction((tx) => addToPipeline(tx, { accountId, publicationIds: ids, userId, now }));
  const state = (id: string) =>
    db.publication.findUniqueOrThrow({ where: { id }, select: { pipelineStatus: true, pipelineStep: true, pipelineRemoval: true } });
  const moves = async (id: string) =>
    (await db.pipelineMovement.findMany({ where: { publicationId: id }, orderBy: { enteredAt: 'asc' } })).map((m) => [
      m.step,
      m.exitKind,
      m.exitedAt === null,
    ]);

  it('entra en Información con su registro abierto', async () => {
    const a = await publication('Kit A', 'MLA1');
    const r = await add([a.id]);
    expect(r).toEqual({ added: 1, resumed: 0, alreadyIn: 0, related: [] });
    expect(await state(a.id)).toEqual({ pipelineStatus: 'IN_PIPELINE', pipelineStep: 'INFO', pipelineRemoval: null });
    expect(await moves(a.id)).toEqual([['INFO', null, true]]);
  });

  it('sin código del canal también entra, y las que ya están se saltean', async () => {
    const a = await publication('Kit A', 'MLA1');
    const b = await publication('Kit B', null);
    await add([a.id]);
    const r = await add([a.id, b.id]);
    expect(r).toEqual({ added: 1, resumed: 0, alreadyIn: 1, related: [] });
    expect(await state(b.id)).toEqual({ pipelineStatus: 'IN_PIPELINE', pipelineStep: 'INFO', pipelineRemoval: null });
  });

  it('las del mismo producto o con el mismo título entran igual, con aviso', async () => {
    const a = await publication('Kit Embrague Gol', 'MLA1');
    const b = await publication('Kit embrague GOL', 'MLA2');
    const c = await publication('Otra cosa', 'MLA3', a.productId);
    const d = await publication('Pistones Corsa', 'MLA4');
    await add([a.id]);

    const r = await add([b.id, c.id, d.id]);
    expect(r.added).toBe(3);
    expect(r.related.map((x) => [x.id, x.reason, x.other.id])).toEqual([
      [b.id, 'title', a.id],
      [c.id, 'product', a.id],
    ]);
    for (const p of [b, c, d]) expect((await state(p.id)).pipelineStatus).toBe('IN_PIPELINE');
  });

  it('avanzar y volver guardan cuándo entró y salió de cada paso', async () => {
    const a = await publication('Kit A', 'MLA1');
    const t0 = new Date('2026-10-20T12:00:00Z');
    const t1 = new Date('2026-10-20T13:00:00Z');
    const t2 = new Date('2026-10-20T14:00:00Z');
    await add([a.id], t0);
    await db.$transaction((tx) => advanceStep(tx, { publicationId: a.id, expected: 'INFO', userId, now: t1 }));
    await db.$transaction((tx) => backStep(tx, { publicationId: a.id, expected: 'TITLE', userId, now: t2 }));

    const all = await db.pipelineMovement.findMany({ where: { publicationId: a.id }, orderBy: { enteredAt: 'asc' } });
    expect(all.map((m) => [m.step, m.enteredAt.toISOString(), m.exitedAt?.toISOString() ?? null, m.exitKind])).toEqual([
      ['INFO', t0.toISOString(), t1.toISOString(), 'ADVANCED'],
      ['TITLE', t1.toISOString(), t2.toISOString(), 'BACK'],
      ['INFO', t2.toISOString(), null, null],
    ]);
    expect(all[0].exitedById).toBe(userId);
    expect((await state(a.id)).pipelineStep).toBe('INFO');
  });

  it('no se mueve si el paso cambió mientras tanto, ni antes del primero', async () => {
    const a = await publication('Kit A', 'MLA1');
    await add([a.id]);
    await db.$transaction((tx) => advanceStep(tx, { publicationId: a.id, expected: 'INFO', userId }));
    // Un doble clic: la segunda vez todavía cree que está en Información.
    await expect(
      db.$transaction((tx) => advanceStep(tx, { publicationId: a.id, expected: 'INFO', userId })),
    ).rejects.toThrow('cambió de paso');
    await db.$transaction((tx) => backStep(tx, { publicationId: a.id, expected: 'TITLE', userId }));
    await expect(db.$transaction((tx) => backStep(tx, { publicationId: a.id, expected: 'INFO', userId }))).rejects.toThrow(
      'primer paso',
    );
  });

  it('al sacarla queda descartada con su motivo y, al volver a agregarla, retoma en el mismo paso', async () => {
    const a = await publication('Kit A', 'MLA1');
    await add([a.id]);
    await db.$transaction((tx) => advanceStep(tx, { publicationId: a.id, expected: 'INFO', userId }));
    await db.$transaction((tx) => removeFromPipeline(tx, { publicationId: a.id, expected: 'TITLE', userId, reason: 'LATER' }));
    expect(await state(a.id)).toEqual({ pipelineStatus: 'DISCARDED', pipelineStep: 'TITLE', pipelineRemoval: 'LATER' });
    const removed = await db.pipelineMovement.findFirstOrThrow({ where: { publicationId: a.id, step: 'TITLE' } });
    expect(removed).toMatchObject({ exitKind: 'REMOVED', removal: 'LATER' });

    expect(await add([a.id])).toEqual({ added: 0, resumed: 1, alreadyIn: 0, related: [] });
    expect(await state(a.id)).toEqual({ pipelineStatus: 'IN_PIPELINE', pipelineStep: 'TITLE', pipelineRemoval: null });
    expect(await moves(a.id)).toEqual([
      ['INFO', 'ADVANCED', false],
      ['TITLE', 'REMOVED', false],
      ['TITLE', null, true],
    ]);
  });

  it('al terminar el último paso queda corregida; si vuelve a entrar, empieza de cero', async () => {
    const a = await publication('Kit A', 'MLA1');
    await add([a.id]);
    for (const step of ['INFO', 'TITLE', 'IMAGES', 'VIDEOS', 'MEDIA', 'DESCRIPTION'] as const) {
      await db.$transaction((tx) => advanceStep(tx, { publicationId: a.id, expected: step, userId }));
    }
    await expect(
      db.$transaction((tx) => advanceStep(tx, { publicationId: a.id, expected: 'PUBLISH', userId })),
    ).rejects.toThrow('último paso');
    await db.$transaction((tx) => completePipeline(tx, { publicationId: a.id, expected: 'PUBLISH', userId }));
    expect(await state(a.id)).toEqual({ pipelineStatus: 'CORRECTED', pipelineStep: null, pipelineRemoval: null });
    expect(await db.pipelineMovement.count({ where: { publicationId: a.id, exitedAt: null } })).toBe(0);

    await add([a.id]);
    expect((await state(a.id)).pipelineStep).toBe('INFO');
  });

  const create = (args: Omit<Parameters<typeof createPipelinePublication>[1], 'accountId' | 'userId'>) =>
    db.$transaction((tx) => createPipelinePublication(tx, { accountId, userId, ...args }));

  it('publicación nueva de un producto que ya está: sin publicar, en Información, con aviso', async () => {
    const a = await publication('Kit A', 'MLA1');
    await add([a.id]);
    const r = await create({ storeId, productId: a.productId });
    expect(r.productId).toBe(a.productId);
    expect(r.related.map((d) => [d.reason, d.other.id])).toEqual([['product', a.id]]);
    const pub = await db.publication.findUniqueOrThrow({ where: { id: r.publicationId } });
    expect(pub).toMatchObject({
      externalId: null,
      title: null,
      channelStatus: 'UNPUBLISHED',
      stage: 'IMPORTED',
      pipelineStatus: 'IN_PIPELINE',
      pipelineStep: 'INFO',
    });
    expect(await moves(r.publicationId)).toEqual([['INFO', null, true]]);
  });

  it('publicación nueva con ficha corta', async () => {
    const r = await create({ storeId, newProduct: { name: '  Combo Pistones 1.6 ', productType: 'Subconjunto', kind: 'COMBO' } });
    const product = await db.product.findUniqueOrThrow({ where: { id: r.productId } });
    expect(product).toMatchObject({ accountId, name: 'Combo Pistones 1.6', productType: 'Subconjunto', kind: 'COMBO', brand: null });
    expect((await state(r.publicationId)).pipelineStep).toBe('INFO');
  });

  it('publicación nueva: sin producto, con ficha vacía o con tienda de otra cuenta no crea nada', async () => {
    const other = await db.account.create({ data: { slug: 'otra', name: 'Otra' } });
    const channel = await db.channel.findFirstOrThrow();
    const foreignStore = await db.store.create({ data: { accountId: other.id, channelId: channel.id, name: 'AJENA' } });
    await expect(create({ storeId })).rejects.toThrow('Elegí un producto o cargá uno nuevo.');
    await expect(create({ storeId, newProduct: { name: ' ', productType: '', kind: 'INDIVIDUAL' } })).rejects.toThrow(
      'Poné un nombre para el producto.',
    );
    await expect(create({ storeId: foreignStore.id, newProduct: { name: 'Kit', productType: '', kind: 'INDIVIDUAL' } })).rejects.toThrow(
      'Elegí una tienda de esta cuenta.',
    );
    expect(await db.product.count()).toBe(0);
    expect(await db.publication.count()).toBe(0);
  });

  it('sin ID no se marca como corregida; con el ID cargado, sí', async () => {
    const r = await create({ storeId, newProduct: { name: 'Kit nuevo', productType: '', kind: 'INDIVIDUAL' } });
    for (const step of ['INFO', 'TITLE', 'IMAGES', 'VIDEOS', 'MEDIA', 'DESCRIPTION'] as const) {
      await db.$transaction((tx) => advanceStep(tx, { publicationId: r.publicationId, expected: step, userId }));
    }
    const complete = () => db.$transaction((tx) => completePipeline(tx, { publicationId: r.publicationId, expected: 'PUBLISH', userId }));
    await expect(complete()).rejects.toThrow('Falta el ID de la publicación en el canal');

    // Un ID que ya tiene otra publicación de la tienda no se guarda.
    await publication('Otra', 'MLA1234567890');
    const save = (raw: string) => savePublicationCode(db, { accountId, publicationId: r.publicationId, raw });
    expect(await save('cualquier cosa')).toMatchObject({ ok: false, error: expect.stringContaining('MLA') });
    expect(await save('MLA1234567890')).toEqual({ ok: false, error: 'Ya hay una publicación con ese ID en esta tienda.' });

    // El link se limpia y la publicación pasa a activa.
    expect(await save('https://articulo.mercadolibre.com.ar/MLA-9876543210-kit-nuevo-_JM')).toEqual({
      ok: true,
      externalId: 'MLA9876543210',
      url: 'https://articulo.mercadolibre.com.ar/MLA-9876543210',
    });
    expect(await db.publication.findUniqueOrThrow({ where: { id: r.publicationId } })).toMatchObject({
      externalId: 'MLA9876543210',
      channelStatus: 'ACTIVE',
    });
    await complete();
    expect((await state(r.publicationId)).pipelineStatus).toBe('CORRECTED');
  });

  it('no deja agregar publicaciones de otra cuenta', async () => {
    const other = await db.account.create({ data: { slug: 'otra', name: 'Otra' } });
    const product = await db.product.create({ data: { accountId: other.id, name: 'Ajeno' } });
    const pub = await db.publication.create({ data: { productId: product.id, storeId, externalId: 'MLA9' } });
    await expect(add([pub.id])).rejects.toThrow('ya no existe');
  });

  it('dos tandas al mismo tiempo con el mismo producto: la segunda avisa', async () => {
    const a = await publication('Kit A', 'MLA1');
    const b = await publication('Kit A bis', 'MLA2', a.productId);
    const [ra, rb] = await Promise.all([add([a.id]), add([b.id])]);
    expect([ra.related.length, rb.related.length].sort()).toEqual([0, 1]);
    expect(await db.publication.count({ where: { pipelineStatus: 'IN_PIPELINE' } })).toBe(2);
  });
});

describe.skipIf(!url)('agregar por link o código', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('encuentra las publicaciones del Catálogo por link o código, y separa las que no están', async () => {
    await db.$executeRawUnsafe('TRUNCATE pipeline_movements, publications, products, stores, channels, accounts CASCADE');
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    const product = await db.product.create({ data: { accountId: account.id, name: 'Kit' } });
    const pub = await db.publication.create({ data: { productId: product.id, storeId: store.id, externalId: 'MLA1234567890' } });

    const r = await resolveExternalIds(
      db,
      account.id,
      'https://articulo.mercadolibre.com.ar/MLA-1234567890-kit-_JM\nMLA1234567890, MLA5555555555\nhola',
    );
    expect(r).toEqual({ ids: [pub.id], notFound: ['MLA5555555555'], invalid: ['hola'] });
  });
});
