import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { parseDailyVisits } from '@/channels/mercadolibre/listings';
import { changeText, visitsForClaude, visitsSummary, type VisitDay } from '@/domain/visits';
import { encrypt } from '@/lib/crypto';
import { unitsLast90 } from '@/lib/sales/units';
import { loadVisits, readAllVisits } from '@/lib/visits';

// Las visitas por día y las ventas de 90 días, con datos de prueba.

const NOW = new Date('2026-11-03T15:00:00Z');
const DAY = 24 * 3600_000;
const dayAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString().slice(0, 10);
/** n días hasta hoy, con estas visitas por día. */
const series = (n: number, perDay: (ago: number) => number): VisitDay[] =>
  Array.from({ length: n }, (_, i) => n - 1 - i).map((ago) => ({ day: dayAgo(ago), visits: perDay(ago) }));

describe('visitas por día', () => {
  it('lee la respuesta de Mercado Libre, del día más viejo al de hoy', () => {
    expect(
      parseDailyVisits({
        item_id: 'MLA1',
        total_visits: 7,
        results: [
          { date: '2026-11-03T00:00:00Z', total: 4, visits_detail: [] },
          { date: '2026-11-02T00:00:00Z', total: 3 },
          { date: 'cualquier cosa', total: 1 },
        ],
      }),
    ).toEqual([
      { day: '2026-11-02', visits: 3 },
      { day: '2026-11-03', visits: 4 },
    ]);
    expect(parseDailyVisits('nada')).toBeNull();
  });

  it('suma por semana y compara los últimos 30 días con los 30 anteriores', () => {
    const s = visitsSummary(series(90, (ago) => (ago < 30 ? 3 : 1)), NOW, null)!;
    expect(s.weeks).toHaveLength(13);
    expect(s.weeks.at(-1)).toEqual({ from: dayAgo(6), visits: 21 });
    expect(s.last30).toBe(90);
    expect(s.previous30).toBe(30);
    expect(s.correction).toBeNull();
    expect(changeText(s.previous30, s.last30)).toBe('+200 %');
    // Con menos de 60 días leídos, no hay con qué comparar.
    expect(visitsSummary(series(40, () => 1), NOW, null)!.previous30).toBeNull();
  });

  it('antes y después de corregirla, por día', () => {
    const s = visitsSummary(series(90, (ago) => (ago < 20 ? 6 : 2)), NOW, new Date(`${dayAgo(20)}T12:00:00Z`))!;
    expect(s.correction).toEqual({ on: dayAgo(20), beforePerDay: 2, afterPerDay: 6, afterDays: 20 });
    expect(changeText(2, 6)).toBe('+200 %');
    expect(changeText(4, 3)).toBe('−25 %');
    expect(changeText(0, 0)).toBe('igual');
    expect(visitsForClaude(s)?.al_corregirla).toEqual({ dia: dayAgo(20), por_dia_antes: 2, por_dia_despues: 6, dias_despues_con_dato: 20 });
    // Corregida antes de lo que hay leído: no se compara.
    expect(visitsSummary(series(30, () => 1), NOW, new Date(NOW.getTime() - 60 * DAY))!.correction).toBeNull();
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('visitas y ventas en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let server: http.Server;
  const asked: { id: string; last: number }[] = [];
  let storeId = '';
  let productId = '';

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    server = http.createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      const json = (status: number, body: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      if (req.headers.authorization !== 'Bearer llave') return json(401, {});
      const m = u.pathname.match(/^\/items\/(MLA\d+)\/visits\/time_window$/);
      if (!m) return json(404, {});
      if (m[1] === 'MLA9') return json(500, { message: 'internal' });
      const last = Number(u.searchParams.get('last'));
      asked.push({ id: m[1], last });
      return json(200, { item_id: m[1], results: Array.from({ length: last }, (_, i) => ({ date: `${dayAgo(last - 1 - i)}T00:00:00Z`, total: 2 })) });
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
      'TRUNCATE publication_visit_days, sales, sale_readers, pipeline_movements, channel_connections, publications, products, stores, channels, accounts, users CASCADE',
    );
    asked.length = 0;
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
    storeId = store.id;
    productId = (await db.product.create({ data: { accountId: account.id, name: 'Subconjunto SP-1' } })).id;
  });

  const pub = (externalId: string | null) => db.publication.create({ data: { productId, storeId, externalId, title: `Publicación ${externalId}` } });

  it('la primera vez trae 90 días; al día siguiente, la última semana', async () => {
    const a = await pub('MLA1');
    await pub(null);
    const broken = await pub('MLA9');
    const clock = () => NOW;
    expect(await readAllVisits(db, { budgetMs: 10_000, now: clock })).toMatchObject({ read: 1, pending: false });
    expect(asked).toEqual([{ id: 'MLA1', last: 90 }]);
    expect(await db.publicationVisitDay.count({ where: { publicationId: a.id } })).toBe(90);
    // La que falló queda para la próxima lectura.
    expect((await db.publication.findUniqueOrThrow({ where: { id: broken.id } })).visitsReadAt).toBeNull();

    // Leída hoy: no se vuelve a pedir.
    asked.length = 0;
    await readAllVisits(db, { budgetMs: 10_000, now: clock });
    expect(asked).toEqual([]);
    // Al día siguiente, solo la última semana; lo de antes sigue.
    const tomorrow = () => new Date(NOW.getTime() + DAY);
    await readAllVisits(db, { budgetMs: 10_000, now: tomorrow });
    expect(asked).toEqual([{ id: 'MLA1', last: 7 }]);
    expect(await db.publicationVisitDay.count({ where: { publicationId: a.id } })).toBe(90);

    // El resumen, con el día en que se terminó de corregir.
    await db.pipelineMovement.create({ data: { publicationId: a.id, step: 'PUBLISH', enteredAt: new Date(NOW.getTime() - 11 * DAY), exitedAt: new Date(NOW.getTime() - 10 * DAY), exitKind: 'COMPLETED' } });
    const v = await loadVisits(db, a.id, NOW);
    expect(v).toMatchObject({ last30: 60, previous30: 60, correction: { on: dayAgo(10), beforePerDay: 2, afterPerDay: 2 } });
    expect(await loadVisits(db, broken.id, NOW)).toBeNull();
    // La que falla se reintenta varias veces antes de dejarla.
  }, 30_000);

  it('las ventas de 90 días salen de las ventas leídas, solo si la tienda ya trajo las viejas', async () => {
    const a = await pub('MLA1');
    const b = await pub('MLA2');
    const sale = (orderId: string, days: number, state: 'PAID' | 'CANCELLED', lines: { publicationId: string; quantity: number }[]) =>
      db.sale.create({ data: { storeId, orderId, state, orderedAt: new Date(NOW.getTime() - days * DAY), itemsAmount: 1000, lines, checkedAt: NOW } });
    await sale('O1', 5, 'PAID', [{ publicationId: a.id, quantity: 2 }]);
    await sale('O2', 40, 'PAID', [{ publicationId: a.id, quantity: 1 }, { publicationId: b.id, quantity: 3 }]);
    await sale('O3', 10, 'CANCELLED', [{ publicationId: a.id, quantity: 5 }]);
    await sale('O4', 120, 'PAID', [{ publicationId: b.id, quantity: 4 }]);

    // Sin las ventas viejas completas, no se cuenta: faltarían algunas.
    expect((await unitsLast90(db, [a.id, b.id], NOW)).size).toBe(0);
    await db.saleReader.create({ data: { storeId, historyDoneAt: NOW } });
    const units = await unitsLast90(db, [a.id, b.id], NOW);
    expect(Object.fromEntries(units)).toEqual({ [a.id]: 3, [b.id]: 3 });
  });
});
