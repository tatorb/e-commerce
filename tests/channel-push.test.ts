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
import { readPromotions } from '@/lib/channel-promotions';
import { cancelCampaign, queueCampaign, sendCampaignNow } from '@/lib/channel-campaigns';
import { formatPrice } from '@/domain/money';
import { saveQuantities } from '@/lib/quantities';
import { advanceStep } from '@/domain/pipeline';
import { resetVisitsTogether } from '@/channels/mercadolibre/listings';
import type { McpContext } from '@/lib/mcp/tool';

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
  // El canal dice que tiene un descuento que ya no está: al sacarlo, no lo encuentra.
  dealStale?: boolean;
  // El precio con descuento más alto que acepta; si no, el 95 % del precio.
  dealMaxPrice?: number;
  // Las campañas que informa, tal cual las manda.
  campaigns?: Record<string, unknown>[];
  // Lo que dice cada campaña de esta publicación: el rango de precio o el código de la oferta.
  campaignDetails?: Record<string, Record<string, unknown>>;
  // El canal no acepta sumarla a una campaña: el motivo.
  campaignRejected?: string;
  // El canal acepta sumarla pero todavía no lo muestra.
  campaignLater?: boolean;
  // El canal no acepta la descripción: el motivo.
  descriptionRejected?: string;
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
  // Los cambios con su dirección completa, para ver lo que va en la consulta.
  const urls: string[] = [];
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
      if (req.method === 'PUT' || req.method === 'POST' || req.method === 'DELETE') {
        writes.push({ method: req.method, path: u.pathname, body });
        urls.push(`${req.method} ${u.pathname}${u.search}`);
      }

      // Lo que dice una campaña de una publicación.
      const campaignItems = u.pathname.match(/^\/seller-promotions\/promotions\/([\w-]+)\/items$/);
      if (campaignItems) {
        const it = items[u.searchParams.get('item_id') ?? ''];
        const detail = it?.campaignDetails?.[campaignItems[1]];
        return json(200, { results: detail ? [detail] : [], paging: {} });
      }

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
        if (req.method === 'GET') {
          // Como en Mercado Libre: a la que se le puede poner un descuento, figura como candidata.
          const price = it.price ?? 100;
          const candidate = {
            type: 'PRICE_DISCOUNT',
            status: 'candidate',
            price: 0,
            original_price: price,
            min_discounted_price: Math.round(price * 0.2),
            max_discounted_price: it.dealMaxPrice ?? Math.round(price * 0.95),
            suggested_discounted_price: Math.round(price * 0.88),
          };
          const own = it.deal || it.dealStale ? [{ id: 'P1', type: 'PRICE_DISCOUNT', status: 'started', price: it.deal?.price ?? 0, original_price: price }] : [];
          return json(200, [candidate, ...own, ...(it.campaigns ?? [])]);
        }
        // Una campaña: sumarse o salir.
        const campaignId = req.method === 'DELETE' ? u.searchParams.get('promotion_id') : body?.promotion_id;
        if (campaignId) {
          const entry = (it.campaigns ?? []).find((c) => c.id === campaignId);
          if (req.method === 'DELETE') {
            if (!entry || entry.status === 'candidate') return json(400, { message: 'No offers found for item', cause: [] });
            it.campaigns = it.campaigns!.filter((c) => c !== entry);
            return json(200, {});
          }
          if (!entry || entry.status !== 'candidate') return json(400, { message: 'Item is not a candidate', cause: [] });
          if (it.campaignRejected) return json(400, { message: it.campaignRejected, cause: [] });
          if (it.campaignLater) return json(201, { price: body.deal_price });
          entry.status = 'started';
          entry.ref_id = `OFFER-${promo[1]}-1`;
          if (body.deal_price) entry.price = body.deal_price;
          return json(201, { price: entry.price });
        }
        if (req.method === 'DELETE') {
          if (!it.deal) return json(400, { message: 'No offers found for item', error: 'bad_request', status: 400, cause: [] });
          it.deal = null;
          return json(200, {});
        }
        if (it.dealRejected) return json(400, { message: it.dealRejected, cause: [] });
        if (it.dealMaxPrice && body.deal_price > it.dealMaxPrice) {
          return json(400, {
            message: 'Errors: ERROR_CREDIBILITY_DISCOUNTED_PRICE - The discounted price is not credible.',
            error: 'bad_request',
            status: 400,
            cause: [{ error_code: 'ERROR_CREDIBILITY_DISCOUNTED_PRICE', error_message: 'The discounted price is not credible.' }],
          });
        }
        if (it.deal) return json(400, { message: 'Item already has a PRICE_DISCOUNT' });
        if (!(body.deal_price < (it.price ?? 100))) return json(400, { message: 'deal_price must be lower than price' });
        if (!it.dealLater) it.deal = { price: body.deal_price, finish: body.finish_date };
        return json(201, {});
      }
      const desc = u.pathname.match(/^\/items\/(\w+)\/description$/);
      if (desc && req.method === 'PUT') {
        const it = items[desc[1]];
        if (it?.descriptionRejected) return json(400, { message: 'validation_error', cause: [{ message: it.descriptionRejected }] });
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
    urls.length = 0;
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
    expect(result).toEqual({ sent: ['title', 'description'], rejected: [], confirmed: true, campaigns: [] });
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
    expect(result).toEqual({ sent: ['attributes'], rejected: [], confirmed: true, campaigns: [] });
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

  /** Decide el precio, con el costo cargado en el producto. */
  async function decide(publicationId: string, listPrice: number, extra: Partial<Parameters<typeof savePriceDecision>[1]> = {}) {
    const { productId: id } = await db.publication.findUniqueOrThrow({ where: { id: publicationId }, select: { productId: true } });
    await db.product.update({ where: { id }, data: { replacementCost: 100_000 } });
    return savePriceDecision(db, { accountId, publicationId, userId: null, listPrice, discountPct: 0, plan: 0, overrides: {}, confirmBelowMin: false, ...extra });
  }

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
    // Con el costo del producto.
    expect(Number((await db.priceDecision.findFirstOrThrow({ where: { publicationId: p.id } })).cost)).toBe(100_000);

    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    expect(result).toEqual({ sent: ['price'], rejected: [], confirmed: true, campaigns: [] });
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
    expect(result).toEqual({ sent: ['price', 'installments', 'discount'], rejected: [], confirmed: true, campaigns: [] });
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

  it('un descuento candidato no se toma como puesto, y si al sacarlo ya no está, se pone el nuevo igual', async () => {
    // Sin descuento: el canal la muestra como candidata y no hay nada que sacar.
    const { p } = await uploadDiscount();
    expect((await pub('MLA1')).channelCopy!.discountUntil).not.toBeNull();
    // El canal dice que tiene uno, pero al sacarlo no lo encuentra.
    items.MLA1.deal = null;
    items.MLA1.dealStale = true;
    await decide(p.id, 260_000, { discountPct: 8, plan: 3 });
    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    expect(result).toMatchObject({ sent: ['discount'], rejected: [] });
    expect(promoWrites()).toEqual(['DELETE', 'POST 239200']);
    expect(await state('MLA1')).toEqual({ draft: [], choose: [], rejected: [] });
  });

  it('lee lo que acepta el canal para el descuento y, si lo rechaza por chico, dice hasta qué precio acepta', async () => {
    const p = await pub('MLA1');
    const nueva = await db.publication.create({ data: { productId, storeId, title: 'Sin publicar', attributes: [], price: 99_000 } });
    items.MLA1.dealMaxPrice = 240_000;
    items.MLA1.campaigns = [
      { id: 'P-MLA9', type: 'DEAL', status: 'candidate', price: 0, original_price: 100, name: 'Hot Sale', finish_date: '2026-11-10T23:59:59-03:00' },
      { id: 'P-MLA8', type: 'SMART', status: 'started', price: 90, original_price: 100, meli_percentage: 4, seller_percentage: 6 },
    ];
    const r = await readPromotions(db, { accountId, publicationIds: [p.id, nueva.id] });
    if (!r.ok) throw new Error(r.error);
    expect(r.unpublished).toBe(1);
    expect(r.read).toHaveLength(1);
    expect(r.read[0]).toMatchObject({ publicationId: p.id, externalId: 'MLA1', promotions: { listPrice: 100, discount: { minPrice: 20, maxPrice: 240_000, suggestedPrice: 88 }, current: null } });
    expect(r.read[0].promotions.campaigns.map((c) => [c.kind, c.status])).toEqual([
      ['Co-fondeada automática', 'active'],
      ['Campaña tradicional', 'invited'],
    ]);
    // No es de la cuenta.
    expect(await readPromotions(db, { accountId, publicationIds: ['otra'] })).toEqual({ ok: false, error: 'La publicación no es de esta cuenta.' });
    // Claude lo ve igual en el paso Precio.
    process.env.DATABASE_URL ??= url;
    const { PRICE_TOOLS } = await import('@/lib/mcp/price-tools');
    const tool = PRICE_TOOLS.find((t) => t.name === 'get_price_step')!;
    await db.user.create({ data: { id: 'u2', name: 'Persona', email: 'persona2@example.com' } });
    const ctx: McpContext = { db, userId: 'u2', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step: any = await tool.run(ctx, tool.input.parse({ cuenta: 'prueba', publicacion: p.id }));
    expect(step.pestanas[0].lo_que_acepta_el_canal).toMatchObject({
      descuento_propio: { se_puede: true, precio_con_descuento_desde: 20, precio_con_descuento_hasta: 240_000 },
      campanas: [
        expect.objectContaining({ publicacion: 'MLA1', tipo: 'Co-fondeada automática', estado: 'esta_adentro', pone_el_canal_pct: 4 }),
        expect.objectContaining({ nombre: 'Hot Sale', estado: 'la_invitan', hasta: '2026-11-11T02:59:59.000Z' }),
      ],
    });
    // Solo lee: no cambia nada en el canal.
    expect(writes).toEqual([]);

    // Con 5 % el comprador pagaría 247.000: lo rechaza, con el máximo en el motivo.
    await decide(p.id, 260_000, { discountPct: 5, plan: 3 });
    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    expect(result.sent).toEqual(['price', 'installments']);
    expect(result.rejected).toEqual([
      {
        field: 'discount',
        message: `Mercado Libre no acepta este descuento porque le parece chico para los precios que tuvo la publicación. El precio con descuento tiene que ser de ${formatPrice(240_000)} o menos.`,
      },
    ]);
  });

  // ───────────────────────────── Campañas ─────────────────────────────

  /** Por subir de la cuenta. Su módulo se conecta a la base al cargarse: se carga con la de prueba. */
  async function listToPush(id: string, base: PrismaClient) {
    process.env.DATABASE_URL ??= url;
    return (await import('@/lib/queries/sync')).listToPush(id, base);
  }

  /** Una invitación a una tradicional, una a una co-fondeada automática, una en la que está y una que se maneja en el canal. */
  function withCampaigns() {
    items.MLA1.campaigns = [
      { id: 'P-DEAL', type: 'DEAL', status: 'candidate', price: 0, original_price: 100, name: 'Semana del repuesto' },
      { id: 'P-SMART', type: 'SMART', status: 'candidate', price: 80, original_price: 100, meli_percentage: 5, seller_percentage: 15, name: 'Compartida' },
      { id: 'P-SMART2', type: 'SMART', status: 'started', ref_id: 'OFFER-MLA1-9', price: 85, original_price: 100, meli_percentage: 5, seller_percentage: 10, name: 'Compartida vieja' },
      { id: 'P-VOL', type: 'VOLUME', status: 'candidate', price: 0, name: '3x2' },
    ];
    items.MLA1.campaignDetails = {
      'P-DEAL': { id: 'MLA1', status: 'candidate', price: 0, original_price: 100, min_discounted_price: 50, max_discounted_price: 90, suggested_discounted_price: 85 },
      'P-SMART': { id: 'MLA1', status: 'candidate', offer_id: 'CANDIDATE-MLA1-7', price: 80, original_price: 100, meli_percentage: 5, seller_percentage: 15 },
    };
  }

  it('lee cómo sumarse a cada campaña: eligiendo el precio, aceptando, o solo desde el canal', async () => {
    const p = await pub('MLA1');
    withCampaigns();
    const r = await readPromotions(db, { accountId, publicationIds: [p.id] });
    if (!r.ok) throw new Error(r.error);
    const byName = Object.fromEntries(r.read[0].promotions.campaigns.map((c) => [c.name, c]));
    expect(byName['Semana del repuesto']).toMatchObject({ status: 'invited', join: 'price', canLeave: false, pausesOwnDiscount: true, range: { minPrice: 50, maxPrice: 90, suggestedPrice: 85 } });
    expect(byName['Compartida']).toMatchObject({ status: 'invited', join: 'accept', range: null, channelPct: 5, sellerPct: 15 });
    expect(byName['Compartida vieja']).toMatchObject({ status: 'active', join: null, canLeave: true });
    expect(byName['3x2']).toMatchObject({ join: null, canLeave: false });
    // La co-fondeada guarda el código de la oferta para sumarse.
    expect(byName['Compartida'].ref).toContain('CANDIDATE-MLA1-7');
    expect(r.pending).toEqual([]);
    // Solo lee.
    expect(writes).toEqual([]);
  });

  it('desde el Pipeline, sumarse y salir quedan en Por subir y se mandan con los demás cambios', async () => {
    const p = await pub('MLA1');
    withCampaigns();
    const read = await readPromotions(db, { accountId, publicationIds: [p.id] });
    if (!read.ok) throw new Error(read.error);
    const ref = (name: string) => read.read[0].promotions.campaigns.find((c) => c.name === name)!.ref!;
    await db.user.create({ data: { id: 'u3', name: 'Persona', email: 'persona3@example.com' } });
    await queueCampaign(db, { accountId, publicationId: p.id, userId: 'u3', choice: { action: 'join', ref: ref('Semana del repuesto'), name: 'Semana del repuesto', kind: 'Campaña tradicional', price: 85 } });
    await queueCampaign(db, { accountId, publicationId: p.id, userId: 'u3', choice: { action: 'join', ref: ref('Compartida'), name: 'Compartida', kind: 'Co-fondeada automática', price: null } });
    await queueCampaign(db, { accountId, publicationId: p.id, userId: 'u3', choice: { action: 'leave', ref: ref('Compartida vieja'), name: 'Compartida vieja', kind: 'Co-fondeada automática', price: null } });
    // Nada llegó al canal todavía.
    expect(writes).toEqual([]);
    const row = (await listToPush(accountId, db)).find((x) => x.id === p.id)!;
    expect(row.draft).toEqual([]);
    expect(row.campaigns.map((c) => c.text)).toEqual([
      `Sumarse a Semana del repuesto (Campaña tradicional), el comprador paga ${formatPrice(85)}`,
      'Sumarse a Compartida (Co-fondeada automática)',
      'Salir de Compartida vieja (Co-fondeada automática)',
    ]);

    // Se suben con el botón de Por subir.
    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: 'u3' });
    expect(result.campaigns).toEqual([
      { ref: ref('Semana del repuesto'), name: 'Semana del repuesto', kind: 'Campaña tradicional', action: 'join', price: 85, ok: true },
      { ref: ref('Compartida'), name: 'Compartida', kind: 'Co-fondeada automática', action: 'join', price: null, ok: true },
      { ref: ref('Compartida vieja'), name: 'Compartida vieja', kind: 'Co-fondeada automática', action: 'leave', price: null, ok: true },
    ]);
    expect(writes.map((w) => w.body)).toEqual([{ promotion_id: 'P-DEAL', promotion_type: 'DEAL', deal_price: 85 }, { promotion_id: 'P-SMART', promotion_type: 'SMART', offer_id: 'CANDIDATE-MLA1-7' }, null]);
    expect(urls[2]).toBe('DELETE /seller-promotions/items/MLA1?promotion_type=SMART&promotion_id=P-SMART2&offer_id=OFFER-MLA1-9&app_version=v2');
    expect(await db.campaignRequest.count()).toBe(0);
    // En el Registro, a nombre de la persona.
    const logged = await db.channelSyncChange.findMany({ where: { publicationId: p.id, field: 'campaign' }, orderBy: { id: 'asc' } });
    expect(logged.map((c) => [c.kind, c.after, c.userId])).toEqual([
      ['SENT', `Sumarse a Semana del repuesto (Campaña tradicional), el comprador paga ${formatPrice(85)}`, 'u3'],
      ['SENT', 'Sumarse a Compartida (Co-fondeada automática)', 'u3'],
      ['SENT', 'Salir de Compartida vieja (Co-fondeada automática)', 'u3'],
    ]);
    expect((await listToPush(accountId, db)).find((x) => x.id === p.id)).toBeUndefined();
  });

  it('si el canal no acepta sumarla, el pedido queda en Por subir con el motivo; se puede sacar sin mandarlo', async () => {
    const p = await pub('MLA1');
    withCampaigns();
    items.MLA1.campaignRejected = 'The seller reputation is not green';
    const read = await readPromotions(db, { accountId, publicationIds: [p.id] });
    if (!read.ok) throw new Error(read.error);
    const c = read.read[0].promotions.campaigns.find((x) => x.name === 'Compartida')!;
    const queued = await queueCampaign(db, { accountId, publicationId: p.id, userId: null, choice: { action: 'join', ref: c.ref!, name: 'Compartida', kind: c.kind, price: null } });
    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    // Con la respuesta completa del canal, para entender rechazos que no se conocen.
    const rejection = 'Mercado Libre no aceptó la campaña: The seller reputation is not green Respuesta completa: {"message":"The seller reputation is not green","cause":[]}';
    expect(result.campaigns).toEqual([expect.objectContaining({ name: 'Compartida', action: 'join', ok: false, message: rejection })]);
    const row = (await listToPush(accountId, db)).find((x) => x.id === p.id)!;
    expect(row.campaigns).toEqual([{ text: 'Sumarse a Compartida (Co-fondeada automática)', rejection }]);
    expect(await db.channelSyncChange.findFirst({ where: { publicationId: p.id, field: 'campaign' } })).toMatchObject({ kind: 'REJECTED' });
    await cancelCampaign(db, { accountId, requestId: queued.id });
    expect(await db.campaignRequest.count()).toBe(0);
    await expect(cancelCampaign(db, { accountId, requestId: queued.id })).rejects.toThrow('ya no está en Por subir');
  });

  it('desde la página de la publicación se manda en el momento', async () => {
    const p = await pub('MLA1');
    withCampaigns();
    const read = await readPromotions(db, { accountId, publicationIds: [p.id] });
    if (!read.ok) throw new Error(read.error);
    const deal = read.read[0].promotions.campaigns.find((x) => x.name === 'Semana del repuesto')!;
    // Lo que había quedado pedido para esa campaña deja de estarlo.
    await queueCampaign(db, { accountId, publicationId: p.id, userId: null, choice: { action: 'join', ref: deal.ref!, name: 'Semana del repuesto', kind: deal.kind, price: 80 } });
    const r = await sendCampaignNow(db, { accountId, publicationId: p.id, userId: null, choice: { action: 'join', ref: deal.ref!, name: 'Semana del repuesto', kind: deal.kind, price: 88 } });
    expect(r).toEqual({ ok: true });
    expect(writes.map((w) => w.body)).toEqual([{ promotion_id: 'P-DEAL', promotion_type: 'DEAL', deal_price: 88 }]);
    expect(await db.campaignRequest.count()).toBe(0);
    // Ahora está adentro: se puede salir.
    const again = await readPromotions(db, { accountId, publicationIds: [p.id] });
    if (!again.ok) throw new Error(again.error);
    expect(again.read[0].promotions.campaigns.find((x) => x.name === 'Semana del repuesto')).toMatchObject({ status: 'active', canLeave: true, price: 88 });
    // Un rechazo vuelve con su motivo y queda en el Registro.
    items.MLA1.campaignRejected = 'Campaign finished';
    const smart = again.read[0].promotions.campaigns.find((x) => x.name === 'Compartida')!;
    expect(await sendCampaignNow(db, { accountId, publicationId: p.id, userId: null, choice: { action: 'join', ref: smart.ref!, name: 'Compartida', kind: smart.kind, price: null } })).toEqual({
      ok: false,
      error: expect.stringContaining('Mercado Libre no aceptó la campaña: Campaign finished'),
    });
    expect(await db.channelSyncChange.count({ where: { publicationId: p.id, field: 'campaign', kind: 'REJECTED' } })).toBe(1);
  });

  it('Claude ve cómo sumarse, deja pedido sumarse con un precio que entre y push_prices lo manda', async () => {
    process.env.DATABASE_URL ??= url;
    const { PRICE_TOOLS } = await import('@/lib/mcp/price-tools');
    const tool = (name: string) => PRICE_TOOLS.find((t) => t.name === name)!;
    await db.user.create({ data: { id: 'u4', name: 'Persona', email: 'persona4@example.com' } });
    const ctx: McpContext = { db, userId: 'u4', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = async (name: string, args: Record<string, unknown>): Promise<any> => tool(name).run(ctx, tool(name).input.parse(args));
    expect(tool('choose_campaign')).toMatchObject({ section: 'pipeline', readOnly: false, destructive: false });
    const p = await pub('MLA1');
    withCampaigns();
    const step = await run('get_price_step', { cuenta: 'prueba', publicacion: p.id });
    const campaigns = step.pestanas[0].lo_que_acepta_el_canal.campanas;
    const deal = campaigns.find((c: { nombre: string }) => c.nombre === 'Semana del repuesto');
    expect(deal).toMatchObject({ estado: 'la_invitan', como_sumarse: 'eligiendo_el_precio', precio_que_acepta: { desde: 50, hasta: 90, sugerido: 85 }, frena_el_descuento_propio: true });
    expect(campaigns.find((c: { nombre: string }) => c.nombre === '3x2')).toMatchObject({ como_sumarse: 'desde_el_canal' });
    expect(campaigns.find((c: { nombre: string }) => c.nombre === 'Compartida vieja')).toMatchObject({ estado: 'esta_adentro', se_puede_salir: true });

    // Un precio fuera de lo que acepta no queda pedido.
    await expect(run('choose_campaign', { cuenta: 'prueba', publicacion: p.id, campana: deal.campana, accion: 'sumarse', precio: 95 })).rejects.toThrow('Es más alto de lo que acepta el canal.');
    await expect(run('choose_campaign', { cuenta: 'prueba', publicacion: p.id, campana: 'otra', accion: 'sumarse' })).rejects.toThrow('ya no aparece');
    const chosen = await run('choose_campaign', { cuenta: 'prueba', publicacion: p.id, campana: deal.campana, accion: 'sumarse', precio: 85 });
    expect(chosen).toMatchObject({ en_por_subir: `Sumarse a Semana del repuesto (Campaña tradicional), el comprador paga ${formatPrice(85)}`, aviso: expect.stringContaining('frena el descuento propio') });
    expect(writes).toEqual([]);
    // get_price_step lo muestra pedido.
    const after = await run('get_price_step', { cuenta: 'prueba', publicacion: p.id });
    expect(after.pestanas[0].lo_que_acepta_el_canal.campanas.find((c: { nombre: string }) => c.nombre === 'Semana del repuesto').en_por_subir).toContain('Sumarse');

    // push_prices lo manda, aunque no haya precio por subir, y vuelve a consultar al canal: ya está adentro.
    const pushed = await run('push_prices', { cuenta: 'prueba' });
    expect(pushed.subidas).toEqual([
      expect.objectContaining({
        publicacion: 'MLA1',
        se_mando: { campanas: [`Sumarse a Semana del repuesto (Campaña tradicional), el comprador paga ${formatPrice(85)}`] },
        resultado: 'subido',
        subio: [],
        campanas: [{ campana: 'Semana del repuesto', accion: 'sumarse', resultado: 'hecho', estado_en_el_canal: 'activa' }],
        confirmado_en_el_canal: true,
      }),
    ]);
    expect(pushed.subidas[0].aviso).toBeUndefined();
    expect(writes.map((w) => w.body)).toEqual([{ promotion_id: 'P-DEAL', promotion_type: 'DEAL', deal_price: 85 }]);
  });

  it('Claude: si el canal acepta la campaña pero todavía no la muestra, queda pendiente; el tope con centavos entra redondeado para abajo', async () => {
    process.env.DATABASE_URL ??= url;
    const { PRICE_TOOLS } = await import('@/lib/mcp/price-tools');
    const tool = (name: string) => PRICE_TOOLS.find((t) => t.name === name)!;
    await db.user.create({ data: { id: 'u6', name: 'Persona', email: 'persona6@example.com' } });
    const ctx: McpContext = { db, userId: 'u6', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = async (name: string, args: Record<string, unknown>): Promise<any> => tool(name).run(ctx, tool(name).input.parse(args));
    const p = await pub('MLA1');
    withCampaigns();
    // El canal informa el tope con centavos: el precio con los mismos centavos entra, redondeado para abajo.
    items.MLA1.campaignDetails!['P-DEAL'].max_discounted_price = 90.56;
    items.MLA1.campaignLater = true;
    const step = await run('get_price_step', { cuenta: 'prueba', publicacion: p.id });
    const deal = step.pestanas[0].lo_que_acepta_el_canal.campanas.find((c: { nombre: string }) => c.nombre === 'Semana del repuesto');
    const chosen = await run('choose_campaign', { cuenta: 'prueba', publicacion: p.id, campana: deal.campana, accion: 'sumarse', precio: 90.56 });
    expect(chosen.en_por_subir).toContain(formatPrice(90));
    const pushed = await run('push_prices', { cuenta: 'prueba' });
    expect(pushed.subidas[0]).toMatchObject({
      resultado: 'subido',
      campanas: [{ campana: 'Semana del repuesto', accion: 'sumarse', resultado: 'hecho', estado_en_el_canal: 'pendiente' }],
      confirmado_en_el_canal: false,
      aviso: expect.stringContaining('todavía no lo muestra'),
    });
    expect(writes.map((w) => w.body)).toEqual([{ promotion_id: 'P-DEAL', promotion_type: 'DEAL', deal_price: 90 }]);
    expect(await db.campaignRequest.count()).toBe(0);
  });

  it('si la campaña pedida frena el descuento propio, el descuento no se manda y queda avisado', async () => {
    const p = await pub('MLA1');
    withCampaigns();
    const read = await readPromotions(db, { accountId, publicationIds: [p.id] });
    if (!read.ok) throw new Error(read.error);
    const deal = read.read[0].promotions.campaigns.find((x) => x.name === 'Semana del repuesto')!;
    await decide(p.id, 260_000, { discountPct: 5, plan: 3 });
    await queueCampaign(db, { accountId, publicationId: p.id, userId: null, choice: { action: 'join', ref: deal.ref!, name: 'Semana del repuesto', kind: deal.kind, price: 85, pausesOwnDiscount: deal.pausesOwnDiscount } });
    writes.length = 0;
    const result = await pushDrafts(db, { accountId, publicationId: p.id, userId: null });
    expect(result.sent).toEqual(['price', 'installments']);
    expect(result.rejected).toEqual([{ field: 'discount', message: expect.stringContaining('No se subió el descuento del 5 %: la campaña Semana del repuesto lo frena') }]);
    expect(result.campaigns).toEqual([expect.objectContaining({ name: 'Semana del repuesto', ok: true })]);
    // El descuento no llegó al canal; la campaña sí.
    expect(writes.filter((w) => (w.body as { promotion_type?: string } | null)?.promotion_type === 'PRICE_DISCOUNT')).toEqual([]);
    expect(writes.map((w) => w.body)).toContainEqual({ promotion_id: 'P-DEAL', promotion_type: 'DEAL', deal_price: 85 });
  });

  // ───────────────────────────── Desde Claude ─────────────────────────────

  it('Claude sube solo el precio, las cuotas y el descuento de Por subir; un descuento rechazado no corta el resto', async () => {
    process.env.DATABASE_URL ??= url;
    const { PRICE_TOOLS } = await import('@/lib/mcp/price-tools');
    const tool = PRICE_TOOLS.find((t) => t.name === 'push_prices')!;
    expect(tool).toMatchObject({ section: 'subir', readOnly: false, destructive: true });
    await db.user.create({ data: { id: 'u1', name: 'Persona', email: 'persona@example.com' } });
    const ctx: McpContext = { db, userId: 'u1', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = async (args: Record<string, unknown>): Promise<any> => tool.run(ctx, tool.input.parse(args));

    // MLA1: precio, 3 cuotas y 10 % de descuento, que el canal rechaza.
    const p1 = await pub('MLA1');
    items.MLA1.dealRejected = 'The seller reputation is not green';
    await decide(p1.id, 260_000, { discountPct: 10, plan: 3 });
    // MLA2: el precio, y un título nuevo en el borrador, que no es del precio.
    const p2 = await pub('MLA2');
    await decide(p2.id, 280_000);
    await saveDraft(db, { accountId, publicationId: p2.id, field: 'title', value: 'Bomba de Agua Fiat Uno' });
    // Una que todavía no está publicada.
    const nueva = await db.publication.create({ data: { productId, storeId, title: 'Bomba nueva', attributes: [], price: 99_000 } });
    writes.length = 0;

    // Por id de la app (los códigos de prueba son más cortos que los del canal) y uno que no está en la cuenta.
    const p3 = await pub('MLA3');
    const r = await run({ cuenta: 'prueba', publicaciones: [p1.id, p2.id, p3.id, nueva.id, 'MLA999999999'] });
    expect(r.subidas).toEqual([
      {
        publicacion: 'MLA1',
        titulo: 'Kit Embrague Ford Ka',
        se_mando: { precio: 260_000, cuotas: '3', descuento_pct: 10 },
        resultado: 'subido_en_parte',
        subio: ['precio', 'cuotas'],
        rechazos: [{ dato: 'descuento', motivo: 'Mercado Libre no aceptó el descuento: The seller reputation is not green' }],
        confirmado_en_el_canal: true,
      },
      { publicacion: 'MLA2', titulo: 'Bomba de Agua Fiat Uno', se_mando: { precio: 280_000 }, resultado: 'subido', subio: ['precio'], confirmado_en_el_canal: true },
    ]);
    expect(r.salteadas).toEqual([
      { publicacion: 'MLA999999999', motivo: 'La publicación MLA999999999 no está en las Publicaciones de la cuenta.' },
      { publicacion: 'MLA3', motivo: 'No tiene precio, cuotas, descuento ni campañas por subir.' },
      { publicacion: nueva.id, motivo: 'Todavía no está publicada en Mercado Libre: primero hay que crearla allá.' },
    ]);
    // El título no se subió: sigue en Por subir.
    expect(writes.some((w) => (w.body as { title?: string } | null)?.title !== undefined)).toBe(false);
    expect((await state('MLA2')).draft).toEqual(['title']);
    expect((await state('MLA1')).draft).toEqual(['discount']);
    // En el historial de cada publicación, a nombre de la persona; en la actividad, hecho por Claude.
    const changes = await db.channelSyncChange.findMany({ where: { publicationId: { in: [p1.id, p2.id] }, kind: { in: ['SENT', 'REJECTED'] } }, orderBy: { createdAt: 'asc' } });
    expect(changes.map((c) => [c.publicationId === p1.id ? 'MLA1' : 'MLA2', c.field, c.kind, c.userId])).toEqual([
      ['MLA1', 'price', 'SENT', 'u1'],
      ['MLA1', 'installments', 'SENT', 'u1'],
      ['MLA1', 'discount', 'REJECTED', 'u1'],
      ['MLA2', 'price', 'SENT', 'u1'],
    ]);
    const activity = await db.activityLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(activity.map((a) => [a.publicationId, a.summary, a.section, a.via, a.userId])).toEqual([
      [p1.id, 'Subió cambios al canal', 'subir', 'CLAUDE', 'u1'],
      [p2.id, 'Subió cambios al canal', 'subir', 'CLAUDE', 'u1'],
    ]);

    // Sin la lista: las de la cuenta con precio, cuotas o descuento por subir. MLA2 solo tiene el título.
    let again = await run({ cuenta: 'prueba' });
    expect(again.subidas).toEqual([
      expect.objectContaining({ publicacion: 'MLA1', se_mando: { descuento_pct: 10 }, resultado: 'rechazado', subio: [] }),
    ]);
    delete items.MLA1.dealRejected;
    again = await run({ cuenta: 'prueba' });
    expect(again.subidas).toEqual([expect.objectContaining({ publicacion: 'MLA1', resultado: 'subido', subio: ['descuento'] })]);
    expect(await run({ cuenta: 'prueba' })).toEqual({ subidas: [], aviso: 'No hay precios, cuotas, descuentos ni campañas por subir en la cuenta.' });
  });

  it('Claude sube solo el título de Por subir; uno bloqueado por ventas no va, y dice por qué', async () => {
    process.env.DATABASE_URL ??= url;
    const { PUSH_TOOLS } = await import('@/lib/mcp/push-tools');
    const tool = PUSH_TOOLS.find((t) => t.name === 'push_titles')!;
    expect(tool).toMatchObject({ section: 'subir', readOnly: false, destructive: true });
    await db.user.create({ data: { id: 'u7', name: 'Persona', email: 'persona7@example.com' } });
    const ctx: McpContext = { db, userId: 'u7', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = async (args: Record<string, unknown>): Promise<any> => tool.run(ctx, tool.input.parse(args));
    const [p1, p2, p3] = [await pub('MLA1'), await pub('MLA2'), await pub('MLA3')];
    await saveDraft(db, { accountId, publicationId: p1.id, field: 'title', value: 'Kit Embrague Ford Ka 1.6' });
    // Una descripción nueva, que no es del título.
    await saveDraft(db, { accountId, publicationId: p1.id, field: 'description', value: 'Kit completo con disco y placa.' });
    // Con ventas, el título está bloqueado: cambiado a mano, no sube.
    await db.publication.update({ where: { id: p3.id }, data: { title: 'Pistones Daewoo Tico' } });
    writes.length = 0;

    const r = await run({ cuenta: 'prueba', publicaciones: [p1.id, p2.id, p3.id] });
    expect(r.subidas).toEqual([
      { publicacion: 'MLA1', titulo: 'Kit Embrague Ford Ka 1.6', resultado: 'subido', confirmado_en_el_canal: true },
      { publicacion: 'MLA3', titulo: 'Pistones Daewoo Tico', resultado: 'rechazado', motivo: expect.stringContaining('bloqueado'), confirmado_en_el_canal: false },
    ]);
    expect(r.salteadas).toEqual([{ publicacion: 'MLA2', motivo: 'No tiene el título por subir.' }]);
    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual(['PUT /items/MLA1']);
    expect(items.MLA1.title).toBe('Kit Embrague Ford Ka 1.6');
    // La descripción no se subió: sigue en Por subir.
    expect((await state('MLA1')).draft).toEqual(['description']);
    expect(await run({ cuenta: 'prueba', publicaciones: [p1.id] })).toEqual({ subidas: [], salteadas: [{ publicacion: 'MLA1', motivo: 'No tiene el título por subir.' }] });
  });

  it('Claude carga la descripción y sube solo esa; en una familia, la de todas sus medidas', async () => {
    process.env.DATABASE_URL ??= url;
    const { DESCRIPTION_TOOLS } = await import('@/lib/mcp/description-tools');
    const { PUSH_TOOLS } = await import('@/lib/mcp/push-tools');
    const tool = (name: string) => [...DESCRIPTION_TOOLS, ...PUSH_TOOLS].find((t) => t.name === name)!;
    expect(tool('push_descriptions')).toMatchObject({ section: 'subir', readOnly: false, destructive: true });
    await db.user.create({ data: { id: 'u5', name: 'Persona', email: 'persona5@example.com' } });
    const ctx: McpContext = { db, userId: 'u5', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = async (name: string, args: Record<string, unknown>): Promise<any> => tool(name).run(ctx, tool(name).input.parse(args));

    // MLA1 y MLA2 son medidas de la misma familia: la descripción es una sola.
    const [p1, p2, p3] = [await pub('MLA1'), await pub('MLA2'), await pub('MLA3')];
    await db.listingFamily.create({ data: { storeId, productId, channelFamilyId: 'FAM-9', leadId: p1.id, members: { connect: [{ id: p1.id }, { id: p2.id }] } } });
    const saved = await run('save_description', { cuenta: 'prueba', descripciones: [{ publicacion: p1.id, descripcion: 'Kit completo con disco, placa y rulemán.' }] });
    expect(saved.resultados[0]).toMatchObject({ resultado: 'guardada', familia: 'Se guardó en sus 2 medidas.' });
    // Un título nuevo en el borrador, que no es de la descripción.
    await saveDraft(db, { accountId, publicationId: p1.id, field: 'title', value: 'Kit Embrague Ford Ka 1.6' });
    const nueva = await db.publication.create({ data: { productId, storeId, title: 'Kit nuevo', description: 'Kit nuevo.', attributes: [] } });
    writes.length = 0;

    // Con una sola medida de la familia van las dos.
    const r = await run('push_descriptions', { cuenta: 'prueba', publicaciones: [p1.id, p3.id, nueva.id, 'MLA999999999'] });
    expect(r.subidas).toEqual([
      { publicacion: 'MLA1', titulo: 'Kit Embrague Ford Ka 1.6', caracteres: 40, resultado: 'subida', confirmado_en_el_canal: true },
      { publicacion: 'MLA2', titulo: 'Kit Embrague Ford Ka 1.6', caracteres: 40, resultado: 'subida', confirmado_en_el_canal: true },
    ]);
    expect(r.salteadas).toEqual([
      { publicacion: 'MLA999999999', motivo: 'La publicación MLA999999999 no está en las Publicaciones de la cuenta.' },
      { publicacion: 'MLA3', motivo: 'No tiene la descripción por subir.' },
      { publicacion: nueva.id, motivo: 'Todavía no está publicada en Mercado Libre: primero hay que crearla allá.' },
    ]);
    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual(['PUT /items/MLA1/description', 'PUT /items/MLA2/description', 'POST /items/MLA2/description']);
    expect([items.MLA1.description, items.MLA2.description]).toEqual(['Kit completo con disco, placa y rulemán.', 'Kit completo con disco, placa y rulemán.']);
    // El título no se subió: sigue en Por subir.
    expect((await state('MLA1')).draft).toEqual(['title']);
    const activity = await db.activityLog.findMany({ where: { summary: 'Subió cambios al canal' }, orderBy: { createdAt: 'asc' } });
    expect(activity.map((a) => [a.publicationId, a.section, a.via, a.userId, a.detail])).toEqual([
      [p1.id, 'subir', 'CLAUDE', 'u5', 'Subió la descripción'],
      [p2.id, 'subir', 'CLAUDE', 'u5', 'Subió la descripción'],
    ]);

    // Lo que el canal rechaza vuelve con su motivo y queda en Por subir.
    items.MLA3.descriptionRejected = 'The description contains a phone number';
    await run('save_description', { cuenta: 'prueba', descripciones: [{ publicacion: p3.id, descripcion: 'Juego de 3 pistones con aros.' }] });
    const rejected = await run('push_descriptions', { cuenta: 'prueba' });
    expect(rejected.subidas).toEqual([
      expect.objectContaining({ publicacion: 'MLA3', resultado: 'rechazado', motivo: 'Mercado Libre no acepta links, mails, teléfonos ni etiquetas HTML en la descripción.' }),
    ]);
    expect((await state('MLA3')).draft).toEqual(['description']);
    delete items.MLA3.descriptionRejected;
    expect((await run('push_descriptions', { cuenta: 'prueba' })).subidas).toEqual([expect.objectContaining({ publicacion: 'MLA3', resultado: 'subida' })]);
    expect(await run('push_descriptions', { cuenta: 'prueba' })).toEqual({ subidas: [], aviso: 'No hay descripciones por subir en la cuenta.' });
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
    expect(result).toEqual({ sent: ['quantity'], rejected: [], confirmed: true, campaigns: [] });
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
