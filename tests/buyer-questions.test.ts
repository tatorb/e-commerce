import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { mercadolibreQuestions, parseBuyer, parseQuestion } from '@/channels/mercadolibre/questions';
import { errorDetail, readQuestions, receiveNotice } from '@/lib/buyer-questions';
import { buyerForClaude, buyerKey, loadBuyerFacts, placeText } from '@/lib/buyers';
import { encrypt } from '@/lib/crypto';

// Las preguntas de los compradores, contra un Mercado Libre simulado. Los
// datos son de prueba.

const T0 = Date.parse('2026-10-21T15:00:00.000Z');
const at = (minutesAgo: number) => new Date(T0 - minutesAgo * 60_000).toISOString().replace('Z', '-00:00');

type MlQuestion = {
  id: number;
  seller_id: number;
  item_id: string;
  status: string;
  text: string;
  date_created: string;
  from: { id: number; answered_questions?: number };
  answer: { text: string; status: string; date_created: string } | null;
};

const question = (id: number, item: string, minutesAgo: number, answer?: string): MlQuestion => ({
  id,
  seller_id: 7,
  item_id: item,
  status: answer ? 'ANSWERED' : 'UNANSWERED',
  text: `¿Pregunta ${id}?`,
  date_created: at(minutesAgo),
  from: { id: 5000 + id },
  answer: answer ? { text: answer, status: 'ACTIVE', date_created: at(minutesAgo - 5) } : null,
});

describe('las preguntas de Mercado Libre', () => {
  it('lee una pregunta con su respuesta y su estado', () => {
    expect(parseQuestion(question(1, 'MLA1', 10, 'Sí, le sirve.'))).toEqual({
      externalId: '1',
      sellerId: '7',
      listingId: 'MLA1',
      text: '¿Pregunta 1?',
      status: 'ANSWERED',
      askedAt: at(10),
      buyerId: '5001',
      buyerAnswered: null,
      statusNote: null,
      answer: { text: 'Sí, le sirve.', answeredAt: at(5) },
    });
    expect(parseQuestion({ ...question(2, 'MLA1', 1), status: 'CLOSED_UNANSWERED' })).toMatchObject({ status: 'CLOSED', statusNote: 'Cerrada sin respuesta' });
    expect(parseQuestion({ ...question(3, 'MLA1', 1), status: 'BANNED', text: '' })).toMatchObject({ status: 'REMOVED', text: '', statusNote: 'Bloqueada por Mercado Libre' });
    expect(parseQuestion({ id: 4 })).toBeNull();
  });

  it('dice por qué no se puede responder y cuántas le respondieron al comprador', () => {
    expect(parseQuestion({ ...question(5, 'MLA1', 1), status: 'UNDER_REVIEW' })).toMatchObject({ status: 'REMOVED', statusNote: 'En revisión de Mercado Libre' });
    expect(parseQuestion({ ...question(6, 'MLA1', 1), deleted_from_listing: true })).toMatchObject({ status: 'REMOVED', statusNote: 'Borrada de la publicación' });
    expect(parseQuestion({ ...question(7, 'MLA1', 1), status: 'DISABLED' })?.statusNote).toContain('Deshabilitada');
    expect(parseQuestion({ ...question(8, 'MLA1', 1), from: { id: 9, answered_questions: 4 } })?.buyerAnswered).toBe(4);
  });

  it('lee el perfil público de quien pregunta, con la provincia por su nombre', () => {
    expect(
      parseBuyer({ id: 9, nickname: 'COMPRADOR.PRUEBA', registration_date: '2019-03-02T10:00:00.000-04:00', permalink: 'http://perfil.ejemplo/COMPRADOR.PRUEBA', address: { city: 'Rosario', state: 'AR-S' } }),
    ).toEqual({ nickname: 'COMPRADOR.PRUEBA', city: 'Rosario', state: 'Santa Fe', registeredAt: '2019-03-02T10:00:00.000-04:00', profileUrl: 'http://perfil.ejemplo/COMPRADOR.PRUEBA' });
    expect(parseBuyer({ nickname: 'X', address: { state: 'Mendoza' } })?.state).toBe('Mendoza');
    expect(parseBuyer({ id: 9 })).toBeNull();
    expect(placeText({ city: 'Córdoba', state: 'Córdoba' })).toBe('Córdoba');
    expect(placeText({ city: null, state: 'Chaco' })).toBe('Chaco');
  });

  it('de un error inesperado muestra la última línea, corta', () => {
    expect(errorDetail(new Error('Invalid `prisma.buyerQuestion.createMany()` invocation:\n\n\nTransaction already closed'))).toBe('Transaction already closed');
    expect(errorDetail('x'.repeat(500))).toHaveLength(240);
  });

  it('del aviso toma solo el número de la pregunta y de quién es', () => {
    const body = { resource: '/questions/123', user_id: 7, topic: 'questions', application_id: 1234567890, attempts: 1 };
    expect(mercadolibreQuestions.parseNotice(body)).toEqual({ userId: '7', appId: '1234567890', questionId: '123' });
    expect(mercadolibreQuestions.parseNotice({ ...body, topic: 'items', resource: '/items/MLA1' })).toBeNull();
    expect(mercadolibreQuestions.parseNotice({ ...body, resource: '/questions/123/../../users' })).toBeNull();
    expect(mercadolibreQuestions.parseNotice('nada')).toBeNull();
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('las preguntas en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let server: http.Server;
  let questions: MlQuestion[] = [];
  const sim = { forbidden: false, sellerSearch: true, offsetLimit: Infinity, onSearch: () => {}, usersDown: false, userReads: 0 };
  let users: Record<string, unknown> = {};
  let storeId = '';
  let productId = '';

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    server = http.createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      const json = (status: number, body: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      if (req.headers.authorization !== 'Bearer llave') return json(401, {});
      if (sim.forbidden) return json(403, { message: 'The caller is not authorized', error: 'forbidden' });
      const limit = Number(u.searchParams.get('limit') ?? 50);
      const offset = Number(u.searchParams.get('offset') ?? 0);
      const pageOf = (list: MlQuestion[]) => {
        if (offset >= sim.offsetLimit) return json(400, { message: 'offset too high' });
        return json(200, { total: list.length, limit, questions: list.slice(offset, offset + limit) });
      };
      if (u.pathname === '/questions/search') {
        if (!sim.sellerSearch) return json(400, { message: 'invalid search', error: 'bad_request' });
        sim.onSearch();
        if (u.searchParams.get('seller_id') !== '7' || u.searchParams.get('api_version') !== '4') return json(400, {});
        return pageOf([...questions].sort((a, b) => b.date_created.localeCompare(a.date_created)));
      }
      if (u.pathname === '/my/received_questions/search') {
        const status = u.searchParams.get('status');
        const desc = u.searchParams.get('sort_types') === 'DESC';
        return pageOf(
          questions
            .filter((q) => !status || q.status === status)
            .sort((a, b) => (desc ? b.date_created.localeCompare(a.date_created) : a.date_created.localeCompare(b.date_created))),
        );
      }
      const user = u.pathname.match(/^\/users\/(\d+)$/);
      if (user) {
        sim.userReads++;
        if (sim.usersDown) return json(500, { message: 'internal error' });
        return users[user[1]] ? json(200, users[user[1]]) : json(404, { message: 'user not found' });
      }
      const one = u.pathname.match(/^\/questions\/(\d+)$/);
      if (one) {
        const q = questions.find((x) => String(x.id) === one[1]);
        return q ? json(200, q) : json(404, { message: 'not found' });
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
      'TRUNCATE buyer_questions, channel_buyers, sales, question_readers, channel_connections, publications, products, stores, channels, accounts, users CASCADE',
    );
    Object.assign(sim, { forbidden: false, sellerSearch: true, offsetLimit: Infinity, onSearch: () => {}, usersDown: false, userReads: 0 });
    users = {};
    // 120 preguntas en dos publicaciones de la app y una que no está.
    questions = Array.from({ length: 120 }, (_, i) => question(1000 + i, i % 3 === 0 ? 'MLA99' : i % 2 ? 'MLA1' : 'MLA2', 200 - i, i < 100 ? 'Respuesta.' : undefined));
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
    storeId = store.id;
    productId = product.id;
    for (const externalId of ['MLA1', 'MLA2']) await db.publication.create({ data: { productId, storeId, externalId, title: `Publicación ${externalId}` } });
  });

  const read = (budgetMs = 30_000, now?: () => Date) => readQuestions(db, storeId, { budgetMs, now });
  const stored = () => db.buyerQuestion.findMany({ where: { storeId }, include: { publication: { select: { externalId: true } } }, orderBy: { externalId: 'asc' } });

  it('la primera vez trae las anteriores por tandas y sigue donde quedó', async () => {
    // Se acaba el tiempo después de la primera tanda.
    let late = false;
    sim.onSearch = () => {
      late = true;
    };
    const first = await read(1_000, () => new Date(Date.now() + (late ? 60_000 : 0)));
    expect(first).toMatchObject({ status: 'pending', read: 50, added: 50 });
    expect(await db.questionReader.findUnique({ where: { storeId } })).toMatchObject({ historyOffset: 50, historyTotal: 120, leaseUntil: null });

    sim.onSearch = () => {};
    const second = await read();
    expect(second).toMatchObject({ status: 'done', added: 70 });
    const all = await stored();
    expect(all).toHaveLength(120);
    expect(await db.questionReader.findUnique({ where: { storeId } })).toMatchObject({ historyOffset: null, newestAt: new Date(T0 - 81 * 60_000) });
    // Las de publicaciones que están en la app quedan unidas; las otras, con su código.
    const q1000 = all.find((q) => q.externalId === '1000')!;
    expect(q1000).toMatchObject({ listingId: 'MLA99', publicationId: null, status: 'ANSWERED', answer: 'Respuesta.', buyerId: '6000' });
    expect(all.find((q) => q.externalId === '1001')!.publication?.externalId).toBe('MLA1');
    expect(all.filter((q) => q.status === 'UNANSWERED')).toHaveLength(20);

    // Si la publicación se suma después, la pregunta se une sola en la próxima lectura.
    await db.publication.create({ data: { productId, storeId, externalId: 'MLA99', title: 'Llegó después' } });
    await read();
    expect((await db.buyerQuestion.findFirstOrThrow({ where: { externalId: '1000' } })).publicationId).not.toBeNull();
  });

  it('trae las nuevas, y lo que se respondió o se borró en el canal', async () => {
    await read();
    const unanswered = questions.filter((q) => q.status === 'UNANSWERED');
    // Juani respondió una desde Mercado Libre, otra se borró y llegó una nueva.
    Object.assign(unanswered[0], { status: 'ANSWERED', answer: { text: 'Sí, es original.', status: 'ACTIVE', date_created: at(1) } });
    questions = questions.filter((q) => q.id !== unanswered[1].id);
    questions.push(question(5000, 'MLA2', 0));

    const r = await read();
    expect(r).toMatchObject({ status: 'done', added: 1 });
    const byId = new Map((await stored()).map((q) => [q.externalId, q]));
    expect(byId.get(String(unanswered[0].id))).toMatchObject({ status: 'ANSWERED', answer: 'Sí, es original.' });
    expect(byId.get(String(unanswered[1].id))?.status).toBe('REMOVED');
    expect(byId.get('5000')).toMatchObject({ status: 'UNANSWERED', text: '¿Pregunta 5000?' });
    // Una pregunta que se bloquea viene sin texto: queda el que ya se tenía.
    Object.assign(questions.find((q) => q.id === 5000)!, { status: 'BANNED', text: '' });
    await receiveNotice(db, 'MERCADOLIBRE', { topic: 'questions', resource: '/questions/5000', user_id: 7 });
    expect(await db.buyerQuestion.findFirstOrThrow({ where: { externalId: '5000' } })).toMatchObject({ status: 'REMOVED', text: '¿Pregunta 5000?' });
  });

  it('con el aviso trae esa pregunta enseguida, solo si es de una tienda conectada', async () => {
    questions.push(question(7000, 'MLA1', 0));
    const notice = { topic: 'questions', resource: '/questions/7000', user_id: 7, application_id: 1234567890 };
    expect(await receiveNotice(db, 'MERCADOLIBRE', notice)).toBe(1);
    expect(await db.buyerQuestion.findFirstOrThrow({ where: { externalId: '7000' } })).toMatchObject({ status: 'UNANSWERED' });
    expect((await db.questionReader.findUniqueOrThrow({ where: { storeId } })).noticeAt).not.toBeNull();
    // Dos veces el mismo aviso no la repite.
    expect(await receiveNotice(db, 'MERCADOLIBRE', notice)).toBe(1);
    expect(await db.buyerQuestion.count()).toBe(1);

    // De otra cuenta, de otra aplicación o de otro tema: no se lee nada.
    expect(await receiveNotice(db, 'MERCADOLIBRE', { ...notice, user_id: 8 })).toBe(0);
    expect(await receiveNotice(db, 'MERCADOLIBRE', { ...notice, application_id: 1 })).toBe(0);
    expect(await receiveNotice(db, 'MERCADOLIBRE', { ...notice, topic: 'orders_v2' })).toBe(0);
    // Si el canal dice que la pregunta es de otro vendedor, no se guarda.
    questions.push({ ...question(7001, 'MLA1', 0), seller_id: 8 });
    expect(await receiveNotice(db, 'MERCADOLIBRE', { ...notice, resource: '/questions/7001' })).toBe(0);
    expect(await db.buyerQuestion.count()).toBe(1);
  });

  it('sin permiso lo dice; si el canal no deja ir más atrás, la carga termina ahí', async () => {
    sim.forbidden = true;
    const r = await read();
    expect(r.status).toBe('failed');
    expect(r.error).toContain('permiso de comunicación');
    // Con lo que respondió Mercado Libre, para saber por qué.
    expect(r.error).toContain('The caller is not authorized');
    expect((await db.questionReader.findUniqueOrThrow({ where: { storeId } })).lastError).toContain('permiso');

    sim.forbidden = false;
    sim.offsetLimit = 100;
    expect((await read()).status).toBe('done');
    expect(await db.questionReader.findUniqueOrThrow({ where: { storeId } })).toMatchObject({ historyOffset: null, historyLimited: true, lastError: null });
    expect(await db.buyerQuestion.count()).toBe(100);
  });

  it('si Mercado Libre no acepta la búsqueda por vendedor, usa las recibidas por la cuenta', async () => {
    sim.sellerSearch = false;
    expect(await read()).toMatchObject({ status: 'done', added: 120 });
    expect(await db.buyerQuestion.count({ where: { status: 'UNANSWERED' } })).toBe(20);
  });

  it('si otra lectura está en curso, no lee', async () => {
    await db.questionReader.create({ data: { storeId, leaseUntil: new Date(Date.now() + 60_000) } });
    expect(await read()).toEqual({ status: 'busy', read: 0, added: 0 });
  });

  it('guarda quién preguntó: su usuario, de dónde es y desde cuándo tiene cuenta; con cuántas preguntas y compras', async () => {
    questions = [
      { ...question(1, 'MLA1', 30, 'Sí.'), from: { id: 900, answered_questions: 3 } },
      { ...question(2, 'MLA2', 10), from: { id: 900, answered_questions: 3 } },
      { ...question(3, 'MLA2', 5), from: { id: 901 } },
      { ...question(4, 'MLA1', 1), status: 'UNDER_REVIEW', from: { id: 902 } },
    ];
    users = {
      '900': { id: 900, nickname: 'COMPRADOR.UNO', registration_date: '2018-05-01T00:00:00.000-04:00', permalink: 'http://perfil.ejemplo/COMPRADOR.UNO', address: { city: 'Rosario', state: 'AR-S' } },
    };
    // Una compra del mismo comprador, y una cancelada que no cuenta.
    const sale = (orderId: string, state: 'PAID' | 'CANCELLED', day: number) =>
      db.sale.create({
        data: { storeId, orderId, state, orderedAt: new Date(Date.UTC(2026, 9, day)), itemsAmount: 1000, buyerId: '900', buyerNickname: 'COMPRADOR.UNO', checkedAt: new Date() },
      });
    await sale('O1', 'PAID', 5);
    await sale('O2', 'CANCELLED', 9);
    await db.sale.create({
      data: { storeId, orderId: 'O3', state: 'PAID', orderedAt: new Date(Date.UTC(2026, 9, 7)), itemsAmount: 500, buyerId: '901', buyerNickname: 'DE.LA.VENTA', checkedAt: new Date() },
    });

    expect((await read()).status).toBe('done');
    expect(await db.channelBuyer.findUnique({ where: { storeId_buyerId: { storeId, buyerId: '900' } } })).toMatchObject({
      nickname: 'COMPRADOR.UNO',
      city: 'Rosario',
      state: 'Santa Fe',
      profileUrl: 'http://perfil.ejemplo/COMPRADOR.UNO',
      failedAt: null,
    });
    // La que está en revisión dice por qué; la del comprador, cuántas le respondieron según el canal.
    expect(await db.buyerQuestion.findFirst({ where: { externalId: '4' } })).toMatchObject({ status: 'REMOVED', statusNote: 'En revisión de Mercado Libre' });
    expect(await db.buyerQuestion.findFirst({ where: { externalId: '2' } })).toMatchObject({ buyerAnswered: 3 });

    const facts = await loadBuyerFacts(db, [
      { storeId, buyerId: '900' },
      { storeId, buyerId: '901' },
      { storeId, buyerId: null },
    ]);
    expect(facts.size).toBe(2);
    const uno = facts.get(buyerKey(storeId, '900'))!;
    expect(uno).toMatchObject({ nickname: 'COMPRADOR.UNO', questions: 2, answered: 1, purchases: 1, unread: false });
    expect(uno.lastPurchase?.orderedAt).toEqual(new Date(Date.UTC(2026, 9, 5)));
    // Sin perfil en el canal, el usuario de su compra.
    expect(facts.get(buyerKey(storeId, '901'))).toMatchObject({ nickname: 'DE.LA.VENTA', questions: 1, purchases: 1 });
    expect(buyerForClaude(uno)).toEqual({
      comprador: { usuario: 'COMPRADOR.UNO', de: 'Rosario, Santa Fe', cuenta_desde: '2018-05-01', preguntas_en_la_tienda: 2, compras: 1, ultima_compra: '2026-10-05' },
    });

    // Ya leídos: la próxima lectura no los vuelve a pedir.
    const reads = sim.userReads;
    await read();
    expect(sim.userReads).toBe(reads);
  });

  it('si el canal falla con un comprador, lo anota y lo vuelve a probar al día siguiente', async () => {
    questions = [{ ...question(1, 'MLA1', 10), from: { id: 900 } }, { ...question(2, 'MLA1', 5), from: { id: 901 } }];
    sim.usersDown = true;
    expect((await read()).status).toBe('done');
    // Paró en el primero que falló, el de la pregunta más nueva: el otro no se pidió.
    expect(await db.channelBuyer.findUnique({ where: { storeId_buyerId: { storeId, buyerId: '900' } } })).toBeNull();
    expect(await db.channelBuyer.findUnique({ where: { storeId_buyerId: { storeId, buyerId: '901' } } })).toMatchObject({ nickname: null, failedAt: expect.any(Date) });
    expect((await loadBuyerFacts(db, [{ storeId, buyerId: '901' }])).get(buyerKey(storeId, '901'))?.unread).toBe(true);

    sim.usersDown = false;
    users = { '901': { id: 901, nickname: 'YA.ANDA' } };
    // Enseguida sigue con el otro, no con el que falló.
    await read();
    expect(await db.channelBuyer.findUnique({ where: { storeId_buyerId: { storeId, buyerId: '901' } } })).toMatchObject({ nickname: null });
    // Al día siguiente lo vuelve a pedir.
    await read(30_000, () => new Date(Date.now() + 25 * 3600_000));
    expect(await db.channelBuyer.findUnique({ where: { storeId_buyerId: { storeId, buyerId: '901' } } })).toMatchObject({ nickname: 'YA.ANDA', failedAt: null });
  });

  it('con el aviso de una pregunta nueva, lee enseguida quién la hizo', async () => {
    questions.push({ ...question(7000, 'MLA1', 0), from: { id: 950 } });
    users = { '950': { id: 950, nickname: 'RECIEN.LLEGA', address: { city: 'Salta', state: 'AR-A' } } };
    expect(await receiveNotice(db, 'MERCADOLIBRE', { topic: 'questions', resource: '/questions/7000', user_id: 7 })).toBe(1);
    expect(await db.channelBuyer.findUnique({ where: { storeId_buyerId: { storeId, buyerId: '950' } } })).toMatchObject({ nickname: 'RECIEN.LLEGA', city: 'Salta', state: 'Salta' });
  });
});
