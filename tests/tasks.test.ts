import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import {
  compareTasks,
  dueDate,
  dueText,
  localTimeIn,
  parseTaskInput,
  parseTaskSearch,
  taskFlags,
  taskRights,
  toLocalInput,
} from '@/domain/tasks';
import { taskMail } from '@/domain/task-mail';
import type { McpContext } from '@/lib/mcp/tool';

// Tareas: fechas, permisos, la base, los mails y Claude. Los datos son inventados.

const url = process.env.TEST_DATABASE_URL;
const BA = 'America/Argentina/Buenos_Aires';

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { createTask, updateTask, setTaskStatus, listTasks, tasksOfPublication, attentionCount, openTasksByPublication, getTask } = await import('@/lib/tasks');
const { sendTaskMail, notifyAssigned } = await import('@/lib/task-mail');
const { handleRpc } = await import('@/lib/mcp/server');

describe('las fechas de una tarea', () => {
  it('lee la fecha de aviso en la zona horaria de la cuenta y la vuelve a escribir igual', () => {
    const at = localTimeIn('2026-10-27T09:00', BA)!;
    expect(at.toISOString()).toBe('2026-10-27T12:00:00.000Z');
    expect(toLocalInput(at, BA)).toBe('2026-10-27T09:00');
    expect(localTimeIn('2026-10-27 09:00', BA)?.toISOString()).toBe('2026-10-27T12:00:00.000Z');
    expect(localTimeIn('2026-02-30T09:00', BA)).toBeNull();
    expect(localTimeIn('mañana', BA)).toBeNull();
    expect(dueDate('2026-02-30')).toBeNull();
    expect(dueDate('2026-11-05')?.toISOString()).toBe('2026-11-05T00:00:00.000Z');
  });

  it('sabe si venció, si vence hoy y si llegó el aviso, en el día de la cuenta', () => {
    // 1 de la mañana en UTC: en Buenos Aires todavía es el día anterior.
    const now = new Date('2026-10-27T01:00:00Z');
    const t = (due: string | null, remind: string | null, status: 'PENDING' | 'DONE' = 'PENDING') => ({
      status,
      dueOn: due ? dueDate(due) : null,
      remindAt: remind ? new Date(remind) : null,
    });
    expect(taskFlags(t('2026-10-26', null), now, BA)).toEqual({ overdue: false, dueToday: true, reminding: false });
    expect(taskFlags(t('2026-10-25', '2026-10-26T12:00:00Z'), now, BA)).toEqual({ overdue: true, dueToday: false, reminding: true });
    expect(taskFlags(t('2026-10-25', null, 'DONE'), now, BA)).toEqual({ overdue: false, dueToday: false, reminding: false });
    expect(dueText(t('2026-10-26', null), now, BA)).toBe('Vence hoy');
    expect(dueText(t('2026-10-27', null), now, BA)).toBe('Vence mañana');
    expect(dueText(t('2026-10-25', null), now, BA)).toBe('Venció ayer');
    expect(dueText(t('2026-10-20', null), now, BA)).toBe('Venció hace 6 días');
    expect(dueText(t('2026-11-05', null), now, BA)).toBe('Vence el 05/11/2026');
  });

  it('pone primero las vencidas, después las del aviso y las que vencen antes', () => {
    const now = new Date('2026-10-27T15:00:00Z');
    const mk = (id: string, due: string | null, remind: string | null, created: string) => ({
      id,
      status: 'PENDING' as const,
      dueOn: due ? dueDate(due) : null,
      remindAt: remind ? new Date(remind) : null,
      createdAt: new Date(created),
    });
    const list = [
      mk('sin-fecha', null, null, '2026-10-20T00:00:00Z'),
      mk('mas-tarde', '2026-11-10', null, '2026-10-20T00:00:00Z'),
      mk('aviso', '2026-11-20', '2026-10-27T12:00:00Z', '2026-10-20T00:00:00Z'),
      mk('vencida', '2026-10-20', null, '2026-10-20T00:00:00Z'),
      mk('antes', '2026-11-01', null, '2026-10-20T00:00:00Z'),
    ];
    expect(list.sort(compareTasks(now, BA)).map((t) => t.id)).toEqual(['vencida', 'aviso', 'antes', 'mas-tarde', 'sin-fecha']);
  });
});

describe('lo que se escribe y quién puede', () => {
  it('limpia lo que llega y dice qué falta', () => {
    const ok = parseTaskInput(
      { title: '  Revisar fotos ', description: ' ', remindAt: '2026-10-27T09:00', dueOn: '2026-10-30', assigneeIds: ['a', 'a', 'b'], publicationIds: [] },
      BA,
    );
    expect(ok).toEqual({
      title: 'Revisar fotos',
      description: '',
      remindAt: new Date('2026-10-27T12:00:00Z'),
      dueOn: new Date('2026-10-30T00:00:00Z'),
      assigneeIds: ['a', 'b'],
      publicationIds: [],
    });
    const base = { title: 'x', description: '', remindAt: '', dueOn: '', assigneeIds: ['a'], publicationIds: [] };
    expect(() => parseTaskInput({ ...base, title: ' ' }, BA)).toThrow('Poné qué hay que hacer.');
    expect(() => parseTaskInput({ ...base, assigneeIds: [] }, BA)).toThrow('Elegí al menos una persona.');
    expect(() => parseTaskInput({ ...base, dueOn: '2026-13-01' }, BA)).toThrow('La fecha de finalización no es válida.');
    expect(() => parseTaskInput({ ...base, remindAt: 'el lunes' }, BA)).toThrow('La fecha de aviso no es válida.');
    expect(parseTaskInput(base, BA)).toMatchObject({ remindAt: null, dueOn: null });
  });

  it('cada uno mueve las suyas; ver todas y editar piden el permiso', () => {
    const none = { isAdmin: false, permissions: {} };
    expect(taskRights(none, 'yo', ['yo'])).toEqual({ see: true, edit: false, move: true });
    expect(taskRights(none, 'yo', ['otro'])).toEqual({ see: false, edit: false, move: false });
    expect(taskRights({ isAdmin: false, permissions: { tareas: 'read' } }, 'yo', ['otro'])).toEqual({ see: true, edit: false, move: false });
    expect(taskRights({ isAdmin: false, permissions: { tareas: 'write' } }, 'yo', ['otro'])).toEqual({ see: true, edit: true, move: true });
    expect(taskRights({ isAdmin: true, permissions: {} }, 'yo', [])).toEqual({ see: true, edit: true, move: true });
  });

  it('lee los filtros de la pantalla', () => {
    expect(parseTaskSearch({})).toMatchObject({ view: 'abiertas', statuses: ['PENDING', 'IN_PROGRESS'], mine: false, people: [] });
    expect(parseTaskSearch({ ver: 'todas', mias: '1', persona: 'u1,mal id', q: ' fotos ' })).toMatchObject({
      view: 'todas',
      statuses: ['PENDING', 'IN_PROGRESS', 'DONE', 'SUSPENDED'],
      mine: true,
      people: ['u1'],
      q: 'fotos',
    });
    expect(parseTaskSearch({ ver: 'inventada' }).view).toBe('abiertas');
  });

  it('arma el mail con el link y sin dejar pasar etiquetas', () => {
    const mail = taskMail({
      kind: 'OVERDUE',
      person: 'Ana',
      account: 'Cuenta de prueba',
      title: 'Revisar <b>fotos</b>',
      description: 'Las del kit',
      status: 'IN_PROGRESS',
      remindAt: null,
      dueOn: dueDate('2026-10-25'),
      people: ['Ana', 'Beto'],
      publications: ['Kit Embrague Modelo X · MLA1110001'],
      link: 'https://app.ejemplo.com/a/uno/tareas/t1',
      timeZone: BA,
    });
    expect(mail.subject).toBe('Venció: Revisar <b>fotos</b>');
    expect(mail.text).toContain('Esta tarea de Cuenta de prueba venció el 25/10/2026 y sigue en proceso.');
    expect(mail.text).toContain('- Kit Embrague Modelo X · MLA1110001');
    expect(mail.text).toContain('Abrir la tarea: https://app.ejemplo.com/a/uno/tareas/t1');
    expect(mail.html).toContain('Revisar &lt;b&gt;fotos&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>fotos</b>');
    expect(mail.html).toContain('href="https://app.ejemplo.com/a/uno/tareas/t1"');
  });
});

describe.skipIf(!url)('tareas en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let a1 = '';
  let a2 = '';
  let pubId = '';
  let otherPub = '';
  // Resend de mentira: guarda lo que le llega.
  const sent: { body: { to: string[]; subject: string; text: string }; headers: IncomingHttpHeaders }[] = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      sent.push({ body: JSON.parse(raw), headers: req.headers });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: `mail-${sent.length}` }));
    });
  });

  beforeAll(async () => {
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    process.env.RESEND_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    delete process.env.RESEND_API_URL;
    delete process.env.RESEND_API_KEY;
    server.close();
    await db.$disconnect();
  });

  beforeEach(async () => {
    sent.length = 0;
    delete process.env.RESEND_API_KEY;
    await db.$executeRawUnsafe(
      'TRUNCATE task_assignees, task_publications, tasks, activity_logs, user_accounts, sessions, mcp_tokens, publications, products, stores, channels, accounts, users CASCADE',
    );
    a1 = (await db.account.create({ data: { slug: 'uno', name: 'Cuenta uno' } })).id;
    a2 = (await db.account.create({ data: { slug: 'dos', name: 'Cuenta dos' } })).id;
    await db.user.createMany({
      data: [
        { id: 'admin', name: 'Ana', email: 'ana@prueba.com', isAdmin: true },
        { id: 'beto', name: 'Beto', email: 'beto@prueba.com' },
        { id: 'carla', name: 'Carla', email: 'carla@prueba.com', permissions: { tareas: 'write' } },
        { id: 'baja', name: 'Dado de baja', email: 'baja@prueba.com', disabledAt: new Date() },
        { id: 'otra', name: 'De otra cuenta', email: 'otra@prueba.com' },
      ],
    });
    await db.userAccount.createMany({
      data: [
        { userId: 'beto', accountId: a1 },
        { userId: 'carla', accountId: a1 },
        { userId: 'baja', accountId: a1 },
        { userId: 'otra', accountId: a2 },
      ],
    });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const s1 = await db.store.create({ data: { accountId: a1, channelId: channel.id, name: 'TIENDA' } });
    const s2 = await db.store.create({ data: { accountId: a2, channelId: channel.id, name: 'OTRA' } });
    const p1 = await db.product.create({ data: { accountId: a1, name: 'Kit de embrague' } });
    const p2 = await db.product.create({ data: { accountId: a2, name: 'Bomba de agua' } });
    pubId = (await db.publication.create({ data: { productId: p1.id, storeId: s1.id, externalId: 'MLA1110001', title: 'Kit Embrague Modelo X' } })).id;
    otherPub = (await db.publication.create({ data: { productId: p2.id, storeId: s2.id, externalId: 'MLA2220002', title: 'Bomba Agua Modelo Y' } })).id;
  });

  const input = (over: Partial<Parameters<typeof parseTaskInput>[0] & object> = {}) =>
    parseTaskInput({ title: 'Revisar fotos', description: '', remindAt: '', dueOn: '', assigneeIds: ['beto'], publicationIds: [pubId], ...over }, BA);

  it('solo asigna a personas activas que ven la cuenta y publicaciones de la cuenta', async () => {
    await expect(createTask(db, { accountId: a1, actorId: 'admin', input: input({ assigneeIds: ['otra'] }) })).rejects.toThrow('no ve esta cuenta');
    await expect(createTask(db, { accountId: a1, actorId: 'admin', input: input({ assigneeIds: ['baja'] }) })).rejects.toThrow('no está activa');
    await expect(createTask(db, { accountId: a1, actorId: 'admin', input: input({ publicationIds: [otherPub] }) })).rejects.toThrow('no es de esta cuenta');
    // Un administrador ve todas las cuentas: se le puede asignar.
    const t = await createTask(db, { accountId: a1, actorId: 'carla', input: input({ assigneeIds: ['admin', 'carla'] }) });
    const rows = await db.taskAssignee.findMany({ where: { taskId: t.id }, orderBy: { userId: 'asc' } });
    // Quien se la asigna a sí misma no recibe el mail de asignación.
    expect(rows.map((r) => [r.userId, r.notifiedAt !== null])).toEqual([
      ['admin', false],
      ['carla', true],
    ]);
  });

  it('cada uno ve las suyas; con el permiso, todas', async () => {
    const mine = await createTask(db, { accountId: a1, actorId: 'admin', input: input({ title: 'De Beto' }) });
    await createTask(db, { accountId: a1, actorId: 'admin', input: input({ title: 'De Carla', assigneeIds: ['carla'], publicationIds: [] }) });
    const done = await createTask(db, { accountId: a1, actorId: 'admin', input: input({ title: 'Hecha', assigneeIds: ['carla'] }) });
    await setTaskStatus(db, { accountId: a1, taskId: done.id, status: 'DONE' });

    const beto = { id: 'beto', access: { isAdmin: false, permissions: {} } };
    const carla = { id: 'carla', access: { isAdmin: false, permissions: { tareas: 'write' as const } } };
    const open = parseTaskSearch({});
    const seen = await listTasks(db, { accountId: a1, viewer: beto, filters: open, timeZone: BA });
    expect(seen.tasks.map((t) => [t.title, t.rights])).toEqual([['De Beto', { see: true, edit: false, move: true }]]);
    const all = await listTasks(db, { accountId: a1, viewer: carla, filters: open, timeZone: BA });
    expect(all.tasks.map((t) => t.title).sort()).toEqual(['De Beto', 'De Carla']);
    expect(all.counts).toEqual({ abiertas: 2, finalizadas: 1, suspendidas: 0, todas: 3 });
    const onlyMine = await listTasks(db, { accountId: a1, viewer: carla, filters: parseTaskSearch({ mias: '1', ver: 'todas' }), timeZone: BA });
    expect(onlyMine.tasks.map((t) => t.title).sort()).toEqual(['De Carla', 'Hecha']);
    const found = await listTasks(db, { accountId: a1, viewer: carla, filters: parseTaskSearch({ q: 'mla1110001', ver: 'todas' }), timeZone: BA });
    expect(found.tasks.map((t) => t.title).sort()).toEqual(['De Beto', 'Hecha']);

    // En la publicación, y el número del tablero.
    expect((await tasksOfPublication(db, { publicationId: pubId, viewer: beto, timeZone: BA })).map((t) => t.title)).toEqual(['De Beto']);
    expect(await openTasksByPublication(db, { publicationIds: [pubId], viewer: carla })).toEqual(new Map([[pubId, 1]]));
    expect(await getTask(db, { accountId: a1, taskId: done.id, viewer: beto })).toBeNull();
    expect(await getTask(db, { accountId: a2, taskId: mine.id, viewer: carla })).toBeNull();
  });

  it('editar vuelve a programar los mails de las fechas y avisa a las personas nuevas', async () => {
    const t = await createTask(db, { accountId: a1, actorId: 'admin', input: input({ remindAt: '2026-10-27T09:00', dueOn: '2026-10-30' }) });
    await db.task.update({ where: { id: t.id }, data: { remindedAt: new Date(), overdueNotifiedAt: new Date() } });
    await db.taskAssignee.updateMany({ where: { taskId: t.id }, data: { notifiedAt: new Date() } });

    // Mismas fechas: no se vuelven a mandar.
    await updateTask(db, { accountId: a1, taskId: t.id, actorId: 'admin', input: input({ title: 'Otro título', remindAt: '2026-10-27T09:00', dueOn: '2026-10-30' }) });
    expect(await db.task.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ title: 'Otro título', remindedAt: expect.any(Date), overdueNotifiedAt: expect.any(Date) });

    const r = await updateTask(db, {
      accountId: a1,
      taskId: t.id,
      actorId: 'carla',
      input: input({ remindAt: '2026-10-28T10:00', dueOn: '2026-11-02', assigneeIds: ['beto', 'carla', 'admin'], publicationIds: [] }),
    });
    expect(r.added.sort()).toEqual(['admin', 'carla']);
    const after = await db.task.findUniqueOrThrow({ where: { id: t.id }, include: { assignees: true, publications: true } });
    expect(after).toMatchObject({ remindedAt: null, overdueNotifiedAt: null, publications: [] });
    expect(Object.fromEntries(after.assignees.map((a) => [a.userId, a.notifiedAt !== null]))).toEqual({ beto: true, carla: true, admin: false });

    await setTaskStatus(db, { accountId: a1, taskId: t.id, status: 'DONE' });
    expect((await db.task.findUniqueOrThrow({ where: { id: t.id } })).doneAt).toBeInstanceOf(Date);
    await setTaskStatus(db, { accountId: a1, taskId: t.id, status: 'IN_PROGRESS' });
    expect((await db.task.findUniqueOrThrow({ where: { id: t.id } })).doneAt).toBeNull();
  });

  it('el número del menú cuenta las suyas abiertas que llegaron al aviso o vencieron', async () => {
    const now = new Date('2026-10-27T15:00:00Z');
    await createTask(db, { accountId: a1, actorId: 'admin', input: input({ title: 'Aviso hoy', remindAt: '2026-10-27T09:00' }) });
    await createTask(db, { accountId: a1, actorId: 'admin', input: input({ title: 'Vencida', dueOn: '2026-10-26' }) });
    await createTask(db, { accountId: a1, actorId: 'admin', input: input({ title: 'Vence hoy', dueOn: '2026-10-27' }) });
    await createTask(db, { accountId: a1, actorId: 'admin', input: input({ title: 'Aviso mañana', remindAt: '2026-10-28T09:00' }) });
    const done = await createTask(db, { accountId: a1, actorId: 'admin', input: input({ title: 'Hecha', dueOn: '2026-10-20' }) });
    await setTaskStatus(db, { accountId: a1, taskId: done.id, status: 'DONE' });
    await createTask(db, { accountId: a1, actorId: 'admin', input: input({ title: 'De otra', dueOn: '2026-10-20', assigneeIds: ['carla'] }) });
    expect(await attentionCount(db, { accountId: a1, userId: 'beto', timeZone: BA, now })).toBe(2);
  });

  it('los mails salen una vez, a las personas activas, y no los viejos', async () => {
    const now = new Date('2026-10-27T15:00:00Z');
    const t = await createTask(db, {
      accountId: a1,
      actorId: 'admin',
      input: input({ title: 'Revisar fotos', assigneeIds: ['beto', 'carla'], remindAt: '2026-10-27T09:00', dueOn: '2026-10-26' }),
      now,
    });
    // Alguien que después se dio de baja no recibe nada.
    await db.taskAssignee.create({ data: { taskId: t.id, userId: 'baja' } });
    // Uno viejo: su aviso fue hace una semana.
    await createTask(db, { accountId: a1, actorId: 'admin', input: input({ title: 'Vieja', remindAt: '2026-10-20T09:00' }), now });
    await db.taskAssignee.updateMany({ where: { task: { title: 'Vieja' } }, data: { notifiedAt: now } });

    // Sin la clave de Resend, no sale nada y nada se marca.
    expect(await sendTaskMail(db, { budgetMs: 5000, now, baseUrl: 'https://app.ejemplo.com' })).toEqual({ configured: false, sent: 0, pending: false });
    expect(sent).toHaveLength(0);

    process.env.RESEND_API_KEY = 're_prueba';
    const r = await sendTaskMail(db, { budgetMs: 5000, now, baseUrl: 'https://app.ejemplo.com' });
    expect(r).toEqual({ configured: true, sent: 6, pending: false });
    const subjects = sent.map((m) => `${m.body.to[0]} ${m.body.subject}`).sort();
    expect(subjects).toEqual([
      'beto@prueba.com Aviso: Revisar fotos',
      'beto@prueba.com Nueva tarea: Revisar fotos',
      'beto@prueba.com Venció: Revisar fotos',
      'carla@prueba.com Aviso: Revisar fotos',
      'carla@prueba.com Nueva tarea: Revisar fotos',
      'carla@prueba.com Venció: Revisar fotos',
    ]);
    expect(sent[0].headers.authorization).toBe('Bearer re_prueba');
    expect(sent[0].headers['idempotency-key']).toMatch(new RegExp(`^tarea-${t.id}-`));
    expect(sent.find((m) => m.body.subject.startsWith('Aviso'))!.body.text).toContain(`https://app.ejemplo.com/a/uno/tareas/${t.id}`);

    // La segunda pasada no repite nada.
    sent.length = 0;
    expect((await sendTaskMail(db, { budgetMs: 5000, now, baseUrl: 'https://app.ejemplo.com' })).sent).toBe(0);
    expect(sent).toHaveLength(0);
    expect(await notifyAssigned(db, t.id, 'https://app.ejemplo.com')).toBe(0);
  });

  it('si Resend no responde, el mail se vuelve a probar en la pasada siguiente', async () => {
    const now = new Date('2026-10-27T15:00:00Z');
    await createTask(db, { accountId: a1, actorId: 'admin', input: input({ remindAt: '2026-10-27T09:00' }), now });
    await db.taskAssignee.updateMany({ data: { notifiedAt: now } });
    process.env.RESEND_API_KEY = 're_prueba';
    process.env.RESEND_API_URL = 'http://127.0.0.1:1';
    try {
      expect(await sendTaskMail(db, { budgetMs: 5000, now, baseUrl: 'https://app.ejemplo.com' })).toMatchObject({ sent: 0 });
    } finally {
      process.env.RESEND_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    }
    expect((await db.task.findFirstOrThrow()).remindedAt).toBeNull();
    expect((await sendTaskMail(db, { budgetMs: 5000, now, baseUrl: 'https://app.ejemplo.com' })).sent).toBe(1);
  });

  it('Claude ve y mueve las tareas de la persona, y crea o edita solo con el permiso', async () => {
    const ctx = (userId: string, access: McpContext['access']): McpContext => ({ db, userId, access, baseUrl: 'https://app.ejemplo.com' });
    const call = async (c: McpContext, name: string, args: object) => {
      const r = (await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, c)) as {
        result: { content: { text: string }[]; isError?: boolean };
      };
      return { text: r.result.content[0].text, isError: r.result.isError === true };
    };
    const list = async (c: McpContext) =>
      ((await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, c)) as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name);

    const carla = ctx('carla', { isAdmin: false, permissions: { tareas: 'write' }, accountIds: [a1] });
    const made = await call(carla, 'create_task', {
      cuenta: 'uno',
      titulo: 'Cargar la ficha técnica',
      personas: ['beto', 'yo'],
      publicaciones: ['MLA1110001'],
      aviso: '2026-10-27 09:00',
      finalizacion: '2026-10-30',
    });
    expect(made.isError).toBe(false);
    const task = JSON.parse(made.text).tarea as { id: string; personas: string[]; aviso: string; finalizacion: string; link_app: string };
    expect(task).toMatchObject({ personas: ['Beto', 'Carla'], aviso: '27/10/26 09:00', finalizacion: '30/10/2026' });
    expect(task.link_app).toBe(`https://app.ejemplo.com/a/uno/tareas/${task.id}`);
    expect(await db.activityLog.findFirstOrThrow({ where: { userId: 'carla' } })).toMatchObject({ section: 'tareas', via: 'CLAUDE', publicationId: pubId });
    expect((await call(carla, 'create_task', { cuenta: 'uno', titulo: 'x', personas: ['De otra'] })).text).toContain('No hay nadie "De otra"');

    // Beto no tiene el permiso de Tareas: ve y mueve la suya, nada más.
    const beto = ctx('beto', { isAdmin: false, permissions: {}, accountIds: [a1] });
    const tools = await list(beto);
    expect(tools).toEqual(expect.arrayContaining(['list_tasks', 'update_task']));
    expect(tools).not.toContain('create_task');
    const seen = JSON.parse((await call(beto, 'list_tasks', { cuenta: 'uno' })).text) as { ve_todas: boolean; tareas: { id: string }[] };
    expect(seen).toMatchObject({ ve_todas: false, tareas: [{ id: task.id }] });
    expect(await call(beto, 'update_task', { cuenta: 'uno', tarea: task.id, estado: 'en_proceso' })).toMatchObject({ isError: false });
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('IN_PROGRESS');
    expect(await call(beto, 'update_task', { cuenta: 'uno', tarea: task.id, titulo: 'Otra cosa' })).toMatchObject({
      isError: true,
      text: expect.stringContaining('no puede hacer cambios en Tareas'),
    });
    expect(await call(beto, 'create_task', { cuenta: 'uno', titulo: 'x' })).toMatchObject({ isError: true });

    // Una que no es suya, para Beto, no existe.
    const other = await createTask(db, { accountId: a1, actorId: 'admin', input: input({ assigneeIds: ['carla'] }) });
    expect((await call(beto, 'update_task', { cuenta: 'uno', tarea: other.id, estado: 'finalizada' })).text).toContain('No hay una tarea');

    // Carla edita: lo que no pasa queda como estaba.
    expect(await call(carla, 'update_task', { cuenta: 'uno', tarea: task.id, finalizacion: '', publicaciones: [] })).toMatchObject({ isError: false });
    expect(await db.task.findUniqueOrThrow({ where: { id: task.id }, include: { publications: true } })).toMatchObject({
      title: 'Cargar la ficha técnica',
      dueOn: null,
      remindAt: new Date('2026-10-27T12:00:00Z'),
      publications: [],
    });
  });
});
