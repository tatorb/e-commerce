import { ConnectError, type ChannelConnector, type TokenSet } from '../connect-types';
import { readItems } from './http';
import { apiUrl, authUrl } from './urls';

// Autorización de Mercado Libre (OAuth con PKCE). La llave de uso dura unas
// horas; la de renovación, 6 meses, y es de un solo uso.

type TokenBody = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  user_id?: unknown;
  error?: unknown;
  message?: unknown;
};

/** Traduce la respuesta del pedido de llaves. */
export function parseTokenResponse(status: number, body: TokenBody, now = new Date()): TokenSet {
  if (status >= 400 || body.error) {
    const code = String(body.error ?? status);
    // invalid_grant: el código o la llave de renovación ya no sirven.
    const reauth = code === 'invalid_grant' || status === 401;
    const detail = typeof body.message === 'string' ? body.message : code;
    throw new ConnectError(
      reauth ? 'Mercado Libre no aceptó la autorización: hay que volver a conectar.' : `Mercado Libre no dio las llaves. Motivo: ${detail}`,
      reauth,
    );
  }
  if (typeof body.access_token !== 'string' || typeof body.refresh_token !== 'string') {
    throw new ConnectError('Mercado Libre no devolvió la llave de renovación. Revisá que la aplicación tenga el permiso de acceso sin conexión.');
  }
  const seconds = Number(body.expires_in);
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: new Date(now.getTime() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 10800) * 1000),
    scope: typeof body.scope === 'string' ? body.scope : null,
    userId: String(body.user_id ?? ''),
  };
}

async function tokenRequest(params: Record<string, string>): Promise<TokenSet> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl()}/oauth/token`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
  } catch {
    throw new ConnectError('No se pudo conectar con Mercado Libre. Probá de nuevo.');
  }
  let body: TokenBody = {};
  try {
    body = (await res.json()) as TokenBody;
  } catch {
    // Sin cuerpo: alcanza con el código.
  }
  return parseTokenResponse(res.status, body);
}

async function getJson(path: string, accessToken: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl()}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
  } catch {
    throw new ConnectError('No se pudo conectar con Mercado Libre. Probá de nuevo.');
  }
  if (res.status === 401) throw new ConnectError('Mercado Libre no aceptó la llave: hay que volver a conectar.', true);
  if (!res.ok) throw new ConnectError(`Mercado Libre respondió con un error (código ${res.status}).`);
  return res.json();
}

export const mercadolibreConnector: ChannelConnector = {
  setupSteps({ redirectUri, noticesUri }) {
    return [
      'Entrá a developers.mercadolibre.com.ar/devcenter con el usuario principal de la cuenta de Mercado Libre del cliente.',
      'Andá a "Mis aplicaciones" y tocá "Crear aplicación". Si pide validar los datos del titular, tienen que ser exactamente los de cuando se creó la cuenta.',
      'Nombre: E-commerce Studio MRB. Completá la descripción corta con "Corrección de publicaciones".',
      `En "URIs de redirect" pegá exactamente: ${redirectUri}`,
      'Activá PKCE.',
      'En los flujos OAuth marcá Authorization Code y Refresh token. Client credentials no.',
      'En unidades de negocio elegí solo Mercado Libre, sin VIS.',
      'En permisos elegí lectura y escritura de publicaciones, lectura y escritura de la comunicación con los compradores (preguntas), lectura de usuarios y de métricas, y acceso sin conexión ("offline access"). Ventas, facturación, pagos, promociones y publicidad, sin acceso.',
      `En "Notificaciones callbacks URL" pegá: ${noticesUri}. En los tópicos marcá solo el de preguntas ("Questions").`,
      'Guardá. Copiá el App ID y la Clave secreta y pegalos acá abajo.',
    ];
  },

  authorizeUrl({ appId, redirectUri, state, codeChallenge }) {
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${authUrl()}?${q.toString()}`;
  },

  exchangeCode({ appId, appSecret, code, redirectUri, codeVerifier }) {
    return tokenRequest({
      grant_type: 'authorization_code',
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });
  },

  refresh({ appId, appSecret, refreshToken }) {
    return tokenRequest({ grant_type: 'refresh_token', client_id: appId, client_secret: appSecret, refresh_token: refreshToken });
  },

  async whoAmI(accessToken) {
    const body = (await getJson('/users/me', accessToken)) as { id?: unknown; nickname?: unknown };
    if (body.id === undefined) throw new ConnectError('Mercado Libre no dijo de qué cuenta es la autorización.');
    return { id: String(body.id), nickname: String(body.nickname ?? body.id) };
  },

  async ownersOf(accessToken, externalIds) {
    const out = new Map<string, string>();
    for (const item of await readItems(accessToken, externalIds, ['id', 'seller_id'])) {
      if (item.seller_id !== undefined && item.seller_id !== null) out.set(String(item.id), String(item.seller_id));
    }
    return out;
  },

  async revoke({ accessToken, userId, appId }) {
    try {
      await fetch(`${apiUrl()}/users/${encodeURIComponent(userId)}/applications/${encodeURIComponent(appId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // Si no se pudo avisar, la app igual borra las llaves.
    }
  },
};
