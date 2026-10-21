import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { faceSummary, faceValues, fingerprintsOf } from '@/domain/channel-sync';
import { cleanMedia, parseMedia, photoKey } from '@/domain/media';
import { createChecks, CreateError, createInChannel, warrantyText } from '@/lib/channel-create';
import { pushDrafts } from '@/lib/channel-push';
import { runSyncStep, startSync } from '@/lib/channel-sync';
import { encrypt } from '@/lib/crypto';
import { loadMediaSources, MediaError, saveMedia } from '@/lib/media';
import { resetVisitsTogether } from '@/channels/mercadolibre/listings';

// Las fotos de cada publicación y crear publicaciones nuevas en el canal,
// contra un Mercado Libre simulado. Las fotos corregidas se leen de un depósito
// simulado. Los datos son de prueba.

vi.mock('@/lib/files', async (original) => ({
  ...(await original<typeof import('@/lib/files')>()),
  readBlob: vi.fn(async () => new Response(new Uint8Array([255, 216, 255, 224]), { headers: { 'content-type': 'image/jpeg' } })),
}));

describe('las fotos elegidas', () => {
  it('sin elegir siguen al canal; se guardan sin repetir y con tope', () => {
    expect(parseMedia(null)).toBeNull();
    expect(parseMedia([{ kind: 'edit', editId: 'a' }, { kind: 'otra' }])).toEqual([{ kind: 'edit', editId: 'a' }]);
    const many = Array.from({ length: 15 }, (_, i) => ({ kind: 'asset' as const, url: `https://foto/${i}.jpg` }));
    expect(cleanMedia([...many.slice(0, 2), many[0]])).toHaveLength(2);
    expect(cleanMedia(many)).toHaveLength(12);
    expect(photoKey({ kind: 'channel', id: 'P1', url: 'x' })).toBe(photoKey({ kind: 'channel', id: 'P1', url: 'y' }));
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

type Item = { title: string; price: number; pictures: { id: string; secure_url: string }[]; sold: number; category_id: string; attributes: object[] };

describe.skipIf(!url)('fotos y publicaciones nuevas en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let server: http.Server;
  const calls: { method: string; path: string; body: unknown }[] = [];
  let items: Record<string, Item> = {};
  let descriptions: Record<string, string> = {};
  let uploads = 0;
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
        uploads++;
        return json(201, { id: `SUBIDA-${uploads}` });
      }
      if (u.pathname === '/items' && req.method === 'POST') {
        if (body.title.includes('RECHAZAR')) {
          return json(400, { message: 'Validation error', cause: [{ code: 'item.price.invalid', message: 'El precio es muy bajo' }] });
        }
        const id = 'MLA900';
        const pictures = body.pictures.map((p: { id?: string; source?: string }, i: number) => ({ id: p.id ?? `LINK-${i}`, secure_url: p.source ?? `https://ml/${p.id}.jpg` }));
        items[id] = { title: body.title, price: body.price, pictures, sold: 0, category_id: body.category_id, attributes: body.attributes };
        return json(201, { id, permalink: 'https://articulo.mercadolibre.com.ar/MLA-900', pictures: pictures.map((p: { id: string }) => ({ id: p.id })) });
      }
      const desc = u.pathname.match(/^\/items\/(\w+)\/description$/);
      if (desc && req.method === 'POST') {
        descriptions[desc[1]] = body.plain_text;
        return json(201, {});
      }
      if (desc) return descriptions[desc[1]] ? json(200, { plain_text: descriptions[desc[1]] }) : json(404, {});
      const item = u.pathname.match(/^\/items\/(\w+)$/);
      if (item && req.method === 'PUT' && body.pictures) {
        const it = items[item[1]];
        it.pictures = body.pictures.map((p: { id?: string; source?: string }, i: number) => ({
          id: p.id ?? `LINK-${i}`,
          secure_url: p.source ?? it.pictures.find((x) => x.id === p.id)?.secure_url ?? `https://ml/${p.id}.jpg`,
        }));
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
              body: { id, seller_id: 7, title: it.title, status: 'active', price: it.price, sold_quantity: it.sold, category_id: it.category_id, pictures: it.pictures, attributes: it.attributes },
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
    uploads = 0;
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

  it('si las fotos cambian en el canal y la app no las tocó, las sigue; si las tocó, hay que elegir', async () => {
    const pub = await db.publication.create({ data: { productId, storeId, externalId: 'MLA1', title: 'Kit Embrague Ford Ka' } });
    await readAll();
    await saveMedia(db, { accountId, publicationId: pub.id, refs: [{ kind: 'channel', id: 'P2', url: '' }] });
    items.MLA1.pictures = [{ id: 'P3', secure_url: 'https://ml/P3.jpg' }];
    await db.channelSync.updateMany({ data: { startedAt: new Date(Date.now() - 3 * 3600_000) } });
    await readAll();
    expect((await state(pub.id)).choose).toEqual(['photos']);
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
    await saveMedia(db, { accountId, publicationId: pub.id, refs: [{ kind: 'asset', url: 'https://otra/foto.jpg' }] });
    info = await createChecks(db, { accountId, publicationId: pub.id });
    expect(info.ready).toBe(true);
    expect(info.listingTypes.map((t) => t.value)).toEqual(['clasica', 'premium']);

    // Con varias medidas, todavía no.
    await db.productVariant.createMany({ data: [{ productId, sku: 'A', measure: 'STD', position: 0 }, { productId, sku: 'B', measure: '0.50', position: 1 }] });
    info = await createChecks(db, { accountId, publicationId: pub.id });
    expect(info.ready).toBe(false);
    await expect(createInChannel(db, { accountId, publicationId: pub.id, price: 100, quantity: 1, listingType: 'clasica', userId: null })).rejects.toThrow(
      'Medidas',
    );
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

    const created = await createInChannel(db, { accountId, publicationId: pub.id, price: 45000, quantity: 3, listingType: 'premium', userId: null });
    expect(created).toEqual({ externalId: 'MLA900', url: 'https://articulo.mercadolibre.com.ar/MLA-900', warnings: [], confirmed: true });
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
    expect(post.attributes).toEqual([
      { id: 'BRAND', value_name: 'Sachs' },
      { id: 'PART_NUMBER', value_name: 'PD-1' },
      { id: 'CLUTCH_TYPE', value_name: 'Monodisco' },
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
});
