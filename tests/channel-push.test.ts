import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { rejectionMessage } from '@/channels/mercadolibre/publish';
import { faceSummary, faceValues, fingerprintsOf } from '@/domain/channel-sync';
import { DraftError, pushDrafts, PushError, saveDraft } from '@/lib/channel-push';
import { discardDrafts, readOne, runSyncStep, startSync } from '@/lib/channel-sync';
import { encrypt } from '@/lib/crypto';
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
    expect(rejectionMessage(400, { message: 'Algo raro' })).toBe('Mercado Libre no lo aceptó: Algo raro');
    expect(rejectionMessage(500, null)).toBe('Mercado Libre no lo aceptó (código 500).');
  });
});

const url = process.env.TEST_DATABASE_URL;

type Item = { title: string; description: string | null; sold: number; last_updated: string };

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
      if (req.method === 'PUT' || req.method === 'POST') writes.push({ method: req.method, path: u.pathname, body });

      const item = u.pathname.match(/^\/items\/(\w+)$/);
      if (item && req.method === 'PUT') {
        const it = items[item[1]];
        if (!it) return json(404, {});
        if (it.sold > 0) return json(400, { message: 'Validation error', cause: [{ code: 'item.title.not_modifiable', message: 'Not modifiable' }] });
        // A veces el canal guarda el título con algún cambio.
        it.title = String(body.title).replace('Sachs', 'SACHS');
        it.last_updated = new Date().toISOString();
        return json(200, { id: item[1] });
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
            return { code: 200, body: { id, seller_id: 7, title: it.title, status: 'active', price: 100, sold_quantity: it.sold, last_updated: it.last_updated } };
          }),
        );
      }
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
      MLA1: { title: 'Kit Embrague Ford Ka', description: 'Kit completo.', sold: 0, last_updated: '2026-10-20T10:00:00.000Z' },
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
});
