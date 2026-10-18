import type { PrismaClient } from '@/generated/prisma/client';
import type { ChannelKind } from '@/generated/prisma/enums';
import { ConnectError, connectPath, getChannelConnector, type ChannelConnector } from '@/channels/connect';
import { decrypt, encrypt, pkceChallenge, randomToken } from '@/lib/crypto';
import { publicAppUrl } from '@/lib/public-url';

// La conexión de cada tienda con su canal: datos de la aplicación del
// cliente, pedido de permiso, vuelta, renovación de llaves y desconexión.
// Todo lo secreto se guarda cifrado. Recibe la base por parámetro para poder
// probarlo con una base de prueba y un canal simulado.

// Cuánto vale el link de autorización: corto desde la app; más largo si se
// le manda al cliente para que lo abra él.
const ATTEMPT_MINUTES = 10;
const SHARED_ATTEMPT_HOURS = 24;
// Se renueva la llave si le queda menos de esto.
const REFRESH_MARGIN_MS = 15 * 60 * 1000;

export function redirectUri(kind: ChannelKind): string {
  return `${publicAppUrl()}${connectPath(kind)}`;
}

async function storeWithChannel(db: PrismaClient, storeId: string) {
  return db.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      accountId: true,
      name: true,
      externalSellerId: true,
      channel: { select: { kind: true } },
      account: { select: { slug: true } },
    },
  });
}

function connectorFor(kind: ChannelKind): ChannelConnector {
  const c = getChannelConnector(kind);
  if (!c) throw new ConnectError('Este canal no se puede conectar por API.');
  return c;
}

/** Guarda el App ID y la clave secreta de la aplicación del cliente. Si cambia la aplicación, hay que volver a autorizar. */
export async function saveAppCredentials(db: PrismaClient, args: { storeId: string; appId: string; appSecret: string | null }) {
  const appId = args.appId.trim();
  const secret = args.appSecret?.trim() ?? '';
  if (!/^\d{4,30}$/.test(appId)) throw new ConnectError('El App ID tiene que ser el número que muestra Mercado Libre en la aplicación.');
  const current = await db.channelConnection.findUnique({ where: { storeId: args.storeId } });
  if (!current && !secret) throw new ConnectError('Falta la clave secreta.');
  if (secret && (secret.length < 10 || /\s/.test(secret))) throw new ConnectError('La clave secreta no parece completa.');
  const changedApp = current !== null && (current.appId !== appId || Boolean(secret));
  const data = {
    appId,
    ...(secret ? { appSecret: encrypt(secret), appSecretHint: secret.slice(-4) } : {}),
    // Otra aplicación: las llaves de la anterior no sirven.
    ...(changedApp
      ? { status: 'NOT_CONNECTED' as const, accessToken: null, refreshToken: null, expiresAt: null, lastError: null }
      : {}),
  };
  if (current) await db.channelConnection.update({ where: { storeId: args.storeId }, data });
  else {
    await db.channelConnection.create({
      data: { storeId: args.storeId, appId, appSecret: encrypt(secret), appSecretHint: secret.slice(-4) },
    });
  }
}

/** Arma el link para pedir permiso. Si es para mandarle al cliente, vale 24 horas; si no, 10 minutos. Se usa una sola vez. */
export async function startAuthorization(
  db: PrismaClient,
  args: { storeId: string; userId: string | null; shared?: boolean; now?: Date },
): Promise<{ url: string; expiresAt: Date }> {
  const store = await storeWithChannel(db, args.storeId);
  if (!store) throw new ConnectError('La tienda no existe.');
  const connection = await db.channelConnection.findUnique({ where: { storeId: args.storeId } });
  if (!connection) throw new ConnectError('Primero cargá el App ID y la clave secreta de la aplicación.');
  const connector = connectorFor(store.channel.kind);
  const now = args.now ?? new Date();
  const verifier = randomToken(48);
  const state = randomToken(24);
  const expiresAt = new Date(now.getTime() + (args.shared ? SHARED_ATTEMPT_HOURS * 3600_000 : ATTEMPT_MINUTES * 60_000));
  await db.connectAttempt.create({
    data: { state, codeVerifier: encrypt(verifier), storeId: store.id, createdById: args.userId, expiresAt },
  });
  const url = connector.authorizeUrl({
    appId: connection.appId,
    redirectUri: redirectUri(store.channel.kind),
    state,
    codeChallenge: pkceChallenge(verifier),
  });
  return { url, expiresAt };
}

export type CompleteOutcome =
  | { ok: true; accountSlug: string; nickname: string }
  | { ok: false; accountSlug: string | null; error: string };

/**
 * La vuelta del canal: confirma el código de control, cambia el código por
 * las llaves y chequea que la cuenta que autorizó sea la de la tienda.
 */
export async function completeAuthorization(
  db: PrismaClient,
  args: { state: string; code: string; now?: Date },
): Promise<CompleteOutcome> {
  const now = args.now ?? new Date();
  // Se marca usado antes de seguir: un mismo link no sirve dos veces.
  const claimed = await db.connectAttempt.updateMany({
    where: { state: args.state, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  const attempt = await db.connectAttempt.findUnique({ where: { state: args.state } });
  const store = attempt ? await storeWithChannel(db, attempt.storeId) : null;
  const slug = store?.account.slug ?? null;
  if (claimed.count === 0 || !attempt || !store) {
    return { ok: false, accountSlug: slug, error: 'El link de autorización venció o ya se usó. Generá uno nuevo.' };
  }
  const connection = await db.channelConnection.findUnique({ where: { storeId: store.id } });
  if (!connection) return { ok: false, accountSlug: slug, error: 'Faltan los datos de la aplicación.' };
  const connector = connectorFor(store.channel.kind);

  try {
    const tokens = await connector.exchangeCode({
      appId: connection.appId,
      appSecret: decrypt(connection.appSecret),
      code: args.code,
      redirectUri: redirectUri(store.channel.kind),
      codeVerifier: decrypt(attempt.codeVerifier),
    });
    const me = await connector.whoAmI(tokens.accessToken);

    // La cuenta que autorizó tiene que ser la de la tienda: por el número de
    // vendedor, o por ser la dueña de las publicaciones que ya están en la app.
    if (store.externalSellerId && store.externalSellerId !== me.id) {
      return {
        ok: false,
        accountSlug: slug,
        error: `Autorizaste con la cuenta ${me.nickname}, que no es la de la tienda ${store.name}. Cerrá esa sesión en Mercado Libre y probá de nuevo.`,
      };
    }
    if (!store.externalSellerId) {
      const sample = await db.publication.findMany({
        where: { storeId: store.id, externalId: { not: null } },
        select: { externalId: true },
        take: 5,
      });
      const owners = await connector.ownersOf(
        tokens.accessToken,
        sample.flatMap((p) => (p.externalId ? [p.externalId] : [])),
      );
      if ([...owners.values()].some((owner) => owner !== me.id)) {
        return {
          ok: false,
          accountSlug: slug,
          error: `Autorizaste con la cuenta ${me.nickname}, que no es la dueña de las publicaciones de ${store.name}.`,
        };
      }
      await db.store.update({ where: { id: store.id }, data: { externalSellerId: me.id } });
    }

    await db.channelConnection.update({
      where: { storeId: store.id },
      data: {
        status: 'ACTIVE',
        externalUserId: me.id,
        externalNickname: me.nickname,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        connectedAt: now,
        connectedById: attempt.createdById,
        lastError: null,
      },
    });
    return { ok: true, accountSlug: slug ?? '', nickname: me.nickname };
  } catch (e) {
    if (e instanceof ConnectError) return { ok: false, accountSlug: slug, error: e.message };
    throw e;
  }
}

/**
 * Corre algo con la llave de uso de la tienda, renovándola antes si está por
 * vencer. La renovación bloquea la fila: la llave de renovación es de un solo
 * uso y dos renovaciones al mismo tiempo romperían la conexión.
 */
export async function withAccessToken<T>(
  db: PrismaClient,
  storeId: string,
  run: (accessToken: string, userId: string) => Promise<T>,
  opts: { now?: () => Date } = {},
): Promise<T> {
  const now = opts.now ?? (() => new Date());
  type Got = { kind: 'token'; accessToken: string; userId: string } | { kind: 'reauth'; message: string };
  const token = await db.$transaction(
    async (tx): Promise<Got> => {
      const [row] = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM channel_connections WHERE "storeId" = ${storeId} FOR UPDATE`;
      if (!row) throw new ConnectError('La tienda no está conectada.');
      const c = await tx.channelConnection.findUniqueOrThrow({
        where: { storeId },
        include: { store: { select: { channel: { select: { kind: true } } } } },
      });
      if (c.status !== 'ACTIVE' || !c.accessToken || !c.refreshToken || !c.externalUserId) {
        throw new ConnectError(
          c.status === 'NEEDS_REAUTH' ? 'Hay que volver a conectar la cuenta.' : 'La tienda no está conectada.',
          c.status === 'NEEDS_REAUTH',
        );
      }
      if (c.expiresAt && c.expiresAt.getTime() - now().getTime() > REFRESH_MARGIN_MS) {
        return { kind: 'token', accessToken: decrypt(c.accessToken), userId: c.externalUserId };
      }
      const connector = connectorFor(c.store.channel.kind);
      try {
        const tokens = await connector.refresh({
          appId: c.appId,
          appSecret: decrypt(c.appSecret),
          refreshToken: decrypt(c.refreshToken),
        });
        await tx.channelConnection.update({
          where: { storeId },
          data: {
            accessToken: encrypt(tokens.accessToken),
            refreshToken: encrypt(tokens.refreshToken),
            expiresAt: tokens.expiresAt,
            scope: tokens.scope ?? c.scope,
            lastRefreshAt: now(),
            lastError: null,
          },
        });
        return { kind: 'token', accessToken: tokens.accessToken, userId: c.externalUserId };
      } catch (e) {
        if (e instanceof ConnectError && e.reauth) return { kind: 'reauth', message: e.message };
        throw e;
      }
    },
    { timeout: 30_000 },
  );
  if (token.kind === 'reauth') {
    // Fuera de la transacción, así la marca queda guardada.
    await db.channelConnection.update({
      where: { storeId },
      data: { status: 'NEEDS_REAUTH', lastError: token.message, accessToken: null, refreshToken: null, expiresAt: null },
    });
    throw new ConnectError(token.message, true);
  }
  return run(token.accessToken, token.userId);
}

/** Desconecta: borra las llaves y avisa al canal. Los datos de la aplicación quedan, para volver a conectar. */
export async function disconnect(db: PrismaClient, storeId: string): Promise<void> {
  const c = await db.channelConnection.findUnique({
    where: { storeId },
    include: { store: { select: { channel: { select: { kind: true } } } } },
  });
  if (!c) return;
  if (c.accessToken && c.externalUserId) {
    try {
      await connectorFor(c.store.channel.kind).revoke({
        accessToken: decrypt(c.accessToken),
        userId: c.externalUserId,
        appId: c.appId,
      });
    } catch {
      // Igual se borran las llaves.
    }
  }
  await db.channelConnection.update({
    where: { storeId },
    data: { status: 'NOT_CONNECTED', accessToken: null, refreshToken: null, expiresAt: null, lastError: null },
  });
}

/** Lo que muestra la pantalla: nunca la clave secreta ni las llaves. */
export async function connectionSummary(db: PrismaClient, storeId: string) {
  return db.channelConnection.findUnique({
    where: { storeId },
    select: {
      appId: true,
      appSecretHint: true,
      status: true,
      externalNickname: true,
      connectedAt: true,
      expiresAt: true,
      lastRefreshAt: true,
      lastError: true,
      connectedBy: { select: { name: true } },
    },
  });
}

export type ConnectionSummary = NonNullable<Awaited<ReturnType<typeof connectionSummary>>>;
