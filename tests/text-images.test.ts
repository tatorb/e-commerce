import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { photoKey, variantKey } from '@/domain/media';
import { nextStep, PIPELINE_STEP_LABEL, PIPELINE_STEPS } from '@/domain/pipeline';
import { brandKeyOf, cleanPiece, emptyPiece, logoType, newBrandKey, parseAliases, pieceMissing, pieceVersion, usedBrands, type PieceContent } from '@/domain/text-images';
import { completeDriveAuthorization, saveDriveCredentials, startDriveAuthorization } from '@/lib/drive';
import { loadFamilyMedia } from '@/lib/family-media';
import { loadMediaSources, picturesFor } from '@/lib/media';
import { addBrand, BrandError, brandUsage, removeBrand, setBrandLogo, updateBrand } from '@/lib/text-images/brands';
import type { PiecePaint } from '@/lib/text-images/piece-html';
import { renderPiece, type PieceRenderer } from '@/lib/text-images/render';
import { completeTextImage, generateTextImage, loadTextImageStep, removeTextImage, saveTextImage, TextImageError } from '@/lib/text-images/step';
import { placeShotPhotos } from '@/lib/shoot';
import { mergeTextImageFolders, syncDriveTextImages } from '@/lib/text-images/drive-files';
import type { TextImageInput, TextImageOutput } from '@/ai/text-images';
import { startFakeGoogle, type FakeGoogle } from './fake-google';

// El paso Imágenes con texto y la base de marcas de vehículos. Datos inventados.

const vehiculo = (marca: string, titulo: string, detalle = '') => ({ tipo: 'vehiculo' as const, marca, titulo, detalle });
const motor = (titulo: string, detalle = '') => ({ tipo: 'motor' as const, titulo, detalle });

const VERSION_A: PieceContent = {
  ...emptyPiece(),
  TIPO_PRODUCTO: 'Subconjunto para motor',
  MOTOR: 'Ford 3.2 TDCi Puma 5 cilindros',
  compatible: [vehiculo('ford', 'Ranger 3.2', 'Años 2012 a 2023'), vehiculo('ford', 'XLS · XLT · Limited', 'Con motor 3.2 de 5 cilindros')],
  no_compatible: [vehiculo('ford', 'Ranger 2.2 Puma', 'Es de 4 cilindros'), vehiculo('ford', 'Ranger 2023 en adelante', 'Motor 2.0 o 3.0 V6'), vehiculo('ford', 'Ranger 3.0 · 2.8 · 2.5')],
  dudas: [
    { titulo: '¿Qué medida pido?', respuesta: 'STD si el cilindro nunca se rectificó. 0.50 si ya se rectificó una vez.' },
    { titulo: '¿Qué trae el subconjunto?', respuesta: 'Pistones, aros y pernos, listo para armar.' },
    { titulo: '¿De qué marca es?', respuesta: 'Persan, fabricado en Argentina.' },
    { titulo: '¿No sabés si es tu motor?', respuesta: 'Mandanos la patente por mensaje y te lo confirmamos antes de comprar.' },
  ],
};

const VERSION_B: PieceContent = {
  ...emptyPiece(),
  TIPO_PRODUCTO: 'Subconjunto para motor',
  MOTOR: 'Fiat 1.7 y 1.9 Diésel aspirado',
  compatible: ['Uno · Duna · Fiorino', 'Strada · Tipo', 'Regata · Ritmo', 'Palio · Siena', 'Tempra · Marengo', 'Ducato'].map((t, i) => vehiculo('fiat', t, i < 3 ? '1.7 diésel aspirado' : '1.9 diésel aspirado')),
  no_compatible: [vehiculo('fiat', 'Palio · Siena 1.7 TD', 'Son turbo, llevan otro pistón'), motor('Motor M 718 turbo', '1.7 TD y 1.9 TD, perno de 26 mm')],
};

describe('el pipeline con el paso nuevo', () => {
  it('tiene los 11 pasos en el orden nuevo, e Imágenes se muestra como Fotos', () => {
    expect(PIPELINE_STEPS.map((s) => PIPELINE_STEP_LABEL[s])).toEqual([
      'Información',
      'Título',
      'Compatibilidades',
      'Descripción',
      'Precio',
      'Fotos',
      'Imágenes con texto',
      'Videos',
      'Organización de multimedia',
      'Preguntas y respuestas',
      'Publicación',
    ]);
    expect(nextStep('TITLE')).toBe('COMPATIBILITIES');
    expect(nextStep('IMAGES')).toBe('TEXT_IMAGES');
    expect(nextStep('TEXT_IMAGES')).toBe('VIDEOS');
  });
});

describe('la pieza, sin la base', () => {
  it('la versión se elige sola por la cantidad de ítems', () => {
    expect(pieceVersion(VERSION_A)).toBe('A');
    expect(pieceVersion(VERSION_B)).toBe('B');
    expect(pieceVersion({ compatible: VERSION_A.compatible, no_compatible: [...VERSION_A.no_compatible, motor('Otro')] })).toBe('B');
  });

  it('los motores no llevan marca, y lo vacío se cae', () => {
    const c = cleanPiece({ ...emptyPiece(), compatible: [{ tipo: 'motor', marca: 'fiat', titulo: 'Perkins 4.203', detalle: '' }, vehiculo('', '', '')], dudas: [{ titulo: '', respuesta: '' }] });
    expect(c.compatible).toEqual([{ tipo: 'motor', titulo: 'Perkins 4.203', detalle: '' }]);
    expect(c.dudas).toEqual([]);
    expect(usedBrands(VERSION_B)).toEqual(['fiat']);
    expect(pieceMissing(emptyPiece())).toHaveLength(3);
    expect(pieceMissing(VERSION_A)).toEqual([]);
  });

  it('las marcas se reconocen por clave, nombre o alias, sin tildes ni mayúsculas', () => {
    const brands = [
      { key: 'volkswagen', name: 'Volkswagen', aliases: ['VW', 'Volks'] },
      { key: 'citroen', name: 'Citroën', aliases: [] },
    ];
    expect(brandKeyOf('vw', brands)).toBe('volkswagen');
    expect(brandKeyOf('CITROEN', brands)).toBe('citroen');
    expect(brandKeyOf('Peugeot', brands)).toBeNull();
    expect(newBrandKey('Mercedes-Benz')).toBe('mercedes-benz');
    expect(newBrandKey('Citroën')).toBe('citroen');
    expect(parseAliases('VW, vw , Volks,Volkswagen', 'Volkswagen')).toEqual(['VW', 'Volks']);
    expect(logoType({ name: 'ford.svg', size: 10 })).toEqual({ ok: true, type: 'image/svg+xml' });
    expect(logoType({ name: 'ford.jpg', size: 10 }).ok).toBe(false);
  });
});

// Con el Chromium de la máquina: la misma pieza que exporta el servidor.
const chromium = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));

describe.skipIf(!chromium)('el PNG, con un Chromium de verdad', () => {
  const paint = (content: PieceContent): PiecePaint => ({ content, photoUrl: null, brands: { ford: { nombre: 'Ford', logo: null }, fiat: { nombre: 'Fiat', logo: null } }, preview: false });

  it('arma la versión A con las 4 dudas y la B sin dudas, de 1200 × 1200', async () => {
    const a = await renderPiece(paint(VERSION_A));
    expect(a.fit).toEqual({ version: 'A', doubts: 4, scale: 1, fits: true });
    // El ancho y el alto del PNG están en su encabezado.
    const view = new DataView(a.png.buffer, a.png.byteOffset);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 1200]);
    const b = await renderPiece(paint(VERSION_B));
    expect(b.fit).toMatchObject({ version: 'B', doubts: 0, fits: true });
  }, 60_000);

  it('si no entra, primero quedan 2 dudas, después se achican los ítems y si ni así entra, avisa', async () => {
    const long = (n: number) => Array.from({ length: n }, (_, i) => vehiculo('ford', `Modelo largo número ${i + 1} con texto`, 'Un detalle bastante largo para ocupar lugar'));
    const two = await renderPiece(paint({ ...VERSION_A, compatible: long(3), no_compatible: long(3), dudas: VERSION_A.dudas.map((d) => ({ ...d, respuesta: `${d.respuesta} ${d.respuesta}` })) }));
    expect(two.fit.version).toBe('A');
    expect(two.fit.doubts).toBe(2);
    const shrunk = await renderPiece(paint({ ...VERSION_B, compatible: long(9) }));
    expect(shrunk.fit.fits).toBe(true);
    expect(shrunk.fit.scale).toBeLessThan(1);
    const never = await renderPiece(paint({ ...VERSION_B, compatible: long(30) }));
    expect(never.fit.fits).toBe(false);
  }, 60_000);
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('el paso en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let google: FakeGoogle;
  let accountId = '';
  let productId = '';
  let stdId = '';
  let halfId = '';
  let editId = '';
  let asIsId = '';
  const userId = 'u1';
  const STD = variantKey({ sku: 'SP-1-00', measure: 'STD' })!;
  const HALF = variantKey({ sku: 'SP-1-60', measure: '0.60' })!;
  const renders: PiecePaint[] = [];
  // El servidor de verdad usa Chromium; acá alcanza con anotar lo que le llega.
  const fakeRender: PieceRenderer = async (paint) => {
    renders.push(paint);
    return { png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]), fit: { version: pieceVersion(paint.content), doubts: 4, scale: 1, fits: true } };
  };

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
      'TRUNCATE drive_connections, drive_folders, vehicle_brands, text_images, listing_families, photo_step_runs, photo_edits, channel_copies, publications, stores, channels, products, accounts, users CASCADE',
    );
    google.files.clear();
    renders.length = 0;
    await db.user.create({ data: { id: userId, name: 'Persona de prueba', email: 'persona@prueba.com' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    productId = (
      await db.product.create({
        data: {
          accountId,
          name: 'Subconjunto de prueba SP-1',
          variants: { create: [{ sku: 'SP-1-00', measure: 'STD', position: 0 }, { sku: 'SP-1-60', measure: '0.60', position: 1 }] },
          compatibilities: { create: [{ vehicleBrand: 'Fiat', model: 'Uno', engine: '1.7 diésel', position: 0 }] },
        },
      })
    ).id;
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const store = await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } });
    stdId = (await db.publication.create({ data: { productId, storeId: store.id, externalId: 'MLA1000000001', title: 'Subconjunto STD', variantKey: STD } })).id;
    halfId = (await db.publication.create({ data: { productId, storeId: store.id, externalId: 'MLA1000000002', title: 'Subconjunto 0.60', variantKey: HALF } })).id;
    const family = await db.listingFamily.create({ data: { storeId: store.id, productId, leadId: stdId } });
    await db.publication.updateMany({ where: { id: { in: [stdId, halfId] } }, data: { familyId: family.id } });
    for (const b of [
      { name: 'Fiat', aliases: '' },
      { name: 'Ford', aliases: '' },
      { name: 'Volkswagen', aliases: 'VW, Volks' },
    ])
      await addBrand(db, b);

    // Una foto corregida, con su PNG sin fondo en el Drive, y una que se usa tal cual.
    google.files.set('png-1', { id: 'png-1', name: 'final.png', mimeType: 'image/png', parents: [], trashed: false, appProperties: {}, data: Buffer.from('png'), createdTime: new Date().toISOString() });
    const edit = await db.photoEdit.create({
      data: { productId, source: 'UPLOAD', originalUrl: 'drive:orig-1', originalName: 'frente.jpg', originalType: 'image/jpeg', originalSize: 10, position: 0 },
    });
    await db.photoStepRun.create({ data: { editId: edit.id, step: 0, status: 'APPROVED', settings: {}, jpgUrl: 'drive:jpg-1', pngUrl: 'drive:png-1' } });
    editId = edit.id;
    asIsId = (
      await db.photoEdit.create({
        data: { productId, source: 'UPLOAD', originalUrl: 'drive:orig-2', originalName: 'caja.jpg', originalType: 'image/jpeg', originalSize: 10, position: 1, asIs: true },
      })
    ).id;

    await saveDriveCredentials(db, { clientId: '123-prueba.apps.googleusercontent.com', clientSecret: 'secreto-del-cliente-123' });
    const res = await fetch(await startDriveAuthorization(db, { userId }), { redirect: 'manual' });
    const back = new URL(res.headers.get('location')!);
    await completeDriveAuthorization(db, { state: back.searchParams.get('state')!, code: back.searchParams.get('code')! });
  });

  it('en una familia la pieza es una sola: se guarda en todas las medidas', async () => {
    await saveTextImage(db, { accountId, publicationId: halfId, content: VERSION_A, photoEditId: editId, userId });
    const rows = await db.publicationTextImage.findMany({ where: { publicationId: { in: [stdId, halfId] } } });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.textImageId)).size).toBe(1);
    const step = await loadTextImageStep(db, { accountId, publicationId: stdId });
    expect(step).toMatchObject({ sharedBy: 2, version: 'A', photoEditId: editId, missing: [], png: null });
    expect(step.photos).toEqual([
      expect.objectContaining({ editId, label: 'Corregida 1', transparent: true }),
      expect.objectContaining({ editId: asIsId, label: 'Original 2, sin editar', transparent: false }),
    ]);
    // Se guarda una parte: lo demás queda.
    await saveTextImage(db, { accountId, publicationId: stdId, content: { MOTOR: 'Ford 3.2 Puma' }, userId });
    const after = await loadTextImageStep(db, { accountId, publicationId: halfId });
    expect(after.content).toMatchObject({ MOTOR: 'Ford 3.2 Puma', TIPO_PRODUCTO: 'Subconjunto para motor' });
    expect(after.content.dudas).toHaveLength(4);
  });

  it('no guarda marcas que no están en la base ni fotos de otro lado', async () => {
    await expect(saveTextImage(db, { accountId, publicationId: stdId, content: { compatible: [vehiculo('renault', 'Clio')] }, userId })).rejects.toThrow('renault');
    await expect(saveTextImage(db, { accountId, publicationId: stdId, photoEditId: 'otra-foto', userId })).rejects.toThrow(TextImageError);
  });

  it('el PNG se arma con todo adentro, va al Drive, queda en multimedia de todas las medidas y se desactualiza solo', async () => {
    await saveTextImage(db, { accountId, publicationId: stdId, content: VERSION_B, photoEditId: editId, userId });
    const r = await generateTextImage(db, { accountId, publicationId: stdId, userId, now: new Date('2026-11-04T12:00:00Z') }, fakeRender);
    expect(r.version).toBe('B');
    // La foto y los logos van como data:, para que no dependa de nada de afuera.
    expect(renders[0].photoUrl).toBe(`data:image/png;base64,${Buffer.from('png').toString('base64')}`);
    expect(renders[0].brands).toEqual({ fiat: { nombre: 'Fiat', logo: null } });
    const saved = [...google.files.values()].find((f) => f.mimeType === 'image/png' && f.id !== 'png-1')!;
    expect(saved.name).toContain('imagen con texto');
    expect(google.files.get(saved.parents[0])!.name).toBe('Imágenes con texto');

    let step = await loadTextImageStep(db, { accountId, publicationId: halfId });
    expect(step.png).toMatchObject({ outdated: false });
    const id = step.png!.id;

    // En Organización de multimedia, para elegirla en cualquiera de las medidas.
    for (const pub of [stdId, halfId]) {
      const media = await loadMediaSources(db, accountId, pub);
      expect(media.available.text.map((m) => m.key)).toEqual([`texto:${id}`]);
    }
    expect((await loadFamilyMedia(db, accountId, stdId))!.available.text).toHaveLength(1);
    // Al canal va como archivo, igual que una corregida.
    const pics = await picturesFor(db, productId, [{ kind: 'text', id }]);
    expect(pics.pictures).toEqual([{ kind: 'file', data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]), type: 'image/png', name: 'imagen-con-texto.png' }]);
    expect(photoKey({ kind: 'text', id })).toBe(`texto:${id}`);

    // Cambia el contenido: queda desactualizado. Se vuelve a generar: el anterior va a la papelera.
    await saveTextImage(db, { accountId, publicationId: stdId, content: { MOTOR: 'Fiat 1.7 Diésel' }, userId });
    expect((await loadTextImageStep(db, { accountId, publicationId: stdId })).png!.outdated).toBe(true);
    await generateTextImage(db, { accountId, publicationId: stdId, userId }, fakeRender);
    expect(google.files.get(saved.id)!.trashed).toBe(true);
    step = await loadTextImageStep(db, { accountId, publicationId: stdId });
    expect(step.png!.outdated).toBe(false);
    // Se sube el logo de una marca que usa: también.
    await setBrandLogo(db, { key: 'fiat', name: 'fiat.svg', data: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>') });
    step = await loadTextImageStep(db, { accountId, publicationId: stdId });
    expect(step.png!.outdated).toBe(true);
    expect(step.withoutLogo).toEqual([]);
  });

  it('dos imágenes con texto, cada una con su lugar: le ganan al orden del protocolo, también a las fotos que llegan después', async () => {
    // Las dos medidas ya tienen fotos elegidas: tres corregidas del protocolo, de todas las medidas.
    const protocol = await db.shootProtocol.create({ data: { accountId, name: 'Subconjuntos' } });
    const shots: string[] = [];
    for (let i = 0; i < 4; i++) {
      const step = await db.shootStep.create({ data: { protocolId: protocol.id, title: `Paso ${i + 1}`, position: i, mediaPosition: i } });
      const e = await db.photoEdit.create({
        data: { productId, source: 'UPLOAD', originalUrl: `drive:p${i}`, originalName: `p${i}.jpg`, originalType: 'image/jpeg', originalSize: 10, position: 10 + i, shot: true, shootStepId: step.id },
      });
      await db.photoStepRun.create({ data: { editId: e.id, step: 0, status: 'APPROVED', settings: {}, jpgUrl: `drive:j${i}`, pngUrl: 'drive:png-1' } });
      shots.push(e.id);
    }
    const ref = (id: string) => ({ kind: 'edit' as const, editId: id });
    for (const pub of [stdId, halfId]) await db.publication.update({ where: { id: pub }, data: { media: shots.slice(0, 3).map(ref) } });
    await db.photoEdit.updateMany({ where: { id: { in: shots.slice(0, 3) } }, data: { placedAt: new Date() } });

    // Imagen 1 en el lugar 2 e imagen 2 en el lugar 4; no pueden compartir lugar.
    await saveTextImage(db, { accountId, publicationId: stdId, slot: 1, content: VERSION_B, photoEditId: editId, mediaPlace: 2, userId });
    await saveTextImage(db, { accountId, publicationId: stdId, slot: 2, content: VERSION_A, photoEditId: editId, mediaPlace: 4, userId });
    await expect(saveTextImage(db, { accountId, publicationId: stdId, slot: 2, mediaPlace: 2, userId })).rejects.toThrow('ya va en el lugar 2');
    const step = await loadTextImageStep(db, { accountId, publicationId: halfId, slot: 2 });
    expect(step.pieces).toEqual([
      { slot: 1, mediaPlace: 2, generated: false },
      { slot: 2, mediaPlace: 4, generated: false },
    ]);
    const t1 = (await db.textImage.findFirstOrThrow({ where: { slot: 1 } })).id;
    const t2 = (await db.textImage.findFirstOrThrow({ where: { slot: 2 } })).id;
    await generateTextImage(db, { accountId, publicationId: stdId, slot: 1, userId }, fakeRender);
    await generateTextImage(db, { accountId, publicationId: stdId, slot: 2, userId }, fakeRender);

    const order = async (pub: string) =>
      ((await db.publication.findUniqueOrThrow({ where: { id: pub }, select: { media: true } })).media as { kind: string; editId?: string; id?: string }[]).map((r) =>
        r.kind === 'text' ? (r.id === t1 ? 'T1' : 'T2') : `P${shots.indexOf(r.editId!) + 1}`,
      );
    expect(await order(stdId)).toEqual(['P1', 'T1', 'P2', 'T2', 'P3']);
    expect(await order(halfId)).toEqual(['P1', 'T1', 'P2', 'T2', 'P3']);

    // Llega sola la cuarta foto del protocolo: va al final, sin mover las imágenes con texto.
    await placeShotPhotos(db, productId);
    expect(await order(stdId)).toEqual(['P1', 'T1', 'P2', 'T2', 'P3', 'P4']);

    // Ordenar como el protocolo también las deja en su lugar.
    const media = await loadMediaSources(db, accountId, stdId);
    // Las corregidas que no son del protocolo siguen al final, como siempre.
    expect(media.protocol!.map((m) => m.key).slice(0, 6)).toEqual([`corregida:${shots[0]}`, `texto:${t1}`, `corregida:${shots[1]}`, `texto:${t2}`, `corregida:${shots[2]}`, `corregida:${shots[3]}`]);

    // Cambia el lugar de la imagen 2: se mueve. Sacar la imagen 1 la saca de multimedia.
    await saveTextImage(db, { accountId, publicationId: stdId, slot: 2, mediaPlace: 1, userId });
    expect(await order(stdId)).toEqual(['T2', 'T1', 'P1', 'P2', 'P3', 'P4']);
    await removeTextImage(db, { accountId, publicationId: stdId, slot: 1 });
    expect(await order(halfId)).toEqual(['T2', 'P1', 'P2', 'P3', 'P4']);
  });

  it('la carpeta Imágenes con texto es una sola: pedidos al mismo tiempo no la repiten, y las repetidas se juntan en la más vieja', async () => {
    const copies = () => [...google.files.values()].filter((f) => f.name === 'Imágenes con texto' && !f.trashed);
    // Varias lecturas a la vez, como cuando se abren la publicación, el paso y Claude juntos.
    await Promise.all([1, 2, 3].map(() => syncDriveTextImages(db, { accountId, productId })));
    expect(copies()).toHaveLength(1);
    const keep = copies()[0];

    // Una repetida de antes, más nueva, con una imagen subida a mano adentro.
    const dup = google.addFile({ name: 'Imágenes con texto', parents: keep.parents, mimeType: 'application/vnd.google-apps.folder', appProperties: { mrb: `imagenes-con-texto:${productId}` }, createdTime: new Date(Date.now() + 60_000).toISOString() });
    const lost = google.addFile({ name: 'en-la-repetida.jpg', parents: [dup.id], mimeType: 'image/jpeg', data: Buffer.from('jpg') });
    expect(await mergeTextImageFolders(db, { accountId, dryRun: true })).toMatchObject({ next: null, fixed: [{ productId, copies: 2, moved: 0, trashed: 0 }] });
    expect(google.files.get(dup.id)!.trashed).toBe(false);

    const r = await mergeTextImageFolders(db, { accountId, dryRun: false });
    expect(r.fixed).toEqual([expect.objectContaining({ productId, copies: 2, moved: 1, trashed: 1, leftOver: 0 })]);
    // La imagen pasó a la más vieja, con el mismo id, y la repetida quedó en la papelera.
    expect(google.files.get(lost.id)!.parents).toEqual([keep.id]);
    expect(google.files.get(dup.id)!.trashed).toBe(true);
    expect(copies()).toHaveLength(1);
    // La app ya la ve: aparece en Organización de multimedia.
    const media = await loadMediaSources(db, accountId, stdId);
    expect(media.available.text.map((m) => m.label)).toContain('Imagen con texto del Drive: en-la-repetida.jpg');
    expect((await mergeTextImageFolders(db, { accountId, dryRun: true })).fixed).toEqual([]);
  });

  it('las imágenes subidas a mano a la carpeta del Drive aparecen en Organización de multimedia, y se van si se borran', async () => {
    // La app arma su PNG en la carpeta: ese no se cuenta como subido a mano.
    await saveTextImage(db, { accountId, publicationId: stdId, content: VERSION_B, photoEditId: editId, userId });
    await generateTextImage(db, { accountId, publicationId: stdId, userId }, fakeRender);
    const folder = [...google.files.values()].find((f) => f.name === 'Imágenes con texto')!;
    const manual = google.addFile({ name: 'compatibilidad-a-mano.jpg', parents: [folder.id], mimeType: 'image/jpeg', data: Buffer.from('jpg') });
    google.addFile({ name: 'notas.pdf', parents: [folder.id], mimeType: 'application/pdf', data: Buffer.from('pdf') });

    expect(await syncDriveTextImages(db, { accountId, productId })).toEqual({ added: 1, removed: 0 });
    // Leerla otra vez no la repite.
    expect(await syncDriveTextImages(db, { accountId, productId })).toEqual({ added: 0, removed: 0 });
    for (const pub of [stdId, halfId]) {
      const media = await loadMediaSources(db, accountId, pub);
      expect(media.available.text.map((m) => m.label)).toEqual(['Imagen con texto 1', 'Imagen con texto del Drive: compatibilidad-a-mano.jpg']);
    }
    // No es una pieza del paso.
    expect((await loadTextImageStep(db, { accountId, publicationId: stdId })).pieces).toHaveLength(1);
    // Al canal va como archivo, con su tipo.
    const row = await db.textImage.findFirstOrThrow({ where: { fromDrive: true } });
    const pics = await picturesFor(db, productId, [{ kind: 'text', id: row.id }]);
    expect(pics.pictures[0]).toMatchObject({ kind: 'file', type: 'image/jpeg', name: 'imagen-con-texto.jpg' });

    // Elegida y después borrada del Drive: sale de la lista y de las fotos elegidas.
    await db.publication.update({ where: { id: stdId }, data: { media: [{ kind: 'text', id: row.id }] } });
    manual.trashed = true;
    expect(await syncDriveTextImages(db, { accountId, productId })).toEqual({ added: 0, removed: 1 });
    expect((await db.publication.findUniqueOrThrow({ where: { id: stdId } })).media).toEqual([]);
    expect(await db.textImage.count({ where: { fromDrive: true } })).toBe(0);
  });

  it('no arma el PNG si falta algo o si no entra', async () => {
    await saveTextImage(db, { accountId, publicationId: stdId, content: { ...VERSION_A, MOTOR: '' }, userId });
    await expect(generateTextImage(db, { accountId, publicationId: stdId, userId }, fakeRender)).rejects.toThrow(/^Falta el motor\.$/);
    // Sin foto se arma igual, con ese lugar vacío y sin el aviso de la vista previa.
    await saveTextImage(db, { accountId, publicationId: stdId, content: VERSION_A, photoEditId: null, userId });
    await generateTextImage(db, { accountId, publicationId: stdId, userId }, fakeRender);
    expect(renders.at(-1)).toMatchObject({ photoUrl: null, preview: false });
    await saveTextImage(db, { accountId, publicationId: stdId, content: VERSION_A, photoEditId: editId, userId });
    const tooBig: PieceRenderer = async () => ({ png: new Uint8Array(), fit: { version: 'A', doubts: 2, scale: 0.55, fits: false } });
    await expect(generateTextImage(db, { accountId, publicationId: stdId, userId }, tooBig)).rejects.toThrow('Juntá ítems');
  });

  it('Completar con IA usa la base de marcas, no inventa claves y pide confirmar antes de reemplazar', async () => {
    let got: TextImageInput | null = null;
    const output: TextImageOutput = {
      TIPO_PRODUCTO: 'Subconjunto para motor',
      MOTOR: 'Fiat 1.7 Diésel aspirado',
      SELLO: 'otro',
      compatible: [{ tipo: 'vehiculo', marca: 'Fiat', titulo: 'Uno · Duna', detalle: '1.7 diésel' }],
      no_compatible: [
        { tipo: 'vehiculo', marca: 'peugeot', titulo: '206 1.9', detalle: 'Otro motor' },
        { tipo: 'motor', marca: 'fiat', titulo: 'Motor M 718', detalle: 'Turbo' },
      ],
      TITULO_DUDAS: 'Antes de comprar',
      dudas: Array.from({ length: 5 }, (_, i) => ({ titulo: `Duda ${i + 1}`, respuesta: 'Respuesta' })),
      marcas_faltantes: ['Peugeot'],
    };
    const request = async (input: TextImageInput) => {
      got = input;
      return { output, usage: { model: 'prueba', inputTokens: 1, outputTokens: 1, cacheWriteTokens: 0, cacheReadTokens: 0, costUsd: 0.01 }, model: 'prueba' };
    };
    const r = await completeTextImage(db, { accountId, publicationId: halfId, userId }, request);
    expect(r).toEqual({ ok: true, costUsd: 0.01, missingBrands: ['Peugeot'] });
    expect(got!.brands.map((b) => b.key)).toEqual(['fiat', 'ford', 'volkswagen']);
    expect(got!.info.content.compatibilities).toHaveLength(1);
    const step = await loadTextImageStep(db, { accountId, publicationId: stdId });
    expect(step.content).toMatchObject({
      SELLO: 'COMPATIBLE',
      TITULO_DUDAS: 'Antes de comprar',
      compatible: [vehiculo('fiat', 'Uno · Duna', '1.7 diésel')],
      no_compatible: [{ tipo: 'vehiculo', marca: null, titulo: '206 1.9', detalle: 'Otro motor' }, motor('Motor M 718', 'Turbo')],
    });
    expect(step.content.dudas).toHaveLength(4);
    // Ya hay contenido: sin confirmar no lo pisa.
    const again = await completeTextImage(db, { accountId, publicationId: stdId, userId }, request);
    expect(again).toMatchObject({ ok: false, error: expect.stringContaining('confirmá') });
    expect((await completeTextImage(db, { accountId, publicationId: stdId, userId, replace: true }, request)).ok).toBe(true);
  });

  it('las marcas: sin repetir nombres ni alias, y no se borra una que use alguna pieza', async () => {
    await expect(addBrand(db, { name: 'Volks', aliases: '' })).rejects.toThrow('ya es de la marca Volkswagen');
    await expect(updateBrand(db, 'ford', { name: 'Ford', aliases: 'VW' })).rejects.toThrow(BrandError);
    await updateBrand(db, 'ford', { name: 'Ford', aliases: 'Ford Motor' });
    await saveTextImage(db, { accountId, publicationId: stdId, content: { compatible: [vehiculo('ford', 'Ranger')] }, userId });
    expect((await brandUsage(db)).get('ford')).toBe(1);
    await expect(removeBrand(db, 'ford')).rejects.toThrow('No se puede borrar');
    await removeBrand(db, 'volkswagen');
    await expect(setBrandLogo(db, { key: 'fiat', name: 'fiat.png', data: new TextEncoder().encode('no es un png') })).rejects.toThrow('no es un SVG o un PNG');
  });
});
