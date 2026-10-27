import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { completeDriveAuthorization, saveDriveCredentials, startDriveAuthorization } from '@/lib/drive';
import { setAsIs } from '@/lib/photo-queue';
import {
  addStep,
  archiveProtocol,
  createProtocol,
  finishShotPhoto,
  finishShotVideo,
  listProtocols,
  moveStep,
  placeAllShotPhotos,
  placeShotPhotos,
  removeIllustration,
  removeStep,
  searchShootProducts,
  setIllustration,
  shootPlan,
  startIllustrationUpload,
  startShotUpload,
  updateStep,
} from '@/lib/shoot';
import { startFakeGoogle, type FakeGoogle } from './fake-google';

// Registro de productos contra la base de prueba y un Google simulado: los
// protocolos, lo que sube el operario y cómo se suma solo a las publicaciones.
// Datos inventados.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('Registro de productos', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let google: FakeGoogle;
  let accountId = '';
  let otherAccountId = '';
  let productId = '';
  // Una con las dos medidas, una que vende solo la 0.50 y otra que vende solo la STD.
  let bothId = '';
  let halfId = '';
  let stdId = '';
  const userId = 'u1';
  const STD = 'sku:AR-1-00 medida:std';
  const HALF = 'sku:AR-1-50 medida:0.50';

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    process.env.BETTER_AUTH_URL = 'http://app.prueba';
    google = await startFakeGoogle();
    process.env.GOOGLE_AUTH_URL = `${google.url}/auth`;
    process.env.GOOGLE_TOKEN_URL = `${google.url}/token`;
    process.env.GOOGLE_REVOKE_URL = `${google.url}/revoke`;
    process.env.GOOGLE_API_URL = google.url;
  });

  afterAll(async () => {
    await google.close();
    for (const k of ['GOOGLE_AUTH_URL', 'GOOGLE_TOKEN_URL', 'GOOGLE_REVOKE_URL', 'GOOGLE_API_URL', 'BETTER_AUTH_URL']) delete process.env[k];
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE drive_connections, drive_folders, shoot_protocols, photo_step_runs, photo_edits, product_videos, channel_copies, publications, stores, channels, products, accounts, users CASCADE',
    );
    google.files.clear();
    await db.user.create({ data: { id: userId, name: 'Operario de prueba', email: 'operario@prueba.com' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    otherAccountId = (await db.account.create({ data: { slug: 'otra', name: 'Otra cuenta' } })).id;
    productId = (
      await db.product.create({
        data: {
          accountId,
          name: 'Aros de prueba',
          variants: { create: [{ sku: 'AR-1-00', measure: 'STD', position: 0 }, { sku: 'AR-1-50', measure: '0.50', position: 1 }] },
        },
      })
    ).id;
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const store = await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } });
    const pub = (externalId: string, copy: { photoIds: string[]; variations?: unknown[]; skus?: string[] }) =>
      db.publication.create({
        data: {
          productId,
          storeId: store.id,
          externalId,
          title: `Aros ${externalId}`,
          channelCopy: {
            create: {
              readAt: new Date(),
              status: 'ACTIVE',
              photos: copy.photoIds.map((p) => `https://ml.ejemplo.com/${p}.jpg`),
              photoIds: copy.photoIds,
              variations: (copy.variations ?? []) as object[],
              details: { skus: copy.skus ?? [] },
            },
          },
        },
      });
    bothId = (
      await pub('MLA1110001', {
        photoIds: ['F1', 'F2'],
        variations: [
          { sku: 'AR-1-00', measure: 'STD', photoIds: ['F1', 'F2'] },
          { sku: 'AR-1-50', measure: '0.50', photoIds: ['F1', 'F2'] },
        ],
      })
    ).id;
    halfId = (await pub('MLA1110002', { photoIds: ['G1'], skus: ['AR-1-50'] })).id;
    stdId = (await pub('MLA1110003', { photoIds: ['H1'], skus: ['AR-1-00'] })).id;
    await saveDriveCredentials(db, { clientId: '123-prueba.apps.googleusercontent.com', clientSecret: 'secreto-del-cliente-123' });
    const res = await fetch(await startDriveAuthorization(db, { userId }), { redirect: 'manual' });
    const back = new URL(res.headers.get('location')!);
    await completeDriveAuthorization(db, { state: back.searchParams.get('state')!, code: back.searchParams.get('code')! });
  });

  /** Lo que hace el navegador: sube el archivo entero a la dirección y devuelve su id en el Drive. */
  async function upload(uploadUrl: string, bytes = Buffer.from('pixeles')): Promise<string> {
    const r = await fetch(uploadUrl, { method: 'PUT', body: bytes });
    expect(r.status).toBe(200);
    return ((await r.json()) as { id: string }).id;
  }

  async function shootPhoto(name: string, opts: { stepId?: string | null; variantKey?: string | null } = {}) {
    const uploadUrl = await startShotUpload(db, { accountId, productId, kind: 'PHOTO', file: { name, size: 7, type: 'image/jpeg' }, origin: 'http://app.prueba' });
    const fileId = await upload(uploadUrl);
    return finishShotPhoto(db, { accountId, productId, fileId, userId, stepId: opts.stepId ?? null, variantKey: opts.variantKey ?? null });
  }

  const mediaOf = async (id: string) => (await db.publication.findUniqueOrThrow({ where: { id }, select: { media: true } })).media;

  it('arma protocolos con pasos en orden; los pasos que se sacan y los archivados no se ofrecen', async () => {
    const pid = await createProtocol(db, { accountId, input: { name: 'Aros', description: 'Para aros y juegos' }, userId });
    const a = await addStep(db, { accountId, protocolId: pid, input: { title: 'Frente', kind: 'PHOTO', explanation: 'Sobre fondo blanco' } });
    const b = await addStep(db, { accountId, protocolId: pid, input: { title: 'Perfil', kind: 'PHOTO' } });
    const c = await addStep(db, { accountId, protocolId: pid, input: { title: 'Giro', kind: 'VIDEO' } });
    await moveStep(db, { accountId, stepId: c, by: -1 });
    await updateStep(db, { accountId, stepId: a, input: { title: 'Frente, de cerca', kind: 'PHOTO', explanation: '' } });
    let [p] = await listProtocols(db, accountId);
    expect(p.steps.map((s) => s.title)).toEqual(['Frente, de cerca', 'Giro', 'Perfil']);
    await removeStep(db, { accountId, stepId: b });
    [p] = await listProtocols(db, accountId);
    expect(p.steps.map((s) => s.id)).toEqual([a, c]);

    const other = await createProtocol(db, { accountId, input: { name: 'Juntas' }, userId });
    await archiveProtocol(db, { accountId, protocolId: pid, archived: true });
    expect((await listProtocols(db, accountId)).map((x) => x.id)).toEqual([other]);
    expect((await listProtocols(db, accountId, { archived: true })).map((x) => [x.name, x.archived])).toEqual([
      ['Juntas', false],
      ['Aros', true],
    ]);

    // Lo que no se puede: sin nombre, y tocar lo de otra cuenta.
    await expect(createProtocol(db, { accountId, input: { name: ' ' }, userId })).rejects.toThrow('Poné un nombre.');
    await expect(addStep(db, { accountId: otherAccountId, protocolId: other, input: { title: 'X', kind: 'PHOTO' } })).rejects.toThrow('no es de esta cuenta');
  });

  it('la ilustración va a la carpeta de la cuenta; al cambiarla, la anterior va a la papelera', async () => {
    const pid = await createProtocol(db, { accountId, input: { name: 'Aros' }, userId });
    const step = await addStep(db, { accountId, protocolId: pid, input: { title: 'Frente', kind: 'PHOTO' } });
    await expect(startIllustrationUpload(db, { accountId, stepId: step, file: { name: 'guia.pdf', size: 10 }, origin: 'http://app.prueba' })).rejects.toThrow('JPG, PNG');
    const first = await upload(await startIllustrationUpload(db, { accountId, stepId: step, file: { name: 'frente.png', size: 7 }, origin: 'http://app.prueba' }));
    await setIllustration(db, { accountId, stepId: step, fileId: first });
    const folder = google.files.get(google.files.get(first)!.parents[0])!;
    expect(folder.name).toBe('Protocolos de fotos');
    let [p] = await listProtocols(db, accountId);
    expect(p.steps[0].illustration).toMatchObject({ name: 'frente.png' });
    expect(p.steps[0].illustration!.href).toMatch(new RegExp(`^/api/protocolos/${step}\\?v=\\d+$`));

    const second = await upload(await startIllustrationUpload(db, { accountId, stepId: step, file: { name: 'frente2.jpg', size: 7 }, origin: 'http://app.prueba' }));
    await setIllustration(db, { accountId, stepId: step, fileId: second });
    expect(google.files.get(first)!.trashed).toBe(true);
    await removeIllustration(db, { accountId, stepId: step });
    expect(google.files.get(second)!.trashed).toBe(true);
    [p] = await listProtocols(db, accountId);
    expect(p.steps[0].illustration).toBeNull();
  });

  it('la foto del operario entra a la línea con su paso y su medida, y no se suma hasta estar lista', async () => {
    const pid = await createProtocol(db, { accountId, input: { name: 'Aros' }, userId });
    const front = await addStep(db, { accountId, protocolId: pid, input: { title: 'Frente', kind: 'PHOTO' } });
    const spin = await addStep(db, { accountId, protocolId: pid, input: { title: 'Giro', kind: 'VIDEO' } });
    const editId = await shootPhoto('IMG_1.JPG', { stepId: front, variantKey: HALF });
    const edit = await db.photoEdit.findUniqueOrThrow({ where: { id: editId } });
    expect(edit).toMatchObject({ shot: true, shootStepId: front, variantKey: HALF, variantLabel: '0.50', createdById: userId, placedAt: null });
    expect(google.files.get(edit.originalUrl.replace('drive:', ''))!.data.toString()).toBe('pixeles');
    // Todavía no está corregida: no va a ninguna publicación.
    expect(await placeShotPhotos(db, productId)).toBe(0);
    expect(await mediaOf(bothId)).toBeNull();

    // Lo que no se puede: un paso de video para una foto, una medida que no está en la ficha.
    await expect(shootPhoto('IMG_2.JPG', { stepId: spin })).rejects.toThrow('Ese paso es de un video.');
    await expect(shootPhoto('IMG_3.JPG', { variantKey: 'sku:OTRO' })).rejects.toThrow('ya no está en la ficha');
    await expect(startShotUpload(db, { accountId, productId, kind: 'PHOTO', file: { name: 'nota.txt', size: 7, type: 'text/plain' }, origin: 'x' })).rejects.toThrow('solo fotos');

    const plan = (await shootPlan(db, accountId, productId))!;
    expect(plan.measures.map((m) => m.label)).toEqual(['STD', '0.50']);
    expect(plan.protocols.map((p) => p.steps.length)).toEqual([2]);
    expect(plan.shots).toEqual([expect.objectContaining({ kind: 'PHOTO', stepId: front, variantKey: HALF, variantLabel: '0.50', by: 'Operario de prueba' })]);
    expect(await shootPlan(db, otherAccountId, productId)).toBeNull();
  });

  it('lista, se suma una sola vez a cada publicación según su medida', async () => {
    const half = await shootPhoto('IMG_1.JPG', { variantKey: HALF });
    const all = await shootPhoto('IMG_2.JPG');
    await setAsIs(db, { editId: half, asIs: true });
    await setAsIs(db, { editId: all, asIs: true });
    expect(await placeShotPhotos(db, productId)).toBe(2);

    // La de las dos medidas seguía a las del canal: queda con esas y después las nuevas, con su medida.
    // Las del canal traen su orden en cada medida; las nuevas no tienen lugar propio, así que van al final.
    expect(await mediaOf(bothId)).toEqual([
      { kind: 'channel', id: 'F1', url: 'https://ml.ejemplo.com/F1.jpg', positions: { [STD]: 0, [HALF]: 0 } },
      { kind: 'channel', id: 'F2', url: 'https://ml.ejemplo.com/F2.jpg', positions: { [STD]: 1, [HALF]: 1 } },
      { kind: 'edit', editId: half, variants: [HALF] },
      { kind: 'edit', editId: all },
    ]);
    // La que vende solo la 0.50 recibe las dos; la de la STD, solo la de todas.
    expect(await mediaOf(halfId)).toEqual([{ kind: 'channel', id: 'G1', url: 'https://ml.ejemplo.com/G1.jpg' }, { kind: 'edit', editId: half }, { kind: 'edit', editId: all }]);
    expect(await mediaOf(stdId)).toEqual([{ kind: 'channel', id: 'H1', url: 'https://ml.ejemplo.com/H1.jpg' }, { kind: 'edit', editId: all }]);

    // Una sola vez, aunque se vuelva a pasar.
    expect(await placeShotPhotos(db, productId)).toBe(0);
    expect(await placeAllShotPhotos(db, { budgetMs: 5000 })).toEqual({ placed: 0, pending: false });
  });

  it('respeta lo que ya se eligió, y la tarea de cada hora suma las que quedaron', async () => {
    await db.publication.update({ where: { id: bothId }, data: { media: [{ kind: 'channel', id: 'F2', url: 'https://ml.ejemplo.com/F2.jpg' }] } });
    const std = await shootPhoto('IMG_1.JPG', { variantKey: STD });
    await setAsIs(db, { editId: std, asIs: true });
    expect(await placeAllShotPhotos(db, { budgetMs: 5000 })).toEqual({ placed: 1, pending: false });
    expect(await mediaOf(bothId)).toEqual([
      { kind: 'channel', id: 'F2', url: 'https://ml.ejemplo.com/F2.jpg' },
      { kind: 'edit', editId: std, variants: [STD] },
    ]);
    expect(await mediaOf(halfId)).toBeNull();
  });

  it('el video queda marcado con su medida donde hay varias medidas, y se busca el producto', async () => {
    const pid = await createProtocol(db, { accountId, input: { name: 'Aros' }, userId });
    const spin = await addStep(db, { accountId, protocolId: pid, input: { title: 'Giro', kind: 'VIDEO' } });
    const uploadUrl = await startShotUpload(db, { accountId, productId, kind: 'VIDEO', file: { name: 'giro.mov', size: 7, type: 'video/quicktime' }, origin: 'http://app.prueba' });
    const fileId = await upload(uploadUrl);
    const videoId = await finishShotVideo(db, {
      accountId,
      productId,
      fileId,
      size: 7,
      measure: { width: 3840, height: 2160, durationMs: 12_000 },
      userId,
      stepId: spin,
      variantKey: STD,
    });
    expect(await db.productVideo.findUniqueOrThrow({ where: { id: videoId } })).toMatchObject({ shot: true, shootStepId: spin, variantKey: STD, width: 3840 });
    const marks = async (id: string) => (await db.publication.findUniqueOrThrow({ where: { id }, select: { videoVariants: true } })).videoVariants;
    expect(await marks(bothId)).toEqual({ [videoId]: [STD] });
    expect(await marks(stdId)).toEqual({});

    expect((await searchShootProducts(db, accountId, 'AR-1')).map((p) => [p.name, p.code, p.measures, p.thumb])).toEqual([
      ['Aros de prueba', 'AR-1', 2, 'https://ml.ejemplo.com/F1.jpg'],
    ]);
    expect(await searchShootProducts(db, otherAccountId, 'AR-1')).toEqual([]);
    // Sin buscar, los últimos registrados: todavía ninguna foto.
    expect(await searchShootProducts(db, accountId, '')).toEqual([]);
  });
});
