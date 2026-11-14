import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { hhmm, inQuietHours, minutesIn, parseHhmm, parsePrefs, pushAllowed, shortText } from '@/domain/notifications';

// Notificaciones: lo que elige cada persona, el silencio, a quién le llega
// cada cosa y que nada se avise dos veces. Los datos son inventados.

const url = process.env.TEST_DATABASE_URL;
const BA = 'America/Argentina/Buenos_Aires';

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { notify, accountPeople, listNotifications, markRead, unreadCount, saveSubscription } = await import('@/lib/notifications');
const { notifyNewSales, notifyPendingQuestions, notifySaleAlarm, dailySummaryPass, notifyConnectionCut } = await import('@/lib/notification-events');
const { notifyAssigned, taskNoticePass } = await import('@/lib/task-mail');

describe('lo que elige cada persona', () => {
  it('sin nada guardado, todo va al celular y por mail lo que ya salía por mail', () => {
    const p = parsePrefs({});
    expect(p.venta).toEqual({ push: true, mail: false });
    expect(p.tarea).toEqual({ push: true, mail: true });
    const q = parsePrefs({ venta: { push: false }, raro: { push: true }, tarea: { mail: 'si' } });
    expect(q.venta).toEqual({ push: false, mail: false });
    expect(q.tarea).toEqual({ push: true, mail: true });
    expect('raro' in q).toBe(false);
  });

  it('el silencio puede cruzar la medianoche, en la hora de la persona', () => {
    // 23:30 en Buenos Aires.
    const night = new Date('2026-11-15T02:30:00Z');
    expect(minutesIn(night, BA)).toBe(23 * 60 + 30);
    const q = { from: 22 * 60, to: 8 * 60, urgent: false, timeZone: BA };
    expect(inQuietHours(q, night)).toBe(true);
    expect(inQuietHours(q, new Date('2026-11-15T13:00:00Z'))).toBe(false);
    expect(inQuietHours({ ...q, from: null }, night)).toBe(false);
    const prefs = parsePrefs({});
    // Lo urgente suena igual, salvo que también se silencie.
    expect(pushAllowed('venta', prefs, q, night)).toBe(true);
    expect(pushAllowed('venta', prefs, { ...q, urgent: true }, night)).toBe(false);
    expect(pushAllowed('tarea', prefs, q, night)).toBe(false);
    expect(pushAllowed('tarea', prefs, q, new Date('2026-11-15T13:00:00Z'))).toBe(true);
    expect(pushAllowed('venta', parsePrefs({ venta: { push: false } }), q, new Date('2026-11-15T13:00:00Z'))).toBe(false);
  });

  it('lee y escribe las horas, y corta los textos largos', () => {
    expect(parseHhmm('22:00')).toBe(1320);
    expect(parseHhmm('7:05')).toBe(425);
    expect(parseHhmm('25:00')).toBeNull();
    expect(hhmm(425)).toBe('07:05');
    expect(shortText('a  b\n c')).toBe('a b c');
    expect(shortText('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});

describe.skipIf(!url)('notificaciones en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let a1 = '';
  let storeId = '';
  let pubId = '';
  const pushed: { endpoint: string; title: string }[] = [];
  const mails: { to: string; subject: string }[] = [];
  const deps = {
    push: async () => async (t: { endpoint: string }, p: { title: string }) => {
      if (t.endpoint.includes('vencida')) return 'gone' as const;
      pushed.push({ endpoint: t.endpoint, title: p.title });
      return 'ok' as const;
    },
    mail: async (m: { to: string; subject: string }) => {
      mails.push({ to: m.to, subject: m.subject });
      return { ok: true as const };
    },
    mailReady: () => true,
    baseUrl: () => 'https://app.ejemplo',
  };

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    pushed.length = 0;
    mails.length = 0;
    await db.$executeRawUnsafe(
      'TRUNCATE notifications, push_subscriptions, question_drafts, buyer_questions, sales, task_assignees, task_publications, tasks, user_accounts, publications, products, channel_connections, stores, channels, accounts, users CASCADE',
    );
    a1 = (await db.account.create({ data: { slug: 'uno', name: 'Cuenta uno' } })).id;
    const a2 = (await db.account.create({ data: { slug: 'dos', name: 'Cuenta dos' } })).id;
    await db.user.createMany({
      data: [
        { id: 'admin', name: 'Ana', email: 'ana@prueba.com', isAdmin: true },
        { id: 'ventas', name: 'Beto', email: 'beto@prueba.com', permissions: { ventas: 'read' } },
        { id: 'fotos', name: 'Carla', email: 'carla@prueba.com', permissions: { pipeline: 'write' } },
        { id: 'baja', name: 'Dado de baja', email: 'baja@prueba.com', disabledAt: new Date(), permissions: { ventas: 'read' } },
        { id: 'otra', name: 'De otra cuenta', email: 'otra@prueba.com', permissions: { ventas: 'read' } },
      ],
    });
    await db.userAccount.createMany({
      data: [
        { userId: 'ventas', accountId: a1 },
        { userId: 'fotos', accountId: a1 },
        { userId: 'baja', accountId: a1 },
        { userId: 'otra', accountId: a2 },
      ],
    });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    storeId = (await db.store.create({ data: { accountId: a1, channelId: channel.id, name: 'TIENDA' } })).id;
    const p1 = await db.product.create({ data: { accountId: a1, name: 'Kit de embrague' } });
    pubId = (await db.publication.create({ data: { productId: p1.id, storeId, externalId: 'MLA1110001', title: 'Kit Embrague Modelo X' } })).id;
  });

  it('a cada cuenta, quienes la ven y tienen la sección', async () => {
    expect((await accountPeople(db, a1, 'ventas')).sort()).toEqual(['admin', 'ventas']);
    expect((await accountPeople(db, a1, null)).sort()).toEqual(['admin', 'fotos', 'ventas']);
  });

  it('guarda una vez por persona, manda a sus dispositivos y borra los que ya no la aceptan', async () => {
    await saveSubscription(db, 'ventas', { endpoint: 'https://push.ejemplo/beto-celu', p256dh: 'k', auth: 'a', label: 'Android · Chrome' });
    await saveSubscription(db, 'ventas', { endpoint: 'https://push.ejemplo/beto-vencida', p256dh: 'k', auth: 'a', label: 'Mac · Safari' });
    // Ana eligió que las ventas no le suenen, pero sí por mail.
    await db.user.update({ where: { id: 'admin' }, data: { notificationPrefs: { venta: { push: false, mail: true } } } });
    await saveSubscription(db, 'admin', { endpoint: 'https://push.ejemplo/ana', p256dh: 'k', auth: 'a', label: '' });
    const input = { userIds: ['admin', 'ventas'], accountId: a1, kind: 'venta' as const, title: 'Venta nueva: Kit', link: '/a/uno/ventas/1', key: 'venta:1' };

    expect(await notify(db, input, deps)).toBe(2);
    expect(pushed).toEqual([{ endpoint: 'https://push.ejemplo/beto-celu', title: 'Venta nueva: Kit' }]);
    expect(mails).toEqual([{ to: 'ana@prueba.com', subject: 'Venta nueva: Kit' }]);
    expect(await db.pushSubscription.count({ where: { userId: 'ventas' } })).toBe(1);
    // La segunda vez no avisa nada.
    expect(await notify(db, input, deps)).toBe(0);
    expect(pushed).toHaveLength(1);

    expect(await unreadCount(db, 'ventas')).toBe(1);
    const [n] = await listNotifications(db, 'ventas');
    expect(n).toMatchObject({ title: 'Venta nueva: Kit', group: 'urgente', account: 'Cuenta uno', read: false });
    await markRead(db, 'ventas', 'all');
    expect(await unreadCount(db, 'ventas')).toBe(0);
  });

  it('en el silencio queda en la campanita sin sonar', async () => {
    await saveSubscription(db, 'ventas', { endpoint: 'https://push.ejemplo/beto', p256dh: 'k', auth: 'a', label: '' });
    await db.user.update({ where: { id: 'ventas' }, data: { quietFrom: 22 * 60, quietTo: 8 * 60, timeZone: BA } });
    const night = new Date('2026-11-15T02:30:00Z');
    await notify(db, { userIds: ['ventas'], accountId: a1, kind: 'fotos', title: 'Fotos corregidas', key: 'fotos:1', now: night }, deps);
    expect(pushed).toHaveLength(0);
    expect(await unreadCount(db, 'ventas')).toBe(1);
  });

  it('avisa las ventas nuevas a quienes ven Ventas, una sola vez y no las viejas', async () => {
    const now = new Date();
    const lines = [{ listingId: 'MLA1110001', title: 'Kit Embrague Modelo X', quantity: 1, unitPrice: 1000 }];
    await db.sale.create({ data: { storeId, orderId: 'O1', state: 'PAID', orderedAt: now, itemsAmount: 1000, buyerNickname: 'COMPRADOR.UNO', lines, checkedAt: now } });
    await db.sale.create({ data: { storeId, orderId: 'O2', state: 'PENDING', orderedAt: now, itemsAmount: 500, lines, checkedAt: now } });
    await db.sale.create({ data: { storeId, orderId: 'O3', state: 'PAID', orderedAt: new Date(now.getTime() - 3 * 86_400_000), itemsAmount: 500, lines, checkedAt: now } });

    expect(await notifyNewSales(db, { now })).toBe(2);
    const rows = await db.notification.findMany({ orderBy: { userId: 'asc' }, select: { userId: true, kind: true, title: true, body: true, link: true } });
    expect(rows.map((r) => r.userId)).toEqual(['admin', 'ventas']);
    expect(rows[0]).toMatchObject({ kind: 'venta', title: 'Venta nueva: Kit Embrague Modelo X' });
    expect(rows[0].body).toContain('COMPRADOR.UNO');
    expect(rows[0].link).toMatch(/^\/a\/uno\/ventas\//);
    expect(await notifyNewSales(db, { now })).toBe(0);
  });

  it('el reclamo llega a quienes ven Ventas con su tipo', async () => {
    const sale = await db.sale.create({ data: { storeId, orderId: 'O9', state: 'PAID', orderedAt: new Date(), itemsAmount: 1000, checkedAt: new Date() } });
    await notifySaleAlarm(db, { kind: 'reclamo', saleId: sale.id, accountId: a1, title: 'Reclamo en la venta O9', body: 'Respondelo.', key: `reclamo:${sale.id}` });
    expect(await db.notification.count({ where: { kind: 'reclamo' } })).toBe(2);
  });

  it('avisa las preguntas que esperan a una persona, no las que el bot va a responder', async () => {
    const pub2 = await db.publication.create({
      data: { productId: (await db.product.findFirstOrThrow()).id, storeId, externalId: 'MLA1110002', title: 'Responde solo', autoAnswer: true },
    });
    await db.user.update({ where: { id: 'fotos' }, data: { permissions: { preguntas: 'write' } } });
    const now = new Date();
    const q = (externalId: string, publicationId: string) =>
      db.buyerQuestion.create({ data: { storeId, externalId, listingId: 'MLA', publicationId, text: '¿Tiene stock?', status: 'UNANSWERED', askedAt: now, readAt: now } });
    await q('1', pubId);
    const waiting = await q('2', pub2.id);
    const leftForPerson = await q('3', pub2.id);
    await db.questionDraft.create({
      data: { questionId: leftForPerson.id, text: '', kind: 'otra', needsPerson: true, model: 'x', usage: {}, costUsd: 0 },
    });

    expect(await notifyPendingQuestions(db, { now })).toBe(4);
    const keys = new Set((await db.notification.findMany({ select: { key: true } })).map((r) => r.key));
    expect(keys.has(`pregunta:${waiting.id}`)).toBe(false);
    expect(keys.has(`pregunta:${leftForPerson.id}`)).toBe(true);
    expect(await notifyPendingQuestions(db, { now })).toBe(0);
  });

  it('la conexión cortada avisa una vez por día', async () => {
    const now = new Date('2026-11-15T15:00:00Z');
    expect(await notifyConnectionCut(db, storeId, now)).toBe(1);
    expect(await notifyConnectionCut(db, storeId, new Date('2026-11-15T20:00:00Z'))).toBe(0);
    const [n] = await db.notification.findMany();
    expect(n).toMatchObject({ userId: 'admin', kind: 'conexion', link: '/a/uno/conexion' });
  });

  it('las tareas avisan al asignar y al vencer, sin mail; las de ventas no avisan como tarea', async () => {
    const t = await db.task.create({
      data: { accountId: a1, title: 'Revisar fotos', dueOn: new Date('2026-11-13T00:00:00Z'), assignees: { create: [{ userId: 'fotos' }, { userId: 'baja' }] } },
    });
    await notifyAssigned(db, t.id);
    expect(await db.notification.findMany({ select: { userId: true, kind: true, title: true } })).toEqual([
      { userId: 'fotos', kind: 'tarea', title: 'Te asignaron: Revisar fotos' },
    ]);
    await taskNoticePass(db, { now: new Date('2026-11-14T15:00:00Z') });
    expect(await db.notification.count({ where: { kind: 'tarea_vencida', userId: 'fotos' } })).toBe(1);

    const sale = await db.task.create({ data: { accountId: a1, title: 'Despachar la venta O1', autoKey: 'despachar:x', assignees: { create: [{ userId: 'admin' }] } } });
    await notifyAssigned(db, sale.id);
    expect(await db.notification.count({ where: { userId: 'admin' } })).toBe(0);
  });

  it('el resumen sale una vez por día, desde las 9, con lo que cada uno ve', async () => {
    await db.publication.update({ where: { id: pubId }, data: { channelStatus: 'PAUSED' } });
    await db.user.update({ where: { id: 'fotos' }, data: { permissions: { publicaciones: 'read' } } });
    // 8:00 en Buenos Aires: todavía no.
    expect(await dailySummaryPass(db, { now: new Date('2026-11-14T11:00:00Z') })).toBe(0);
    expect(await dailySummaryPass(db, { now: new Date('2026-11-14T12:30:00Z') })).toBe(2);
    expect(await dailySummaryPass(db, { now: new Date('2026-11-14T15:30:00Z') })).toBe(0);
    const rows = await db.notification.findMany({ orderBy: { userId: 'asc' }, select: { userId: true, title: true, body: true } });
    expect(rows).toEqual([
      { userId: 'admin', title: 'Resumen de Cuenta uno', body: '1 publicación pausada' },
      { userId: 'fotos', title: 'Resumen de Cuenta uno', body: '1 publicación pausada' },
    ]);
  });
});
