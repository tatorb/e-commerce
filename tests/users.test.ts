import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { buildActivitySheet, parseActivitySearch, ACTIVITY_COLUMNS } from '@/domain/activity';
import type { McpContext } from '@/lib/mcp/tool';

// Usuarios, permisos, actividad y Claude con el usuario de una persona. Los
// datos son inventados.

const url = process.env.TEST_DATABASE_URL;

// La app crea su conexión a la base al cargarse: que apunte a la de prueba.
vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { saveUserAccess, saveUserProfile, setUserDisabled, listUsers, UserError } = await import('@/lib/users');
const { logActivity } = await import('@/lib/activity');
const { loadActivity, activitySheetRows } = await import('@/lib/queries/activity');
const { handleRpc } = await import('@/lib/mcp/server');

describe('la planilla de la actividad', () => {
  it('lee los filtros y arma las columnas', () => {
    expect(parseActivitySearch({ persona: 'u1,mal id', seccion: 'pipeline,inventada,equipo', tipo: 'cambios,raro', desde: '2026-10-01', page: '2' })).toMatchObject({
      people: ['u1'],
      sections: ['pipeline', 'equipo'],
      types: ['cambios'],
      from: '2026-10-01',
      to: null,
      page: 2,
    });
    const csv = buildActivitySheet(
      [
        {
          createdAt: new Date('2026-10-20T15:30:00Z'),
          kind: 'CHANGE',
          summary: 'Aprobó el título',
          section: 'pipeline',
          person: 'Ana',
          account: 'Cuenta de prueba',
          target: 'Kit de embrague · MLA1',
          detail: 'Kit Embrague Modelo X',
          via: 'CLAUDE',
        },
      ],
      'America/Argentina/Buenos_Aires',
    );
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain(ACTIVITY_COLUMNS.map((c) => `"${c}"`).join(','));
    expect(csv).toContain('"2026-10-20 12:30","Ana","Aprobó el título","Pipeline","Cuenta de prueba","Kit de embrague · MLA1","Kit Embrague Modelo X","Claude"');
  });
});

describe.skipIf(!url)('usuarios en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let a1 = '';
  let a2 = '';
  let pubId = '';

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE activity_logs, user_accounts, sessions, mcp_tokens, title_works, pipeline_movements, publications, products, stores, channels, accounts, users CASCADE',
    );
    await db.user.createMany({
      data: [
        { id: 'admin', name: 'Ana', email: 'ana@prueba.com', isAdmin: true },
        { id: 'edit', name: 'Beto', email: 'beto@prueba.com' },
      ],
    });
    a1 = (await db.account.create({ data: { slug: 'uno', name: 'Cuenta uno' } })).id;
    a2 = (await db.account.create({ data: { slug: 'dos', name: 'Cuenta dos' } })).id;
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const store = await db.store.create({ data: { accountId: a1, channelId: channel.id, name: 'TIENDA' } });
    const product = await db.product.create({ data: { accountId: a1, name: 'Kit de embrague' } });
    pubId = (await db.publication.create({ data: { productId: product.id, storeId: store.id, externalId: 'MLA1110001', title: 'Kit Embrague Modelo X' } })).id;
  });

  it('guarda los permisos limpios y las cuentas que ve', async () => {
    await saveUserAccess(db, { userId: 'edit', isAdmin: false, permissions: { pipeline: 'write', registro: 'write', inventada: 'read' } as never, accountIds: [a1, a1] });
    expect(await db.user.findUniqueOrThrow({ where: { id: 'edit' }, select: { permissions: true } })).toEqual({ permissions: { pipeline: 'write', registro: 'read' } });
    expect((await db.userAccount.findMany({ where: { userId: 'edit' } })).map((r) => r.accountId)).toEqual([a1]);
    // Cambiar las cuentas reemplaza las anteriores.
    await saveUserAccess(db, { userId: 'edit', isAdmin: false, permissions: {}, accountIds: [a2] });
    expect((await db.userAccount.findMany({ where: { userId: 'edit' } })).map((r) => r.accountId)).toEqual([a2]);
    await expect(saveUserAccess(db, { userId: 'edit', isAdmin: false, permissions: {}, accountIds: ['no-existe'] })).rejects.toThrow('Alguna de las cuentas no existe.');
    await expect(saveUserProfile(db, { userId: 'edit', name: 'Beto', email: 'ANA@prueba.com' })).rejects.toThrow('Ya hay otra persona con ese email.');
    await saveUserProfile(db, { userId: 'edit', name: ' Beto B. ', email: 'Beto.B@Prueba.com ' });
    expect(await db.user.findUniqueOrThrow({ where: { id: 'edit' }, select: { name: true, email: true } })).toEqual({ name: 'Beto B.', email: 'beto.b@prueba.com' });
  });

  it('siempre queda un administrador, y la baja corta las sesiones y las conexiones con Claude', async () => {
    await expect(saveUserAccess(db, { userId: 'admin', isAdmin: false, permissions: {}, accountIds: [] })).rejects.toThrow(UserError);
    await expect(setUserDisabled(db, { actorId: 'edit', userId: 'admin', disabled: true })).rejects.toThrow('Tiene que quedar al menos un administrador.');
    await expect(setUserDisabled(db, { actorId: 'admin', userId: 'admin', disabled: true })).rejects.toThrow('No te podés dar de baja a vos.');

    const soon = new Date(Date.now() + 3600_000);
    await db.session.create({ data: { id: 's1', token: 't1', userId: 'edit', expiresAt: soon } });
    await db.mcpToken.create({ data: { tokenHash: 'h1', userId: 'edit', clientName: 'Claude', expiresAt: soon } });
    await setUserDisabled(db, { actorId: 'admin', userId: 'edit', disabled: true });
    expect(await db.session.count({ where: { userId: 'edit' } })).toBe(0);
    expect(await db.mcpToken.findFirstOrThrow({ where: { userId: 'edit' } })).toMatchObject({ revokedAt: expect.any(Date) });
    expect((await listUsers(db)).map((u) => [u.id, Boolean(u.disabledAt)])).toEqual([
      ['admin', false],
      ['edit', true],
    ]);
    await setUserDisabled(db, { actorId: 'admin', userId: 'edit', disabled: false });
    expect((await db.user.findUniqueOrThrow({ where: { id: 'edit' } })).disabledAt).toBeNull();

    // Con otro administrador, el primero puede dejar de serlo.
    await saveUserAccess(db, { userId: 'edit', isAdmin: true, permissions: {}, accountIds: [] });
    await saveUserAccess(db, { userId: 'admin', isAdmin: false, permissions: {}, accountIds: [] });
    expect((await db.user.findUniqueOrThrow({ where: { id: 'admin' } })).isAdmin).toBe(false);
  });

  it('la actividad guarda cómo se llamaba lo que se tocó y se filtra', async () => {
    await logActivity(db, { userId: 'edit', accountId: a1, section: 'pipeline', summary: 'Aprobó el título', publicationId: pubId, detail: `  Kit   ${'x'.repeat(600)}` });
    await logActivity(db, { userId: 'admin', kind: 'SIGN_IN', summary: 'Entró a la app' });
    await logActivity(db, { userId: null, email: 'alguien@prueba.com', kind: 'SIGN_IN_FAILED', summary: 'No pudo entrar' });
    // Si algo falla al anotar, no corta lo que se estaba haciendo.
    await expect(logActivity(db, { userId: 'no-existe', summary: 'x' })).resolves.toBeUndefined();

    const first = await db.activityLog.findFirstOrThrow({ where: { userId: 'edit' } });
    expect(first).toMatchObject({ targetLabel: 'Kit Embrague Modelo X · MLA1110001', productId: expect.any(String), via: 'APP' });
    expect(first.detail!.length).toBeLessThanOrEqual(500);
    expect(first.detail!.startsWith('Kit x')).toBe(true);

    const all = await loadActivity(db, parseActivitySearch({}), 'America/Argentina/Buenos_Aires');
    expect(all.total).toBe(3);
    const changes = await loadActivity(db, parseActivitySearch({ tipo: 'cambios', persona: 'edit' }), 'America/Argentina/Buenos_Aires');
    expect(changes.entries.map((e) => [e.summary, e.href])).toEqual([['Aprobó el título', `/a/uno/publicaciones/${pubId}`]]);
    const failed = await activitySheetRows(db, parseActivitySearch({ tipo: 'fallidos' }), 'America/Argentina/Buenos_Aires');
    expect(failed).toMatchObject([{ person: 'alguien@prueba.com', summary: 'No pudo entrar' }]);
    const old = await loadActivity(db, parseActivitySearch({ hasta: '2020-01-01' }), 'America/Argentina/Buenos_Aires');
    expect(old.total).toBe(0);
  });

  it('Claude hace solo lo que puede la persona, en sus cuentas, y queda en su actividad', async () => {
    const ctx = (access: McpContext['access']): McpContext => ({ db, userId: 'edit', access, baseUrl: 'https://app.ejemplo.com' });
    const call = async (c: McpContext, name: string, args: object) => {
      const r = (await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, c)) as {
        result: { content: { text: string }[]; isError?: boolean };
      };
      return { text: r.result.content[0].text, isError: r.result.isError === true };
    };
    const list = async (c: McpContext) =>
      ((await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, c)) as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name);

    // Solo ve el Pipeline de la cuenta uno.
    const viewer = ctx({ isAdmin: false, permissions: { pipeline: 'read' }, accountIds: [a1] });
    const tools = await list(viewer);
    expect(tools).toContain('get_pipeline_board');
    expect(tools).not.toContain('approve_title');
    expect(tools).not.toContain('update_title_rules');
    const denied = await call(viewer, 'set_title_words', { cuenta: 'uno', publicacion: 'MLA1110001', palabras: ['kit'], estado: 'usar' });
    expect(denied).toMatchObject({ isError: true, text: expect.stringContaining('no puede hacer cambios en Pipeline') });
    // La otra cuenta no existe para esta persona.
    const other = await call(viewer, 'get_pipeline_board', { cuenta: 'dos' });
    expect(other).toMatchObject({ isError: true, text: expect.stringContaining('No hay una cuenta "dos"') });
    expect(other.text).not.toContain('Cuenta dos');
    const accounts = JSON.parse((await call(viewer, 'list_accounts', {})).text) as { cuentas: { cuenta: string }[] };
    expect(accounts.cuentas.map((c) => c.cuenta)).toEqual(['uno']);

    // Con permiso para cambiar, lo hace y queda a su nombre, hecho por Claude.
    const editor = ctx({ isAdmin: false, permissions: { pipeline: 'write' }, accountIds: [a1] });
    const done = await call(editor, 'set_publication_title', { cuenta: 'uno', publicacion: 'MLA1110001', titulo: 'Kit Embrague Modelo X Original' });
    expect(done.isError).toBe(false);
    expect(await db.activityLog.findFirstOrThrow({ where: { userId: 'edit' } })).toMatchObject({
      accountId: a1,
      publicationId: pubId,
      section: 'pipeline',
      via: 'CLAUDE',
      kind: 'CHANGE',
    });
    // Lo que solo lee no se anota.
    expect(await db.activityLog.count()).toBe(1);
  });
});
