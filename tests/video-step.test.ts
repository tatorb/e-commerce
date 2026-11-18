import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { renameOption } from '@/lib/product-options';
import { addStep, createProtocol, listProtocols, updateProtocol, updateStep } from '@/lib/shoot';
import { chooseVideoStep, stepForVideo } from '@/lib/video-edits';

const url = process.env.TEST_DATABASE_URL;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? 'postgresql://x' }) });

describe.skipIf(!url)('el paso de un video copiado al Drive sale del tipo de su producto', () => {
  let accountId: string;
  let camisas: string;

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE video_edits, product_videos, shoot_steps, shoot_protocols, product_options, products, accounts, users CASCADE');
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta' } })).id;
    await db.productOption.createMany({ data: ['Camisas', 'Subconjunto (pistones + aros)', 'Juntas'].map((name) => ({ accountId, kind: 'TYPE' as const, name })) });
    camisas = await createProtocol(db, { accountId, input: { name: 'Camisas', productType: 'camisas' }, userId: null });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const video = (productType: string | null, extra: { shootStepId?: string; stepChosen?: boolean } = {}) => ({ accountId, productType, shootStepId: extra.shootStepId ?? null, stepChosen: extra.stepChosen ?? false });
  const step = (protocolId: string, title: string, kind = 'VIDEO', driveDefault = false) => addStep(db, { accountId, protocolId, input: { title, kind, driveDefault } });

  it('un protocolo nuevo lleva su tipo, de la lista de la cuenta, y cada tipo tiene uno solo', async () => {
    expect((await listProtocols(db, accountId))[0].productType).toBe('Camisas');
    await expect(createProtocol(db, { accountId, input: { name: 'Otro' }, userId: null })).rejects.toThrow('Elegí para qué tipo');
    await expect(createProtocol(db, { accountId, input: { name: 'Otro', productType: 'Bujías' }, userId: null })).rejects.toThrow('no está en los tipos');
    await expect(createProtocol(db, { accountId, input: { name: 'Camisas 2', productType: 'Camisas' }, userId: null })).rejects.toThrow('ya tiene un protocolo: Camisas');
    // Uno que tiene tipo no lo pierde, y puede cambiarlo por uno libre.
    await expect(updateProtocol(db, { accountId, protocolId: camisas, input: { name: 'Camisas', productType: null } })).rejects.toThrow('Elegí para qué tipo');
    await updateProtocol(db, { accountId, protocolId: camisas, input: { name: 'Camisas', productType: 'Juntas' } });
    await updateProtocol(db, { accountId, protocolId: camisas, input: { name: 'Camisas', productType: 'Camisas' } });
    // Uno archivado deja libre su tipo.
    await db.shootProtocol.update({ where: { id: camisas }, data: { archivedAt: new Date() } });
    await createProtocol(db, { accountId, input: { name: 'Camisas nuevo', productType: 'Camisas' }, userId: null });
  });

  it('con un solo paso de video usa ese; con varios, el marcado; sin marcar, ninguno', async () => {
    await step(camisas, 'Frente', 'PHOTO');
    expect(await stepForVideo(db, video('Camisas'))).toMatchObject({ step: null, reason: 'sin-protocolo' });
    const unboxing = await step(camisas, 'Unboxing');
    expect(await stepForVideo(db, video('Camisas'))).toMatchObject({ step: { id: unboxing }, reason: 'tipo' });
    const detalle = await step(camisas, 'Detalle');
    expect(await stepForVideo(db, video('Camisas'))).toMatchObject({ step: null, reason: 'sin-marcar' });
    await updateStep(db, { accountId, stepId: detalle, input: { title: 'Detalle', kind: 'VIDEO', driveDefault: true } });
    expect(await stepForVideo(db, video('Camisas'))).toMatchObject({ step: { id: detalle }, reason: 'tipo' });
    // Marcar otro desmarca al anterior: uno solo por protocolo.
    await updateStep(db, { accountId, stepId: unboxing, input: { title: 'Unboxing', kind: 'VIDEO', driveDefault: true } });
    expect((await listProtocols(db, accountId))[0].steps.filter((s) => s.driveDefault).map((s) => s.id)).toEqual([unboxing]);
    // Un paso de foto no puede ser el de los videos.
    const foto = await step(camisas, 'Lateral', 'PHOTO', true);
    expect((await db.shootStep.findUniqueOrThrow({ where: { id: foto } })).driveDefault).toBe(false);
  });

  it('sin tipo o sin protocolo para ese tipo, no usa ninguno', async () => {
    await step(camisas, 'Unboxing');
    expect(await stepForVideo(db, video(null))).toMatchObject({ step: null, reason: 'sin-tipo' });
    expect(await stepForVideo(db, video('Juntas'))).toMatchObject({ step: null, reason: 'sin-protocolo' });
    // Un protocolo archivado no cuenta.
    await db.shootProtocol.update({ where: { id: camisas }, data: { archivedAt: new Date() } });
    expect(await stepForVideo(db, video('Camisas'))).toMatchObject({ step: null, reason: 'sin-protocolo' });
  });

  it('lo que elige una persona manda, también cuando elige que no use protocolo', async () => {
    const unboxing = await step(camisas, 'Unboxing');
    const sub = await createProtocol(db, { accountId, input: { name: 'Subconjuntos', productType: 'Subconjunto (pistones + aros)' }, userId: null });
    const otro = await step(sub, 'Unboxing de subconjunto');
    const productId = (await db.product.create({ data: { accountId, name: 'Camisa', productType: 'Camisas' } })).id;
    const v = await db.productVideo.create({ data: { productId, driveFileId: 'd1', name: 'v.mp4', mimeType: 'video/mp4', origin: 'DRIVE' } });
    const now = async () => {
      const r = await db.productVideo.findUniqueOrThrow({ where: { id: v.id } });
      return stepForVideo(db, video('Camisas', { shootStepId: r.shootStepId ?? undefined, stepChosen: r.stepChosen }));
    };
    expect(await now()).toMatchObject({ step: { id: unboxing }, reason: 'tipo' });
    await chooseVideoStep(db, { accountId, videoId: v.id, stepId: otro });
    expect(await now()).toMatchObject({ step: { id: otro }, reason: 'persona' });
    await chooseVideoStep(db, { accountId, videoId: v.id, stepId: null });
    expect(await now()).toMatchObject({ step: null, reason: 'persona' });
    // Volver a automático lo deja otra vez en el del tipo.
    await chooseVideoStep(db, { accountId, videoId: v.id, stepId: 'auto' });
    expect(await now()).toMatchObject({ step: { id: unboxing }, reason: 'tipo' });
    await expect(chooseVideoStep(db, { accountId, videoId: v.id, stepId: 'no-existe' })).rejects.toThrow('ya no está en los protocolos');
    // El paso con que se grabó en Registro de productos vale sin que nadie elija, y automático no lo borra.
    await db.productVideo.update({ where: { id: v.id }, data: { shootStepId: otro, stepChosen: false } });
    expect(await now()).toMatchObject({ step: { id: otro }, reason: 'registro' });
    await chooseVideoStep(db, { accountId, videoId: v.id, stepId: 'auto' });
    expect(await now()).toMatchObject({ step: { id: otro }, reason: 'registro' });
  });

  it('si el tipo cambia de nombre, el protocolo lo acompaña', async () => {
    const unboxing = await step(camisas, 'Unboxing');
    await renameOption(db, accountId, 'TYPE', 'Camisas', 'Camisas de cilindro');
    expect((await listProtocols(db, accountId))[0].productType).toBe('Camisas de cilindro');
    expect(await stepForVideo(db, video('Camisas de cilindro'))).toMatchObject({ step: { id: unboxing } });
  });
});
