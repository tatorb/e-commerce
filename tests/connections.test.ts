import { createHash } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { parseTokenResponse } from '@/channels/mercadolibre/oauth';
import { decrypt, encrypt } from '@/lib/crypto';
import {
  completeAuthorization,
  connectionSummary,
  disconnect,
  saveAppCredentials,
  startAuthorization,
  withAccessToken,
} from '@/lib/connections';

// Mercado Libre simulado en la computadora. Datos inventados.

const SECRET = 'secreto-de-prueba-123';

describe('cifrado', () => {
  beforeAll(() => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
  });

  it('cifra y descifra, y cada vez da distinto', () => {
    const a = encrypt('llave');
    expect(a).not.toContain('llave');
    expect(encrypt('llave')).not.toBe(a);
    expect(decrypt(a)).toBe('llave');
  });

  it('no se puede leer con otra clave ni si se toca el dato', () => {
    const a = encrypt('llave');
    const parts = a.split(':');
    parts[3] = Buffer.from('otra cosa').toString('base64url');
    expect(() => decrypt(parts.join(':'))).toThrow('CHANNEL_TOKEN_KEY');
    process.env.CHANNEL_TOKEN_KEY = 'otra-clave';
    expect(() => decrypt(a)).toThrow('CHANNEL_TOKEN_KEY cambió');
    delete process.env.CHANNEL_TOKEN_KEY;
    expect(() => encrypt('x')).toThrow('Falta configurar CHANNEL_TOKEN_KEY');
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
  });
});

describe('respuesta de llaves de Mercado Libre', () => {
  it('lee las llaves y el vencimiento', () => {
    const now = new Date('2026-10-18T12:00:00Z');
    expect(
      parseTokenResponse(200, { access_token: 'a', refresh_token: 'r', expires_in: 21600, scope: 'offline_access read write', user_id: 1 }, now),
    ).toEqual({ accessToken: 'a', refreshToken: 'r', expiresAt: new Date('2026-10-18T18:00:00Z'), scope: 'offline_access read write', userId: '1' });
  });

  it('una autorización vencida pide volver a conectar; sin llave de renovación, avisa el permiso que falta', () => {
    expect(() => parseTokenResponse(400, { error: 'invalid_grant' })).toThrow('volver a conectar');
    try {
      parseTokenResponse(400, { error: 'invalid_grant' });
    } catch (e) {
      expect((e as { reauth: boolean }).reauth).toBe(true);
    }
    expect(() => parseTokenResponse(200, { access_token: 'a' })).toThrow('acceso sin conexión');
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('conexión de una tienda', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let server: http.Server;
  // Lo que sabe el Mercado Libre simulado.
  const ml = {
    challenge: '',
    refresh: 'ref-1',
    n: 1,
    refreshCalls: 0,
    revokes: 0,
    meId: '363689851',
    owner: '363689851',
    // Si ya contesta /items/bulk, la forma que reemplaza a /items?ids=.
    bulk: true,
    paths: [] as string[],
    clientIds: [] as string[],
  };
  let storeId = '';
  let accountId = '';

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    process.env.BETTER_AUTH_URL = 'https://app.example.com';
    server = http.createServer((req, res) => {
      const u = new URL(req.url!, 'http://x');
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        const send = (status: number, data: unknown) => {
          res.writeHead(status, { 'content-type': 'application/json' });
          res.end(JSON.stringify(data));
        };
        const auth = req.headers.authorization ?? '';
        if (u.pathname === '/oauth/token') {
          const f = new URLSearchParams(body);
          ml.clientIds.push(f.get('client_id') ?? '');
          if (f.get('client_secret') !== SECRET) return send(401, { error: 'invalid_client' });
          if (f.get('grant_type') === 'authorization_code') {
            const verifier = f.get('code_verifier') ?? '';
            const ok = f.get('code') === 'codigo-bueno' && createHash('sha256').update(verifier).digest('base64url') === ml.challenge;
            if (!ok) return send(400, { error: 'invalid_grant' });
            return send(200, { access_token: 'acc-1', refresh_token: 'ref-1', expires_in: 10800, scope: 'offline_access read write', user_id: ml.meId });
          }
          ml.refreshCalls++;
          await new Promise((r) => setTimeout(r, 150));
          if (f.get('refresh_token') !== ml.refresh) return send(400, { error: 'invalid_grant' });
          ml.n++;
          ml.refresh = `ref-${ml.n}`;
          return send(200, { access_token: `acc-${ml.n}`, refresh_token: ml.refresh, expires_in: 10800, user_id: ml.meId });
        }
        if (!auth.startsWith('Bearer acc-')) return send(401, { message: 'invalid token' });
        if (u.pathname === '/users/me') return send(200, { id: Number(ml.meId), nickname: ml.meId === '363689851' ? 'INSURMOTOR' : 'OTRA' });
        if (u.pathname === '/items/bulk') {
          ml.paths.push(u.pathname);
          if (!ml.bulk) return send(404, {});
          expect(u.searchParams.get('attributes')).toBe('body.id,body.seller_id');
          const ids = (u.searchParams.get('ids') ?? '').split(',');
          return send(200, ids.map((id) => ({ id, status_code: 200, body: { id, seller_id: Number(ml.owner) } })));
        }
        if (u.pathname === '/items') {
          ml.paths.push(u.pathname);
          const ids = (u.searchParams.get('ids') ?? '').split(',');
          return send(200, ids.map((id) => ({ code: 200, body: { id, seller_id: Number(ml.owner) } })));
        }
        if (req.method === 'DELETE') {
          ml.revokes++;
          return send(200, {});
        }
        send(404, {});
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    process.env.MERCADOLIBRE_API_URL = `http://127.0.0.1:${port}`;
    process.env.MERCADOLIBRE_AUTH_URL = 'https://auth.example.com/authorization';
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE connect_attempts, channel_connections, publications, products, stores, channels, accounts, users CASCADE');
    Object.assign(ml, {
      challenge: '',
      refresh: 'ref-1',
      n: 1,
      refreshCalls: 0,
      revokes: 0,
      meId: '363689851',
      owner: '363689851',
      bulk: true,
      paths: [],
      clientIds: [],
    });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Prueba' } })).id;
    storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'INSURMOTOR', externalSellerId: '363689851' } })).id;
  });

  afterAll(async () => {
    delete process.env.MERCADOLIBRE_API_URL;
    delete process.env.MERCADOLIBRE_AUTH_URL;
    await new Promise((r) => server.close(r));
    await db.$disconnect();
  });

  async function connect(code = 'codigo-bueno') {
    const { url: link } = await startAuthorization(db, { storeId, userId: null });
    const q = new URL(link).searchParams;
    ml.challenge = q.get('code_challenge') ?? '';
    return { state: q.get('state')!, result: await completeAuthorization(db, { state: q.get('state')!, code }) };
  }

  it('guarda la clave secreta cifrada y solo deja ver sus últimos 4', async () => {
    await expect(saveAppCredentials(db, { storeId, appId: 'abc', appSecret: SECRET })).rejects.toThrow('App ID');
    await saveAppCredentials(db, { storeId, appId: '1234567890', appSecret: SECRET });
    const row = await db.channelConnection.findUniqueOrThrow({ where: { storeId } });
    expect(row.appSecret).not.toContain(SECRET);
    expect(decrypt(row.appSecret)).toBe(SECRET);
    const summary = await connectionSummary(db, storeId);
    expect(summary).toMatchObject({ appId: '1234567890', appSecretHint: '-123', status: 'NOT_CONNECTED' });
    expect(JSON.stringify(summary)).not.toContain(SECRET);
  });

  it('arma el link de permiso con el código de control y PKCE', async () => {
    await saveAppCredentials(db, { storeId, appId: '1234567890', appSecret: SECRET });
    const { url: link, expiresAt } = await startAuthorization(db, { storeId, userId: null });
    const u = new URL(link);
    expect(u.origin + u.pathname).toBe('https://auth.example.com/authorization');
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: '1234567890',
      redirect_uri: 'https://app.example.com/api/canales/mercadolibre/vuelta',
      code_challenge_method: 'S256',
    });
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(10 * 60_000);
    const attempt = await db.connectAttempt.findFirstOrThrow();
    expect(attempt.codeVerifier.startsWith('v1:')).toBe(true);
    const shared = await startAuthorization(db, { storeId, userId: null, shared: true });
    expect(shared.expiresAt.getTime() - Date.now()).toBeGreaterThan(23 * 3600_000);
  });

  it('a la vuelta guarda las llaves cifradas, y el mismo link no sirve dos veces', async () => {
    await saveAppCredentials(db, { storeId, appId: '1234567890', appSecret: SECRET });
    const { state, result } = await connect();
    expect(result).toEqual({ ok: true, accountSlug: 'prueba', nickname: 'INSURMOTOR' });
    const row = await db.channelConnection.findUniqueOrThrow({ where: { storeId } });
    expect(row).toMatchObject({ status: 'ACTIVE', externalUserId: '363689851', externalNickname: 'INSURMOTOR' });
    expect(row.accessToken).not.toBe('acc-1');
    expect(decrypt(row.refreshToken!)).toBe('ref-1');
    expect(await completeAuthorization(db, { state, code: 'codigo-bueno' })).toMatchObject({ ok: false, error: expect.stringContaining('ya se usó') });
  });

  it('un link vencido no sirve', async () => {
    await saveAppCredentials(db, { storeId, appId: '1234567890', appSecret: SECRET });
    const { url: link } = await startAuthorization(db, { storeId, userId: null, now: new Date(Date.now() - 11 * 60_000) });
    const state = new URL(link).searchParams.get('state')!;
    expect(await completeAuthorization(db, { state, code: 'codigo-bueno' })).toMatchObject({ ok: false, error: expect.stringContaining('venció') });
  });

  it('si autorizan con otra cuenta, avisa y no la guarda', async () => {
    await saveAppCredentials(db, { storeId, appId: '1234567890', appSecret: SECRET });
    ml.meId = '999';
    const { result } = await connect();
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('no es la de la tienda INSURMOTOR') });
    expect((await db.channelConnection.findUniqueOrThrow({ where: { storeId } })).status).toBe('NOT_CONNECTED');
  });

  it('sin número de vendedor, chequea que la cuenta sea la dueña de las publicaciones', async () => {
    await db.store.update({ where: { id: storeId }, data: { externalSellerId: null } });
    const product = await db.product.create({ data: { accountId, name: 'Kit' } });
    await db.publication.create({ data: { productId: product.id, storeId, externalId: 'MLA1' } });
    await saveAppCredentials(db, { storeId, appId: '1234567890', appSecret: SECRET });
    ml.owner = '555';
    expect((await connect()).result).toMatchObject({ ok: false, error: expect.stringContaining('no es la dueña') });
    ml.owner = '363689851';
    expect((await connect()).result).toMatchObject({ ok: true });
    expect((await db.store.findUniqueOrThrow({ where: { id: storeId } })).externalSellerId).toBe('363689851');
    // Usa la forma nueva de Mercado Libre para leer varias a la vez.
    expect(ml.paths).toEqual(['/items/bulk', '/items/bulk']);
  });

  it('si Mercado Libre todavía no acepta la forma nueva, usa la vieja', async () => {
    await db.store.update({ where: { id: storeId }, data: { externalSellerId: null } });
    const product = await db.product.create({ data: { accountId, name: 'Kit' } });
    await db.publication.create({ data: { productId: product.id, storeId, externalId: 'MLA1' } });
    await saveAppCredentials(db, { storeId, appId: '1234567890', appSecret: SECRET });
    ml.bulk = false;
    expect((await connect()).result).toMatchObject({ ok: true });
    expect(ml.paths).toEqual(['/items/bulk', '/items']);
  });

  it('renueva la llave una sola vez aunque la pidan tres a la vez', async () => {
    await saveAppCredentials(db, { storeId, appId: '1234567890', appSecret: SECRET });
    await connect();
    // Todavía no vence: no renueva.
    expect(await withAccessToken(db, storeId, async (t) => t)).toBe('acc-1');
    expect(ml.refreshCalls).toBe(0);
    // Por vencer: renueva una vez, y las tres usan la llave nueva.
    await db.channelConnection.update({ where: { storeId }, data: { expiresAt: new Date(Date.now() + 60_000) } });
    const tokens = await Promise.all([1, 2, 3].map(() => withAccessToken(db, storeId, async (t) => t)));
    expect(tokens).toEqual(['acc-2', 'acc-2', 'acc-2']);
    expect(ml.refreshCalls).toBe(1);
    expect(decrypt((await db.channelConnection.findUniqueOrThrow({ where: { storeId } })).refreshToken!)).toBe('ref-2');
  });

  it('si la renovación falla, la tienda queda para volver a conectar', async () => {
    await saveAppCredentials(db, { storeId, appId: '1234567890', appSecret: SECRET });
    await connect();
    ml.refresh = 'otra';
    await db.channelConnection.update({ where: { storeId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(withAccessToken(db, storeId, async (t) => t)).rejects.toThrow('volver a conectar');
    const row = await db.channelConnection.findUniqueOrThrow({ where: { storeId } });
    expect(row).toMatchObject({ status: 'NEEDS_REAUTH', accessToken: null, refreshToken: null });
  });

  it('cada cuenta usa su propia aplicación', async () => {
    const channel = await db.channel.findFirstOrThrow();
    const other = await db.account.create({ data: { slug: 'otra', name: 'Otra' } });
    const otherStore = await db.store.create({ data: { accountId: other.id, channelId: channel.id, name: 'OTRA', externalSellerId: '363689851' } });
    await saveAppCredentials(db, { storeId, appId: '1111111111', appSecret: SECRET });
    await saveAppCredentials(db, { storeId: otherStore.id, appId: '2222222222', appSecret: SECRET });
    await connect();
    expect(ml.clientIds).toEqual(['1111111111']);
    expect((await db.channelConnection.findUniqueOrThrow({ where: { storeId: otherStore.id } })).status).toBe('NOT_CONNECTED');
  });

  it('desconectar borra las llaves, avisa a Mercado Libre y conserva los datos de la aplicación', async () => {
    await saveAppCredentials(db, { storeId, appId: '1234567890', appSecret: SECRET });
    await connect();
    await disconnect(db, storeId);
    const row = await db.channelConnection.findUniqueOrThrow({ where: { storeId } });
    expect(row).toMatchObject({ status: 'NOT_CONNECTED', accessToken: null, refreshToken: null, appId: '1234567890' });
    expect(ml.revokes).toBe(1);
  });

  it('cambiar de aplicación obliga a volver a autorizar', async () => {
    await saveAppCredentials(db, { storeId, appId: '1234567890', appSecret: SECRET });
    await connect();
    await saveAppCredentials(db, { storeId, appId: '1234567890', appSecret: null });
    expect((await db.channelConnection.findUniqueOrThrow({ where: { storeId } })).status).toBe('ACTIVE');
    await saveAppCredentials(db, { storeId, appId: '9876543210', appSecret: null });
    expect((await db.channelConnection.findUniqueOrThrow({ where: { storeId } })).status).toBe('NOT_CONNECTED');
  });
});
