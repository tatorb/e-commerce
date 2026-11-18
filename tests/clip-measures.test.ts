import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { chooseApprovedClip, pendingClipUploads } from '@/lib/clip-uploads';
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
    await db.$executeRawUnsafe('TRUNCATE video_edits, publication_clips, product_videos, publications, stores, channels, product_variants, products, accounts, users CASCADE');
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
});
