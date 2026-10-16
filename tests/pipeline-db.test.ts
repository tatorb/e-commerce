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

  const add = (ids: string[], force = false, now?: Date) =>
    db.$transaction((tx) => addToPipeline(tx, { accountId, publicationIds: ids, userId, force, now }));
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
    expect(r).toEqual({ ok: true, added: 1, resumed: 0, alreadyIn: 0, withoutId: 0 });
    expect(await state(a.id)).toEqual({ pipelineStatus: 'IN_PIPELINE', pipelineStep: 'INFO', pipelineRemoval: null });
    expect(await moves(a.id)).toEqual([['INFO', null, true]]);
  });

  it('sin código del canal no entra, y las que ya están se saltean', async () => {
    const a = await publication('Kit A', 'MLA1');
    const b = await publication('Kit B', null);
    await add([a.id]);
    const r = await add([a.id, b.id]);
    expect(r).toEqual({ ok: true, added: 0, resumed: 0, alreadyIn: 1, withoutId: 1 });
    expect((await state(b.id)).pipelineStatus).toBe('UNTOUCHED');
    expect(await db.pipelineMovement.count()).toBe(1);
  });

  it('avisa las duplicadas y no agrega nada, salvo que se pida agregarlas igual', async () => {
    const a = await publication('Kit Embrague Gol', 'MLA1');
    const b = await publication('Kit embrague GOL', 'MLA2');
    const c = await publication('Otra cosa', 'MLA3', a.productId);
    const d = await publication('Pistones Corsa', 'MLA4');
    await add([a.id]);

    const r = await add([b.id, c.id, d.id]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.duplicates.map((x) => [x.id, x.reason])).toEqual([
      [b.id, 'title'],
      [c.id, 'product'],
    ]);
    expect((await state(d.id)).pipelineStatus).toBe('UNTOUCHED');

    // Agregar sin las repetidas.
    expect(await add([d.id])).toMatchObject({ ok: true, added: 1 });
    // O agregarlas igual.
    expect(await add([b.id, c.id], true)).toMatchObject({ ok: true, added: 2 });
    expect((await state(c.id)).pipelineStatus).toBe('IN_PIPELINE');
  });

  it('avanzar y volver guardan cuándo entró y salió de cada paso', async () => {
    const a = await publication('Kit A', 'MLA1');
    const t0 = new Date('2026-10-20T12:00:00Z');
    const t1 = new Date('2026-10-20T13:00:00Z');
    const t2 = new Date('2026-10-20T14:00:00Z');
    await add([a.id], false, t0);
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

    expect(await add([a.id])).toEqual({ ok: true, added: 0, resumed: 1, alreadyIn: 0, withoutId: 0 });
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

  it('no deja agregar publicaciones de otra cuenta', async () => {
    const other = await db.account.create({ data: { slug: 'otra', name: 'Otra' } });
    const product = await db.product.create({ data: { accountId: other.id, name: 'Ajeno' } });
    const pub = await db.publication.create({ data: { productId: product.id, storeId, externalId: 'MLA9' } });
    await expect(add([pub.id])).rejects.toThrow('ya no existe');
  });

  it('dos tandas al mismo tiempo con el mismo producto: la segunda avisa la duplicada', async () => {
    const a = await publication('Kit A', 'MLA1');
    const b = await publication('Kit A bis', 'MLA2', a.productId);
    const [ra, rb] = await Promise.all([add([a.id]), add([b.id])]);
    expect([ra.ok, rb.ok].sort()).toEqual([false, true]);
    expect(await db.publication.count({ where: { pipelineStatus: 'IN_PIPELINE' } })).toBe(1);
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
