import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { rejectionMessage } from '@/channels/mercadolibre/publish';
import { faceSummary, faceValues, fingerprintsOf } from '@/domain/channel-sync';
import { DraftError, pushDrafts, PushError, renewDiscounts, saveDraft } from '@/lib/channel-push';
import { discardDrafts, readOne, runSyncStep, startSync } from '@/lib/channel-sync';
import { encrypt } from '@/lib/crypto';
import { savePriceDecision } from '@/lib/pricing';
import { saveQuantities } from '@/lib/quantities';
import { advanceStep } from '@/domain/pipeline';
import { resetVisitsTogether } from '@/channels/mercadolibre/listings';

// Subir al canal el borrador de una publicación, contra un Mercado Libre
// simulado. Los datos son de prueba.

describe('por qué Mercado Libre no aceptó un cambio', () => {
  it('explica los motivos conocidos en castellano', () => {
    expect(rejectionMessage(400, { cause: [{ code: 'item.title.not_modifiable', message: 'Title is not modifiable' }] })).toContain(
      'no deja cambiar el título',
    );
    expect(rejectionMessage(400, { cause: [{ code: 'item.title.length.invalid' }] })).toContain('más largo');
    expect(rejectionMessage(403, {})).toContain('permiso para modificar');
    expect(rejectionMessage(404, {})).toContain('no encontró');
    expect(rejectionMessage(400, { cause: [{ code: 'item.variations.attribute_combinations.invalid', message: 'Medida no válida' }] })).toBe(
      'Mercado Libre no aceptó las medidas: Medida no válida',
    );
    expect(
      rejectionMessage(400, {
        cause: [
          {
            code: 'item.attributes.missing_required',
            message: "The attributes [VALUE_ADDED_TAX,IMPORT_DUTY] are required for category [MLA373289]. Check the attribute is present in the attributes list or in all variation's attributes_combination or attributes",
          },
        ],
      }),
    ).toMatch(/^Mercado Libre pide datos de catálogo que faltan: The attributes \[VALUE_ADDED_TAX,IMPORT_DUTY\]/);
    expect(
      rejectionMessage(400, {
        cause: [{ code: 'item.attributes.invalid', message: 'The attributes [seller_package_height, seller_package_weight] are all required' }],
      }),
    ).toBe('Mercado Libre pide datos de catálogo que faltan: The attributes [seller_package_height, seller_package_weight] are all required');
    expect(rejectionMessage(400, { message: 'Algo raro' })).toBe('Mercado Libre no lo aceptó: Algo raro');
    expect(rejectionMessage(500, null)).toBe('Mercado Libre no lo aceptó (código 500).');
  });
});

const url = process.env.TEST_DATABASE_URL;

type Attribute = { id: string; name: string; value_name: string | null; values?: { name: string }[] };
type Item = {
  title: string;
  description: string | null;
  sold: number;
  last_updated: string;
  attributes?: Attribute[];
  category_id?: string;
  price?: number;
  variations?: { id: number; price: number; quantity?: number; measure?: string }[];
  // La cantidad disponible; sin cargar, 5.
  quantity?: number;
  // En Full: el stock lo maneja Mercado Libre.
  full?: boolean;
  listing_type_id?: string;
  tags?: string[];
  // El descuento puesto: el precio con descuento.
  deal?: { price: number; finish: string } | null;
  // El canal acepta el descuento pero todavía no lo muestra.
  dealLater?: boolean;
  // El canal no acepta descuentos: el motivo.
  dealRejected?: string;
};

const variationBody = (v: NonNullable<Item['variations']>[number]) => ({
  id: v.id,
  price: v.price,
  available_quantity: v.quantity,
  attribute_combinations: v.measure ? [{ id: 'SIZE', value_name: v.measure }] : [],
});

describe.skipIf(!url)('subir al canal en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let server: http.Server;
  const writes: { method: string; path: string; body: unknown }[] = [];
  let items: Record<string, Item> = {};
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
      const body = raw ? JSON.parse(raw) : null;
      if (req.method === 'PUT' || req.method === 'POST' || req.method === 'DELETE') writes.push({ method: req.method, path: u.pathname, body });

      const item = u.pathname.match(/^\/items\/(\w+)$/);
      if (item && req.method === 'GET' && items[item[1]]) {
        const it = items[item[1]];
        return json(200, {
          id: item[1],
          variations: (it.variations ?? []).map(variationBody),
          listing_type_id: it.listing_type_id ?? 'gold_special',
          tags: it.tags ?? [],
          shipping: { logistic_type: it.full ? 'fulfillment' : 'cross_docking' },
        });
      }
      if (item && req.method === 'PUT') {
        const it = items[item[1]];
        if (!it) return json(404, {});
        // La cantidad: sin medidas, la de la publicación; con medidas, la de cada una.
        if (body.available_quantity !== undefined || (body.variations && !body.variations.some((v: { price?: number }) => v.price !== undefined))) {
          if (body.available_quantity !== undefined) it.quantity = body.available_quantity;
          for (const v of body.variations ?? []) {
            const mine = it.variations?.find((x) => x.id === v.id);
            if (mine && v.available_quantity !== undefined) mine.quantity = v.available_quantity;
          }
          it.last_updated = new Date().toISOString();
          return json(200, { id: item[1] });
        }
        if (body.price !== undefined || body.variations) {
          if (body.price !== undefined && it.variations?.length) return json(400, { message: 'Validation error', cause: [{ code: 'item.price.invalid', message: 'Use variations price' }] });
          if (body.price !== undefined) it.price = body.price;
          for (const v of body.variations ?? []) {
            const mine = it.variations?.find((x) => x.id === v.id);
            if (mine) mine.price = v.price;
          }
          it.price = it.variations?.[0]?.price ?? it.price;
          // Al cambiar el precio, Mercado Libre saca el descuento.
          it.deal = null;
          it.last_updated = new Date().toISOString();
          return json(200, { id: item[1] });
        }
        if (body.tags) {
          it.tags = body.tags;
          return json(200, { id: item[1] });
        }
        if (body.attributes) {
          const bad = body.attributes.find((a: Attribute) => a.value_name === 'Usado');
          if (bad) return json(400, { message: 'Validation error', cause: [{ code: 'item.attributes.invalid', message: 'Condición del ítem: el valor Usado no es válido' }] });
          for (const a of body.attributes as Attribute[]) {
            const list = (it.attributes ??= []);
            const at = list.findIndex((x) => x.id === a.id);
            const next = { id: a.id, name: at >= 0 ? list[at].name : a.id, value_name: a.value_name ?? null, ...(a.values ? { values: a.values } : {}) };
            if (at >= 0) list[at] = next;
            else list.push(next);
          }
          it.last_updated = new Date().toISOString();
          return json(200, { id: item[1] });
        }
        if (it.sold > 0) return json(400, { message: 'Validation error', cause: [{ code: 'item.title.not_modifiable', message: 'Not modifiable' }] });
        // A veces el canal guarda el título con algún cambio.
        it.title = String(body.title).replace('Sachs', 'SACHS');
        it.last_updated = new Date().toISOString();
        return json(200, { id: item[1] });
      }
      const type = u.pathname.match(/^\/items\/(\w+)\/listing_type$/);
      if (type && req.method === 'POST') {
        items[type[1]].listing_type_id = body.id;
        return json(200, {});
      }
      const promo = u.pathname.match(/^\/seller-promotions\/items\/(\w+)$/);
      if (promo) {
        const it = items[promo[1]];
        if (!it) return json(404, {});
        if (req.method === 'GET') return json(200, it.deal ? [{ id: 'P1', type: 'PRICE_DISCOUNT', status: 'started' }] : []);
        if (req.method === 'DELETE') {
          it.deal = null;
          return json(200, {});
        }
        if (it.dealRejected) return json(400, { message: it.dealRejected, cause: [] });
        if (it.deal) return json(400, { message: 'Item already has a PRICE_DISCOUNT' });
        if (!(body.deal_price < (it.price ?? 100))) return json(400, { message: 'deal_price must be lower than price' });
        if (!it.dealLater) it.deal = { price: body.deal_price, finish: body.finish_date };
        return json(201, {});
      }
      const desc = u.pathname.match(/^\/items\/(\w+)\/description$/);
      if (desc && req.method === 'PUT') {
        const it = items[desc[1]];
        if (!it || it.description === null) return json(404, { message: 'no description' });
        it.description = body.plain_text;
        return json(200, {});
      }
      if (desc && req.method === 'POST') {
        items[desc[1]].description = body.plain_text;
        return json(201, {});
      }
      if (desc) {
        const it = items[desc[1]];
        return it?.description ? json(200, { plain_text: it.description }) : json(404, {});
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
                status: 'active',
                price: it.deal?.price ?? it.price ?? 100,
                original_price: it.deal ? (it.price ?? 100) : null,
                listing_type_id: it.listing_type_id ?? 'gold_special',
                tags: it.tags ?? [],
                available_quantity: it.variations?.some((v) => v.quantity !== undefined) ? it.variations.reduce((sum, v) => sum + (v.quantity ?? 0), 0) : (it.quantity ?? 5),
                shipping: { logistic_type: it.full ? 'fulfillment' : 'cross_docking' },
                ...(it.variations?.some((v) => v.quantity !== undefined) ? { variations: it.variations.map(variationBody) } : {}),
                sold_quantity: it.sold,
                last_updated: it.last_updated,
                category_id: it.category_id ?? 'MLA999',
                attributes: it.attributes ?? [],
              },
            };
          }),
        );
      }
      if (u.pathname.startsWith('/categories/')) return json(200, { name: 'Otra categoría' });
      if (u.pathname === '/items/visits') return json(200, (u.searchParams.get('ids') ?? '').split(',').map((id) => ({ item_id: id, total_visits: 10 })));
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
      'TRUNCATE channel_syncs, channel_copies, channel_sync_changes, channel_applications, channel_connections, measurements, publications, products, stores, channels, accounts, users CASCADE',
    );
    resetVisitsTogether();
    writes.length = 0;
    items = {
      MLA1: {
        title: 'Kit Embrague Ford Ka',
        description: 'Kit completo.',
        sold: 0,
        last_updated: '2026-10-20T10:00:00.000Z',
        category_id: 'MLA373460',
        attributes: [
          { id: 'BRAND', name: 'Marca', value_name: 'Sachs' },
          { id: 'CLUTCH_TYPE', name: 'Tipo de embrague', value_name: 'Monodisco' },
          { id: 'INCLUDES_DISC', name: 'Incluye disco', value_name: 'No' },
          { id: 'ITEM_CONDITION', name: 'Condición del ítem', value_name: 'Nuevo' },
          { id: 'COLOR', name: 'Color', value_name: 'Gris' },
        ],
      },
      MLA2: { title: 'Bomba de Agua Fiat', description: null, sold: 0, last_updated: '2026-10-20T10:00:00.000Z' },
      MLA3: { title: 'Pistones Tico', description: 'Juego de 3.', sold: 4, last_updated: '2026-10-20T10:00:00.000Z' },
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
    const product = await db.product.create({ data: { accountId: account.id, name: 'Kit de embrague PD-1' } });
    accountId = account.id;
    storeId = store.id;
    productId = product.id;
    for (const [externalId, it] of Object.entries(items)) {
      await db.publication.create({ data: { productId, storeId, externalId, title: it.title, description: it.description, attributes: [] } });
    }
    const run = (await startSync(db, { storeId, trigger: 'MANUAL' }))!;
    await runSyncStep(db, run.id, { budgetMs: 30_000 });
  });

  const pub = (externalId: string) => db.publication.findFirstOrThrow({ where: { externalId }, include: { channelCopy: true } });
  const state = async (externalId: string) => {
    const p = await pub(externalId);
    return faceSummary(fingerprintsOf(faceValues(p)), p.channelCopy);
  };

  it('sube el título y la descripción del borrador, y después la publicación queda al día', async () => {
    const p = await pub('MLA1');
    await saveDraft(db, { accountId, publicationId: p.id, field: 'title', value: ' Kit Embrague  Ford Ka 1.6 Sachs' });
    // El título se guarda sin espacios de más.
    expect((await pub('MLA1')).title).toBe('Kit Embrague Ford Ka 1.6 Sachs');
    await saveDraft(db, { accountId, publicationId: p.id, field: 'description', value: 'Kit completo con disco y placa.' });
    expect((await state('MLA1')).draft).toEqual(['title', 'description']);

    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    expect(result).toEqual({ sent: ['title', 'description'], rejected: [], confirmed: true });
    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual(['PUT /items/MLA1', 'PUT /items/MLA1/description']);
    expect(items.MLA1.description).toBe('Kit completo con disco y placa.');
    // El canal guardó el título un poco distinto: la lectura de confirmación lo trae.
    expect((await pub('MLA1')).title).toBe('Kit Embrague Ford Ka 1.6 SACHS');
    expect(await state('MLA1')).toEqual({ draft: [], choose: [], rejected: [] });

    const sent = await db.channelSyncChange.findMany({ where: { publicationId: p.id, kind: 'SENT' }, orderBy: { field: 'asc' } });
    expect(sent.map((c) => [c.field, c.before])).toEqual([
      ['description', 'Kit completo.'],
      ['title', 'Kit Embrague Ford Ka'],
    ]);
    expect(await db.channelApplication.findFirst({ where: { publicationId: p.id } })).toMatchObject({ method: 'API', fields: ['title', 'description'] });
  });

  it('si la publicación no tenía descripción, la crea', async () => {
    const p = await pub('MLA2');
    await saveDraft(db, { accountId, publicationId: p.id, field: 'description', value: 'Bomba con junta.' });
    expect((await pushDrafts(db, { accountId, publicationId: p.id, userId: null })).sent).toEqual(['description']);
    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual(['PUT /items/MLA2/description', 'POST /items/MLA2/description']);
    expect(items.MLA2.description).toBe('Bomba con junta.');
  });

  it('lo que el canal no acepta queda con su motivo mientras el borrador sea el mismo', async () => {
    const p = await pub('MLA3');
    // La app todavía no sabe que tiene ventas: la marca a mano dice que no.
    await db.publication.update({ where: { id: p.id }, data: { titleLockedManual: false, title: 'Pistones Daewoo Tico' } });
    await db.measurement.deleteMany({ where: { publicationId: p.id } });
    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    expect(result.sent).toEqual([]);
    expect(result.rejected).toEqual([{ field: 'title', message: 'Mercado Libre no deja cambiar el título de una publicación con ventas.' }]);
    expect((await state('MLA3')).rejected).toMatchObject([{ field: 'title', message: expect.stringContaining('con ventas') }]);
    // El intento queda en el historial, con lo que había y lo que se quiso subir.
    expect(await db.channelSyncChange.findMany({ where: { publicationId: p.id, kind: 'REJECTED' } })).toMatchObject([
      { field: 'title', before: 'Pistones Tico', after: 'Pistones Daewoo Tico', message: expect.stringContaining('con ventas') },
    ]);
    // Con otro valor en el borrador, el motivo ya no vale.
    await db.publication.update({ where: { id: p.id }, data: { title: 'Pistones Daewoo Tico 800' } });
    expect((await state('MLA3')).rejected).toEqual([]);
  });

  it('no sube un título bloqueado, uno con errores ni lo que hay que elegir', async () => {
    // Con ventas en la medición, el título está bloqueado.
    const p3 = await pub('MLA3');
    await db.publication.update({ where: { id: p3.id }, data: { title: 'Pistones Daewoo Tico' } });
    expect((await pushDrafts(db, { accountId, publicationId: p3.id, userId: null })).rejected[0].message).toContain('bloqueado');
    await expect(saveDraft(db, { accountId, publicationId: p3.id, field: 'title', value: 'Otro título' })).rejects.toThrow(DraftError);

    const p1 = await pub('MLA1');
    await expect(saveDraft(db, { accountId, publicationId: p1.id, field: 'title', value: 'x'.repeat(80) })).rejects.toThrow('No se guardó');
    // Cambió en los dos lados.
    await db.publication.update({ where: { id: p1.id }, data: { title: 'Kit de la app' } });
    items.MLA1.title = 'Kit de Mercado Libre';
    items.MLA1.last_updated = '2026-10-20T12:00:00.000Z';
    await readOne(db, { accountId, publicationId: p1.id });
    expect((await pushDrafts(db, { accountId, publicationId: p1.id, userId: null })).rejected).toEqual([
      { field: 'title', message: 'Cambió también en Mercado Libre: primero elegí cuál queda.' },
    ]);
    expect(writes).toEqual([]);
    expect((await db.channelSyncChange.findMany({ where: { kind: 'REJECTED' }, orderBy: { id: 'asc' } })).map((c) => c.message)).toEqual([
      expect.stringContaining('bloqueado'),
      'Cambió también en Mercado Libre: primero elegí cuál queda.',
    ]);
  });

  it('descartar el borrador vuelve a lo que está en el canal', async () => {
    const p = await pub('MLA1');
    await saveDraft(db, { accountId, publicationId: p.id, field: 'description', value: 'Otra descripción.' });
    expect(await discardDrafts(db, { accountId, publicationId: p.id, userId: null })).toEqual(['description']);
    expect((await pub('MLA1')).description).toBe('Kit completo.');
    expect(await state('MLA1')).toEqual({ draft: [], choose: [], rejected: [] });
  });

  it('sin la cara del canal o sin código no sube', async () => {
    const fresh = await db.publication.create({ data: { productId, storeId, externalId: 'MLA9', title: 'Nueva' } });
    await expect(pushDrafts(db, { accountId, publicationId: fresh.id, userId: null })).rejects.toThrow('Primero hay que leerla');
    const unpublished = await db.publication.create({ data: { productId, storeId, title: 'Sin publicar', channelStatus: 'UNPUBLISHED' } });
    await expect(pushDrafts(db, { accountId, publicationId: unpublished.id, userId: null })).rejects.toThrow(PushError);
    await expect(pushDrafts(db, { accountId: 'otra', publicationId: fresh.id, userId: null })).rejects.toThrow('no está en la cuenta');
  });

  it('sube los datos de catálogo que cambiaron o son nuevos, con el código de cada campo', async () => {
    const p = await pub('MLA1');
    // La primera lectura trajo los datos de catálogo a la app.
    expect(p.attributes).toEqual([
      { name: 'Tipo de embrague', value: 'Monodisco' },
      { name: 'Incluye disco', value: 'No' },
      { name: 'Condición del ítem', value: 'Nuevo' },
      { name: 'Color', value: 'Gris' },
    ]);
    await db.publication.update({
      where: { id: p.id },
      data: {
        attributes: [
          { name: 'Tipo de embrague', value: 'Bidisco' },
          { name: 'Incluye disco', value: 'Sí' },
          { name: 'Condición del ítem', value: 'Nuevo' },
          { name: 'Color', value: 'Gris' },
          { name: 'Código OEM', value: 'AB12, CD34' },
        ],
      },
    });
    expect((await state('MLA1')).draft).toEqual(['attributes']);

    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    expect(result).toEqual({ sent: ['attributes'], rejected: [], confirmed: true });
    expect(writes).toEqual([
      {
        method: 'PUT',
        path: '/items/MLA1',
        body: {
          attributes: [
            { id: 'CLUTCH_TYPE', value_name: 'Bidisco' },
            { id: 'INCLUDES_DISC', value_name: 'Sí' },
            { id: 'OEM', values: [{ name: 'AB12' }, { name: 'CD34' }] },
          ],
        },
      },
    ]);
    expect(await state('MLA1')).toEqual({ draft: [], choose: [], rejected: [] });
  });

  it('los campos que el canal no conoce y los que se borraron en la app quedan con su motivo', async () => {
    const p = await pub('MLA1');
    await db.publication.update({
      where: { id: p.id },
      data: {
        attributes: [
          { name: 'Tipo de embrague', value: 'Bidisco' },
          { name: 'Incluye disco', value: 'No' },
          { name: 'Condición del ítem', value: 'Nuevo' },
          { name: 'Largo del cable', value: '1 m' },
        ],
      },
    });
    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    expect(result.sent).toEqual(['attributes']);
    expect(result.rejected[0].message).toContain('«Largo del cable» no es un campo de la categoría en Mercado Libre.');
    expect(result.rejected[0].message).toContain('«Color» está en Mercado Libre y no en la app');
    expect(writes.map((w) => w.body)).toEqual([{ attributes: [{ id: 'CLUTCH_TYPE', value_name: 'Bidisco' }] }]);
    // Lo que se subió ya está en los dos lados; lo demás sigue en el borrador, con su motivo.
    const after = await state('MLA1');
    expect(after.draft).toEqual(['attributes']);
    expect(after.rejected[0].message).toContain('Largo del cable');
    expect((await pub('MLA1')).channelCopy?.attributes).toContainEqual({ name: 'Tipo de embrague', value: 'Bidisco' });
  });

  it('un valor que la app sabe que no vale no se sube, y lo que el canal rechaza queda con su motivo', async () => {
    const p = await pub('MLA1');
    await db.publication.update({
      where: { id: p.id },
      data: {
        attributes: [
          { name: 'Tipo de embrague', value: 'Tridisco' },
          { name: 'Incluye disco', value: 'No' },
          { name: 'Condición del ítem', value: 'Usado' },
          { name: 'Color', value: 'Gris' },
        ],
      },
    });
    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    expect(result.sent).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].message).toContain('Mercado Libre no aceptó un dato de catálogo: Condición del ítem: el valor Usado no es válido');
    expect(result.rejected[0].message).toContain('«Tridisco» no es una opción');
    // Tipo de embrague no se mandó: no es una de las opciones.
    expect(writes.map((w) => w.body)).toEqual([{ attributes: [{ id: 'ITEM_CONDITION', value_name: 'Usado' }] }]);
    expect((await state('MLA1')).rejected).toHaveLength(1);
  });
  // ───────────────────────────── Precio ─────────────────────────────

  const decide = (publicationId: string, listPrice: number, extra: Partial<Parameters<typeof savePriceDecision>[1]> = {}) =>
    savePriceDecision(db, { accountId, publicationId, userId: null, listPrice, discountPct: 0, plan: 0, cost: 100_000, overrides: {}, confirmBelowMin: false, ...extra });

  it('la primera lectura toma el precio del canal, y una copia de antes del precio no muestra cambios', async () => {
    expect(Number((await pub('MLA1')).price)).toBe(100);
    const p = await pub('MLA1');
    // Una copia leída antes de que el precio se comparara: sin su huella.
    const strip = (raw: unknown) => Object.fromEntries(Object.entries(raw as Record<string, string>).filter(([k]) => !['price', 'installments', 'discount'].includes(k)));
    await db.channelCopy.update({ where: { publicationId: p.id }, data: { fingerprints: strip(p.channelCopy!.fingerprints), agreed: strip(p.channelCopy!.agreed) } });
    expect(await state('MLA1')).toEqual({ draft: [], choose: [], rejected: [] });
  });

  it('el precio decidido queda para subir y se sube; con medidas, en cada una', async () => {
    const p = await pub('MLA1');
    const saved = await decide(p.id, 260_000);
    expect(saved.simulation.finalPrice).toBe(260_000);
    expect(Number((await pub('MLA1')).price)).toBe(260_000);
    // Sin cuotas ni descuento, como ya estaba en el canal: solo cambia el precio.
    expect((await state('MLA1')).draft).toEqual(['price']);
    expect(await db.priceDecision.findFirst({ where: { publicationId: p.id } })).toMatchObject({ installments: 0, belowMinConfirmed: false });
    expect(Number((await db.product.findUniqueOrThrow({ where: { id: productId } })).replacementCost)).toBe(100_000);

    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    expect(result).toEqual({ sent: ['price'], rejected: [], confirmed: true });
    expect(writes.map((w) => w.body)).toEqual([{ price: 260_000 }]);
    expect(await state('MLA1')).toEqual({ draft: [], choose: [], rejected: [] });
    expect(await db.channelSyncChange.findFirst({ where: { publicationId: p.id, kind: 'SENT' } })).toMatchObject({ field: 'price', after: '260000' });

    // Con medidas, Mercado Libre pide el precio en cada una.
    items.MLA2.variations = [
      { id: 11, price: 100 },
      { id: 12, price: 100 },
    ];
    const p2 = await pub('MLA2');
    await decide(p2.id, 260_000);
    writes.length = 0;
    expect((await pushDrafts(db, { accountId, publicationId: p2.id, userId: null })).sent).toEqual(['price']);
    expect(writes.map((w) => w.body)).toEqual([{ variations: [{ id: 11, price: 260_000 }, { id: 12, price: 260_000 }] }]);
  });

  // ───────────────────────────── Cuotas y descuento ─────────────────────────────

  const promoWrites = () => writes.filter((w) => w.path.startsWith('/seller-promotions')).map((w) => `${w.method} ${(w.body as { deal_price?: number } | null)?.deal_price ?? ''}`.trim());

  /** Decide 260.000 con 3 cuotas y 10 % de descuento, y lo sube. */
  async function uploadDiscount() {
    const p = await pub('MLA1');
    await decide(p.id, 260_000, { discountPct: 10, plan: 3 });
    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    writes.length = 0;
    return { p, result };
  }

  it('las cuotas y el descuento decididos quedan para subir y se suben después del precio', async () => {
    const p = await pub('MLA1');
    // Lo que se leyó del canal: Clásica, sin cuotas ni descuento.
    expect(p).toMatchObject({ installments: 0 });
    expect(Number(p.discount)).toBe(0);
    await decide(p.id, 260_000, { discountPct: 10, plan: 3 });
    expect((await state('MLA1')).draft).toEqual(['price', 'installments', 'discount']);

    const started = Date.now();
    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    expect(result).toEqual({ sent: ['price', 'installments', 'discount'], rejected: [], confirmed: true });
    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual([
      'PUT /items/MLA1',
      'POST /items/MLA1/listing_type',
      'PUT /items/MLA1',
      'POST /seller-promotions/items/MLA1',
    ]);
    expect(writes[1].body).toEqual({ id: 'gold_pro' });
    expect(writes[2].body).toEqual({ tags: ['3x_campaign'] });
    expect(writes[3].body).toMatchObject({ promotion_type: 'PRICE_DISCOUNT', deal_price: 234_000 });
    // La lectura de confirmación ya ve las 3 cuotas y el descuento.
    expect(await state('MLA1')).toEqual({ draft: [], choose: [], rejected: [] });
    const after = await pub('MLA1');
    expect(Number(after.channelCopy!.discount)).toBe(10);
    expect(after.channelCopy!.installments).toBe(3);
    // Dura unos 14 días, y queda anotado cuándo se subió.
    const days = (after.channelCopy!.discountUntil!.getTime() - started) / 86_400_000;
    expect(days).toBeGreaterThan(12.9);
    expect(days).toBeLessThan(14.01);
    expect(after.channelCopy!.discountSentAt).not.toBeNull();
    const sent = await db.channelSyncChange.findMany({ where: { publicationId: p.id, kind: 'SENT' }, orderBy: { createdAt: 'asc' } });
    expect(sent.map((c) => [c.field, c.after])).toEqual([
      ['price', '260000'],
      ['installments', '3'],
      ['discount', '10'],
    ]);
  });

  it('si cambia el precio, el descuento que ya estaba se vuelve a subir sobre el precio nuevo', async () => {
    const { p } = await uploadDiscount();
    await decide(p.id, 280_000, { discountPct: 10, plan: 3 });
    expect((await state('MLA1')).draft).toEqual(['price']);
    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    expect(result.sent).toEqual(['price', 'discount']);
    expect(promoWrites()).toEqual(['POST 252000']);
    expect(await state('MLA1')).toEqual({ draft: [], choose: [], rejected: [] });
  });

  it('un descuento que el canal no acepta queda con su motivo, y uno fuera de lo que acepta no se guarda', async () => {
    const p = await pub('MLA1');
    await expect(decide(p.id, 260_000, { discountPct: 3 })).rejects.toThrow('Mercado Libre acepta descuentos de 5 a 80 %, o sin descuento.');
    items.MLA1.dealRejected = 'The seller reputation is not green';
    await decide(p.id, 260_000, { discountPct: 10 });
    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    expect(result.sent).toEqual(['price']);
    expect(result.rejected).toEqual([{ field: 'discount', message: 'Mercado Libre no aceptó el descuento: The seller reputation is not green' }]);
    expect((await state('MLA1')).rejected).toHaveLength(1);
  });

  it('antes de que venza, el descuento se renueva solo y queda en el Registro', async () => {
    const { p } = await uploadDiscount();
    const soon = new Date(Date.now() + 12 * 3600_000);
    await db.channelCopy.update({ where: { publicationId: p.id }, data: { discountUntil: soon } });
    expect(await renewDiscounts(db, { budgetMs: 10_000 })).toEqual({ renewed: 1, failed: 0, pending: false });
    // El que estaba se saca y se vuelve a poner.
    expect(promoWrites()).toEqual(['DELETE', 'POST 234000']);
    const copy = (await pub('MLA1')).channelCopy!;
    expect(copy.discountUntil!.getTime()).toBeGreaterThan(soon.getTime() + 10 * 86_400_000);
    expect(await db.channelSyncChange.findFirst({ where: { publicationId: p.id, kind: 'RENEWED' } })).toMatchObject({ field: 'discount', before: '10', after: '10', userId: null });
    // Lo que no está por vencer no se toca.
    writes.length = 0;
    expect(await renewDiscounts(db, { budgetMs: 10_000 })).toEqual({ renewed: 0, failed: 0, pending: false });
    expect(writes).toEqual([]);
  });

  it('no se renueva solo un descuento que se cambió en la app después de subirlo', async () => {
    const { p } = await uploadDiscount();
    await decide(p.id, 260_000, { discountPct: 11, plan: 3 });
    await db.channelCopy.update({ where: { publicationId: p.id }, data: { discountUntil: new Date(Date.now() + 3600_000) } });
    expect(await renewDiscounts(db, { budgetMs: 10_000 })).toEqual({ renewed: 0, failed: 0, pending: false });
    expect(writes).toEqual([]);
    expect((await state('MLA1')).draft).toEqual(['discount']);
  });

  it('un descuento vencido no se pierde: queda para subir y se renueva solo', async () => {
    const { p } = await uploadDiscount();
    items.MLA1.deal = null;
    await db.channelCopy.update({ where: { publicationId: p.id }, data: { discountUntil: new Date(Date.now() - 3600_000) } });
    expect(await readOne(db, { accountId, publicationId: p.id })).not.toContain('discount');
    expect(Number((await pub('MLA1')).discount)).toBe(10);
    expect((await state('MLA1')).draft).toEqual(['discount']);
    expect((await renewDiscounts(db, { budgetMs: 10_000 })).renewed).toBe(1);
    expect(promoWrites()).toEqual(['POST 234000']);
    expect(await state('MLA1')).toEqual({ draft: [], choose: [], rejected: [] });
  });

  it('recién subido, si el canal todavía no lo muestra se espera; si después lo sacan allá, la app lo toma', async () => {
    items.MLA1.dealLater = true;
    const { p, result } = await uploadDiscount();
    expect(result.sent).toEqual(['price', 'installments', 'discount']);
    expect(Number((await pub('MLA1')).discount)).toBe(10);
    expect(await state('MLA1')).toEqual({ draft: [], choose: [], rejected: [] });
    // Pasó más de una hora y el canal sigue sin descuento: alguien lo sacó allá.
    await db.channelCopy.update({ where: { publicationId: p.id }, data: { discountSentAt: new Date(Date.now() - 2 * 3600_000) } });
    expect(await readOne(db, { accountId, publicationId: p.id })).toContain('discount');
    const after = await pub('MLA1');
    expect(Number(after.discount)).toBe(0);
    expect(after.channelCopy!.discountUntil).toBeNull();
  });

  // ───────────────────────────── Cantidad ─────────────────────────────

  const clean = { draft: [], choose: [], rejected: [] };

  it('la cantidad sigue a la del canal; cambiada en la app queda para subir y se sube', async () => {
    const p = await pub('MLA1');
    expect(p.channelCopy!.quantity).toBe(5);
    expect(p.quantities).toBeNull();
    // Una venta en el canal: la app la sigue, sin nada para subir ni anotar.
    items.MLA1.quantity = 4;
    items.MLA1.last_updated = new Date().toISOString();
    await readOne(db, { accountId, publicationId: p.id });
    expect(await state('MLA1')).toEqual(clean);
    expect(await db.channelSyncChange.count({ where: { publicationId: p.id, field: 'quantity' } })).toBe(0);

    expect(await saveQuantities(db, { accountId, publicationIds: [p.id], change: { all: 9 } })).toEqual({ saved: [p.id], skipped: [] });
    expect((await state('MLA1')).draft).toEqual(['quantity']);
    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    expect(result).toEqual({ sent: ['quantity'], rejected: [], confirmed: true });
    expect(writes.map((w) => w.body)).toEqual([{ available_quantity: 9 }]);
    expect(await state('MLA1')).toEqual(clean);
    const after = await pub('MLA1');
    // Ya está en el canal: la app vuelve a seguirlo.
    expect(after.quantities).toBeNull();
    expect(after.channelCopy!.quantity).toBe(9);
    expect(await db.channelSyncChange.findFirst({ where: { publicationId: p.id, kind: 'SENT', field: 'quantity' } })).toMatchObject({
      before: [{ key: '', label: '', quantity: 4 }],
      after: [{ key: '', label: '', quantity: 9 }],
    });
    // Poner lo mismo que ya está en el canal no deja nada para subir.
    await saveQuantities(db, { accountId, publicationIds: [p.id], change: { all: 9 } });
    expect(await state('MLA1')).toEqual(clean);
  });

  it('con medidas, cada una lleva la suya; si se vende mientras tanto, hay que elegir', async () => {
    items.MLA2.variations = [
      { id: 11, price: 100, quantity: 3, measure: 'STD' },
      { id: 12, price: 100, quantity: 2, measure: '0.50' },
    ];
    items.MLA2.last_updated = new Date().toISOString();
    const p = await pub('MLA2');
    await readOne(db, { accountId, publicationId: p.id });
    expect((await pub('MLA2')).channelCopy!.quantity).toBe(5);
    await saveQuantities(db, { accountId, publicationIds: [p.id], change: { byKey: { 'medida:std': 6 } } });
    writes.length = 0;
    expect((await pushDrafts(db, { accountId, publicationId: p.id, userId: null })).sent).toEqual(['quantity']);
    // Van todas las medidas, porque Mercado Libre borra las que faltan: la otra, con la que ya tenía.
    expect(writes.map((w) => w.body)).toEqual([{ variations: [{ id: 11, available_quantity: 6 }, { id: 12, available_quantity: 2 }] }]);
    expect(items.MLA2.variations.map((v) => v.quantity)).toEqual([6, 2]);

    await saveQuantities(db, { accountId, publicationIds: [p.id], change: { byKey: { 'medida:0.50': 0 } } });
    items.MLA2.variations[0].quantity = 5;
    items.MLA2.last_updated = new Date().toISOString();
    await readOne(db, { accountId, publicationId: p.id });
    expect((await state('MLA2')).choose).toEqual(['quantity']);
  });

  it('si el canal maneja el stock, como en Full, no se cambia desde la app', async () => {
    items.MLA3.full = true;
    items.MLA3.last_updated = new Date().toISOString();
    const p = await pub('MLA3');
    await readOne(db, { accountId, publicationId: p.id });
    const r = await saveQuantities(db, { accountId, publicationIds: [p.id], change: { all: 3 } });
    expect(r.saved).toEqual([]);
    expect(r.skipped[0].reason).toContain('Full');
  });

  it('debajo del margen mínimo hay que confirmarlo; sin precio guardado igual se avanza a Publicación', async () => {
    const p = await pub('MLA1');
    await expect(decide(p.id, 150_000)).rejects.toThrow(/debajo del mínimo/);
    await expect(decide(p.id, 150_000, { plan: 9, overrides: { installments9Pct: null } })).rejects.toThrow(/costo de 9 cuotas/);
    await decide(p.id, 150_000, { confirmBelowMin: true });
    expect(await db.priceDecision.findFirst({ where: { publicationId: p.id } })).toMatchObject({ belowMinConfirmed: true });

    // Los pasos son una guía: lo que falta lo avisa Publicación.
    const q = await pub('MLA2');
    await db.publication.update({ where: { id: q.id }, data: { pipelineStatus: 'IN_PIPELINE', pipelineStep: 'PRICE' } });
    await db.pipelineMovement.create({ data: { publicationId: q.id, step: 'PRICE' } });
    expect(await db.$transaction((tx) => advanceStep(tx, { publicationId: q.id, expected: 'PRICE', userId: null }))).toEqual({ step: 'PUBLISH' });
  });
});
