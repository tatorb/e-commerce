import { PrismaPg } from '@prisma/adapter-pg';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { parseMedia, photoKey } from '@/domain/media';
import { draftsForTextImage, findTextImagesInChannel, sentTextCodes, type ImageLoaders } from '@/lib/text-images/channel-codes';
import { placeTextImages } from '@/lib/text-images/place';

// El código de la imagen con texto en el canal: reemplazar la anterior en su
// lugar al regenerarla, y reconocer las que ya estaban subidas. Datos inventados.

describe('los códigos que devuelve el canal', () => {
  it('quedan solo para las imágenes con texto, por su lugar en la lista', () => {
    expect(sentTextCodes([null, 't1', null, 't2'], ['A', 'B', 'C', 'D'])).toEqual([
      { textImageId: 't1', photoId: 'B' },
      { textImageId: 't2', photoId: 'D' },
    ]);
    expect(sentTextCodes(['t1'], null)).toEqual([]);
  });
});

/** Una imagen de prueba: franjas o cuadros, de un tamaño. */
async function picture(kind: 'franjas' | 'cuadros' | 'diagonal', size: { w: number; h: number }, format: 'png' | 'jpeg' = 'png'): Promise<Uint8Array> {
  const { w, h } = size;
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const on = kind === 'franjas' ? Math.floor(x / (w / 6)) % 2 === 0 : kind === 'cuadros' ? (Math.floor(x / (w / 4)) + Math.floor(y / (h / 4))) % 2 === 0 : x > y;
      raw.fill(on ? 30 : 220, (y * w + x) * 3, (y * w + x) * 3 + 3);
    }
  const img = sharp(raw, { raw: { width: w, height: h, channels: 3 } });
  return new Uint8Array(format === 'png' ? await img.png().toBuffer() : await img.jpeg({ quality: 70 }).toBuffer());
}

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('la imagen con texto en el canal', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let productId = '';
  let storeId = '';
  let mainId = '';
  let optionId = '';
  let textId = '';

  afterAll(async () => {
    await db.$disconnect();
  });

  const copy = (ids: string[]) => ({ readAt: new Date(), status: 'ACTIVE' as const, photos: ids.map((id) => `https://ml/${id}.jpg`), photoIds: ids, variations: [], details: { channelProductId: 'UP1' } });

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE text_images, channel_copies, publications, products, stores, channels, accounts CASCADE');
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Prueba' } })).id;
    storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } })).id;
    productId = (await db.product.create({ data: { accountId, name: 'Subconjunto SP-1' } })).id;
    // En el canal la imagen con texto quedó en el lugar 3, aunque su lugar fijo es el 1.
    mainId = (await db.publication.create({ data: { productId, storeId, externalId: 'MLA1', title: 'Subconjunto', channelCopy: { create: copy(['F1', 'F2', 'VIEJA', 'F3']) } } })).id;
    // La de 6 cuotas comparte las fotos y tiene un borrador propio, que se pisaría con el de la principal.
    optionId = (
      await db.publication.create({
        data: { productId, storeId, externalId: 'MLA2', title: 'Subconjunto', mainOptionId: mainId, media: [{ kind: 'channel', id: 'F2', url: '' }], channelCopy: { create: copy(['F1', 'F2', 'VIEJA', 'F3']) } },
      })
    ).id;
    textId = (
      await db.textImage.create({
        data: { accountId, content: {}, slot: 1, mediaPlace: 1, pngRef: 'https://deposito/texto.png', pngAt: new Date('2026-11-10T10:00:00Z'), publications: { create: { publicationId: mainId } } },
      })
    ).id;
  });

  const link = () => db.publicationTextImage.findUniqueOrThrow({ where: { publicationId_textImageId: { publicationId: mainId, textImageId: textId } } });
  const mediaOf = async (id: string) => parseMedia((await db.publication.findUniqueOrThrow({ where: { id } })).media)?.map(photoKey) ?? null;

  it('con el código guardado, la nueva va en el lugar de la anterior y la opción de venta queda sin borrador', async () => {
    await db.publicationTextImage.update({ where: { publicationId_textImageId: { publicationId: mainId, textImageId: textId } }, data: { channelPhotoId: 'VIEJA' } });
    // Primero sin guardar.
    const preview = await draftsForTextImage(db, { textImageId: textId, publicationIds: [mainId], dryRun: true });
    expect(preview.drafts).toEqual([{ publicationId: mainId, externalId: 'MLA1', how: 'replaced', position: 3, note: null }]);
    expect(preview.cleared).toEqual([{ publicationId: optionId, externalId: 'MLA2', from: 'MLA1' }]);
    expect(await mediaOf(mainId)).toBeNull();

    await draftsForTextImage(db, { textImageId: textId, publicationIds: [mainId] });
    // Las mismas fotos del canal, en el mismo orden, con la nueva en el lugar 3 y no en el fijo.
    expect(await mediaOf(mainId)).toEqual(['canal:F1', 'canal:F2', `texto:${textId}`, 'canal:F3']);
    expect(await mediaOf(optionId)).toBeNull();
    // Otra vez: ya la tiene, no cambia nada.
    expect((await draftsForTextImage(db, { textImageId: textId, publicationIds: [mainId] })).drafts[0].how).toBe('kept');
  });

  it('si el código ya no está en el canal, va en su lugar fijo y avisa', async () => {
    await db.publicationTextImage.update({ where: { publicationId_textImageId: { publicationId: mainId, textImageId: textId } }, data: { channelPhotoId: 'BORRADA' } });
    const r = await draftsForTextImage(db, { textImageId: textId, publicationIds: [mainId] });
    expect(r.drafts[0]).toMatchObject({ how: 'placed', position: 1 });
    expect(r.drafts[0].note).toContain('ya no está en el canal');
    expect(await mediaOf(mainId)).toEqual([`texto:${textId}`, 'canal:F1', 'canal:F2', 'canal:VIEJA', 'canal:F3']);
  });

  it('sin código sigue como antes, y con lugar fijo no deja la anterior repetida', async () => {
    expect((await draftsForTextImage(db, { textImageId: textId, publicationIds: [mainId] })).withoutCode).toEqual([mainId]);
    // Con un borrador que tiene la anterior del canal y su código: queda una sola, en el lugar fijo.
    await db.publication.update({ where: { id: mainId }, data: { media: ['F1', 'F2', 'VIEJA', 'F3'].map((id) => ({ kind: 'channel', id, url: '' })) } });
    await db.publicationTextImage.update({ where: { publicationId_textImageId: { publicationId: mainId, textImageId: textId } }, data: { channelPhotoId: 'VIEJA' } });
    await placeTextImages(db, [mainId]);
    expect(await mediaOf(mainId)).toEqual([`texto:${textId}`, 'canal:F1', 'canal:F2', 'canal:F3']);
  });

  it('reconoce entre las fotos del canal la que es el PNG, aunque el canal la haya pasado a JPG', async () => {
    const png = await picture('franjas', { w: 1200, h: 1200 });
    const photos: Record<string, Uint8Array> = {
      'https://ml/F1.jpg': await picture('cuadros', { w: 1200, h: 1200 }, 'jpeg'),
      'https://ml/F2.jpg': await picture('diagonal', { w: 1200, h: 1200 }, 'jpeg'),
      'https://ml/VIEJA.jpg': await picture('franjas', { w: 1200, h: 1200 }, 'jpeg'),
      'https://ml/F3.jpg': await picture('franjas', { w: 1200, h: 800 }, 'jpeg'),
    };
    const loaders: ImageLoaders = { png: async () => png, photo: async (u) => photos[u] ?? null };
    const r = await findTextImagesInChannel(db, { publicationIds: [mainId], budgetMs: 30_000, loaders });
    expect(r.found).toEqual([{ publicationId: mainId, externalId: 'MLA1', textImageId: textId, slot: 1, photoId: 'VIEJA', position: 3 }]);
    expect(await link()).toMatchObject({ channelPhotoId: 'VIEJA', channelFound: true });
    // Con el código, al regenerar se reemplaza esa.
    await draftsForTextImage(db, { textImageId: textId, publicationIds: [mainId] });
    expect(await mediaOf(mainId)).toEqual(['canal:F1', 'canal:F2', `texto:${textId}`, 'canal:F3']);
  });

  it('si ninguna se parece no guarda nada, y no vuelve a bajar las mismas fotos', async () => {
    const png = await picture('franjas', { w: 1200, h: 1200 });
    const other = await picture('cuadros', { w: 1200, h: 1200 }, 'jpeg');
    let downloads = 0;
    const loaders: ImageLoaders = {
      png: async () => png,
      photo: async () => {
        downloads++;
        return other;
      },
    };
    // Las corregidas que subió la app ya se saben: no se comparan.
    await db.channelCopy.update({ where: { publicationId: mainId }, data: { photoOrigins: { F1: 'una-corregida' } } });
    expect((await findTextImagesInChannel(db, { publicationIds: [mainId], budgetMs: 30_000, loaders })).found).toEqual([]);
    expect(downloads).toBe(3);
    expect((await link()).channelPhotoId).toBeNull();
    await findTextImagesInChannel(db, { publicationIds: [mainId], budgetMs: 30_000, loaders });
    expect(downloads).toBe(3);
    // Cambian las fotos del canal: se vuelve a mirar.
    await db.channelCopy.update({ where: { publicationId: mainId }, data: { photoIds: ['F1', 'F2', 'NUEVA'], photos: ['https://ml/F1.jpg', 'https://ml/F2.jpg', 'https://ml/NUEVA.jpg'] } });
    await findTextImagesInChannel(db, { publicationIds: [mainId], budgetMs: 30_000, loaders });
    expect(downloads).toBe(5);
  });
});
