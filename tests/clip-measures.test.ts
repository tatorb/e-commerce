import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { activeUploaders, chooseApprovedClip, claimQueuedUpload, finishQueuedUpload, pendingClipUploads, queueClipUploads, uploaderSeen } from '@/lib/clip-uploads';
import { measuresOf } from '@/lib/media';
import { findVideoMeasures, setVideoMeasure } from '@/lib/video-measure';
import { markClipUploaded } from '@/lib/videos';

const url = process.env.TEST_DATABASE_URL;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? 'postgresql://x' }) });

describe.skipIf(!url)('un video por medida', () => {
  let accountId: string;
  let productId: string;
  const VARIANTS = [
    { sku: 'SP-449-00', measure: 'STD' },
    { sku: 'SP-449-60', measure: '0,60 mm' },
  ];
  const [STD, M60] = measuresOf(VARIANTS);

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE clip_uploaders, video_edits, publication_clips, product_videos, publications, stores, channels, product_variants, products, accounts, users CASCADE');
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta' } })).id;
    productId = (await db.product.create({ data: { accountId, name: 'Subconjunto SP-449', productType: 'Subconjunto', variants: { create: VARIANTS.map((v, position) => ({ ...v, position })) } } })).id;
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const store = await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } });
    // Dos formas de cobro por medida.
    for (const [code, key] of [['MLA1', STD.key], ['MLA2', STD.key], ['MLA3', M60.key], ['MLA4', M60.key]] as const) {
      await db.publication.create({ data: { productId, storeId: store.id, externalId: code, title: 'Subconjunto', variantKey: key } });
    }
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  /** Un video original y el clip aprobado que salió de él. */
  async function approved(name: string) {
    const original = await db.productVideo.create({ data: { productId, driveFileId: `d-${name}`, name, mimeType: 'video/mp4', origin: 'DRIVE' } });
    const clip = await db.productVideo.create({ data: { productId, driveFileId: `c-${name}`, name: name.replace('.MP4', ' · editado.mp4'), mimeType: 'video/mp4', origin: 'DRIVE' } });
    await db.videoEdit.create({ data: { videoId: original.id, status: 'APPROVED', targetSeconds: 45, clipId: clip.id } });
    return { original, clip };
  }

  const where = async () =>
    Object.fromEntries(
      (await db.publication.findMany({ orderBy: { externalId: 'asc' }, select: { externalId: true, clips: { select: { video: { select: { name: true } } } } } })).map((p) => [
        p.externalId,
        p.clips.map((c) => c.video.name.slice(0, 10)),
      ]),
    );

  it('la medida sale del nombre del archivo, y el clip es de la medida de su video', async () => {
    const { original, clip } = await approved('SP-449-060.MP4');
    await findVideoMeasures(db, productId);
    expect((await db.productVideo.findUniqueOrThrow({ where: { id: original.id } })).variantLabel).toBe('0,60 mm');
    expect(await db.productVideo.findUniqueOrThrow({ where: { id: clip.id } })).toMatchObject({ variantKey: M60.key, variantSource: 'archivo' });
    // Un nombre sin el SKU no dice nada.
    const other = await approved('DJI_0073_D.MP4');
    await findVideoMeasures(db, productId);
    expect((await db.productVideo.findUniqueOrThrow({ where: { id: other.clip.id } })).variantKey).toBeNull();
  });

  it('con un solo video aprobado va en todas las medidas; al aprobar el de otra, cada uno queda en la suya', async () => {
    const std = await approved('SP-449-00.MP4');
    await chooseApprovedClip(db, { clipId: std.clip.id, userId: null });
    expect(await where()).toEqual({ MLA1: ['SP-449-00 '], MLA2: ['SP-449-00 '], MLA3: ['SP-449-00 '], MLA4: ['SP-449-00 '] });
    // Es una sola subida, para todas las medidas.
    let list = await pendingClipUploads(db, accountId);
    expect(list.map((c) => [c.fileName, c.allMeasures, c.measure])).toEqual([['SP-449-00 · editado.mp4', true, null]]);
    await markClipUploaded(db, { accountId, publicationId: list[0].publicationId, videoId: list[0].videoId, uploaded: true, userId: null });
    expect(await pendingClipUploads(db, accountId)).toEqual([]);

    const m60 = await approved('SP-449-060.MP4');
    await chooseApprovedClip(db, { clipId: m60.clip.id, userId: null });
    expect(await where()).toEqual({ MLA1: ['SP-449-00 '], MLA2: ['SP-449-00 '], MLA3: ['SP-449-060'], MLA4: ['SP-449-060'] });
    // Falta subir solo el nuevo, y solo para su medida: sus dos formas de cobro son una subida.
    list = await pendingClipUploads(db, accountId);
    expect(list.map((c) => [c.fileName, c.allMeasures, c.measure, c.publications])).toEqual([['SP-449-060 · editado.mp4', false, '0,60 mm', 2]]);
    await markClipUploaded(db, { accountId, publicationId: list[0].publicationId, videoId: list[0].videoId, uploaded: true, userId: null, onlyMeasure: true });
    expect(await pendingClipUploads(db, accountId)).toEqual([]);
  });

  it('un video sin medida no pisa al que ya hay, y la medida se puede elegir a mano', async () => {
    const std = await approved('SP-449-00.MP4');
    await chooseApprovedClip(db, { clipId: std.clip.id, userId: null });
    const loose = await approved('DJI_0074_D.MP4');
    await chooseApprovedClip(db, { clipId: loose.clip.id, userId: null });
    expect((await where()).MLA3).toEqual(['SP-449-00 ']);
    // La persona dice que el video suelto es de 0,60: su clip queda con esa medida.
    await setVideoMeasure(db, { accountId, videoId: loose.original.id, variantKey: M60.key });
    expect(await db.productVideo.findUniqueOrThrow({ where: { id: loose.clip.id } })).toMatchObject({ variantLabel: '0,60 mm' });
    expect(await db.productVideo.findUniqueOrThrow({ where: { id: loose.original.id } })).toMatchObject({ variantSource: 'persona' });
    // Y que es de todas: el nombre ya no se vuelve a mirar.
    await setVideoMeasure(db, { accountId, videoId: std.original.id, variantKey: null });
    await findVideoMeasures(db, productId);
    expect((await db.productVideo.findUniqueOrThrow({ where: { id: std.original.id } })).variantKey).toBeNull();
    await expect(setVideoMeasure(db, { accountId, videoId: std.original.id, variantKey: 'no-existe' })).rejects.toThrow('no está en la ficha');
  });
  it('la cola de subida: se pide, la extensión la toma de a uno y cuenta cómo salió', async () => {
    const std = await approved('SP-449-00.MP4');
    await chooseApprovedClip(db, { clipId: std.clip.id, userId: null });
    const m60 = await approved('SP-449-060.MP4');
    await chooseApprovedClip(db, { clipId: m60.clip.id, userId: null });
    const accounts = [{ id: accountId, slug: 'prueba' }];
    const t0 = new Date('2026-11-19T10:00:00Z');
    // Sin pedir nada, la cola está vacía.
    expect(await claimQueuedUpload(db, accounts, t0)).toBeNull();
    // Se piden todos: son dos subidas, una por medida.
    expect((await queueClipUploads(db, { accountId, queued: true, now: t0 })).changed).toBe(2);
    expect((await pendingClipUploads(db, accountId)).every((c) => c.queuedAt)).toBe(true);

    const first = await claimQueuedUpload(db, accounts, t0);
    expect(first).toMatchObject({ fileName: 'SP-449-00 · editado.mp4', allMeasures: false, accountSlug: 'prueba' });
    // Mientras ese está en curso, no entrega otro: de a uno.
    expect(await claimQueuedUpload(db, accounts, new Date(t0.getTime() + 60_000))).toBeNull();
    await finishQueuedUpload(db, { accountId, publicationId: first!.publicationId, videoId: first!.videoId, allMeasures: false, ok: true, userId: null, now: t0 });
    // Quedó subido en las dos formas de cobro de su medida, y salió de la lista.
    expect((await pendingClipUploads(db, accountId)).map((c) => c.fileName)).toEqual(['SP-449-060 · editado.mp4']);

    // El segundo falla: sale de la cola con su motivo, y no se vuelve a tomar hasta que se pida de nuevo.
    const second = await claimQueuedUpload(db, accounts, t0);
    await finishQueuedUpload(db, { accountId, publicationId: second!.publicationId, videoId: second!.videoId, allMeasures: false, ok: false, error: 'La sesión de Mercado Libre está cerrada.', userId: null });
    expect(await pendingClipUploads(db, accountId)).toMatchObject([{ queuedAt: null, error: 'La sesión de Mercado Libre está cerrada.' }]);
    expect(await claimQueuedUpload(db, accounts, t0)).toBeNull();
    // Se pide de nuevo, con una publicación cualquiera de esa medida.
    const other = await db.publication.findFirstOrThrow({ where: { externalId: 'MLA4' } });
    expect(await queueClipUploads(db, { accountId, items: [{ publicationId: other.id, videoId: second!.videoId }], queued: true, now: t0 })).toMatchObject({ changed: 1, skipped: [] });
    // Un clip que no está para subir no entra.
    expect((await queueClipUploads(db, { accountId, items: [{ publicationId: other.id, videoId: 'no-existe' }], queued: true })).skipped).toHaveLength(1);

    // Una subida que se cuelga se vuelve a tomar pasado un rato, hasta tres veces.
    for (const minutes of [0, 16, 32]) expect(await claimQueuedUpload(db, accounts, new Date(t0.getTime() + minutes * 60_000))).not.toBeNull();
    expect(await claimQueuedUpload(db, accounts, new Date(t0.getTime() + 48 * 60_000))).toBeNull();
    expect((await pendingClipUploads(db, accountId))[0]).toMatchObject({ queuedAt: null, error: expect.stringContaining('3 veces') });
  });

  it('se sabe si hay una extensión atendiendo la cola', async () => {
    await db.user.create({ data: { id: 'u1', name: 'Martín', email: 'm@example.com' } });
    const now = new Date('2026-11-19T10:00:00Z');
    expect(await activeUploaders(db, now)).toEqual([]);
    // Con la cola apagada está, pero no la atiende.
    await uploaderSeen(db, { userId: 'u1', version: '0.4.0', auto: false, now });
    expect(await activeUploaders(db, now)).toEqual([]);
    await uploaderSeen(db, { userId: 'u1', version: '0.4.0', auto: true, now });
    expect(await activeUploaders(db, now)).toMatchObject([{ name: 'Martín', version: '0.4.0' }]);
    // Si dejó de preguntar, ya no cuenta.
    expect(await activeUploaders(db, new Date(now.getTime() + 10 * 60_000))).toEqual([]);
  });
});
