import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { flexConfirm, flexLabel, flexOption } from '@/domain/flex';
import { flexOfItem } from '@/channels/mercadolibre/listings';
import { flexRejection, parseHolidays, parseRanges, parseZones, siteOf } from '@/channels/mercadolibre/flex';
import { filterPublications, parsePublicationSearch, type Filterable } from '@/lib/queries/catalog-filters';

// Envíos Flex: leerlo de cada publicación, prenderlo y apagarlo, las ventas
// Flex del día, la configuración de la cuenta y el filtro de la lista. Los
// datos son inventados.

const url = process.env.TEST_DATABASE_URL;

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { encrypt } = await import('@/lib/crypto');
const { setPublicationsFlex, flexToday, flexConfiguration, readPublicationFlex } = await import('@/lib/flex');

describe('Flex sin la base', () => {
  it('lee si la publicación ofrece Flex de sus etiquetas', () => {
    expect(flexOfItem({ tags: ['good_quality_thumbnail', 'self_service_in'] })).toBe(true);
    expect(flexOfItem({ tags: ['self_service_out'] })).toBe(false);
    expect(flexOfItem({ tags: ['good_quality_thumbnail'] })).toBeNull();
    expect(flexOfItem({})).toBeNull();
  });

  it('saca el sitio del código', () => {
    expect(siteOf('MLA123')).toBe('MLA');
    expect(siteOf('mlb987')).toBe('MLB');
    expect(siteOf('123')).toBe('MLA');
  });

  it('lee zonas, franjas y feriados como los manda Mercado Libre', () => {
    expect(parseZones({ zones: [{ id: 'CABA', cutoff: { week: 12, saturday: 11 } }, { id: 'GBA1' }, { nada: 1 }] })).toEqual([
      { id: 'CABA', cutoff: { week: 12, saturday: 11 } },
      { id: 'GBA1', cutoff: null },
    ]);
    expect(
      parseRanges({
        delivery_window: 'same_day',
        delivery_ranges: { week: [{ capacity: 30, from: 11, to: 20, cutoff: 14 }], sunday: [] },
        has_extended_range: true,
        is_downgraded: false,
      }),
    ).toEqual({ window: 'same_day', ranges: [{ day: 'week', from: 11, to: 20, cutoff: 14, capacity: 30 }], extended: true, moderated: false });
    expect(parseHolidays({ holidays: [{ date: '2026-12-25', description: 'Navidad', selected: true }, { description: 'sin fecha' }] })).toEqual([
      { date: '2026-12-25', description: 'Navidad', selected: true },
    ]);
  });

  it('explica en palabras lo que no acepta Mercado Libre', () => {
    expect(flexRejection(403, true)).toContain('no deja ofrecer Envíos Flex');
    expect(flexRejection(404, true)).toContain('el país no lo tiene');
    expect(flexRejection(409, false)).toContain('Probá de nuevo');
  });

  it('pregunta antes de prender o apagar, y dice si va a toda la familia', () => {
    expect(flexConfirm(true, 'Mercado Libre', 1)).toContain('¿Prender Envíos Flex en esta publicación?');
    expect(flexConfirm(true, 'Mercado Libre', 1, 3)).toContain('las 3 medidas de su familia');
    expect(flexConfirm(false, 'Mercado Libre', 4)).toContain('¿Apagar Envíos Flex en 4 publicaciones?');
    expect(flexLabel(true)).toBe('Con Flex');
    expect(flexLabel(null)).toBe('Sin dato');
  });

  it('filtra la lista por Flex', () => {
    const row = (title: string, flex: boolean | null): Filterable => ({
      title,
      externalId: null,
      skus: [],
      score: 50,
      stage: 'IMPORTED',
      channelStatus: 'ACTIVE',
      pipelineStatus: 'UNTOUCHED',
      productType: null,
      kind: 'INDIVIDUAL',
      visits: null,
      sales: null,
      titleLock: { locked: null, reason: null } as never,
      sync: { read: true, draft: false, choose: false, rejected: false },
      stock: null,
      flex,
    });
    const all = [row('A', true), row('B', false), row('C', null)];
    const titles = (flex: string) => filterPublications(all, parsePublicationSearch({ flex })).map((r) => r.title);
    expect(titles('con')).toEqual(['A']);
    expect(titles('sin')).toEqual(['B']);
    expect(titles('sin,sin-dato')).toEqual(['B', 'C']);
    expect(titles('')).toHaveLength(3);
    expect(flexOption(undefined)).toBe('sin-dato');
  });
});

describe.skipIf(!url)('Flex en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let server: http.Server;
  let accountId = '';
  let storeId = '';
  let productId = '';
  // Lo que tiene Flex en el Mercado Libre simulado, y los pedidos que llegaron.
  let flex: Record<string, boolean> = {};
  let refuse: Record<string, number> = {};
  const calls: string[] = [];

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    server = http.createServer(async (req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      const json = (status: number, body: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(body === null ? '' : JSON.stringify(body));
      if (req.headers.authorization !== 'Bearer llave') return json(401, {});
      calls.push(`${req.method} ${u.pathname}`);
      const item = u.pathname.match(/^\/flex\/sites\/MLA\/items\/(MLA\d+)\/v2$/);
      if (item) {
        const id = item[1];
        if (refuse[id]) return json(refuse[id], { message: 'item down' });
        if (req.method === 'GET') return json(200, { has_flex: flex[id] === true });
        if (req.method === 'POST') {
          if (flex[id]) return json(400, { message: 'item is already in flex' });
          flex[id] = true;
          return json(204, null);
        }
        if (req.method === 'DELETE') {
          flex[id] = false;
          return json(204, null);
        }
      }
      const base = '/flex/sites/MLA/users/7';
      if (u.pathname === `${base}/subscriptions/v1`) {
        return json(200, [
          { site_id: 'MLA', user_id: 7, service_id: 99, mode: 'FLEX', status: 'in', origin: { address_line: 'Calle Falsa 123', city: { name: 'Saavedra' } }, configuration: { set: { coverage: { type: 'zone' } } } },
          { site_id: 'MLA', user_id: 7, service_id: 100, mode: 'TURBO', status: 'in' },
        ]);
      }
      if (u.pathname === `${base}/services/99/configurations/coverage/zones/v1`) return json(200, { zones: [{ id: 'CABA', cutoff: { week: 13 } }] });
      if (u.pathname === `${base}/services/99/configurations/delivery-ranges/v1`) {
        return json(200, { delivery_window: 'same_day', delivery_ranges: { week: [{ capacity: 20, from: 12, to: 20, cutoff: 13 }] }, has_extended_range: false, is_downgraded: false });
      }
      if (u.pathname === `${base}/services/99/configurations/holidays/v1`) return json(500, {});
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
    await db.$executeRawUnsafe('TRUNCATE channel_sync_changes, channel_copies, sales, listing_families, channel_connections, publications, products, stores, channels, accounts, users CASCADE');
    flex = { MLA1: false, MLA2: false, MLA3: false, MLA4: true };
    refuse = {};
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
    const product = await db.product.create({ data: { accountId: account.id, name: 'Kit PD-1' } });
    accountId = account.id;
    storeId = store.id;
    productId = product.id;
  });

  const publication = async (externalId: string | null, title: string, copyFlex: boolean | null = null) => {
    const p = await db.publication.create({ data: { productId, storeId, externalId, title } });
    if (externalId) await db.channelCopy.create({ data: { publicationId: p.id, readAt: new Date(), status: 'ACTIVE', flex: copyFlex } });
    return p;
  };

  it('prende Flex, lo guarda y lo anota en el registro; lo que no se puede vuelve con el motivo', async () => {
    const a = await publication('MLA1', 'Kit Embrague');
    const unpublished = await publication(null, 'Sin publicar');
    const refused = await publication('MLA3', 'Rechazada');
    refuse.MLA3 = 403;

    const r = await setPublicationsFlex(db, { accountId, publicationIds: [a.id, unpublished.id, refused.id, 'otra'], on: true, userId: null });
    expect(r.done.map((d) => d.externalId)).toEqual(['MLA1']);
    expect(Object.fromEntries(r.failed.map((f) => [f.title ?? f.id, f.message]))).toEqual({
      otra: 'La publicación no está en la cuenta.',
      'Sin publicar': 'Todavía no está publicada en Mercado Libre.',
      Rechazada: flexRejection(403, true),
    });
    expect(flex.MLA1).toBe(true);
    expect((await db.channelCopy.findUniqueOrThrow({ where: { publicationId: a.id } })).flex).toBe(true);
    const log = await db.channelSyncChange.findMany({ where: { field: 'flex' }, orderBy: { kind: 'asc' }, select: { kind: true, after: true, message: true } });
    expect(log).toEqual([
      { kind: 'STATUS_CHANGED', after: true, message: null },
      { kind: 'STATUS_FAILED', after: true, message: flexRejection(403, true) },
    ]);

    // Prender una que ya tiene Flex no es un error.
    expect((await setPublicationsFlex(db, { accountId, publicationIds: [a.id], on: true, userId: null })).failed).toEqual([]);
    // Apagar.
    await setPublicationsFlex(db, { accountId, publicationIds: [a.id], on: false, userId: null });
    expect(flex.MLA1).toBe(false);
    expect((await db.channelCopy.findUniqueOrThrow({ where: { publicationId: a.id } })).flex).toBe(false);
  });

  it('en una familia, el cambio va a todas sus medidas', async () => {
    const lead = await publication('MLA1', 'STD');
    const other = await publication('MLA2', '0,50');
    const family = await db.listingFamily.create({ data: { storeId, productId, leadId: lead.id } });
    await db.publication.updateMany({ where: { id: { in: [lead.id, other.id] } }, data: { familyId: family.id } });

    const r = await setPublicationsFlex(db, { accountId, publicationIds: [lead.id], on: true, userId: null });
    expect(r.done.map((d) => d.externalId)).toEqual(['MLA1', 'MLA2']);
    expect(flex).toMatchObject({ MLA1: true, MLA2: true });
  });

  it('lee en el momento si tiene Flex y lo guarda', async () => {
    const p = await publication('MLA4', 'Con Flex en el canal', null);
    expect(await readPublicationFlex(db, { accountId, publicationId: p.id })).toBe(true);
    expect((await db.channelCopy.findUniqueOrThrow({ where: { publicationId: p.id } })).flex).toBe(true);
  });

  it('las ventas Flex del día, en la hora de la cuenta', async () => {
    const now = new Date('2026-11-15T15:00:00Z');
    const sale = (orderId: string, data: Record<string, unknown>) =>
      db.sale.create({
        data: { storeId, orderId, state: 'PAID', orderedAt: new Date('2026-11-15T10:00:00Z'), itemsAmount: 1000, checkedAt: now, shipKind: 'flex', lines: [{ listingId: 'MLA1', title: `Venta ${orderId}` }], ...data },
      });
    await sale('O1', { shipState: 'TO_SHIP', dispatchBy: new Date('2026-11-15T23:00:00Z'), buyerNickname: 'COMPRADOR.UNO' });
    await sale('O2', { shipState: 'SHIPPED' });
    await sale('O3', { shipState: 'DELIVERED', deliveredAt: new Date('2026-11-15T14:00:00Z') });
    await sale('O4', { shipState: 'DELIVERED', deliveredAt: new Date('2026-11-14T14:00:00Z') });
    await sale('O5', { shipState: 'NOT_DELIVERED', shipDetail: 'Comprador ausente' });
    await sale('O6', { shipState: 'TO_SHIP', shipKind: 'pickup' });
    await sale('O7', { shipState: 'TO_SHIP', state: 'CANCELLED' });

    const t = await flexToday(db, { accountId, timeZone: 'America/Argentina/Buenos_Aires', now });
    expect(t.day).toBe('2026-11-15');
    expect(t.toDeliver.map((s) => s.orderId)).toEqual(['O1']);
    expect(t.toDeliver[0]).toMatchObject({ what: 'Venta O1', buyer: 'COMPRADOR.UNO' });
    expect(t.onTheWay.map((s) => s.orderId)).toEqual(['O2']);
    expect(t.delivered.map((s) => s.orderId)).toEqual(['O3']);
    expect(t.problems.map((s) => ({ id: s.orderId, why: s.shipDetail }))).toEqual([{ id: 'O5', why: 'Comprador ausente' }]);
  });

  it('lee la configuración de Flex de la cuenta, y avisa lo que no pudo leer', async () => {
    await publication('MLA1', 'Kit');
    const [store] = await flexConfiguration(db, accountId);
    expect(store.error).toBeNull();
    expect(store.services).toEqual([
      {
        serviceId: '99',
        status: 'in',
        origin: 'Calle Falsa 123, Saavedra',
        coverage: 'zone',
        zones: [{ id: 'CABA', cutoff: { week: 13 } }],
        deliveryWindow: 'same_day',
        ranges: [{ day: 'week', from: 12, to: 20, cutoff: 13, capacity: 20 }],
        extendedRange: false,
        moderated: false,
        holidays: [],
        warnings: ['No se pudo leer los feriados.'],
      },
    ]);
    // Solo pide lo de Flex, nunca cambia nada.
    expect(calls.every((c) => c.startsWith('GET '))).toBe(true);
  });
});
