import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { faceSummary, faceValues, fingerprint, fingerprintsOf } from '@/domain/channel-sync';
import {
  channelPhotos,
  cleanMedia,
  mediaWarnings,
  parseMedia,
  parseVideoVariants,
  photoKey,
  variantKey,
  variantPhotos,
  withMarks,
  withVariants,
  type PhotoRef,
} from '@/domain/media';
import { createChecks, CreateError, createInChannel, warrantyText } from '@/lib/channel-create';
import { changeStatus, relistInChannel, relistInfo } from '@/lib/channel-status';
import { pushDrafts } from '@/lib/channel-push';
import { runSyncStep, startSync } from '@/lib/channel-sync';
import { encrypt } from '@/lib/crypto';
import { loadMediaSources, measuresOf, MediaError, saveMedia } from '@/lib/media';
import { saveFamilyMedia } from '@/lib/family-media';
import { saveQuestions } from '@/lib/buyer-questions';
import { loadCatalogData, saveCatalogData } from '@/lib/catalog-data';
import { resetVisitsTogether } from '@/channels/mercadolibre/listings';

// Las fotos de cada publicación y crear publicaciones nuevas en el canal,
// contra un Mercado Libre simulado. Las fotos corregidas se leen de un depósito
// simulado. Los datos son de prueba.

vi.mock('@/lib/files', async (original) => ({
  ...(await original<typeof import('@/lib/files')>()),
  readBlob: vi.fn(async () => new Response(new Uint8Array([255, 216, 255, 224]), { headers: { 'content-type': 'image/jpeg' } })),
}));

describe('las fotos elegidas', () => {
  it('sin elegir siguen al canal; se guardan sin repetir y sin tope', () => {
    expect(parseMedia(null)).toBeNull();
    expect(parseMedia([{ kind: 'edit', editId: 'a' }, { kind: 'otra' }])).toEqual([{ kind: 'edit', editId: 'a' }]);
    const many = Array.from({ length: 15 }, (_, i) => ({ kind: 'asset' as const, url: `https://foto/${i}.jpg` }));
    expect(cleanMedia([...many.slice(0, 2), many[0]])).toHaveLength(2);
    expect(cleanMedia(many)).toHaveLength(15);
    expect(photoKey({ kind: 'channel', id: 'P1', url: 'x' })).toBe(photoKey({ kind: 'channel', id: 'P1', url: 'y' }));
  });

  it('cada medida se reconoce por su SKU o, si no tiene, por la medida', () => {
    expect(variantKey({ sku: ' a-50 ', measure: null })).toBe('sku:A-50');
    expect(variantKey({ sku: null, measure: ' 0,50  mm ' })).toBe('medida:0.50');
    expect(variantKey({ sku: '', measure: null })).toBeNull();
    // El mismo código para todas las medidas, como hace Persan: cuenta la medida.
    expect(variantKey({ sku: 'SP-413', measure: '0,50' })).toBe(variantKey({ sku: 'sp-413', measure: '+0.50' }));
    expect(variantKey({ sku: 'SP-413', measure: 'STD' })).not.toBe(variantKey({ sku: 'SP-413', measure: '0,50' }));
    expect(measuresOf([{ sku: 'SP-413', measure: 'STD' }, { sku: 'SP-413', measure: '0,50' }, { sku: 'SP-413', measure: '0.50' }]).map((m) => m.label)).toEqual([
      'STD',
      '0,50',
    ]);
  });

  it('el comprador ve primero las fotos de su medida y después las de todas, en el orden de la lista', () => {
    const refs: PhotoRef[] = [
      { kind: 'asset', url: 'https://f/general.jpg' },
      withVariants({ kind: 'asset', url: 'https://f/caja-050.jpg' }, ['sku:B']),
      withVariants({ kind: 'asset', url: 'https://f/caja-std.jpg' }, ['sku:A']),
      { kind: 'asset', url: 'https://f/detalle.jpg' },
    ];
    const urls = (list: PhotoRef[]) => list.map((r) => (r.kind === 'asset' ? r.url.split('/').pop() : ''));
    expect(urls(variantPhotos(refs, 'sku:B'))).toEqual(['caja-050.jpg', 'general.jpg', 'detalle.jpg']);
    expect(urls(variantPhotos(refs, 'sku:A'))).toEqual(['caja-std.jpg', 'general.jpg', 'detalle.jpg']);
    const measures = [
      { key: 'sku:A', label: 'STD' },
      { key: 'sku:C', label: '0.25' },
    ];
    expect(mediaWarnings([refs[2]], measures)).toEqual(['La medida 0.25 se queda sin fotos.']);
    expect(mediaWarnings(refs, measures)).toEqual([]);
    // Con una sola medida no hay nada que avisar.
    expect(mediaWarnings([refs[2]], measures.slice(0, 1))).toEqual([]);
  });

  it('las marcas se guardan sin repetir y una foto sin marcas es de todas', () => {
    const ref = withVariants({ kind: 'edit', editId: 'e1' }, ['sku:B', 'sku:A', 'sku:B']);
    expect(ref).toEqual({ kind: 'edit', editId: 'e1', variants: ['sku:A', 'sku:B'] });
    expect(withVariants(ref, [])).toEqual({ kind: 'edit', editId: 'e1' });
    expect(cleanMedia([ref, { ...ref, variants: [] }])).toEqual([ref]);
    expect(parseMedia([ref])).toEqual([ref]);
    expect(parseVideoVariants({ v1: ['sku:B', 'sku:A'], v2: [], v3: 'x' })).toEqual({ v1: ['sku:A', 'sku:B'] });
  });

  it('del canal, cada foto queda con las medidas que la tienen; la que está en todas es de todas', () => {
    const variations = [
      { sku: 'A', measure: 'STD', photoIds: ['P1', 'P3'] },
      { sku: null, measure: '0.50', photoIds: ['P2', 'P3'] },
    ];
    expect(channelPhotos(['u1', 'u2', 'u3'], ['P1', 'P2', 'P3'], variations)).toEqual([
      // Y su lugar en cada medida, como lo tiene el canal.
      { kind: 'channel', id: 'P1', url: 'u1', variants: ['sku:A medida:std'], positions: { 'sku:A medida:std': 0 } },
      { kind: 'channel', id: 'P2', url: 'u2', variants: ['medida:0.50'], positions: { 'medida:0.50': 0 } },
      { kind: 'channel', id: 'P3', url: 'u3', positions: { 'sku:A medida:std': 1, 'medida:0.50': 1 } },
    ]);
    // Sin medidas marcadas, la huella es la de siempre; con marcas, cambia.
    const plain = channelPhotos(['u1'], ['P1']);
    expect(fingerprint('photos', plain)).toBe(fingerprint('photos', [{ kind: 'channel', id: 'P1', url: 'otro' }]));
    expect(fingerprint('photos', [withVariants(plain[0], ['sku:A'])])).not.toBe(fingerprint('photos', plain));
  });

  it('cada medida puede tener su propio orden, y cambiarlo es un cambio para subir', () => {
    const a = { kind: 'asset' as const, url: 'https://f/a.jpg' };
    const b = withVariants({ kind: 'asset' as const, url: 'https://f/b.jpg' }, ['sku:B']);
    const c = { kind: 'asset' as const, url: 'https://f/c.jpg' };
    const name = (list: PhotoRef[]) => list.map((r) => (r.kind === 'asset' ? r.url.slice(-5) : ''));
    // Sin orden propio: primero las de la medida y después las de todas.
    expect(name(variantPhotos([a, b, c], 'sku:B'))).toEqual(['b.jpg', 'a.jpg', 'c.jpg']);
    // Con orden propio en la medida B: c, a, b. La medida A sigue con el suyo.
    const ordered: PhotoRef[] = [
      { ...a, positions: { 'sku:B': 1, 'sku:A': 0 } },
      { ...b, positions: { 'sku:B': 2 } },
      { ...c, positions: { 'sku:B': 0, 'sku:A': 1 } },
    ];
    expect(name(variantPhotos(ordered, 'sku:B'))).toEqual(['c.jpg', 'a.jpg', 'b.jpg']);
    expect(name(variantPhotos(ordered, 'sku:A'))).toEqual(['a.jpg', 'c.jpg']);
    // Cambiar el orden de una medida cambia la huella; la misma lista con los mismos lugares, no.
    const swapped: PhotoRef[] = [{ ...ordered[0], positions: { 'sku:B': 0, 'sku:A': 0 } }, ordered[1], { ...ordered[2], positions: { 'sku:B': 1, 'sku:A': 1 } }];
    expect(fingerprint('photos', swapped)).not.toBe(fingerprint('photos', ordered));
    expect(fingerprint('photos', ordered.map((r) => withMarks(r, r)))).toBe(fingerprint('photos', ordered));
    // Con una sola variante en el canal no hay orden propio: compara como siempre.
    expect(channelPhotos(['u1'], ['P1'], [{ sku: 'A', measure: null, photoIds: ['P1'] }])).toEqual([{ kind: 'channel', id: 'P1', url: 'u1' }]);
  });

  it('la garantía, si la ficha la tiene en la forma que pide el canal', () => {
    expect(warrantyText('6 meses')).toBe('6 meses');
    expect(warrantyText('1 mes')).toBe('1 mes');
    expect(warrantyText(' 90 dias ')).toBe('90 días');
    expect(warrantyText('1 año')).toBe('1 año');
    expect(warrantyText('De fábrica')).toBeNull();
    expect(warrantyText(null)).toBeNull();
  });
});

const url = process.env.TEST_DATABASE_URL;

type Variation = {
  id: number;
  seller_custom_field?: string;
  attribute_combinations: { id?: string; name?: string; value_name: string }[];
  picture_ids: string[];
  attributes?: { id: string; value_name: string }[];
  available_quantity?: number;
  price?: number;
};
type Item = {
  title: string;
  price: number;
  pictures: { id: string; secure_url: string }[];
  sold: number;
  category_id: string;
  attributes: object[];
  variations?: Variation[];
  status?: 'active' | 'paused' | 'closed';
  deleted?: boolean;
  quantity?: number;
  // Sin variantes: el SKU de la publicación y el producto de usuario al que pertenece.
  sku?: string;
  userProduct?: string;
};

describe.skipIf(!url)('fotos y publicaciones nuevas en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let server: http.Server;
  const calls: { method: string; path: string; body: unknown }[] = [];
  let items: Record<string, Item> = {};
  let descriptions: Record<string, string> = {};
  let uploads = 0;
  const uploadedFiles: string[] = [];
  // Una cuenta del modelo de familias: cada medida es una publicación aparte.
  let separate = false;
  let created = 0;
  let accountId = '';
  let storeId = '';
  let productId = '';

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    server = http.createServer(async (req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      const json = (status: number, body: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      if (req.headers.authorization !== 'Bearer llave') return json(401, {});
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const multipart = (req.headers['content-type'] ?? '').startsWith('multipart/form-data');
      const body = raw && !multipart ? JSON.parse(raw) : null;
      if (req.method !== 'GET') calls.push({ method: req.method!, path: u.pathname, body: multipart ? 'archivo' : body });

      if (u.pathname === '/pictures/items/upload' && req.method === 'POST') {
        expect(raw).toContain('name="file"');
        uploadedFiles.push(raw);
        uploads++;
        return json(201, { id: `SUBIDA-${uploads}` });
      }
      if (u.pathname === '/users/me') return json(200, { id: 7, tags: separate ? ['normal', 'user_product_seller'] : ['normal'] });
      if (u.pathname === '/items' && req.method === 'POST') {
        const rejectedSku = body.attributes.some((a: { id?: string; value_name?: string }) => a.id === 'SELLER_SKU' && a.value_name === 'RECHAZAR');
        if ((body.title ?? body.family_name).includes('RECHAZAR') || rejectedSku) {
          return json(400, { message: 'Validation error', cause: [{ code: 'item.price.invalid', message: 'El precio es muy bajo' }] });
        }
        // Como Mercado Libre con familias: sin variantes ni título, con nombre de familia.
        const invalid = (code: string, message: string) => json(400, { message: 'Validation error', cause: [{ code, message }] });
        if (separate && !body.family_name) return invalid('item.family_name.missing', 'The body does not contain family_name property');
        if (separate && body.variations) return invalid('item.variations.invalid', 'The field variations is invalid with family name');
        if (separate && body.title) return invalid('item.title.invalid', 'The field title is invalid with family name');
        const id = `MLA${900 + created++}`;
        const pictures = body.pictures.map((p: { id?: string; source?: string }, i: number) => ({ id: p.id ?? `LINK-${i}`, secure_url: p.source ?? `https://ml/${p.id}.jpg` }));
        // Como Mercado Libre: cada medida con su combinación, al mismo precio y con fotos de la lista.
        const refs: string[] = body.pictures.map((p: { id?: string; source?: string }) => p.id ?? p.source);
        const got: Omit<Variation, 'id'>[] = body.variations ?? [];
        if (
          got.some((v) => v.attribute_combinations.length === 0 || v.price !== body.price || v.picture_ids.length === 0 || v.picture_ids.some((r) => !refs.includes(r)))
        ) {
          return json(400, { message: 'Validation error', cause: [{ code: 'item.variations.invalid', message: 'Las variantes no son válidas' }] });
        }
        const variations = got.map((v, i) => ({ ...v, id: 100 + i, picture_ids: v.picture_ids.map((r) => pictures[refs.indexOf(r)].id) }));
        // Con familias, Mercado Libre arma el título con el nombre y la medida.
        const measure = body.attributes.find((a: { name?: string }) => a.name === 'Medida')?.value_name;
        const title = body.title ?? `${body.family_name}${measure ? ` ${measure}` : ''}`;
        items[id] = { title, price: body.price, pictures, sold: 0, category_id: body.category_id, attributes: body.attributes, variations };
        return json(201, {
          id,
          permalink: `https://articulo.mercadolibre.com.ar/${id.replace('MLA', 'MLA-')}`,
          pictures: pictures.map((p: { id: string }) => ({ id: p.id })),
          variations: variations.map((v) => ({ id: v.id, attribute_combinations: v.attribute_combinations, picture_ids: v.picture_ids })),
        });
      }
      const desc = u.pathname.match(/^\/items\/(\w+)\/description$/);
      if (desc && (req.method === 'POST' || req.method === 'PUT')) {
        descriptions[desc[1]] = body.plain_text;
        return json(201, {});
      }
      if (desc) return descriptions[desc[1]] ? json(200, { plain_text: descriptions[desc[1]] }) : json(404, {});
      const item = u.pathname.match(/^\/items\/(\w+)$/);
      if (item && req.method === 'GET' && u.searchParams.get('attributes') === 'variations') {
        const it = items[item[1]];
        return it ? json(200, { id: item[1], variations: it.variations ?? [] }) : json(404, {});
      }
      // Como Mercado Libre: pausar, reactivar, finalizar y eliminar, y republicar una finalizada.
      if (item && req.method === 'PUT' && (body.status || body.deleted)) {
        const it = items[item[1]];
        if (!it) return json(404, {});
        if (body.deleted) {
          if (it.status !== 'closed') return json(400, { message: 'Validation error', cause: [{ code: 'item.deleted.invalid', message: 'Only closed items can be deleted' }] });
          it.deleted = true;
        } else {
          if (body.status === 'active' && it.quantity === 0) {
            return json(400, { message: 'Validation error', cause: [{ code: 'item.available_quantity.invalid', message: 'Item without stock cannot be activated' }] });
          }
          it.status = body.status;
        }
        return json(200, { id: item[1] });
      }
      const relist = u.pathname.match(/^\/items\/(\w+)\/relist$/);
      if (relist && req.method === 'POST') {
        const it = items[relist[1]];
        if (!it || it.status !== 'closed') return json(400, { message: 'Validation error', cause: [{ code: 'item.relist.invalid', message: 'Only closed items can be relisted' }] });
        const id = `MLA${900 + created++}`;
        items[id] = { ...it, price: body.price, status: 'active', deleted: false, quantity: body.quantity };
        return json(201, { id, permalink: `https://articulo.mercadolibre.com.ar/${id.replace('MLA', 'MLA-')}` });
      }
      if (item && req.method === 'PUT' && body.pictures) {
        const it = items[item[1]];
        const sent = body.pictures.map((p: { id?: string; source?: string }) => p.id ?? p.source);
        const known = new Set(sent);
        // Como Mercado Libre: con variantes, van todas, y cada una con fotos de la lista.
        if (it.variations?.length) {
          const got: { id: number; picture_ids: string[] }[] = body.variations ?? [];
          if (got.length !== it.variations.length || got.some((v) => v.picture_ids.length === 0 || v.picture_ids.some((id) => !known.has(id)))) {
            return json(400, { message: 'Validation error', cause: [{ code: 'item.variations.picture_ids.invalid', message: 'Las fotos de las variantes no coinciden' }] });
          }
        }
        it.pictures = body.pictures.map((p: { id?: string; source?: string }, i: number) => ({
          id: p.id ?? `LINK-${i}`,
          secure_url: p.source ?? it.pictures.find((x) => x.id === p.id)?.secure_url ?? `https://ml/${p.id}.jpg`,
        }));
        const idOf = (ref: string) => it.pictures[sent.indexOf(ref)].id;
        for (const v of body.variations ?? []) {
          const mine = it.variations!.find((x) => x.id === v.id)!;
          mine.picture_ids = v.picture_ids.map(idOf);
        }
        return json(200, { id: item[1], pictures: it.pictures.map((p) => ({ id: p.id })) });
      }
      if (u.pathname === '/items/bulk') {
        const wanted = (u.searchParams.get('ids') ?? '').split(',');
        return json(
          200,
          wanted.map((id) => {
            const it = items[id];
            if (!it) return { code: 404, body: {} };
            return {
              code: 200,
              body: {
                id,
                seller_id: 7,
                title: it.title,
                status: it.status ?? 'active',
                sub_status: it.deleted ? ['deleted'] : [],
                price: it.price,
                sold_quantity: it.sold,
                category_id: it.category_id,
                pictures: it.pictures,
                attributes: it.attributes,
                variations: it.variations ?? [],
                ...(it.sku ? { seller_custom_field: it.sku } : {}),
                ...(it.userProduct ? { user_product_id: it.userProduct } : {}),
              },
            };
          }),
        );
      }
      if (u.pathname === '/items/visits') return json(200, (u.searchParams.get('ids') ?? '').split(',').map((id) => ({ item_id: id, total_visits: 1 })));
      if (u.pathname.startsWith('/categories/')) return json(200, { name: 'Otra' });
      return json(404, {});
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    process.env.MERCADOLIBRE_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.close();
    delete process.env.MERCADOLIBRE_API_URL;
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE channel_syncs, channel_copies, channel_sync_changes, channel_applications, channel_connections, photo_step_runs, photo_edits, assets, measurements, publications, product_variants, products, stores, channels, accounts, users CASCADE',
    );
    resetVisitsTogether();
    calls.length = 0;
    uploadedFiles.length = 0;
    uploads = 0;
    separate = false;
    created = 0;
    descriptions = {};
    items = {
      MLA1: {
        title: 'Kit Embrague Ford Ka',
        price: 100,
        sold: 0,
        category_id: 'MLA999',
        attributes: [],
        pictures: [
          { id: 'P1', secure_url: 'https://ml/P1.jpg' },
          { id: 'P2', secure_url: 'https://ml/P2.jpg' },
        ],
      },
    };
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    await db.channelConnection.create({
      data: {
        storeId: store.id,
        appId: '1234567890',
        appSecret: encrypt('secreto-de-prueba'),
        appSecretHint: 'ueba',
        status: 'ACTIVE',
        externalUserId: '7',
        accessToken: encrypt('llave'),
        refreshToken: encrypt('renovar'),
        expiresAt: new Date(Date.now() + 6 * 3600_000),
      },
    });
    const product = await db.product.create({
      data: {
        accountId: account.id,
        name: 'Kit de embrague PD-1',
        productType: 'Kit de embrague',
        brand: 'Sachs',
        partNumber: 'PD-1',
        warranty: '6 meses',
        assets: { create: [{ kind: 'PHOTO', url: 'https://otra/foto.jpg', position: 0 }] },
      },
    });
    accountId = account.id;
    storeId = store.id;
    productId = product.id;
  });

  async function correctedPhoto(name: string) {
    const edit = await db.photoEdit.create({
      data: { productId, source: 'UPLOAD', originalUrl: `https://deposito/${name}`, originalName: name, originalType: 'image/jpeg', originalSize: 10 },
    });
    await db.photoStepRun.create({
      data: { editId: edit.id, step: 0, status: 'APPROVED', settings: {}, jpgUrl: `https://deposito/${name}.jpg`, previewUrl: `https://deposito/${name}-vista.jpg` },
    });
    return edit.id;
  }

  // Otra publicación de la tienda, con los impuestos como los leyó el canal.
  async function taxesInStore(iva = '21 %') {
    const other = await db.publication.create({ data: { productId, storeId, title: 'Otra de la tienda' } });
    await db.channelCopy.create({
      data: { publicationId: other.id, readAt: new Date(), status: 'ACTIVE', attributes: [{ name: 'IVA', value: iva }, { name: 'Impuesto interno', value: '0 %' }] },
    });
  }

  // Las medidas y el peso del paquete de la publicación, que pide el canal.
  const withPackage = (publicationId: string) =>
    saveCatalogData(db, {
      publicationId,
      values: { SELLER_PACKAGE_HEIGHT: '10', SELLER_PACKAGE_WIDTH: '20', SELLER_PACKAGE_LENGTH: '30', SELLER_PACKAGE_WEIGHT: '1500' },
    });

  async function readAll() {
    const run = (await startSync(db, { storeId, trigger: 'MANUAL' }))!;
    await runSyncStep(db, run.id, { budgetMs: 30_000 });
  }

  const state = async (id: string) => {
    const p = await db.publication.findUniqueOrThrow({ where: { id }, include: { channelCopy: true } });
    return faceSummary(fingerprintsOf(faceValues(p)), p.channelCopy);
  };

  it('ordena las fotos, suma una corregida y una del producto, y las sube en ese orden', async () => {
    const pub = await db.publication.create({ data: { productId, storeId, externalId: 'MLA1', title: 'Kit Embrague Ford Ka' } });
    const editId = await correctedPhoto('frente.jpg');
    await readAll();
    // Sin elegir, sigue a las del canal.
    let sources = await loadMediaSources(db, accountId, pub.id);
    expect(sources.following).toBe(true);
    expect(sources.current.map((m) => m.key)).toEqual(['canal:P1', 'canal:P2']);
    expect(sources.available.corrected.map((m) => m.key)).toEqual([`corregida:${editId}`]);
    expect(sources.available.assets.map((m) => m.key)).toEqual(['link:https://otra/foto.jpg']);
    expect(await state(pub.id)).toEqual({ draft: [], choose: [], rejected: [] });

    await saveMedia(db, {
      accountId,
      publicationId: pub.id,
      refs: [{ kind: 'edit', editId }, { kind: 'channel', id: 'P2', url: '' }, { kind: 'asset', url: 'https://otra/foto.jpg' }],
    });
    expect((await state(pub.id)).draft).toEqual(['photos']);

    const result = await pushDrafts(db, { accountId, publicationId: pub.id, userId: null });
    expect(result).toEqual({ sent: ['photos'], rejected: [], confirmed: true });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /pictures/items/upload', 'PUT /items/MLA1']);
    expect(calls[1].body).toEqual({ pictures: [{ id: 'SUBIDA-1' }, { id: 'P2' }, { source: 'https://otra/foto.jpg' }] });
    // Después de subir, vuelve a seguir a las del canal, que ya son esas.
    const after = await db.publication.findUniqueOrThrow({ where: { id: pub.id }, include: { channelCopy: true } });
    expect(after.media).toBeNull();
    expect(after.channelCopy?.photoIds).toEqual(['SUBIDA-1', 'P2', 'LINK-2']);
    expect(after.channelCopy?.photoOrigins).toEqual({ 'SUBIDA-1': editId });
    expect(await state(pub.id)).toEqual({ draft: [], choose: [], rejected: [] });
    sources = await loadMediaSources(db, accountId, pub.id);
    expect(sources.available.corrected[0].note).toBe('Ya está en Mercado Libre');
    expect(sources.current[0].note).toBe('Es la corregida 1');
  });

  it('traída del canal: lo que se cambió en la app antes de la primera lectura queda para subir, no para elegir', async () => {
    const run = await db.importRun.create({
      data: { accountId, storeId, origin: 'CHANNEL_API', fileName: 'Mercado Libre', sheetName: 'Mercado Libre', dataDate: new Date(), rowsTotal: 1 },
    });
    const traida = await db.publication.create({ data: { productId, storeId, externalId: 'MLA1', title: 'Otro título', importRunId: run.id } });
    const deArchivo = await db.publication.create({ data: { productId, storeId, externalId: 'MLA9', title: 'Otro título' } });
    items.MLA9 = { ...items.MLA1 };
    for (const id of [traida.id, deArchivo.id]) await db.publication.update({ where: { id }, data: { media: [{ kind: 'channel', id: 'P2', url: '' }] } });
    await readAll();
    expect(await state(traida.id)).toEqual({ draft: ['title', 'photos'], choose: [], rejected: [] });
    // De una planilla no se sabe cuál es más nuevo: hay que elegir.
    expect((await state(deArchivo.id)).choose).toEqual(['title', 'photos']);
  });

  it('si las fotos cambian en el canal y la app no las tocó, las sigue; si las tocó, hay que elegir', async () => {
    const pub = await db.publication.create({ data: { productId, storeId, externalId: 'MLA1', title: 'Kit Embrague Ford Ka' } });
    await readAll();
    await saveMedia(db, { accountId, publicationId: pub.id, refs: [{ kind: 'channel', id: 'P2', url: '' }] });
    items.MLA1.pictures = [{ id: 'P3', secure_url: 'https://ml/P3.jpg' }];
    await db.channelSync.updateMany({ data: { startedAt: new Date(Date.now() - 3 * 3600_000) } });
    await readAll();
    expect((await state(pub.id)).choose).toEqual(['photos']);
  });

  describe('con medidas', () => {
    beforeEach(async () => {
      items.MLA2 = {
        title: 'Aros Ford Sigma',
        price: 100,
        sold: 0,
        category_id: 'MLA999',
        attributes: [],
        pictures: [
          { id: 'P1', secure_url: 'https://ml/P1.jpg' },
          { id: 'P2', secure_url: 'https://ml/P2.jpg' },
          { id: 'P3', secure_url: 'https://ml/P3.jpg' },
        ],
        variations: [
          { id: 11, seller_custom_field: 'A-00', attribute_combinations: [], picture_ids: ['P1', 'P3'] },
          { id: 12, seller_custom_field: 'A-50', attribute_combinations: [{ id: 'SIZE', value_name: '0.50' }], picture_ids: ['P2', 'P3'] },
        ],
      };
      await db.productVariant.createMany({
        data: [
          { productId, sku: 'A-00', measure: null, position: 0 },
          { productId, sku: 'A-50', measure: '0.50', position: 1 },
        ],
      });
    });

    it('una publicación que vende una sola medida muestra solo esa, sube sus fotos sin repartir y avisa cuáles las comparten', async () => {
      const sola = (sku: string, userProduct: string): Item => ({
        title: 'Aros Ford Sigma',
        price: 100,
        sold: 0,
        category_id: 'MLA999',
        attributes: [],
        pictures: [
          { id: 'P1', secure_url: 'https://ml/P1.jpg' },
          { id: 'P2', secure_url: 'https://ml/P2.jpg' },
        ],
        sku,
        userProduct,
      });
      items.MLA3 = sola('A-00', 'UP-00');
      items.MLA4 = sola('A-00', 'UP-00');
      items.MLA5 = sola('A-50', 'UP-50');
      const std = await db.publication.create({ data: { productId, storeId, externalId: 'MLA3', title: 'Aros Ford Sigma' } });
      await db.publication.create({ data: { productId, storeId, externalId: 'MLA4', title: 'Aros Ford Sigma' } });
      await db.publication.create({ data: { productId, storeId, externalId: 'MLA5', title: 'Aros Ford Sigma' } });
      await readAll();

      let sources = await loadMediaSources(db, accountId, std.id);
      expect(sources.measures).toEqual([]);
      expect(sources.soleMeasure).toEqual({ label: 'A-00', sku: 'A-00' });
      expect(sources.sharedWith).toEqual(['MLA4']);
      // Si de la otra todavía no se sabe su producto en el canal, cuenta por vender la misma medida.
      const mla4 = await db.publication.findFirstOrThrow({ where: { externalId: 'MLA4' }, include: { channelCopy: true } });
      const known = mla4.channelCopy!.details as Record<string, unknown>;
      await db.channelCopy.update({ where: { publicationId: mla4.id }, data: { details: { ...known, channelProductId: null } as object } });
      expect((await loadMediaSources(db, accountId, std.id)).sharedWith).toEqual(['MLA4']);
      await db.channelCopy.update({ where: { publicationId: mla4.id }, data: { details: { ...known, channelProductId: 'OTRO' } as object } });
      expect((await loadMediaSources(db, accountId, std.id)).sharedWith).toEqual([]);
      await db.channelCopy.update({ where: { publicationId: mla4.id }, data: { details: known as object } });
      expect(sources.channelWithoutVariants).toBe(false);

      // Lo que se guardó cuando se repartía por medida: van las de su medida, en su orden.
      const std00 = 'sku:A-00';
      const half = 'sku:A-50 medida:0.50';
      await db.publication.update({
        where: { id: std.id },
        data: {
          media: [
            { kind: 'channel', id: 'P1', url: '', variants: [half], positions: { [half]: 0 } },
            { kind: 'channel', id: 'P2', url: '', positions: { [std00]: 1, [half]: 1 } },
            { kind: 'asset', url: 'https://otra/foto.jpg', variants: [std00], positions: { [std00]: 0 } },
          ],
        },
      });
      sources = await loadMediaSources(db, accountId, std.id);
      expect(sources.current.map((m) => m.ref)).toEqual([
        { kind: 'asset', url: 'https://otra/foto.jpg' },
        { kind: 'channel', id: 'P2', url: 'https://ml/P2.jpg' },
      ]);
      expect((await state(std.id)).draft).toEqual(['photos']);

      // En el canal, las que comparten el producto cambian junto con esta.
      items.MLA4.pictures = [{ id: 'P2', secure_url: 'https://ml/P2.jpg' }];
      calls.length = 0;
      expect(await pushDrafts(db, { accountId, publicationId: std.id, userId: null })).toEqual({ sent: ['photos'], rejected: [], confirmed: true });
      const sibling = await db.publication.findFirstOrThrow({ where: { externalId: 'MLA4' }, include: { channelCopy: true } });
      expect(sibling.channelCopy?.photos).toEqual(['https://ml/P2.jpg']);
      // Todas a la publicación, sin variantes.
      expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['PUT /items/MLA3']);
      expect(calls[0].body).toEqual({ pictures: [{ source: 'https://otra/foto.jpg' }, { id: 'P2' }] });
      expect(await state(std.id)).toEqual({ draft: [], choose: [], rejected: [] });
      // Guardar con una sola medida guarda sin marcas.
      await saveMedia(db, { accountId, publicationId: std.id, refs: [{ kind: 'channel', id: 'P2', url: '', variants: [half] }] });
      expect((await db.publication.findUniqueOrThrow({ where: { id: std.id } })).media).toEqual([{ kind: 'channel', id: 'P2', url: 'https://ml/P2.jpg' }]);
    });

    it('lee las fotos de cada medida, guarda las que se marcan a mano y las sube con cada medida', async () => {
      const pub = await db.publication.create({ data: { productId, storeId, externalId: 'MLA2', title: 'Aros Ford Sigma' } });
      await readAll();
      let sources = await loadMediaSources(db, accountId, pub.id);
      expect(sources.measures.map((m) => m.label)).toEqual(['A-00', '0.50']);
      expect(sources.current.map((m) => m.ref)).toEqual([
        { kind: 'channel', id: 'P1', url: 'https://ml/P1.jpg', variants: ['sku:A-00'], positions: { 'sku:A-00': 0 } },
        { kind: 'channel', id: 'P2', url: 'https://ml/P2.jpg', variants: ['sku:A-50 medida:0.50'], positions: { 'sku:A-50 medida:0.50': 0 } },
        { kind: 'channel', id: 'P3', url: 'https://ml/P3.jpg', positions: { 'sku:A-00': 1, 'sku:A-50 medida:0.50': 1 } },
      ]);
      expect(sources.channelWithoutVariants).toBe(false);
      expect(await state(pub.id)).toEqual({ draft: [], choose: [], rejected: [] });

      // Solo cambia la medida de una foto: es un cambio para subir.
      await saveMedia(db, {
        accountId,
        publicationId: pub.id,
        refs: [
          { kind: 'channel', id: 'P1', url: '', variants: ['sku:A-50 medida:0.50'] },
          { kind: 'channel', id: 'P2', url: '', variants: ['sku:A-50 medida:0.50'] },
          { kind: 'channel', id: 'P3', url: '' },
        ],
      });
      expect((await state(pub.id)).draft).toEqual(['photos']);

      const result = await pushDrafts(db, { accountId, publicationId: pub.id, userId: null });
      expect(result).toEqual({ sent: ['photos'], rejected: [], confirmed: true });
      expect(calls[0].body).toEqual({
        pictures: [{ id: 'P1' }, { id: 'P2' }, { id: 'P3' }],
        variations: [
          { id: 11, picture_ids: ['P3'] },
          { id: 12, picture_ids: ['P1', 'P2', 'P3'] },
        ],
      });
      expect(await state(pub.id)).toEqual({ draft: [], choose: [], rejected: [] });
      sources = await loadMediaSources(db, accountId, pub.id);
      expect(sources.following).toBe(true);
      expect(sources.current.map((m) => m.ref.variants ?? [])).toEqual([['sku:A-50 medida:0.50'], ['sku:A-50 medida:0.50'], []]);
    });

    it('cada medida sube con su propio orden', async () => {
      const pub = await db.publication.create({ data: { productId, storeId, externalId: 'MLA2', title: 'Aros Ford Sigma' } });
      await readAll();
      const std = 'sku:A-00';
      const half = 'sku:A-50 medida:0.50';
      // P3 es de todas: en la 0.50 va primera, en la A-00 va segunda.
      await saveMedia(db, {
        accountId,
        publicationId: pub.id,
        refs: [
          { kind: 'channel', id: 'P1', url: '', variants: [std], positions: { [std]: 0 } },
          { kind: 'channel', id: 'P3', url: '', positions: { [std]: 1, [half]: 0 } },
          { kind: 'channel', id: 'P2', url: '', variants: [half], positions: { [half]: 1 } },
        ],
      });
      expect((await state(pub.id)).draft).toEqual(['photos']);
      await pushDrafts(db, { accountId, publicationId: pub.id, userId: null });
      expect(calls[0].body).toEqual({
        pictures: [{ id: 'P1' }, { id: 'P3' }, { id: 'P2' }],
        variations: [
          { id: 11, picture_ids: ['P1', 'P3'] },
          { id: 12, picture_ids: ['P3', 'P2'] },
        ],
      });
      // Al volver a leer, el canal tiene lo mismo: no queda nada para subir.
      await db.channelSync.updateMany({ data: { startedAt: new Date(Date.now() - 3 * 3600_000) } });
      await readAll();
      expect(await state(pub.id)).toEqual({ draft: [], choose: [], rejected: [] });
      const sources = await loadMediaSources(db, accountId, pub.id);
      expect(sources.current.map((m) => m.key)).toEqual(['canal:P1', 'canal:P3', 'canal:P2']);
    });

    it('con el mismo SKU en todas las medidas, las distingue por la medida', async () => {
      await db.productVariant.deleteMany({ where: { productId } });
      await db.productVariant.createMany({
        data: [
          { productId, sku: 'SP-413', measure: 'STD', position: 0 },
          { productId, sku: 'SP-413', measure: '0,50', position: 1 },
        ],
      });
      items.MLA2.variations = [
        { id: 21, seller_custom_field: 'SP-413', attribute_combinations: [{ id: 'SIZE', value_name: 'STD' }], picture_ids: ['P1', 'P3'] },
        { id: 22, seller_custom_field: 'SP-413', attribute_combinations: [{ id: 'SIZE', value_name: '0.50' }], picture_ids: ['P2', 'P3'] },
      ];
      const pub = await db.publication.create({ data: { productId, storeId, externalId: 'MLA2', title: 'Aros Ford Sigma' } });
      await readAll();
      const sources = await loadMediaSources(db, accountId, pub.id);
      expect(sources.measures.map((m) => m.label)).toEqual(['STD', '0,50']);
      // Lo que lee del canal, con "0.50", es la medida "0,50" de la ficha.
      expect(sources.current.map((m) => m.ref.variants ?? [])).toEqual([['sku:SP-413 medida:std'], ['sku:SP-413 medida:0.50'], []]);
      expect(await state(pub.id)).toEqual({ draft: [], choose: [], rejected: [] });

      await saveMedia(db, {
        accountId,
        publicationId: pub.id,
        refs: [
          { kind: 'channel', id: 'P2', url: '', variants: ['sku:SP-413 medida:0.50'] },
          { kind: 'channel', id: 'P1', url: '', variants: ['sku:SP-413 medida:std'] },
          { kind: 'channel', id: 'P3', url: '' },
        ],
      });
      await pushDrafts(db, { accountId, publicationId: pub.id, userId: null });
      expect((calls[0].body as { variations: unknown }).variations).toEqual([
        { id: 21, picture_ids: ['P1', 'P3'] },
        { id: 22, picture_ids: ['P2', 'P3'] },
      ]);
    });

    it('no hay tope de fotos, ni en total ni por medida', async () => {
      await db.asset.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ productId, kind: 'PHOTO' as const, url: `https://otra/${i}.jpg`, position: i + 1 })) });
      const pub = await db.publication.create({ data: { productId, storeId, externalId: 'MLA2', title: 'Aros Ford Sigma' } });
      await readAll();
      const refs = Array.from({ length: 30 }, (_, i) => ({ kind: 'asset' as const, url: `https://otra/${i}.jpg`, ...(i < 20 ? { variants: ['sku:A-00'] } : {}) }));
      await saveMedia(db, { accountId, publicationId: pub.id, refs });
      expect(parseMedia((await db.publication.findUniqueOrThrow({ where: { id: pub.id } })).media)).toHaveLength(30);
    });

    it('una variante del canal que la ficha no tiene lleva las fotos de todas, y sin variantes van solo las fotos', async () => {
      items.MLA2.variations!.push({ id: 13, seller_custom_field: 'OTRA', attribute_combinations: [], picture_ids: ['P1'] });
      const pub = await db.publication.create({ data: { productId, storeId, externalId: 'MLA2', title: 'Aros Ford Sigma' } });
      await readAll();
      await saveMedia(db, {
        accountId,
        publicationId: pub.id,
        refs: [
          { kind: 'channel', id: 'P2', url: '', variants: ['sku:A-50 medida:0.50'] },
          { kind: 'channel', id: 'P3', url: '' },
        ],
      });
      await pushDrafts(db, { accountId, publicationId: pub.id, userId: null });
      expect((calls[0].body as { variations: unknown }).variations).toEqual([
        { id: 11, picture_ids: ['P3'] },
        { id: 12, picture_ids: ['P2', 'P3'] },
        { id: 13, picture_ids: ['P3'] },
      ]);

      // La publicación sin variantes en el canal: se avisa y se mandan solo las fotos.
      const plain = await db.publication.create({ data: { productId, storeId, externalId: 'MLA1', title: 'Kit Embrague Ford Ka' } });
      await readAll();
      expect((await loadMediaSources(db, accountId, plain.id)).channelWithoutVariants).toBe(true);
      calls.length = 0;
      await saveMedia(db, { accountId, publicationId: plain.id, refs: [{ kind: 'channel', id: 'P2', url: '', variants: ['sku:A-50 medida:0.50'] }] });
      await pushDrafts(db, { accountId, publicationId: plain.id, userId: null });
      expect(calls[0].body).toEqual({ pictures: [{ id: 'P2' }] });
    });

    it('descarta marcas de medidas que no están en la ficha, marcar todas es Todas, y guarda las medidas de los videos', async () => {
      const pub = await db.publication.create({ data: { productId, storeId, externalId: 'MLA2', title: 'Aros Ford Sigma' } });
      await readAll();
      const video = await db.productVideo.create({ data: { productId, driveFileId: 'drive-1', name: 'giro.mp4', mimeType: 'video/mp4', origin: 'APP' } });
      await db.publicationClip.create({ data: { publicationId: pub.id, videoId: video.id } });
      await saveMedia(db, {
        accountId,
        publicationId: pub.id,
        refs: [
          { kind: 'channel', id: 'P1', url: '', variants: ['sku:A-00', 'sku:A-50 medida:0.50'] },
          { kind: 'channel', id: 'P2', url: '', variants: ['sku:NO-ESTA'] },
        ],
        videos: { [video.id]: ['sku:A-50 medida:0.50', 'sku:NO-ESTA'], 'de-otro': ['sku:A-50 medida:0.50'] },
      });
      const saved = await db.publication.findUniqueOrThrow({ where: { id: pub.id } });
      expect(saved.media).toEqual([
        { kind: 'channel', id: 'P1', url: 'https://ml/P1.jpg' },
        { kind: 'channel', id: 'P2', url: 'https://ml/P2.jpg' },
      ]);
      expect(saved.videoVariants).toEqual({ [video.id]: ['sku:A-50 medida:0.50'] });
      const sources = await loadMediaSources(db, accountId, pub.id);
      expect(sources.videos).toEqual([
        {
          id: video.id,
          name: 'giro.mp4',
          durationMs: null,
          width: null,
          height: null,
          size: null,
          measuredByBrowser: false,
          // Sin medir todavía: no se sabe si sirve como clip hasta verlo.
          check: { pending: true, problems: [], notes: [] },
          variants: ['sku:A-50 medida:0.50'],
        },
      ]);
      expect(sources.clip).toEqual({ name: 'clip', perVariant: false });
      expect(sources.clipIds).toEqual([video.id]);

      // Sin mandar las fotos, quedan como están.
      await saveMedia(db, { accountId, publicationId: pub.id, videos: {} });
      const again = await db.publication.findUniqueOrThrow({ where: { id: pub.id } });
      expect(again.media).toEqual(saved.media);
      expect(again.videoVariants).toEqual({});

      // Si la medida sale de la ficha, su marca se cae y la foto queda en Todas.
      await db.productVariant.deleteMany({ where: { productId, sku: 'A-00' } });
      await db.productVariant.create({ data: { productId, sku: 'A-25', measure: '0.25', position: 2 } });
      await saveMedia(db, { accountId, publicationId: pub.id, refs: [{ kind: 'channel', id: 'P1', url: '', variants: ['sku:A-25 medida:0.25'] }] });
      await db.productVariant.deleteMany({ where: { productId, sku: 'A-25' } });
      await db.productVariant.create({ data: { productId, sku: 'A-75', measure: '0.75', position: 3 } });
      const gone = (await loadMediaSources(db, accountId, pub.id)).current[0];
      expect(gone.ref.variants).toBeUndefined();
      expect(gone.note).toBe('Su medida ya no está en la ficha: quedó en Todas');
    });
  });

  it('el original que se usa tal cual se elige como las corregidas y va al canal sin cambios', async () => {
    const pub = await db.publication.create({ data: { productId, storeId, externalId: 'MLA1', title: 'Kit Embrague Ford Ka' } });
    const asIs = (name: string, type: string, size: number) =>
      db.photoEdit.create({
        data: { productId, source: 'UPLOAD', originalUrl: `https://deposito/${name}`, originalName: name, originalType: type, originalSize: size, asIs: true },
      });
    const ready = await asIs('editada en la Mac.jpg', 'image/jpeg', 4);
    const heic = await asIs('del iPhone.heic', 'image/heic', 4);
    const heavy = await asIs('enorme.png', 'image/png', 11 * 1024 * 1024);
    const editId = await correctedPhoto('frente.jpg');
    await readAll();

    const sources = await loadMediaSources(db, accountId, pub.id);
    expect(sources.available.corrected.map((m) => [m.label, m.blocked ?? null])).toEqual([
      ['Original 1, sin editar', null],
      ['Original 2, sin editar', 'Mercado Libre solo acepta fotos JPG o PNG: exportala así desde la Mac para usarla tal cual.'],
      ['Original 3, sin editar', 'Mercado Libre acepta fotos de hasta 10 MB y esta pesa 11,0 MB.'],
      ['Corregida 4', null],
    ]);
    expect(sources.available.corrected[0].thumb).toBe(`/api/imagenes/ver?tipo=original&foto=${ready.id}`);
    for (const blocked of [heic, heavy]) {
      await expect(saveMedia(db, { accountId, publicationId: pub.id, refs: [{ kind: 'edit', editId: blocked.id }] })).rejects.toThrow(MediaError);
    }

    await saveMedia(db, { accountId, publicationId: pub.id, refs: [{ kind: 'edit', editId: ready.id }, { kind: 'edit', editId }] });
    const result = await pushDrafts(db, { accountId, publicationId: pub.id, userId: null });
    expect(result).toEqual({ sent: ['photos'], rejected: [], confirmed: true });
    // El original va con su nombre y su tipo, y los mismos bytes que se guardaron.
    expect(uploadedFiles[0]).toContain('filename="editada en la Mac.jpg"');
    expect(uploadedFiles[0]).toContain('Content-Type: image/jpeg');
    expect(uploadedFiles[1]).toContain('filename="frente.jpg"');
    const after = await db.channelCopy.findUniqueOrThrow({ where: { publicationId: pub.id } });
    expect(after.photoOrigins).toEqual({ 'SUBIDA-1': ready.id, 'SUBIDA-2': editId });
    expect((await loadMediaSources(db, accountId, pub.id)).current[0].note).toBe('Es el original 1, sin editar');
  });

  it('no deja guardar fotos que la publicación no puede usar, ni una lista vacía', async () => {
    const pub = await db.publication.create({ data: { productId, storeId, externalId: 'MLA1', title: 'Kit' } });
    await readAll();
    await expect(saveMedia(db, { accountId, publicationId: pub.id, refs: [{ kind: 'asset', url: 'https://de-otro/foto.jpg' }] })).rejects.toThrow(MediaError);
    await expect(saveMedia(db, { accountId, publicationId: pub.id, refs: [] })).rejects.toThrow('al menos una foto');
  });

  it('dice qué falta para crear una publicación nueva', async () => {
    const pub = await db.publication.create({ data: { productId, storeId, title: 'Kit Embrague Ford Ka 1.6', channelStatus: 'UNPUBLISHED' } });
    let info = await createChecks(db, { accountId, publicationId: pub.id });
    expect(info.blocked).toBeNull();
    expect(info.ready).toBe(false);
    expect(info.checks.find((c) => c.label === 'Fotos')).toMatchObject({ ok: false, blocking: true });
    expect(info.checks.find((c) => c.label === 'Categoría')).toMatchObject({ ok: true, detail: 'Kits de Embrague' });
    expect(info.checks.find((c) => c.label === 'Descripción')).toMatchObject({ ok: false, blocking: false });
    expect(info.checks.find((c) => c.label === 'Datos obligatorios')).toMatchObject({
      ok: false,
      detail: 'Faltan Altura del paquete del seller, Ancho del paquete del seller, Largo del paquete del seller, Peso del paquete del seller, IVA y Impuesto interno.',
    });
    await withPackage(pub.id);
    await saveMedia(db, { accountId, publicationId: pub.id, refs: [{ kind: 'asset', url: 'https://otra/foto.jpg' }] });
    info = await createChecks(db, { accountId, publicationId: pub.id });
    // Los impuestos: sin cargar y sin otras publicaciones en la tienda, faltan.
    expect(info.ready).toBe(false);
    expect(info.checks.find((c) => c.label === 'Datos obligatorios')).toMatchObject({ ok: false, detail: 'Faltan IVA y Impuesto interno.' });
    // Van los que tiene la mayoría de las publicaciones de la tienda.
    await taxesInStore();
    await taxesInStore();
    await taxesInStore('10.5 %');
    info = await createChecks(db, { accountId, publicationId: pub.id });
    expect(info.ready).toBe(true);
    expect(info.checks.find((c) => c.label === 'Datos obligatorios')).toMatchObject({
      ok: true,
      detail: 'Están todos. IVA 21 % y Impuesto interno 0 % van como en la mayoría de las publicaciones de la tienda; se cambian en Datos de catálogo.',
    });
    expect((await loadCatalogData(db, pub.id))!.fromStore).toEqual({
      VALUE_ADDED_TAX: { value: '21 %', count: 2, total: 3 },
      IMPORT_DUTY: { value: '0 %', count: 3, total: 3 },
    });
    // Lo cargado en la publicación manda.
    await saveCatalogData(db, { publicationId: pub.id, values: { VALUE_ADDED_TAX: '10.5 %' } });
    expect((await loadCatalogData(db, pub.id))!.fromStore).toEqual({ IMPORT_DUTY: { value: '0 %', count: 3, total: 3 } });
    expect(info.listingTypes.map((t) => t.value)).toEqual(['clasica', 'premium']);

    expect(info.measures).toEqual([]);

    // Con varias medidas, cada una necesita su medida cargada, sin repetir, y sus fotos.
    const measuresCheck = async () => (await createChecks(db, { accountId, publicationId: pub.id })).checks.find((c) => c.label === 'Medidas');
    await db.productVariant.createMany({ data: [{ productId, sku: 'A', measure: 'STD', position: 0 }, { productId, sku: 'B', measure: null, position: 1 }] });
    expect(await measuresCheck()).toMatchObject({ ok: false, detail: 'Cargá en la ficha la medida de B, es lo que elige el comprador.' });
    await db.productVariant.updateMany({ where: { productId, sku: 'B' }, data: { measure: 'std' } });
    expect(await measuresCheck()).toMatchObject({ ok: false, detail: 'std está más de una vez en la ficha.' });
    await db.productVariant.updateMany({ where: { productId, sku: 'B' }, data: { measure: '0,50' } });
    await saveMedia(db, { accountId, publicationId: pub.id, refs: [{ kind: 'asset', url: 'https://otra/foto.jpg', variants: ['sku:A medida:std'] }] });
    expect(await measuresCheck()).toMatchObject({ ok: true });
    info = await createChecks(db, { accountId, publicationId: pub.id });
    expect(info.checks.find((c) => c.label === 'Fotos')).toMatchObject({ ok: false, detail: 'La medida 0,50 no tiene fotos, elegilas en Organización de multimedia.' });
    await expect(createInChannel(db, { accountId, publicationId: pub.id, price: 100, quantity: 1, listingType: 'clasica', userId: null })).rejects.toThrow(
      'Fotos',
    );

    await saveMedia(db, { accountId, publicationId: pub.id, refs: [{ kind: 'asset', url: 'https://otra/foto.jpg' }] });
    info = await createChecks(db, { accountId, publicationId: pub.id });
    expect(info.ready).toBe(true);
    expect(info.checks.find((c) => c.label === 'Medidas')).toMatchObject({
      ok: true,
      detail: 'STD y 0,50, una publicación por medida, en la misma familia. Cada una lleva su SKU, su cantidad y sus fotos.',
    });
    expect(info.checks.find((c) => c.label === 'Fotos')).toMatchObject({ ok: true, detail: 'STD con 1 foto y 0,50 con 1 foto.' });
    expect(info.measures).toEqual([
      { key: 'sku:A medida:std', label: 'STD', price: null },
      { key: 'sku:B medida:0.50', label: '0,50', price: null },
    ]);
    // La cantidad se carga en cada medida.
    await expect(
      createInChannel(db, { accountId, publicationId: pub.id, price: 100, quantities: { 'sku:A medida:std': 2 }, listingType: 'clasica', userId: null }),
    ).rejects.toThrow('La cantidad de 0,50 tiene que ser 1 o más.');
    expect(calls.some((c) => c.path === '/items')).toBe(false);
    // Ver lo que falta no arma la familia: se arma al crear.
    expect(await db.listingFamily.count()).toBe(0);
    expect((await db.publication.findUniqueOrThrow({ where: { id: pub.id } })).familyId).toBeNull();
  });

  it('con varias medidas crea una publicación por medida, en su familia, cada una con su SKU, su cantidad y sus fotos', async () => {
    // El mismo SKU en las dos medidas, como en algunas fábricas.
    await db.productVariant.createMany({
      data: [
        { productId, sku: 'SP-413', measure: 'STD', position: 0 },
        { productId, sku: 'SP-413', measure: '0,50', position: 1 },
      ],
    });
    const std = 'sku:SP-413 medida:std';
    const half = 'sku:SP-413 medida:0.50';
    await taxesInStore();
    const pub = await db.publication.create({ data: { productId, storeId, title: 'Subconjunto Peugeot 1.6 SP-413', channelStatus: 'UNPUBLISHED' } });
    await withPackage(pub.id);
    const general = await correctedPhoto('general.jpg');
    const box = await correctedPhoto('caja-050.jpg');
    // La general es de todas; la del producto, de STD; la de la caja, de 0,50.
    await saveMedia(db, {
      accountId,
      publicationId: pub.id,
      refs: [
        { kind: 'edit', editId: general },
        { kind: 'asset', url: 'https://otra/foto.jpg', variants: [std] },
        { kind: 'edit', editId: box, variants: [half] },
      ],
    });

    const created = await createInChannel(db, {
      accountId,
      publicationId: pub.id,
      price: 80000,
      quantities: { [std]: 2, [half]: 5 },
      listingType: 'clasica',
      userId: null,
    });
    expect(created).toMatchObject({
      externalId: 'MLA900',
      confirmed: true,
      warnings: [],
      created: [
        { label: 'STD', externalId: 'MLA900' },
        { label: '0,50', externalId: 'MLA901' },
      ],
    });
    const posts = calls.filter((c) => c.path === '/items').map((c) => c.body as Record<string, unknown>);
    expect(posts).toHaveLength(2);
    for (const post of posts) {
      expect(post).toMatchObject({ title: 'Subconjunto Peugeot 1.6 SP-413', price: 80000 });
      expect(post.variations).toBeUndefined();
    }
    expect(posts.map((p) => p.available_quantity)).toEqual([2, 5]);
    // Cada medida ve primero las suyas; la general se sube una sola vez y la otra usa su código.
    expect(posts[0].pictures).toEqual([{ source: 'https://otra/foto.jpg' }, { id: 'SUBIDA-1' }]);
    expect(posts[1].pictures).toEqual([{ id: 'SUBIDA-2' }, { id: 'SUBIDA-1' }]);
    expect(uploads).toBe(2);
    expect(posts[0].attributes).toEqual(expect.arrayContaining([{ id: 'SELLER_SKU', value_name: 'SP-413' }, { name: 'Medida', value_name: 'STD' }]));
    expect(posts[1].attributes).toEqual(expect.arrayContaining([{ id: 'SELLER_SKU', value_name: 'SP-413' }, { name: 'Medida', value_name: '0,50' }]));

    // Quedan dos publicaciones en la familia, cada una con su código, su medida y sus fotos del canal.
    const after = await db.publication.findUniqueOrThrow({ where: { id: pub.id }, include: { channelCopy: true } });
    const other = await db.publication.findFirstOrThrow({ where: { productId, id: { not: pub.id }, title: { not: 'Otra de la tienda' } }, include: { channelCopy: true } });
    expect(after).toMatchObject({ externalId: 'MLA900', variantKey: std, channelStatus: 'ACTIVE', media: null, familyId: expect.any(String) });
    expect(other).toMatchObject({ externalId: 'MLA901', variantKey: half, channelStatus: 'ACTIVE', media: null, familyId: after.familyId, title: after.title });
    expect([Number(after.price), Number(other.price)]).toEqual([80000, 80000]);
    expect(await db.listingFamily.findUniqueOrThrow({ where: { id: after.familyId! } })).toMatchObject({ leadId: pub.id, productId });
    expect(after.channelCopy!.photoIds).toEqual(['LINK-0', 'SUBIDA-1']);
    expect(other.channelCopy!.photoIds).toEqual(['SUBIDA-2', 'SUBIDA-1']);
    expect(await state(pub.id)).toEqual({ draft: [], choose: [], rejected: [] });
    expect(await state(other.id)).toEqual({ draft: [], choose: [], rejected: [] });
    // Ya no queda nada para crear.
    expect((await createChecks(db, { accountId, publicationId: other.id })).blocked).toBe('Todas las medidas ya están publicadas en Mercado Libre.');
  });

  it('crea la publicación con sus datos, fotos y descripción, y queda con su código y al día', async () => {
    const pub = await db.publication.create({
      data: {
        productId,
        storeId,
        title: 'Kit Embrague Ford Ka 1.6',
        description: 'Kit completo con disco y placa.',
        channelStatus: 'UNPUBLISHED',
        attributes: [{ name: 'Tipo de embrague', value: 'Monodisco' }],
      },
    });
    const editId = await correctedPhoto('frente.jpg');
    await saveMedia(db, { accountId, publicationId: pub.id, refs: [{ kind: 'edit', editId }, { kind: 'asset', url: 'https://otra/foto.jpg' }] });
    await taxesInStore();
    await withPackage(pub.id);

    const created = await createInChannel(db, { accountId, publicationId: pub.id, price: 45000, quantity: 3, listingType: 'premium', userId: null });
    expect(created).toEqual({ externalId: 'MLA900', url: 'https://articulo.mercadolibre.com.ar/MLA-900', warnings: [], confirmed: true, created: [] });
    const post = calls.find((c) => c.path === '/items')!.body as Record<string, unknown>;
    expect(post).toMatchObject({
      title: 'Kit Embrague Ford Ka 1.6',
      category_id: 'MLA373460',
      price: 45000,
      currency_id: 'ARS',
      available_quantity: 3,
      listing_type_id: 'gold_pro',
      condition: 'new',
      pictures: [{ id: 'SUBIDA-1' }, { source: 'https://otra/foto.jpg' }],
      sale_terms: [
        { id: 'WARRANTY_TYPE', value_name: 'Garantía del vendedor' },
        { id: 'WARRANTY_TIME', value_name: '6 meses' },
      ],
    });
    // Los impuestos van como en la tienda y quedan en la publicación.
    expect(post.attributes).toEqual([
      { id: 'BRAND', value_name: 'Sachs' },
      { id: 'PART_NUMBER', value_name: 'PD-1' },
      { id: 'CLUTCH_TYPE', value_name: 'Monodisco' },
      { id: 'SELLER_PACKAGE_HEIGHT', value_name: '10 cm' },
      { id: 'SELLER_PACKAGE_WIDTH', value_name: '20 cm' },
      { id: 'SELLER_PACKAGE_LENGTH', value_name: '30 cm' },
      { id: 'SELLER_PACKAGE_WEIGHT', value_name: '1500 g' },
      { id: 'VALUE_ADDED_TAX', value_name: '21 %' },
      { id: 'IMPORT_DUTY', value_name: '0 %' },
    ]);
    expect((await db.publication.findUniqueOrThrow({ where: { id: pub.id } })).attributes).toEqual([
      { name: 'Tipo de embrague', value: 'Monodisco' },
      { name: 'Altura del paquete del seller', value: '10 cm' },
      { name: 'Ancho del paquete del seller', value: '20 cm' },
      { name: 'Largo del paquete del seller', value: '30 cm' },
      { name: 'Peso del paquete del seller', value: '1500 g' },
      { name: 'IVA', value: '21 %' },
      { name: 'Impuesto interno', value: '0 %' },
    ]);
    expect(descriptions.MLA900).toBe('Kit completo con disco y placa.');

    const after = await db.publication.findUniqueOrThrow({ where: { id: pub.id } });
    expect(after).toMatchObject({ externalId: 'MLA900', channelStatus: 'ACTIVE', media: null });
    expect(Number(after.price)).toBe(45000);
    expect(await state(pub.id)).toEqual({ draft: [], choose: [], rejected: [] });
    expect(await db.channelSyncChange.findFirst({ where: { publicationId: pub.id, kind: 'CREATED' } })).not.toBeNull();
    // Ya no se puede volver a crear.
    expect((await createChecks(db, { accountId, publicationId: pub.id })).blocked).toBe('Ya está publicada en Mercado Libre.');
  });

  it('si el canal no la acepta, no queda nada a medias y se ve el motivo', async () => {
    const pub = await db.publication.create({ data: { productId, storeId, title: 'Kit Embrague RECHAZAR', channelStatus: 'UNPUBLISHED' } });
    await saveMedia(db, { accountId, publicationId: pub.id, refs: [{ kind: 'asset', url: 'https://otra/foto.jpg' }] });
    await taxesInStore();
    await withPackage(pub.id);
    const attempt = createInChannel(db, { accountId, publicationId: pub.id, price: 1, quantity: 1, listingType: 'clasica', userId: null });
    await expect(attempt).rejects.toThrow(CreateError);
    await expect(createInChannel(db, { accountId, publicationId: pub.id, price: 1, quantity: 1, listingType: 'clasica', userId: null })).rejects.toThrow(
      'El precio es muy bajo',
    );
    expect((await db.publication.findUniqueOrThrow({ where: { id: pub.id } })).externalId).toBeNull();
    // Cada intento queda en el historial con el motivo.
    expect(await db.channelSyncChange.findMany({ where: { publicationId: pub.id } })).toMatchObject([
      { field: 'publication', kind: 'CREATE_FAILED', message: expect.stringContaining('El precio es muy bajo') },
      { field: 'publication', kind: 'CREATE_FAILED', message: expect.stringContaining('El precio es muy bajo') },
    ]);
  });


  describe('el estado en el canal', () => {
    const logged = async (publicationId: string) =>
      (await db.channelSyncChange.findMany({ where: { publicationId, field: { in: ['status', 'publication'] } }, orderBy: { id: 'asc' } })).map((c) => [
        c.kind,
        c.before,
        c.after,
        c.message,
      ]);

    it('pausa, reactiva y finaliza; lo que no se puede vuelve con el motivo', async () => {
      const pub = await db.publication.create({ data: { productId, storeId, externalId: 'MLA1', title: 'Kit Embrague Ford Ka' } });
      await readAll();
      let r = await changeStatus(db, { accountId, publicationIds: [pub.id], action: 'pause', userId: null });
      expect(r).toEqual({ done: [{ id: pub.id, title: 'Kit Embrague Ford Ka' }], failed: [] });
      expect(calls.filter((c) => c.method === 'PUT').map((c) => [c.path, c.body])).toEqual([['/items/MLA1', { status: 'paused' }]]);
      expect((await db.publication.findUniqueOrThrow({ where: { id: pub.id } })).channelStatus).toBe('PAUSED');

      // Lo que no corresponde al estado no se manda.
      r = await changeStatus(db, { accountId, publicationIds: [pub.id], action: 'pause', userId: null });
      expect(r.failed).toEqual([{ id: pub.id, title: 'Kit Embrague Ford Ka', message: 'Está pausada, no se puede pausar.' }]);
      expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);

      // Sin stock, Mercado Libre no la reactiva.
      items.MLA1.quantity = 0;
      r = await changeStatus(db, { accountId, publicationIds: [pub.id], action: 'activate', userId: null });
      expect(r.failed[0].message).toBe('No tiene stock en Mercado Libre: cargale stock para reactivarla.');
      items.MLA1.quantity = 3;
      await changeStatus(db, { accountId, publicationIds: [pub.id], action: 'activate', userId: null });
      await changeStatus(db, { accountId, publicationIds: [pub.id], action: 'close', userId: null });
      expect((await db.publication.findUniqueOrThrow({ where: { id: pub.id } })).channelStatus).toBe('CLOSED');
      expect(await logged(pub.id)).toEqual([
        ['STATUS_CHANGED', 'ACTIVE', 'PAUSED', null],
        ['STATUS_FAILED', 'PAUSED', 'ACTIVE', 'No tiene stock en Mercado Libre: cargale stock para reactivarla.'],
        ['STATUS_CHANGED', 'PAUSED', 'ACTIVE', null],
        ['STATUS_CHANGED', 'ACTIVE', 'CLOSED', null],
      ]);
      // La lectura trae el mismo estado.
      await readAll();
      expect((await db.publication.findUniqueOrThrow({ where: { id: pub.id } })).channelStatus).toBe('CLOSED');
    });

    it('solo se elimina una finalizada; queda archivada y ya no se lee', async () => {
      const pub = await db.publication.create({ data: { productId, storeId, externalId: 'MLA1', title: 'Kit Embrague Ford Ka' } });
      await readAll();
      let r = await changeStatus(db, { accountId, publicationIds: [pub.id], action: 'delete', userId: null });
      expect(r.failed[0].message).toBe('Está activa, no se puede eliminar.');
      await changeStatus(db, { accountId, publicationIds: [pub.id], action: 'close', userId: null });
      r = await changeStatus(db, { accountId, publicationIds: [pub.id], action: 'delete', userId: null });
      expect(r.done).toHaveLength(1);
      expect(calls.filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([{ status: 'closed' }, { deleted: 'true' }]);
      expect((await db.publication.findUniqueOrThrow({ where: { id: pub.id } })).channelStatus).toBe('DELETED');
      const run = await startSync(db, { storeId, trigger: 'MANUAL' });
      expect((await db.channelSync.findUniqueOrThrow({ where: { id: run!.id } })).ids).toEqual([]);
    });

    it('republicar deja la misma publicación con el código nuevo', async () => {
      const pub = await db.publication.create({ data: { productId, storeId, externalId: 'MLA1', title: 'Kit Embrague Ford Ka' } });
      await readAll();
      await changeStatus(db, { accountId, publicationIds: [pub.id], action: 'close', userId: null });
      const info = await relistInfo(db, { accountId, publicationId: pub.id });
      expect(info).toMatchObject({ blocked: null, measures: [], price: 100 });
      const r = await relistInChannel(db, { accountId, publicationId: pub.id, price: 120, quantity: 2, listingType: 'clasica', userId: null });
      expect(r).toEqual({ externalId: 'MLA900', warnings: [] });
      expect(calls.find((c) => c.path === '/items/MLA1/relist')!.body).toEqual({ price: 120, listing_type_id: 'gold_special', quantity: 2 });
      const after = await db.publication.findUniqueOrThrow({ where: { id: pub.id }, include: { channelCopy: true } });
      expect(after).toMatchObject({ externalId: 'MLA900', channelStatus: 'ACTIVE' });
      expect(Number(after.price)).toBe(120);
      expect(after.channelCopy!.missingSince).toBeNull();
      expect((await logged(pub.id)).at(-1)).toEqual(['RELISTED', { externalId: 'MLA1' }, { externalId: 'MLA900' }, null]);
      // Una activa no se republica.
      await expect(relistInChannel(db, { accountId, publicationId: pub.id, price: 120, quantity: 2, listingType: 'clasica', userId: null })).rejects.toThrow(
        'Está activa, no se puede republicar.',
      );
    });
  });

  describe('en una cuenta donde cada medida es una publicación aparte', () => {
    const std = 'sku:SP-413 medida:std';
    const half = 'sku:SP-413 medida:0.50';

    beforeEach(async () => {
      separate = true;
      await taxesInStore();
      await db.productVariant.createMany({
        data: [
          { productId, sku: 'SP-413', measure: 'STD', position: 0 },
          { productId, sku: 'SP-413', measure: '0,50', position: 1 },
        ],
      });
    });

    async function createFamily() {
      const pub = await db.publication.create({
        data: { productId, storeId, title: 'Subconjunto Peugeot 1.6 SP-413', description: 'Pistones y aros.', channelStatus: 'UNPUBLISHED' },
      });
      await withPackage(pub.id);
      const general = await correctedPhoto('general.jpg');
      await saveMedia(db, {
        accountId,
        publicationId: pub.id,
        refs: [
          { kind: 'asset', url: 'https://otra/foto.jpg' },
          { kind: 'edit', editId: general, variants: [std] },
        ],
      });
      const result = await createInChannel(db, { accountId, publicationId: pub.id, price: 80000, quantities: { [std]: 2, [half]: 5 }, listingType: 'clasica', userId: null });
      const other = await db.publication.findFirstOrThrow({ where: { productId, variantKey: half } });
      return { pub, other, result };
    }

    it('crea una publicación por medida con el mismo nombre de familia, y cada una queda en la familia de la app', async () => {
      const { pub, other, result } = await createFamily();
      // Mercado Libre arma el título con la medida: el nombre de la familia sigue siendo el de la app.
      expect(result).toMatchObject({ externalId: 'MLA900', confirmed: true, warnings: [] });

      const posts = calls.filter((c) => c.path === '/items').map((c) => c.body as Record<string, unknown>);
      expect(posts).toHaveLength(2);
      for (const post of posts) {
        expect(post).toMatchObject({ family_name: 'Subconjunto Peugeot 1.6 SP-413', price: 80000, category_id: expect.any(String) });
        expect(post.title).toBeUndefined();
        expect(post.variations).toBeUndefined();
      }
      // Cada una con su cantidad, su SKU, su medida y sus fotos: la STD ve primero la suya.
      // La foto de todas se sube con la primera y la segunda usa el mismo código.
      expect(posts.map((p) => p.available_quantity)).toEqual([2, 5]);
      expect(posts[0].pictures).toEqual([{ id: 'SUBIDA-1' }, { source: 'https://otra/foto.jpg' }]);
      expect(posts[1].pictures).toEqual([{ id: 'LINK-1' }]);
      expect(posts[0].attributes).toEqual(expect.arrayContaining([{ id: 'SELLER_SKU', value_name: 'SP-413' }, { name: 'Medida', value_name: 'STD' }]));
      expect(posts[1].attributes).toEqual(expect.arrayContaining([{ id: 'SELLER_SKU', value_name: 'SP-413' }, { name: 'Medida', value_name: '0,50' }]));
      expect(descriptions).toEqual({ MLA900: 'Pistones y aros.', MLA901: 'Pistones y aros.' });

      const after = await db.publication.findUniqueOrThrow({ where: { id: pub.id }, include: { channelCopy: true } });
      expect(after).toMatchObject({ externalId: 'MLA900', title: 'Subconjunto Peugeot 1.6 SP-413', media: null, variantListings: [], variantKey: std });
      expect(other).toMatchObject({ externalId: 'MLA901', title: 'Subconjunto Peugeot 1.6 SP-413', familyId: after.familyId, description: 'Pistones y aros.' });
      // Cada una con las fotos que ve el comprador en su medida.
      const otherCopy = await db.channelCopy.findUniqueOrThrow({ where: { publicationId: other.id } });
      expect(after.channelCopy!.photoIds).toEqual(['SUBIDA-1', 'LINK-1']);
      expect(otherCopy.photoIds).toEqual(['LINK-1']);
      expect(await state(pub.id)).toEqual({ draft: [], choose: [], rejected: [] });
      expect(await state(other.id)).toEqual({ draft: [], choose: [], rejected: [] });

      // La lectura de la tienda las lee y sigue todo igual.
      await readAll();
      expect(await state(pub.id)).toEqual({ draft: [], choose: [], rejected: [] });
      expect(await state(other.id)).toEqual({ draft: [], choose: [], rejected: [] });

      // Las preguntas de cada código van a la publicación de su medida.
      await saveQuestions(db, storeId, [
        { externalId: 'Q1', sellerId: '7', listingId: 'MLA901', text: '¿Sirve para 206?', status: 'UNANSWERED', askedAt: '2026-10-22T10:00:00Z', buyerId: '9', answer: null },
      ], new Date());
      expect(await db.buyerQuestion.findFirst({ where: { externalId: 'Q1' } })).toMatchObject({ publicationId: other.id });
    });

    it('los cambios se suben a cada una, y las fotos de cada medida a la suya', async () => {
      const { pub, other } = await createFamily();
      calls.length = 0;
      await db.publication.updateMany({ where: { familyId: other.familyId }, data: { description: 'Pistones, aros y pernos.' } });
      // La corregida pasa a ser de las dos: en la STD va segunda y en la 0,50, primera.
      await saveFamilyMedia(db, {
        accountId,
        publicationId: pub.id,
        refs: [
          { kind: 'channel', id: 'LINK-1', url: '' },
          { kind: 'channel', id: 'SUBIDA-1', url: '', positions: { [half]: 0 } },
        ],
      });
      for (const id of [pub.id, other.id]) {
        const result = await pushDrafts(db, { accountId, publicationId: id, userId: null });
        expect(result).toMatchObject({ sent: expect.arrayContaining(['description', 'photos']), rejected: [], confirmed: true });
      }
      expect(descriptions).toMatchObject({ MLA900: 'Pistones, aros y pernos.', MLA901: 'Pistones, aros y pernos.' });
      const puts = calls.filter((c) => c.method === 'PUT' && /^\/items\/MLA90\d$/.test(c.path));
      expect(puts.map((c) => [c.path, (c.body as { pictures: unknown }).pictures])).toEqual([
        ['/items/MLA900', [{ id: 'LINK-1' }, { id: 'SUBIDA-1' }]],
        ['/items/MLA901', [{ id: 'SUBIDA-1' }, { id: 'LINK-1' }]],
      ]);
      expect(await state(pub.id)).toEqual({ draft: [], choose: [], rejected: [] });
      expect(await state(other.id)).toEqual({ draft: [], choose: [], rejected: [] });
    });

    it('el estado es de cada medida, y cada una se republica con su código nuevo', async () => {
      const { pub, other } = await createFamily();
      calls.length = 0;
      await changeStatus(db, { accountId, publicationIds: [pub.id, other.id], action: 'close', userId: null });
      expect(calls.filter((c) => c.method === 'PUT').map((c) => [c.path, c.body])).toEqual([
        ['/items/MLA900', { status: 'closed' }],
        ['/items/MLA901', { status: 'closed' }],
      ]);
      // Cada una vende una sola medida: se republica con su cantidad.
      expect((await relistInfo(db, { accountId, publicationId: pub.id })).measures).toEqual([]);
      const a = await relistInChannel(db, { accountId, publicationId: pub.id, price: 90000, quantity: 1, listingType: 'clasica', userId: null });
      const b = await relistInChannel(db, { accountId, publicationId: other.id, price: 90000, quantity: 4, listingType: 'clasica', userId: null });
      expect([a.externalId, b.externalId]).toEqual(['MLA902', 'MLA903']);
      expect(calls.filter((c) => c.path.endsWith('/relist')).map((c) => [c.path, c.body])).toEqual([
        ['/items/MLA900/relist', { price: 90000, listing_type_id: 'gold_special', quantity: 1 }],
        ['/items/MLA901/relist', { price: 90000, listing_type_id: 'gold_special', quantity: 4 }],
      ]);
      expect((await db.publication.findUniqueOrThrow({ where: { id: other.id } })).familyId).toBe(other.familyId);
    });

    it('si una medida no se crea, queda sin publicar en la familia y se crea después', async () => {
      // La segunda medida tiene un SKU que el canal rechaza.
      await db.productVariant.updateMany({ where: { productId, measure: '0,50' }, data: { sku: 'RECHAZAR' } });
      const pub = await db.publication.create({ data: { productId, storeId, title: 'Subconjunto Peugeot 1.6 SP-413', channelStatus: 'UNPUBLISHED' } });
      await withPackage(pub.id);
      await saveMedia(db, { accountId, publicationId: pub.id, refs: [{ kind: 'asset', url: 'https://otra/foto.jpg' }] });
      const rejected = 'sku:RECHAZAR medida:0.50';
      const result = await createInChannel(db, { accountId, publicationId: pub.id, price: 80000, quantities: { [std]: 2, [rejected]: 5 }, listingType: 'clasica', userId: null });
      expect(result.created).toEqual([{ label: 'STD', externalId: 'MLA900' }]);
      expect(result.warnings).toEqual([expect.stringContaining('La medida 0,50 no se creó')]);
      const other = await db.publication.findFirstOrThrow({ where: { productId, variantKey: rejected } });
      expect(other).toMatchObject({ externalId: null, channelStatus: 'UNPUBLISHED' });
      expect(await db.channelSyncChange.findFirst({ where: { publicationId: other.id, kind: 'CREATE_FAILED' } })).not.toBeNull();

      // Desde cualquiera de las dos se ve lo que falta: solo la 0,50.
      const info = await createChecks(db, { accountId, publicationId: pub.id });
      expect(info.measures).toEqual([{ key: rejected, label: '0,50', price: null }]);
      expect(info.published).toEqual([{ label: 'STD', externalId: 'MLA900' }]);
      expect(info.checks.find((c) => c.label === 'Medidas')).toMatchObject({ ok: true, detail: 'Falta crear 0,50, en la familia de STD, que ya está publicada.' });
      await db.productVariant.updateMany({ where: { productId, measure: '0,50' }, data: { sku: 'SP-414' } });
      await db.publication.update({ where: { id: other.id }, data: { variantKey: 'sku:SP-414 medida:0.50' } });
      calls.length = 0;
      const again = await createInChannel(db, { accountId, publicationId: other.id, price: 80000, quantities: { 'sku:SP-414 medida:0.50': 5 }, listingType: 'clasica', userId: null });
      expect(again.created).toEqual([{ label: '0,50', externalId: 'MLA901' }]);
      expect(calls.filter((c) => c.path === '/items')).toHaveLength(1);
    });

    it('una sola medida se crea con nombre de familia y sin título', async () => {
      await db.productVariant.deleteMany({ where: { productId, measure: '0,50' } });
      const pub = await db.publication.create({ data: { productId, storeId, title: 'Subconjunto Peugeot 1.6 SP-413', channelStatus: 'UNPUBLISHED' } });
      await withPackage(pub.id);
      await saveMedia(db, { accountId, publicationId: pub.id, refs: [{ kind: 'asset', url: 'https://otra/foto.jpg' }] });
      const result = await createInChannel(db, { accountId, publicationId: pub.id, price: 80000, quantity: 3, listingType: 'clasica', userId: null });
      expect(result).toMatchObject({ externalId: 'MLA900', confirmed: true });
      const post = calls.find((c) => c.path === '/items')!.body as Record<string, unknown>;
      expect(post).toMatchObject({ family_name: 'Subconjunto Peugeot 1.6 SP-413', available_quantity: 3 });
      expect(post.title).toBeUndefined();
      expect((await db.publication.findUniqueOrThrow({ where: { id: pub.id } })).familyId).toBeNull();
    });
  });
});
