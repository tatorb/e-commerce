import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { variantKey, photoKey } from '@/domain/media';
import { guessMeasure, markState, measureCompare } from '@/domain/photo-measures';
import { setPublicationMeasure } from '@/lib/families';
import { loadFamilyMedia, saveFamilyMedia } from '@/lib/family-media';
import { loadMediaSources, measuresOf } from '@/lib/media';
import { accountMeasureIssues, measureCheck, setPhotoMeasures } from '@/lib/photo-measures';

// Fotos y publicaciones de una familia que quedaron con una medida que ya no
// está en la ficha, como el SP-449: la medida "O.60" pasó a llamarse "0,60 mm"
// y se le cargó el SKU antes de que la app mudara las marcas sola. Datos inventados.

const measures = measuresOf([
  { sku: 'SP-1-00', measure: 'STD' },
  { sku: 'SP-1-60', measure: '0,60 mm' },
]);
const STD = measures[0].key;
const HALF = measures[1].key;

describe('la medida de una marca, sin la base', () => {
  it('reconoce la medida de antes por su SKU o por su medida, con la O por un cero', () => {
    expect(measureCompare('O.60')).toBe('0.60');
    expect(measureCompare('0,60 mm')).toBe('0.60');
    expect(markState(STD, 'STD', measures)).toEqual({ kind: 'measure', key: STD, label: 'STD' });
    expect(markState(null, null, measures)).toEqual({ kind: 'all' });
    // Sin SKU todavía y con la O: es la 0,60.
    expect(markState('medida:o.60', 'O.60', measures)).toEqual({ kind: 'unknown', label: 'O.60', guess: measures[1] });
    expect(guessMeasure('medida:std', 'STD', measures)).toEqual(measures[0]);
    // Por el SKU, aunque la medida diga otra cosa.
    expect(guessMeasure('sku:SP-1-60 medida:vieja', null, measures)).toEqual(measures[1]);
    // Si no se puede saber, no adivina.
    expect(guessMeasure('medida:0.40', '0.40', measures)).toBeNull();
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('las medidas de las fotos de una familia, en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let productId = '';
  let stdPub = '';
  let halfPub = '';
  const edits: Record<string, string> = {};

  afterAll(() => db.$disconnect());

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE listing_families, photo_step_runs, photo_edits, channel_copies, publications, stores, channels, products, accounts CASCADE');
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    productId = (
      await db.product.create({
        data: { accountId, name: 'Subconjunto SP-1', partNumber: 'SP-1', variants: { create: [{ sku: 'SP-1-00', measure: 'STD', position: 0 }, { sku: 'SP-1-60', measure: '0,60 mm', position: 1 }] } },
      })
    ).id;
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const store = await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } });
    // Las dos publicaciones de la familia, con las claves de antes.
    stdPub = (await db.publication.create({ data: { productId, storeId: store.id, title: 'Subconjunto STD', variantKey: 'medida:std' } })).id;
    halfPub = (await db.publication.create({ data: { productId, storeId: store.id, title: 'Subconjunto 0.60', variantKey: 'medida:o.60' } })).id;
    const family = await db.listingFamily.create({ data: { storeId: store.id, productId, leadId: stdPub } });
    await db.publication.updateMany({ where: { id: { in: [stdPub, halfPub] } }, data: { familyId: family.id } });
    // Una foto de cada medida, con la clave de antes, corregida y aprobada.
    for (const [name, key, label, i] of [
      ['frente-std', 'medida:std', 'STD', 0],
      ['frente-060', 'medida:o.60', 'O.60', 1],
    ] as const) {
      const e = await db.photoEdit.create({
        data: { productId, source: 'UPLOAD', originalUrl: `drive:${name}`, originalName: `${name}.jpg`, originalType: 'image/jpeg', originalSize: 10, position: i, variantKey: key, variantLabel: label },
      });
      await db.photoStepRun.create({ data: { editId: e.id, step: 0, status: 'APPROVED', settings: {}, jpgUrl: `drive:${name}-final` } });
      edits[name] = e.id;
    }
  });

  it('avisa, no las mezcla en una sola medida y no deja guardar hasta elegir', async () => {
    const check = await measureCheck(db, productId);
    expect(check.unknownPhotos.map((p) => [p.name, p.state.kind === 'unknown' ? p.state.guess?.label : null])).toEqual([
      ['frente-std.jpg', 'STD'],
      ['frente-060.jpg', '0,60 mm'],
    ]);
    expect(check.memberIssues.map((m) => m.publicationId).sort()).toEqual([stdPub, halfPub].sort());
    expect((await accountMeasureIssues(db, accountId)).map((p) => p.partNumber)).toEqual(['SP-1']);

    // Organización de multimedia: las dos medidas a la vista, con el aviso, sin proponer nada y sin guardar.
    const media = await loadFamilyMedia(db, accountId, stdPub);
    expect(media!.measures.map((m) => m.label)).toEqual(['STD', '0,60 mm']);
    expect(media!.measureIssue).toContain('no tienen su medida elegida');
    expect(media!.protocol).toBeNull();
    expect(media!.available.corrected.every((m) => m.shot?.unknownMeasure)).toBe(true);
    await expect(saveFamilyMedia(db, { accountId, publicationId: stdPub, refs: [{ kind: 'edit', editId: edits['frente-std'] }] })).rejects.toThrow('no tienen su medida elegida');
  });

  it('con las medidas elegidas, cada medida queda con sus fotos', async () => {
    await setPhotoMeasures(db, {
      accountId,
      productId,
      photos: [
        { editId: edits['frente-std'], variantKey: STD },
        { editId: edits['frente-060'], variantKey: HALF },
      ],
    });
    await setPublicationMeasure(db, { accountId, publicationId: stdPub, variantKey: STD });
    await setPublicationMeasure(db, { accountId, publicationId: halfPub, variantKey: HALF });
    expect((await measureCheck(db, productId)).hasIssues).toBe(false);
    expect(await db.photoEdit.findUniqueOrThrow({ where: { id: edits['frente-060'] } })).toMatchObject({ variantKey: HALF, variantLabel: '0,60 mm' });
    expect(await accountMeasureIssues(db, accountId)).toEqual([]);

    const media = await loadFamilyMedia(db, accountId, stdPub);
    expect(media!.measureIssue).toBeNull();
    // El orden que propone: la de la STD solo en la STD, la de la 0,60 solo en la 0,60.
    expect(media!.protocol).toBeNull();
    const sources = await loadMediaSources(db, accountId, halfPub);
    expect(sources.available.corrected.map((m) => [photoKey(m.ref), m.shot?.measureLabel])).toEqual([
      [`corregida:${edits['frente-std']}`, 'STD'],
      [`corregida:${edits['frente-060']}`, '0,60 mm'],
    ]);
    await saveFamilyMedia(db, {
      accountId,
      publicationId: stdPub,
      refs: [
        { kind: 'edit', editId: edits['frente-std'], variants: [STD] },
        { kind: 'edit', editId: edits['frente-060'], variants: [HALF] },
      ],
    });
    const mediaOf = async (id: string) => (await db.publication.findUniqueOrThrow({ where: { id }, select: { media: true } })).media;
    expect(await mediaOf(stdPub)).toEqual([{ kind: 'edit', editId: edits['frente-std'] }]);
    expect(await mediaOf(halfPub)).toEqual([{ kind: 'edit', editId: edits['frente-060'] }]);
  });

  it('solo medidas de la ficha, y solo fotos del producto', async () => {
    await expect(setPhotoMeasures(db, { accountId, productId, photos: [{ editId: edits['frente-std'], variantKey: 'medida:vieja' }] })).rejects.toThrow('no está en la ficha');
    await expect(setPhotoMeasures(db, { accountId, productId, photos: [{ editId: 'otra', variantKey: STD }] })).rejects.toThrow('ya no está en el producto');
    expect(variantKey({ sku: 'SP-1-60', measure: '0,60 mm' })).toBe(HALF);
  });
});
