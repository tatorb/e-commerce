import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { pkceChallenge } from '@/lib/crypto';
import {
  authorizeQuery,
  baseUrlFromHeaders,
  checkAuthorizeRequest,
  exchangeAuthorizationCode,
  issueAuthorizationCode,
  listConnections,
  readAuthorizeParams,
  registerClient,
  revokeAccessToken,
  revokeAllConnections,
  revokeConnection,
  verifyAccessToken,
  type AuthorizeParams,
} from '@/lib/mcp/oauth';
import { isAllowedRedirectUri } from '@/lib/mcp/redirect-allowlist';

// Datos inventados.

const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';

describe('direcciones de vuelta permitidas', () => {
  it('acepta las de Claude y las de la propia computadora', () => {
    expect(isAllowedRedirectUri(CLAUDE, [])).toBe(true);
    expect(isAllowedRedirectUri('https://claude.com/api/mcp/auth_callback', [])).toBe(true);
    expect(isAllowedRedirectUri('http://localhost:6274/oauth/callback', [])).toBe(true);
    expect(isAllowedRedirectUri('http://127.0.0.1:33418/callback', [])).toBe(true);
  });

  it('rechaza cualquier otra, o las de Claude con algo agregado', () => {
    expect(isAllowedRedirectUri('https://otro-sitio.com/api/mcp/auth_callback', [])).toBe(false);
    expect(isAllowedRedirectUri('http://claude.ai/api/mcp/auth_callback', [])).toBe(false);
    expect(isAllowedRedirectUri(`${CLAUDE}?x=1`, [])).toBe(false);
    expect(isAllowedRedirectUri(`${CLAUDE}#x`, [])).toBe(false);
    expect(isAllowedRedirectUri('https://user:pass@claude.ai/api/mcp/auth_callback', [])).toBe(false);
    expect(isAllowedRedirectUri('https://claude.ai.otro-sitio.com/api/mcp/auth_callback', [])).toBe(false);
    expect(isAllowedRedirectUri('javascript:alert(1)', [])).toBe(false);
    expect(isAllowedRedirectUri('no es una dirección', [])).toBe(false);
  });

  it('suma las que se agregan por configuración', () => {
    expect(isAllowedRedirectUri('https://ejemplo.com/cb', ['https://ejemplo.com/cb'])).toBe(true);
  });
});

describe('dirección pública', () => {
  it('usa la que mandó Vercel o, si no, la del pedido', () => {
    const h = new Headers({ 'x-forwarded-host': 'app.ejemplo.com', 'x-forwarded-proto': 'https', host: 'interno:3000' });
    expect(baseUrlFromHeaders(h, 'http://localhost:3000')).toBe('https://app.ejemplo.com');
    expect(baseUrlFromHeaders(new Headers({ host: 'localhost:3000' }), 'http://localhost:3000')).toBe('http://localhost:3000');
  });
});

describe('parámetros del pedido de permiso', () => {
  it('ida y vuelta por la dirección', () => {
    const p: AuthorizeParams = {
      responseType: 'code',
      clientId: 'mcp-1',
      redirectUri: CLAUDE,
      state: 'a b&c',
      codeChallenge: 'x',
      codeChallengeMethod: 'S256',
    };
    const q = new URLSearchParams(authorizeQuery(p));
    expect(readAuthorizeParams((k) => q.get(k))).toEqual(p);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('permiso para Claude', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const verifier = 'secreto-de-pkce-inventado-con-largo-suficiente-1234567890';
  const challenge = pkceChallenge(verifier);

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE mcp_tokens, mcp_auth_codes, mcp_clients, users CASCADE');
    await db.user.create({ data: { id: 'u1', name: 'Persona', email: 'persona@example.com' } });
    await db.user.create({ data: { id: 'u2', name: 'Otra', email: 'otra@example.com' } });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const params = (extra: Partial<AuthorizeParams> = {}): AuthorizeParams => ({
    responseType: 'code',
    clientId: null,
    redirectUri: CLAUDE,
    state: 'estado',
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
    ...extra,
  });

  async function connect(userId = 'u1') {
    const code = await issueAuthorizationCode(db, { userId, clientId: null, redirectUri: CLAUDE, codeChallenge: challenge });
    const r = await exchangeAuthorizationCode(db, { code, codeVerifier: verifier, redirectUri: CLAUDE, clientId: null });
    if (!r.ok) throw new Error(r.detail);
    return r.accessToken;
  }

  it('registra el programa con su nombre y rechaza direcciones de vuelta raras', async () => {
    const r = await registerClient(db, { client_name: 'Claude', redirect_uris: [CLAUDE] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.client.client_id).toMatch(/^mcp-/);
    expect(await db.mcpClient.findUnique({ where: { id: r.client.client_id } })).toMatchObject({ name: 'Claude' });
    const bad = await registerClient(db, { redirect_uris: ['https://otro-sitio.com/cb'] });
    expect(bad.ok).toBe(false);
  });

  it('revisa el pedido: dirección, tipo de respuesta y PKCE', async () => {
    expect(await checkAuthorizeRequest(db, params({ redirectUri: 'https://otro-sitio.com/cb' }))).toMatchObject({ ok: false, show: expect.any(String) });
    expect(await checkAuthorizeRequest(db, params({ responseType: 'token' }))).toEqual({
      ok: false,
      redirect: `${CLAUDE}?error=unsupported_response_type&state=estado`,
    });
    expect(await checkAuthorizeRequest(db, params({ codeChallengeMethod: 'plain' }))).toMatchObject({ ok: false, redirect: expect.stringContaining('invalid_request') });
    expect(await checkAuthorizeRequest(db, params({ codeChallenge: null }))).toMatchObject({ ok: false });
    expect(await checkAuthorizeRequest(db, params())).toMatchObject({ ok: true, clientName: 'Claude', destination: 'claude.ai' });
  });

  it('con un programa registrado, usa su nombre y exige su dirección de vuelta', async () => {
    const r = await registerClient(db, { client_name: 'Claude Desktop', redirect_uris: ['http://localhost:5000/cb'] });
    if (!r.ok) throw new Error('no registró');
    const id = r.client.client_id;
    expect(await checkAuthorizeRequest(db, params({ clientId: id, redirectUri: 'http://localhost:5000/cb' }))).toMatchObject({
      ok: true,
      clientId: id,
      clientName: 'Claude Desktop',
    });
    expect(await checkAuthorizeRequest(db, params({ clientId: id }))).toMatchObject({ ok: false, show: expect.any(String) });
  });

  it('el código se cambia por una llave que vale, y en la base queda solo la huella', async () => {
    const token = await connect();
    expect(token).toMatch(/^mcp_/);
    const row = await db.mcpToken.findFirstOrThrow();
    expect(row.tokenHash).not.toContain(token);
    expect(row.clientName).toBe('Claude');
    expect(await verifyAccessToken(db, token)).toEqual({ userId: 'u1', tokenId: row.id });
    const code = await db.mcpAuthCode.findFirstOrThrow();
    expect(code.usedAt).not.toBeNull();
  });

  it('el código sirve una sola vez; si vuelve, se corta la llave que se dio con él', async () => {
    const code = await issueAuthorizationCode(db, { userId: 'u1', clientId: null, redirectUri: CLAUDE, codeChallenge: challenge });
    const first = await exchangeAuthorizationCode(db, { code, codeVerifier: verifier, redirectUri: CLAUDE, clientId: null });
    expect(first.ok).toBe(true);
    const again = await exchangeAuthorizationCode(db, { code, codeVerifier: verifier, redirectUri: CLAUDE, clientId: null });
    expect(again).toMatchObject({ ok: false, error: 'invalid_grant' });
    if (first.ok) expect(await verifyAccessToken(db, first.accessToken)).toBeNull();
  });

  it('rechaza un secreto de PKCE equivocado, otra dirección de vuelta o un código vencido', async () => {
    const issue = (now?: Date) =>
      issueAuthorizationCode(db, { userId: 'u1', clientId: null, redirectUri: CLAUDE, codeChallenge: challenge, now });
    expect(
      await exchangeAuthorizationCode(db, { code: await issue(), codeVerifier: 'otro', redirectUri: CLAUDE, clientId: null }),
    ).toMatchObject({ ok: false, detail: expect.stringContaining('PKCE') });
    expect(
      await exchangeAuthorizationCode(db, {
        code: await issue(),
        codeVerifier: verifier,
        redirectUri: 'https://claude.com/api/mcp/auth_callback',
        clientId: null,
      }),
    ).toMatchObject({ ok: false });
    const old = await issue(new Date(Date.now() - 11 * 60 * 1000));
    expect(await exchangeAuthorizationCode(db, { code: old, codeVerifier: verifier, redirectUri: CLAUDE, clientId: null })).toMatchObject({
      ok: false,
    });
    expect(await exchangeAuthorizationCode(db, { code: 'inventado', codeVerifier: verifier, redirectUri: CLAUDE, clientId: null })).toMatchObject({
      ok: false,
    });
    expect(await db.mcpToken.count()).toBe(0);
  });

  it('una llave vencida, cortada o inventada no vale', async () => {
    const token = await connect();
    const later = new Date(Date.now() + 31 * 24 * 3600_000);
    expect(await verifyAccessToken(db, token, later)).toBeNull();
    expect(await verifyAccessToken(db, 'mcp_inventada')).toBeNull();
    expect(await verifyAccessToken(db, 'cualquier cosa')).toBeNull();
    await revokeAccessToken(db, token);
    expect(await verifyAccessToken(db, token)).toBeNull();
  });

  it('anota el último uso', async () => {
    const token = await connect();
    await verifyAccessToken(db, token);
    expect((await db.mcpToken.findFirstOrThrow()).lastUsedAt).not.toBeNull();
  });

  it('cada persona corta solo sus conexiones', async () => {
    const mine = await connect('u1');
    await connect('u1');
    const theirs = await connect('u2');
    const [row] = await listConnections(db, 'u1');
    expect(await listConnections(db, 'u1')).toHaveLength(2);
    expect(await revokeConnection(db, 'u2', row.id)).toBe(false);
    expect(await revokeConnection(db, 'u1', row.id)).toBe(true);
    expect(await listConnections(db, 'u1')).toHaveLength(1);
    expect(await revokeAllConnections(db, 'u1')).toBe(1);
    expect(await verifyAccessToken(db, mine)).toBeNull();
    expect(await verifyAccessToken(db, theirs)).not.toBeNull();
  });
});
