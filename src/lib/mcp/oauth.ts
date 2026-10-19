import { createHash, timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@/generated/prisma/client';
import { pkceChallenge, randomToken } from '@/lib/crypto';
import { isAllowedRedirectUri, isLoopback } from './redirect-allowlist';

// El permiso para que Claude use la app en nombre de una persona (OAuth 2.1
// con PKCE, lo que piden los conectores de Claude). El código y la llave son
// textos al azar; en la base se guarda solo su huella, así una copia de la
// base no sirve para entrar. Recibe la base por parámetro para poder
// probarlo con una base de prueba.

const CODE_TTL_MS = 10 * 60 * 1000;
export const TOKEN_TTL_S = 60 * 60 * 24 * 30;
// El último uso se anota cada tanto, no en cada pedido.
const LAST_USED_EVERY_MS = 5 * 60 * 1000;

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** La dirección pública desde la que llegó el pedido, para las direcciones de descubrimiento. */
export function baseUrlFromHeaders(headers: Headers, fallback: string): string {
  const url = new URL(fallback);
  const first = (v: string | null) => v?.split(',')[0].trim() || null;
  const host = first(headers.get('x-forwarded-host')) ?? first(headers.get('host')) ?? url.host;
  const proto = first(headers.get('x-forwarded-proto')) ?? url.protocol.replace(':', '');
  return `${proto}://${host}`;
}

export const baseUrlFrom = (req: Request) => baseUrlFromHeaders(req.headers, new URL(req.url).origin);

// ───────────────────────────── Registro del programa ─────────────────────────────

/** Registro dinámico: el programa se presenta con su nombre y sus direcciones de vuelta. */
export async function registerClient(db: PrismaClient, body: unknown) {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const name = typeof b.client_name === 'string' ? b.client_name.trim().slice(0, 100) || null : null;
  const redirectUris = Array.isArray(b.redirect_uris)
    ? b.redirect_uris.filter((u): u is string => typeof u === 'string').slice(0, 10)
    : [];
  const bad = redirectUris.find((u) => !isAllowedRedirectUri(u));
  if (bad) return { ok: false as const, error: 'invalid_redirect_uri', detail: `Dirección de vuelta no permitida: ${bad}` };
  const client = await db.mcpClient.create({ data: { id: `mcp-${randomToken(16)}`, name, redirectUris } });
  return {
    ok: true as const,
    client: {
      client_id: client.id,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
      redirect_uris: redirectUris,
      ...(name ? { client_name: name } : {}),
    },
  };
}

// ───────────────────────────── Pedido de permiso ─────────────────────────────

export type AuthorizeParams = {
  responseType: string | null;
  clientId: string | null;
  redirectUri: string | null;
  state: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
};

const PARAM_KEYS = {
  responseType: 'response_type',
  clientId: 'client_id',
  redirectUri: 'redirect_uri',
  state: 'state',
  codeChallenge: 'code_challenge',
  codeChallengeMethod: 'code_challenge_method',
} as const satisfies Record<keyof AuthorizeParams, string>;

export function readAuthorizeParams(get: (key: string) => unknown): AuthorizeParams {
  const s = (k: string) => {
    const v = get(k);
    return typeof v === 'string' && v !== '' ? v : null;
  };
  return Object.fromEntries(Object.entries(PARAM_KEYS).map(([field, key]) => [field, s(key)])) as AuthorizeParams;
}

/** El pedido como parámetros de dirección, para volver a la pantalla de permiso después del login. */
export function authorizeQuery(p: AuthorizeParams): string {
  return new URLSearchParams(
    Object.entries(PARAM_KEYS).flatMap(([field, key]) => {
      const v = p[field as keyof AuthorizeParams];
      return v ? [[key, v]] : [];
    }),
  ).toString();
}

export type AuthorizeCheck =
  | { ok: true; clientId: string | null; clientName: string; redirectUri: string; destination: string; state: string | null; codeChallenge: string }
  // No se puede volver al programa: se muestra en pantalla.
  | { ok: false; show: string }
  // Se le avisa al programa en su dirección de vuelta.
  | { ok: false; redirect: string };

export function errorRedirect(redirectUri: string, error: string, state: string | null): string {
  const u = new URL(redirectUri);
  u.searchParams.set('error', error);
  if (state) u.searchParams.set('state', state);
  return u.toString();
}

function defaultClientName(redirectUri: string): string {
  if (isLoopback(redirectUri)) return 'Un programa en esta computadora';
  const host = new URL(redirectUri).hostname;
  return host === 'claude.ai' || host === 'claude.com' ? 'Claude' : host;
}

/** Revisa el pedido antes de mostrar la pantalla de permiso y otra vez al tocar Autorizar. */
export async function checkAuthorizeRequest(db: PrismaClient, p: AuthorizeParams): Promise<AuthorizeCheck> {
  // Con una dirección de vuelta dudosa no se redirige nunca.
  if (!p.redirectUri || !isAllowedRedirectUri(p.redirectUri)) {
    return { ok: false, show: 'El pedido no vino de Claude o de un programa permitido.' };
  }
  const client = p.clientId ? await db.mcpClient.findUnique({ where: { id: p.clientId } }) : null;
  const declared = Array.isArray(client?.redirectUris) ? (client.redirectUris as unknown[]) : [];
  if (client && declared.length > 0 && !declared.includes(p.redirectUri)) {
    return { ok: false, show: 'La dirección de vuelta no es la que declaró el programa.' };
  }
  if (p.responseType !== 'code') return { ok: false, redirect: errorRedirect(p.redirectUri, 'unsupported_response_type', p.state) };
  if (!p.codeChallenge || p.codeChallengeMethod !== 'S256') {
    return { ok: false, redirect: errorRedirect(p.redirectUri, 'invalid_request', p.state) };
  }
  return {
    ok: true,
    clientId: client?.id ?? null,
    clientName: client?.name ?? defaultClientName(p.redirectUri),
    redirectUri: p.redirectUri,
    destination: new URL(p.redirectUri).host,
    state: p.state,
    codeChallenge: p.codeChallenge,
  };
}

/** Emite el código que vuelve al programa. Sirve una sola vez y vence a los 10 minutos. */
export async function issueAuthorizationCode(
  db: PrismaClient,
  args: { userId: string; clientId: string | null; redirectUri: string; codeChallenge: string; now?: Date },
): Promise<string> {
  const now = args.now ?? new Date();
  const code = randomToken(32);
  // De paso, se borran los códigos vencidos.
  await db.mcpAuthCode.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } });
  await db.mcpAuthCode.create({
    data: {
      codeHash: hash(code),
      userId: args.userId,
      clientId: args.clientId,
      redirectUri: args.redirectUri,
      codeChallenge: args.codeChallenge,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    },
  });
  return code;
}

function equalSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type ExchangeOutcome =
  | { ok: true; accessToken: string; expiresIn: number }
  | { ok: false; error: 'invalid_request' | 'invalid_grant'; detail: string };

/** Cambia el código por la llave, si el secreto de PKCE coincide. */
export async function exchangeAuthorizationCode(
  db: PrismaClient,
  args: { code: string; codeVerifier: string; redirectUri: string | null; clientId: string | null; now?: Date },
): Promise<ExchangeOutcome> {
  const now = args.now ?? new Date();
  const codeHash = hash(args.code);
  // Se marca usado antes de seguir: un mismo código no sirve dos veces.
  const claimed = await db.mcpAuthCode.updateMany({
    where: { codeHash, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  const row = await db.mcpAuthCode.findUnique({ where: { codeHash }, include: { client: { select: { name: true } } } });
  if (claimed.count === 0 || !row) {
    // Un código usado que vuelve es señal de que alguien lo copió: se cortan
    // las llaves que se dieron con él.
    if (row?.usedAt) await db.mcpToken.updateMany({ where: { codeId: row.id, revokedAt: null }, data: { revokedAt: now } });
    return { ok: false, error: 'invalid_grant', detail: 'El código venció o ya se usó.' };
  }
  if (args.redirectUri !== null && args.redirectUri !== row.redirectUri) {
    return { ok: false, error: 'invalid_grant', detail: 'La dirección de vuelta no coincide.' };
  }
  if (args.clientId && row.clientId && args.clientId !== row.clientId) {
    return { ok: false, error: 'invalid_grant', detail: 'El código es de otro programa.' };
  }
  if (!equalSecret(pkceChallenge(args.codeVerifier), row.codeChallenge)) {
    return { ok: false, error: 'invalid_grant', detail: 'El secreto de PKCE no coincide.' };
  }
  const accessToken = `mcp_${randomToken(32)}`;
  await db.mcpToken.create({
    data: {
      tokenHash: hash(accessToken),
      userId: row.userId,
      clientId: row.clientId,
      clientName: row.client?.name ?? defaultClientName(row.redirectUri),
      codeId: row.id,
      expiresAt: new Date(now.getTime() + TOKEN_TTL_S * 1000),
    },
  });
  return { ok: true, accessToken, expiresIn: TOKEN_TTL_S };
}

// ───────────────────────────── Llaves ─────────────────────────────

/** La persona dueña de la llave, si la llave vale: existe, no venció y no se cortó. */
export async function verifyAccessToken(
  db: PrismaClient,
  token: string,
  now: Date = new Date(),
): Promise<{ userId: string; tokenId: string } | null> {
  if (!token.startsWith('mcp_')) return null;
  const row = await db.mcpToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!row || row.revokedAt || row.expiresAt <= now) return null;
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_EVERY_MS) {
    await db.mcpToken.update({ where: { id: row.id }, data: { lastUsedAt: now } });
  }
  return { userId: row.userId, tokenId: row.id };
}

/** Corta una llave por su valor. Lo usa el programa al desconectarse; una llave desconocida no es error. */
export async function revokeAccessToken(db: PrismaClient, token: string): Promise<void> {
  await db.mcpToken.updateMany({ where: { tokenHash: hash(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Corta una conexión desde Equipo. Solo las propias. */
export async function revokeConnection(db: PrismaClient, userId: string, tokenId: string): Promise<boolean> {
  const r = await db.mcpToken.updateMany({ where: { id: tokenId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return r.count > 0;
}

export async function revokeAllConnections(db: PrismaClient, userId: string): Promise<number> {
  const r = await db.mcpToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return r.count;
}

/** Las conexiones vivas de una persona, para Equipo. Nunca la llave. */
export async function listConnections(db: PrismaClient, userId: string, now: Date = new Date()) {
  return db.mcpToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, clientName: true, createdAt: true, expiresAt: true, lastUsedAt: true },
  });
}
