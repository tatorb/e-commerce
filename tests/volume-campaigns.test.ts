import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { campaignBody, parseCampaign, parseItem } from '@/channels/mercadolibre/volume';
import { VolumeError } from '@/channels/volume';

// Campañas de descuento por cantidad: lo que se le manda a Mercado Libre, lo
// que se lee de su respuesta y crear, sumar, sacar y borrar. Los datos son
// inventados.

const url = process.env.TEST_DATABASE_URL;

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { encrypt } = await import('@/lib/crypto');
const { changeVolumeItems, createVolumeCampaign, deleteVolumeCampaign, getVolumeCampaign, listVolumeCampaigns, rawPromotions } = await import('@/lib/volume-campaigns');

const dates = { start: '2026-11-25T00:00:00', finish: '2026-12-02T00:00:00' };

describe('campañas por cantidad sin la base', () => {
  it('arma el pedido de cada tipo como lo pide Mercado Libre', () => {
    expect(campaignBody({ name: ' 3x2 ', kind: 'lleva_paga', buyQuantity: 3, payQuantity: 2, combine: true, ...dates })).toEqual({
      promotion_type: 'VOLUME',
      sub_type: 'BNGM',
      buy_quantity: 3,
      pay_quantity: 2,
      allow_combination: true,
      name: '3x2',
      start_date: dates.start,
      finish_date: dates.finish,
    });
    expect(campaignBody({ name: 'Llevando 2', kind: 'descuento_llevando', buyQuantity: 2, discountPct: 5, combine: false, ...dates })).toMatchObject({
      sub_type: 'BNSP',
      buy_quantity: 2,
      discount_percentage: 5,
      allow_combination: false,
    });
    expect(campaignBody({ name: '2da', kind: 'descuento_en_la_unidad', buyQuantity: 2, discountPct: 50, combine: true, ...dates })).toMatchObject({ sub_type: 'SPONTH', discount_percentage: 50 });
  });

  it('no arma un pedido que no tiene sentido', () => {
    const base = { name: 'x', combine: true, ...dates };
    expect(() => campaignBody({ ...base, kind: 'lleva_paga', buyQuantity: 3, payQuantity: 3 })).toThrow(VolumeError);
    expect(() => campaignBody({ ...base, kind: 'lleva_paga', buyQuantity: 3 })).toThrow(VolumeError);
    expect(() => campaignBody({ ...base, kind: 'descuento_llevando', buyQuantity: 1, discountPct: 10 })).toThrow(VolumeError);
    expect(() => campaignBody({ ...base, kind: 'descuento_llevando', buyQuantity: 2, discountPct: 100 })).toThrow(VolumeError);
    expect(() => campaignBody({ ...base, kind: 'descuento_llevando', buyQuantity: 2 })).toThrow(VolumeError);
    expect(() => campaignBody({ ...base, name: ' ', kind: 'descuento_llevando', buyQuantity: 2, discountPct: 10 })).toThrow(VolumeError);
    expect(() => campaignBody({ ...base, kind: 'descuento_llevando', buyQuantity: 2, discountPct: 10, finish: dates.start })).toThrow(VolumeError);
    expect(() => campaignBody({ ...base, kind: 'descuento_llevando', buyQuantity: 2, discountPct: 10, start: '25/11/2026' })).toThrow(VolumeError);
  });

  it('lee la campaña del detalle y de la lista de la cuenta, y las publicaciones', () => {
    expect(parseCampaign({ id: 'C-MLA1', type: 'VOLUME', sub_type: 'BNSP', status: 'pending', name: 'Llevando 2', buy_quantity: 2, discount_percentage: 5, allow_combination: true, start_date: 'a', finish_date: 'b' })).toMatchObject({
      id: 'C-MLA1',
      kind: 'descuento_llevando',
      status: 'pending',
      buyQuantity: 2,
      discountPct: 5,
      combine: true,
    });
    // En la lista de la cuenta las cantidades vienen dentro de benefits.
    expect(parseCampaign({ id: 'P-MLA2', type: 'VOLUME', status: 'started', name: '3x2', benefits: { buy_quantity: 3, pay_quantity: 2, item_discount_percent: 33.333 } })).toMatchObject({
      kind: null,
      buyQuantity: 3,
      payQuantity: 2,
      discountPct: 33.333,
      combine: null,
    });
    expect(parseCampaign({ type: 'VOLUME' })).toBeNull();
    expect(parseItem({ id: 'MLA1', status: 'candidate', price: 0, original_price: 2000 })).toMatchObject({ externalId: 'MLA1', status: 'candidate', price: null, originalPrice: 2000, offerId: null });
    expect(parseItem({ id: 'MLA1', status: 'pending', price: 1800, original_price: 2000, offer_id: 'MLA1-abc' })).toMatchObject({ price: 1800, offerId: 'MLA1-abc' });
  });
});

describe.skipIf(!url)('campañas por cantidad en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let server: http.Server;
  let accountId = '';
  let storeId = '';
  let productId = '';
  // El Mercado Libre simulado: las campañas, quién participa y lo que llegó.
  let campaigns: Record<string, Record<string, unknown>> = {};
  let offers: Record<string, Record<string, string>> = {};
  const calls: { method: string; path: string; body: unknown }[] = [];

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    server = http.createServer(async (req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      const json = (status: number, body: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(body === undefined ? '' : JSON.stringify(body));
      if (req.headers.authorization !== 'Bearer llave') return json(401, {});
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : null;
      calls.push({ method: req.method ?? '', path: `${u.pathname}${u.search}`, body });
      if (u.pathname === '/seller-promotions/users/7') {
        return json(200, { results: [{ id: 'P-OTRA', type: 'DEAL', status: 'started', name: 'Otra' }, ...Object.values(campaigns).map((c) => ({ ...c, type: 'VOLUME' }))] });
      }
      if (u.pathname === '/seller-promotions/promotions' && req.method === 'POST') {
        if (body.discount_percentage === 99) return json(400, { message: 'discount too high', error: 'bad_request' });
        const id = `C-MLA${Object.keys(campaigns).length + 1}`;
        const { promotion_type, ...rest } = body;
        campaigns[id] = { id, type: promotion_type, status: 'pending', ...rest };
        offers[id] = {};
        return json(201, campaigns[id]);
      }
      const one = u.pathname.match(/^\/seller-promotions\/promotions\/([^/]+)(\/items)?$/);
      if (one) {
        const c = campaigns[one[1]];
        if (!c) return json(404, {});
        if (one[2]) {
          const only = u.searchParams.get('item_id');
          const results = ['MLA1', 'MLA2']
            .filter((id) => !only || only === id)
            .map((id) => (offers[one[1]][id] ? { id, status: 'pending', price: 950, original_price: 1000, offer_id: offers[one[1]][id] } : { id, status: 'candidate', price: 0, original_price: 1000 }));
          return json(200, { results, paging: { total: results.length } });
        }
        if (req.method === 'DELETE') {
          delete campaigns[one[1]];
          return json(200, undefined);
        }
        return json(200, c);
      }
      const item = u.pathname.match(/^\/seller-promotions\/items\/(MLA\d+)$/);
      if (item) {
        if (req.method === 'GET') return json(200, [{ id: 'C-MLA1', type: 'VOLUME', status: 'candidate' }]);
        if (req.method === 'POST') {
          if (item[1] === 'MLA2') return json(400, { message: 'item is in another promotion', error: 'bad_request' });
          offers[body.promotion_id][item[1]] = `${item[1]}-oferta`;
          return json(200, { offer_id: `${item[1]}-oferta`, price: 950, original_price: 1000 });
        }
        if (req.method === 'DELETE') {
          delete offers[u.searchParams.get('promotion_id')!][item[1]];
          return json(200, undefined);
        }
      }
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
    await db.$executeRawUnsafe('TRUNCATE channel_sync_changes, channel_copies, channel_connections, publications, products, stores, channels, accounts, users CASCADE');
    campaigns = {};
    offers = {};
    calls.length = 0;
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
    const product = await db.product.create({ data: { accountId: account.id, name: 'Camisa de prueba' } });
    accountId = account.id;
    storeId = store.id;
    productId = product.id;
  });

  const pub = (externalId: string | null, title: string) => db.publication.create({ data: { productId, storeId, externalId, title } });
  const input = { name: 'Llevando 2', kind: 'descuento_llevando' as const, buyQuantity: 2, discountPct: 5, combine: true, ...dates };

  it('crea la campaña, la lista entre las de la cuenta y la lee con sus candidatas', async () => {
    const c = await createVolumeCampaign(db, accountId, input);
    expect(c).toMatchObject({ id: 'C-MLA1', kind: 'descuento_llevando', status: 'pending', buyQuantity: 2, discountPct: 5, combine: true });
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/seller-promotions/promotions?app_version=v2', body: { promotion_type: 'VOLUME', sub_type: 'BNSP' } });
    // De las promociones de la cuenta, solo las de cantidad.
    expect((await listVolumeCampaigns(db, accountId)).map((x) => x.id)).toEqual(['C-MLA1']);
    const r = await getVolumeCampaign(db, accountId, 'C-MLA1');
    expect(r.items.total).toBe(2);
    expect(r.items.items.map((i) => [i.externalId, i.status, i.originalPrice])).toEqual([
      ['MLA1', 'candidate', 1000],
      ['MLA2', 'candidate', 1000],
    ]);
  });

  it('si Mercado Libre no acepta la campaña, vuelve lo que respondió', async () => {
    await expect(createVolumeCampaign(db, accountId, { ...input, discountPct: 99 })).rejects.toThrow(/código 400.*discount too high/);
  });

  it('suma y saca publicaciones, con el precio que informa el canal, y lo anota en el registro', async () => {
    const a = await pub('MLA1', 'Camisa STD');
    const b = await pub('MLA2', 'Camisa 0,50');
    const unpublished = await pub(null, 'Sin publicar');
    await createVolumeCampaign(db, accountId, input);

    const r = await changeVolumeItems(db, { accountId, campaignId: 'C-MLA1', publicationIds: [a.id, b.id, unpublished.id, 'otra'], join: true, userId: null });
    expect(r.done).toMatchObject([{ externalId: 'MLA1', offerId: 'MLA1-oferta', price: 950, originalPrice: 1000 }]);
    expect(Object.fromEntries(r.failed.map((f) => [f.title ?? f.id, f.message]))).toMatchObject({
      otra: 'La publicación no está en la tienda de la cuenta.',
      'Sin publicar': 'Todavía no está publicada en Mercado Libre.',
    });
    expect(r.failed.find((f) => f.externalId === 'MLA2')?.message).toContain('item is in another promotion');
    expect((await getVolumeCampaign(db, accountId, 'C-MLA1', { externalId: 'MLA1' })).items.items).toMatchObject([{ externalId: 'MLA1', status: 'pending', price: 950, offerId: 'MLA1-oferta' }]);
    const log = await db.channelSyncChange.findMany({ where: { field: 'campaign' }, orderBy: { kind: 'asc' }, select: { kind: true, after: true } });
    expect(log).toEqual([
      { kind: 'SENT', after: 'Campaña por cantidad C-MLA1: se sumó' },
      { kind: 'REJECTED', after: 'Campaña por cantidad C-MLA1: sumarse' },
    ]);

    // Para sacarla, busca el código de su oferta en la campaña.
    await changeVolumeItems(db, { accountId, campaignId: 'C-MLA1', publicationIds: [a.id], join: false, userId: null });
    expect(calls.at(-1)).toMatchObject({ method: 'DELETE' });
    expect(calls.at(-1)!.path).toContain('offer_id=MLA1-oferta');
    expect(offers['C-MLA1']).toEqual({});
    // Sacar una que no participa no es un error.
    expect((await changeVolumeItems(db, { accountId, campaignId: 'C-MLA1', publicationIds: [a.id], join: false, userId: null })).failed).toEqual([]);
  });

  it('borra la campaña y lee las promociones de una publicación como las manda el canal', async () => {
    const a = await pub('MLA1', 'Camisa STD');
    await createVolumeCampaign(db, accountId, input);
    expect(await rawPromotions(db, accountId, a.id)).toEqual({ externalId: 'MLA1', promotions: [{ id: 'C-MLA1', type: 'VOLUME', status: 'candidate' }] });
    await deleteVolumeCampaign(db, accountId, 'C-MLA1');
    expect(campaigns).toEqual({});
    await expect(getVolumeCampaign(db, accountId, 'C-MLA1')).rejects.toThrow('no encontró esa campaña');
    // Borrar una que ya no está no es un error.
    await deleteVolumeCampaign(db, accountId, 'C-MLA1');
  });
});
