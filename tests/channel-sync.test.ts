import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { DISCOUNT_GRACE_MS, discountText, faceSummary, faceValues, fieldState, fingerprint, fingerprintsOf, heldDiscount, installmentsText, planFaces, storedPrints } from '@/domain/channel-sync';
import { chooseFaces, runSyncStep, startSync, syncAllStores } from '@/lib/channel-sync';
import { encrypt } from '@/lib/crypto';
import { resetVisitsTogether } from '@/channels/mercadolibre/listings';

// La lectura automática del canal y las caras de cada publicación, contra un
// Mercado Libre simulado. Los datos son de prueba.

describe('de qué lado cambió cada dato', () => {
  it('compara sin fijarse en espacios, saltos de línea ni el orden de los datos de catálogo', () => {
    expect(fingerprint('title', '  Kit  Embrague Ka ')).toBe(fingerprint('title', 'Kit Embrague Ka'));
    expect(fingerprint('description', 'Uno \r\nDos\n\n\n\nTres  ')).toBe(fingerprint('description', 'Uno\nDos\n\nTres'));
    expect(fingerprint('description', 'Uno')).not.toBe(fingerprint('description', 'Dos'));
    expect(
      fingerprint('attributes', [
        { name: 'Color', value: 'Negro' },
        { name: 'Largo', value: '10 cm' },
      ]),
    ).toBe(fingerprint('attributes', [{ name: 'largo', value: '10  cm' }, { name: 'Color', value: 'Negro' }]));
    expect(fingerprint('title', null)).toBe('');
    expect(fingerprint('attributes', [])).toBe('');
  });

  it('igual, borrador, para tomar o para elegir', () => {
    // Igual en los dos lados.
    expect(fieldState('a', 'a', undefined)).toBe('same');
    expect(fieldState('a', 'a', 'z')).toBe('same');
    // Cambió solo en el canal: se toma.
    expect(fieldState('a', 'b', 'a')).toBe('incoming');
    // Cambió solo en la app: borrador.
    expect(fieldState('b', 'a', 'a')).toBe('draft');
    // Cambió en los dos lados.
    expect(fieldState('b', 'c', 'a')).toBe('choose');
    // La primera vez, distinto en los dos lados: hay que elegir.
    expect(fieldState('b', 'c', undefined)).toBe('choose');
    // La primera vez, si a uno le falta, el otro lo trae.
    expect(fieldState('', 'c', undefined)).toBe('incoming');
    expect(fieldState('b', '', undefined)).toBe('draft');
  });

  it('las cuotas y el descuento se comparan como texto corto', () => {
    expect(installmentsText(6)).toBe('6');
    expect(installmentsText(null)).toBeNull();
    expect(discountText('27.30')).toBe('27.3');
    // Un descuento calculado por el canal sobre un precio redondeado da lo mismo.
    expect(discountText((1 - 223_097 / 306_873) * 100)).toBe('27.3');
    expect(discountText(0)).toBe('0');
    expect(fingerprint('discount', '0')).not.toBe(fingerprint('discount', null));
    // Una copia leída antes de comparar las cuotas y el descuento: lo leído queda como acordado.
    const { channel, agreed } = storedPrints({ fingerprints: {}, agreed: {}, price: 100, installments: 6, discount: 0 });
    expect(channel.installments).toBe(fingerprint('installments', '6'));
    expect(agreed.discount).toBe(fingerprint('discount', '0'));
  });

  it('el descuento que subió la app: se espera si recién se subió y no se pierde si venció', () => {
    const now = new Date('2026-10-23T12:00:00Z');
    const until = new Date('2026-11-05T12:00:00Z');
    const justSent = { discountUntil: until, discountSentAt: new Date(now.getTime() - 60_000) };
    expect(heldDiscount('10', '0', justSent, now)).toBe('pending');
    expect(heldDiscount('10', '0', { ...justSent, discountSentAt: new Date(now.getTime() - DISCOUNT_GRACE_MS - 1) }, now)).toBeNull();
    expect(heldDiscount('10', '0', { ...justSent, discountUntil: new Date(now.getTime() - 1) }, now)).toBe('expired');
    // El canal lo muestra, la app no tiene, o no lo subió la app: vale lo de siempre.
    expect(heldDiscount('10', '10', justSent, now)).toBeNull();
    expect(heldDiscount('0', '0', justSent, now)).toBeNull();
    expect(heldDiscount('10', '0', { discountUntil: null, discountSentAt: null }, now)).toBeNull();
  });

  it('el plan toma lo del canal, guarda el borrador y no toca lo que hay que elegir', () => {
    const plans = planFaces(
      { title: 'a', description: 'x', attributes: 'm', photos: 'f', price: 'p', installments: 'c', discount: 'd', quantity: 'q' },
      { title: 'b', description: 'y', attributes: 'n', photos: 'f', price: 'p', installments: 'c', discount: 'd', quantity: 'q' },
      { title: 'a', description: 'y' },
    );
    expect(plans).toEqual([
      { field: 'title', state: 'incoming', take: true, agreed: 'b' },
      { field: 'description', state: 'draft', take: false, agreed: 'y' },
      { field: 'attributes', state: 'choose', take: false, agreed: undefined },
      { field: 'photos', state: 'same', take: false, agreed: 'f' },
      { field: 'price', state: 'same', take: false, agreed: 'p' },
      { field: 'installments', state: 'same', take: false, agreed: 'c' },
      { field: 'discount', state: 'same', take: false, agreed: 'd' },
      { field: 'quantity', state: 'same', take: false, agreed: 'q' },
    ]);
  });
});

const url = process.env.TEST_DATABASE_URL;

type Item = { title: string; description: string; price: number; status: string; last_updated: string; attributes?: object[] };

describe.skipIf(!url)('la lectura automática en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let server: http.Server;
  const paths: string[] = [];
  let items: Record<string, Item> = {};
  let inChannel: string[] = [];
  let reject = false;
  let accountId = '';
  let storeId = '';
  let productId = '';

  const item = (over: Partial<Item> = {}): Item => ({
    title: 'Kit Embrague Ford Ka',
    description: 'Kit completo.',
    price: 100,
    status: 'active',
    last_updated: '2026-10-20T10:00:00.000Z',
    attributes: [{ id: 'COLOR', name: 'Color', value_name: 'Negro' }],
    ...over,
  });

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    server = http.createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      paths.push(u.pathname);
      const json = (status: number, body: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      if (reject || req.headers.authorization !== 'Bearer llave') return json(401, {});
      if (u.pathname === '/items/bulk') {
        const wanted = (u.searchParams.get('ids') ?? '').split(',');
        return json(
          200,
          wanted.map((id) => {
            const it = items[id];
            if (!it) return { code: 404, body: { message: 'not found' } };
            const { description: _, ...rest } = it;
            return { code: 200, body: { id, seller_id: 7, category_id: 'MLA999', pictures: [{ secure_url: 'https://foto/1.jpg' }], sold_quantity: 3, ...rest } };
          }),
        );
      }
      const desc = u.pathname.match(/^\/items\/(\w+)\/description$/);
      if (desc && items[desc[1]]) return json(200, { plain_text: items[desc[1]].description });
      if (u.pathname === '/items/visits') {
        return json(200, (u.searchParams.get('ids') ?? '').split(',').map((id) => ({ item_id: id, total_visits: 50 })));
      }
      if (u.pathname === '/categories/MLA999') return json(200, { id: 'MLA999', name: 'Repuestos' });
      if (u.pathname === '/users/7/items/search') {
        const status = u.searchParams.get('status');
        const list = status === 'active' ? inChannel : [];
        return json(200, { results: list, paging: { total: list.length } });
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
    await db.$executeRawUnsafe(
      'TRUNCATE channel_syncs, channel_copies, channel_sync_changes, channel_connections, measurements, publications, products, stores, channels, accounts, users CASCADE',
    );
    resetVisitsTogether();
    paths.length = 0;
    reject = false;
    inChannel = [];
    items = {};
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
  });

  const publication = (externalId: string, data: { title?: string | null; description?: string | null; attributes?: object[] } = {}) =>
    db.publication.create({
      data: {
        productId,
        storeId,
        externalId,
        title: 'Kit Embrague Ford Ka',
        description: 'Kit completo.',
        attributes: [{ name: 'Color', value: 'Negro' }],
        ...data,
      },
    });

  async function pass(trigger: 'SCHEDULE' | 'MANUAL' = 'MANUAL') {
    const run = await startSync(db, { storeId, trigger });
    if (!run) return null;
    return runSyncStep(db, run.id, { budgetMs: 30_000 });
  }

  const state = async (id: string) => {
    const p = await db.publication.findUniqueOrThrow({ where: { id }, include: { channelCopy: true } });
    const { draft, choose } = faceSummary(fingerprintsOf(faceValues(p)), p.channelCopy);
    return { draft, choose };
  };

  it('la primera vez: lo igual queda acordado, lo que falta se trae y lo distinto queda para elegir', async () => {
    const same = await publication('MLA1');
    const empty = await publication('MLA2', { title: null, description: null, attributes: [] });
    const different = await publication('MLA3', { title: 'Kit Embrague Ka 1.6' });
    await db.publication.create({ data: { productId, storeId, title: 'Sin publicar' } });
    items = { MLA1: item(), MLA2: item({ price: 120, status: 'paused' }), MLA3: item() };
    inChannel = ['MLA1', 'MLA2', 'MLA3', 'MLA9'];

    const progress = await pass();
    expect(progress).toMatchObject({ status: 'DONE', position: 3, total: 3 });
    const run = await db.channelSync.findFirstOrThrow();
    // Las tres toman el precio del canal: la app no tenía ninguno.
    expect(run).toMatchObject({ read: 3, updated: 3, toChoose: 1, newInChannel: 1, missing: 0 });

    expect(await state(same.id)).toEqual({ draft: [], choose: [] });
    const filled = await db.publication.findUniqueOrThrow({ where: { id: empty.id } });
    expect(filled).toMatchObject({ title: 'Kit Embrague Ford Ka', description: 'Kit completo.', channelStatus: 'PAUSED' });
    expect(Number(filled.price)).toBe(120);
    expect(filled.attributes).toEqual([{ name: 'Color', value: 'Negro' }]);
    expect(await state(different.id)).toEqual({ draft: [], choose: ['title'] });
    // Lo distinto no se pisa.
    expect((await db.publication.findUniqueOrThrow({ where: { id: different.id } })).title).toBe('Kit Embrague Ka 1.6');

    const changes = await db.channelSyncChange.findMany({ where: { publicationId: empty.id }, orderBy: { field: 'asc' } });
    expect(changes.map((c) => [c.field, c.kind])).toEqual([
      ['attributes', 'TAKEN'],
      ['description', 'TAKEN'],
      ['discount', 'TAKEN'],
      ['price', 'TAKEN'],
      ['title', 'TAKEN'],
    ]);
    // La medición del día con lo que mide el canal.
    const m = await db.measurement.findFirstOrThrow({ where: { publicationId: same.id } });
    expect(m.metrics).toMatchObject({ visits_90d: 50, sold_visible: 3, photo_count: 1, has_video: false });
  });

  it('después: lo que cambió solo en el canal se toma, lo de la app es borrador y si cambian los dos hay que elegir', async () => {
    const a = await publication('MLA1');
    const b = await publication('MLA2');
    const c = await publication('MLA3');
    items = { MLA1: item(), MLA2: item(), MLA3: item() };
    await pass();

    // En el canal cambian el título de MLA1 y la descripción de MLA3. En la app,
    // la descripción de MLA2 y la de MLA3.
    items.MLA1 = item({ title: 'Kit Embrague Ford Ka 1.6 Sachs', last_updated: '2026-10-20T12:00:00.000Z' });
    items.MLA3 = item({ description: 'Kit completo, con disco.', last_updated: '2026-10-20T12:00:00.000Z' });
    await db.publication.update({ where: { id: b.id }, data: { description: 'Kit completo con rulemán.' } });
    await db.publication.update({ where: { id: c.id }, data: { description: 'Kit completo y garantía.' } });
    await pass();

    expect((await db.publication.findUniqueOrThrow({ where: { id: a.id } })).title).toBe('Kit Embrague Ford Ka 1.6 Sachs');
    expect(await state(a.id)).toEqual({ draft: [], choose: [] });
    expect(await state(b.id)).toEqual({ draft: ['description'], choose: [] });
    expect(await state(c.id)).toEqual({ draft: [], choose: ['description'] });
    expect((await db.publication.findUniqueOrThrow({ where: { id: c.id } })).description).toBe('Kit completo y garantía.');
    const taken = await db.channelSyncChange.findFirstOrThrow({ where: { publicationId: a.id, field: 'title' } });
    expect(taken).toMatchObject({ kind: 'TAKEN', before: 'Kit Embrague Ford Ka', after: 'Kit Embrague Ford Ka 1.6 Sachs' });
  });

  it('la descripción se vuelve a pedir solo si la publicación cambió en el canal', async () => {
    await publication('MLA1');
    await publication('MLA2');
    items = { MLA1: item(), MLA2: item() };
    await pass();
    expect(paths.filter((p) => p.endsWith('/description'))).toHaveLength(2);

    paths.length = 0;
    items.MLA2 = item({ last_updated: '2026-10-20T13:00:00.000Z' });
    await pass();
    expect(paths.filter((p) => p.endsWith('/description'))).toEqual(['/items/MLA2/description']);
    // La que no se pidió conserva la descripción que ya tenía la cara del canal.
    const copy = await db.channelCopy.findFirstOrThrow({ where: { publication: { externalId: 'MLA1' } } });
    expect(copy.description).toBe('Kit completo.');
  });

  it('elegir lo del canal lo trae a la app; elegir lo de la app lo deja como borrador', async () => {
    const a = await publication('MLA1', { title: 'Título de la app' });
    const b = await publication('MLA2', { title: 'Otro título de la app' });
    items = { MLA1: item(), MLA2: item() };
    await pass();
    expect((await state(a.id)).choose).toEqual(['title']);

    expect(await chooseFaces(db, { accountId, publicationIds: [a.id], side: 'channel', userId: null })).toEqual({ publications: 1, fields: 1 });
    expect((await db.publication.findUniqueOrThrow({ where: { id: a.id } })).title).toBe('Kit Embrague Ford Ka');
    expect(await state(a.id)).toEqual({ draft: [], choose: [] });

    await chooseFaces(db, { accountId, publicationIds: [b.id], side: 'app', userId: null });
    expect((await db.publication.findUniqueOrThrow({ where: { id: b.id } })).title).toBe('Otro título de la app');
    expect(await state(b.id)).toEqual({ draft: ['title'], choose: [] });
    // Otra cuenta no puede elegir.
    expect(await chooseFaces(db, { accountId: 'otra', publicationIds: [b.id], side: 'channel', userId: null })).toEqual({ publications: 0, fields: 0 });
  });

  it('sigue donde quedó si se acaba el tiempo, y nadie más la toma mientras corre', async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `MLA${100 + i}`);
    for (const id of ids) {
      await publication(id);
      items[id] = item();
    }
    const run = (await startSync(db, { storeId, trigger: 'MANUAL' }))!;
    // Un reloj que pasa 10 segundos por consulta: alcanza para una tanda.
    let t = Date.now();
    const clock = () => new Date((t += 10_000));
    const first = await runSyncStep(db, run.id, { budgetMs: 15_000, now: clock });
    expect(first).toMatchObject({ status: 'RUNNING', position: 20, total: 25 });

    // Otro pedido mientras corre: no hace nada.
    await db.channelSync.update({ where: { id: run.id }, data: { leaseUntil: new Date(Date.now() + 60_000) } });
    expect(await runSyncStep(db, run.id, { budgetMs: 30_000 })).toMatchObject({ status: 'RUNNING', position: 20, busy: true });
    await db.channelSync.update({ where: { id: run.id }, data: { leaseUntil: null } });

    // La misma pasada sigue, no se empieza otra.
    expect((await startSync(db, { storeId, trigger: 'MANUAL' }))!.id).toBe(run.id);
    expect(await runSyncStep(db, run.id, { budgetMs: 30_000 })).toMatchObject({ status: 'DONE', position: 25 });
    expect(await db.channelCopy.count()).toBe(25);
  });

  it('la programada no lee dos veces seguidas; la del botón sí', async () => {
    await publication('MLA1');
    items = { MLA1: item() };
    expect(await syncAllStores(db, { budgetMs: 30_000 })).toMatchObject({ pending: false, stores: [{ status: 'DONE' }] });
    expect(await syncAllStores(db, { budgetMs: 30_000 })).toEqual({ pending: false, stores: [] });
    expect(await pass('MANUAL')).toMatchObject({ status: 'DONE' });
    expect(await db.channelSync.count()).toBe(2);
  });

  it('las que el canal no devuelve quedan anotadas', async () => {
    await publication('MLA1');
    await publication('MLA404');
    items = { MLA1: item() };
    await pass();
    const run = await db.channelSync.findFirstOrThrow();
    expect(run).toMatchObject({ status: 'DONE', read: 1, missing: 1 });
    expect(JSON.stringify(run.errors)).toContain('MLA404');
  });

  it('si el canal no acepta la llave, la pasada falla y lo dice', async () => {
    await publication('MLA1');
    items = { MLA1: item() };
    reject = true;
    expect(await pass()).toMatchObject({ status: 'FAILED' });
    expect(JSON.stringify((await db.channelSync.findFirstOrThrow()).errors)).toContain('volver a conectar');
    expect(await db.channelCopy.count()).toBe(0);
  });
});
