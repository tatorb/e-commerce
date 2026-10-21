import type { PrismaClient } from '@/generated/prisma/client';
import { decrypt, encrypt, pkceChallenge, randomToken } from '@/lib/crypto';
import { publicAppUrl } from '@/lib/public-url';

// La conexión del estudio con su Google Drive y lo que la app hace ahí:
// carpetas, subidas, listas y miniaturas. Hoy guarda los videos de cada
// producto. El cliente de Google lo crea el estudio en su proyecto de Google
// Cloud; la clave secreta y las llaves se guardan cifradas. Recibe la base por
// parámetro para poder probarlo con una base de prueba y un Google simulado.

export class DriveError extends Error {
  constructor(
    message: string,
    // La conexión ya no sirve: hay que volver a conectar.
    readonly reauth = false,
    readonly status: number | null = null,
  ) {
    super(message);
  }
}

const ROW = 'estudio';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
export const DRIVE_CALLBACK_PATH = '/api/google/vuelta';
export const ROOT_FOLDER_NAME = 'E-commerce Studio MRB';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const ATTEMPT_MINUTES = 10;
// La llave de uso de Google dura una hora: se renueva si le queda menos de esto.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
export const NOT_CONNECTED = 'El Drive del estudio no está conectado. Se conecta en Equipo.';

// Direcciones de Google. Se pueden cambiar con variables de entorno para
// probar contra un Google simulado.
export const googleAuthUrl = () => process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
const googleTokenUrl = () => process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const googleRevokeUrl = () => process.env.GOOGLE_REVOKE_URL || 'https://oauth2.googleapis.com/revoke';
export const googleApiUrl = () => (process.env.GOOGLE_API_URL || 'https://www.googleapis.com').replace(/\/+$/, '');

export function driveRedirectUri(): string {
  return `${publicAppUrl()}${DRIVE_CALLBACK_PATH}`;
}

// Cómo guarda la app un archivo del Drive en la base: "drive:<id del archivo>".
const REF = 'drive:';
export const driveRef = (fileId: string) => `${REF}${fileId}`;

/** El id del archivo en el Drive, o null si está guardado en otro lado. */
export function driveIdOf(ref: string | null | undefined): string | null {
  return ref?.startsWith(REF) ? ref.slice(REF.length) || null : null;
}

export function folderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

// ───────────────────────────── Llaves ─────────────────────────────

type TokenBody = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  error?: unknown;
  error_description?: unknown;
};

export type GoogleTokens = { accessToken: string; refreshToken: string | null; expiresAt: Date; scope: string | null };

/** Traduce la respuesta del pedido de llaves de Google. */
export function parseGoogleTokens(status: number, body: TokenBody, now = new Date()): GoogleTokens {
  if (status >= 400 || body.error) {
    const code = String(body.error ?? status);
    if (code === 'invalid_grant') throw new DriveError('Google no aceptó la autorización: hay que volver a conectar el Drive.', true);
    if (code === 'invalid_client' || code === 'unauthorized_client') {
      throw new DriveError('Google no reconoce el ID o la clave secreta del cliente. Revisalos en Equipo.', true);
    }
    if (code === 'redirect_uri_mismatch') {
      throw new DriveError(`En el cliente de Google falta la dirección de vuelta: ${driveRedirectUri()}`, true);
    }
    const detail = typeof body.error_description === 'string' ? body.error_description : code;
    throw new DriveError(`Google no dio las llaves. Motivo: ${detail}`);
  }
  if (typeof body.access_token !== 'string') throw new DriveError('Google no devolvió la llave de uso.');
  const seconds = Number(body.expires_in);
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
    expiresAt: new Date(now.getTime() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 3600) * 1000),
    scope: typeof body.scope === 'string' ? body.scope : null,
  };
}

async function tokenRequest(params: Record<string, string>, now: Date): Promise<GoogleTokens> {
  let res: Response;
  try {
    res = await fetch(googleTokenUrl(), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
  } catch {
    throw new DriveError('No se pudo conectar con Google. Probá de nuevo.');
  }
  let body: TokenBody = {};
  try {
    body = (await res.json()) as TokenBody;
  } catch {
    // Sin cuerpo: alcanza con el código.
  }
  return parseGoogleTokens(res.status, body, now);
}

// ───────────────────────────── Pedidos al Drive ─────────────────────────────

type GoogleErrorBody = { error?: { code?: number; message?: string; errors?: { reason?: string }[] } };

/** Traduce un error del Drive a algo que se entienda. */
export function driveFailure(status: number, body: GoogleErrorBody | null): DriveError {
  const reason = body?.error?.errors?.[0]?.reason ?? '';
  if (status === 401) return new DriveError('Google no aceptó la llave del Drive: hay que volver a conectarlo en Equipo.', true, 401);
  if (status === 403 && /insufficient|scope/i.test(reason + (body?.error?.message ?? ''))) {
    return new DriveError('Falta el permiso para el Drive: volvé a conectarlo en Equipo y tildá el permiso de los archivos.', true, 403);
  }
  if (status === 403 && /storageQuota/i.test(reason)) return new DriveError('El Drive del estudio está lleno.', false, 403);
  if (status === 404) return new DriveError('El archivo ya no está en el Drive.', false, 404);
  if (status === 429 || status >= 500 || /rateLimit/i.test(reason)) {
    return new DriveError('Google no respondió a tiempo. Probá de nuevo en un rato.', false, status);
  }
  return new DriveError(`Google respondió con un error (código ${status}${reason ? `, ${reason}` : ''}).`, false, status);
}

async function driveFetch(token: string, path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 20_000, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${googleApiUrl()}${path}`, {
      ...rest,
      headers: { Authorization: `Bearer ${token}`, ...headers },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  } catch {
    throw new DriveError('No se pudo conectar con Google. Probá de nuevo.');
  }
  if (!res.ok && res.status !== 206 && res.status !== 308) {
    const body = (await res.json().catch(() => null)) as GoogleErrorBody | null;
    throw driveFailure(res.status, body);
  }
  return res;
}

async function driveJson<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await driveFetch(token, path, { ...init, headers: { Accept: 'application/json', ...init.headers } });
  return (await res.json()) as T;
}

/** Comillas y barras de un valor dentro de una búsqueda del Drive. */
export function driveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Lo que se pide de cada video.
export const VIDEO_FIELDS = 'id,name,mimeType,size,createdTime,webViewLink,trashed,parents,videoMediaMetadata(width,height,durationMillis)';

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  webViewLink?: string;
  trashed?: boolean;
  parents?: string[];
  thumbnailLink?: string;
  appProperties?: Record<string, string>;
  videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string };
};

export async function getFile(token: string, fileId: string, fields = VIDEO_FIELDS): Promise<DriveFile | null> {
  try {
    return await driveJson<DriveFile>(token, `/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}`);
  } catch (e) {
    if (e instanceof DriveError && e.status === 404) return null;
    throw e;
  }
}

export async function listFiles(token: string, q: string, fields = VIDEO_FIELDS, max = 500): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | null = null;
  do {
    const params = new URLSearchParams({
      q,
      fields: `nextPageToken,files(${fields})`,
      pageSize: String(Math.min(100, max)),
      orderBy: 'createdTime',
      spaces: 'drive',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const page = await driveJson<{ files?: DriveFile[]; nextPageToken?: string }>(token, `/drive/v3/files?${params}`);
    files.push(...(page.files ?? []));
    pageToken = page.nextPageToken ?? null;
  } while (pageToken && files.length < max);
  return files.slice(0, max);
}

export async function trashFile(token: string, fileId: string): Promise<void> {
  await driveJson(token, `/drive/v3/files/${encodeURIComponent(fileId)}?fields=id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}

/**
 * Abre una subida por partes y devuelve su dirección. La dirección sirve solo
 * para este archivo: con ella suben el navegador o el trabajador de la Mac,
 * sin la llave del Drive. Si sube el navegador, la subida se abre con el
 * origen de la app, así el navegador la puede usar.
 */
export async function startResumableUpload(
  token: string,
  args: { folderId: string; name: string; type: string; size?: number; origin?: string; properties: Record<string, string> },
): Promise<string> {
  const res = await driveFetch(token, `/upload/drive/v3/files?uploadType=resumable&fields=${encodeURIComponent(VIDEO_FIELDS)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': args.type,
      ...(args.size !== undefined ? { 'X-Upload-Content-Length': String(args.size) } : {}),
      ...(args.origin ? { Origin: args.origin } : {}),
    },
    body: JSON.stringify({ name: args.name, parents: [args.folderId], mimeType: args.type, appProperties: args.properties }),
  });
  const location = res.headers.get('location');
  if (!location || !isUploadSessionUrl(location)) throw new DriveError('Google no abrió la subida. Probá de nuevo.');
  return location;
}

/** Si una dirección es de una subida por partes del Drive. Así la app no reenvía partes a cualquier lado. */
export function isUploadSessionUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (
    url.origin === new URL(googleApiUrl()).origin &&
    url.pathname === '/upload/drive/v3/files' &&
    url.searchParams.get('uploadType') === 'resumable' &&
    Boolean(url.searchParams.get('upload_id'))
  );
}

/** Sube un archivo desde la app, de una sola vez. */
export async function uploadContent(
  token: string,
  args: { folderId: string; name: string; type: string; data: Uint8Array | ArrayBuffer; properties: Record<string, string> },
): Promise<DriveFile> {
  const size = args.data.byteLength;
  const session = await startResumableUpload(token, { ...args, size });
  let res: Response;
  try {
    res = await fetch(session, {
      method: 'PUT',
      headers: { 'Content-Type': args.type },
      body: args.data as BodyInit,
      signal: AbortSignal.timeout(240_000),
      cache: 'no-store',
    });
  } catch {
    throw new DriveError('Se cortó la subida al Drive. Probá de nuevo.');
  }
  if (!res.ok) throw driveFailure(res.status, (await res.json().catch(() => null)) as GoogleErrorBody | null);
  const file = (await res.json()) as DriveFile;
  if (!file.id) throw new DriveError('Google no confirmó el archivo subido.');
  return file;
}

/** Mueve un archivo a otra carpeta, y si se pide le cambia el nombre. */
export async function moveFile(token: string, fileId: string, args: { to: string; from: string[]; name?: string }): Promise<void> {
  const params = new URLSearchParams({ addParents: args.to, fields: 'id' });
  if (args.from.length > 0) params.set('removeParents', args.from.join(','));
  await driveJson(token, `/drive/v3/files/${encodeURIComponent(fileId)}?${params}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args.name ? { name: args.name } : {}),
  });
}

/** El archivo entero, para leerlo desde la app. Null si ya no está. */
export async function fileContent(token: string, fileId: string): Promise<Response | null> {
  try {
    return await driveFetch(token, `/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { timeoutMs: 120_000 });
  } catch (e) {
    if (e instanceof DriveError && e.status === 404) return null;
    throw e;
  }
}

/** Un pedazo del archivo, para verlo en la app. */
export async function fileMedia(token: string, fileId: string, range: string): Promise<Response> {
  return driveFetch(token, `/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { Range: range }, timeoutMs: 45_000 });
}

/** La miniatura que arma Google, del ancho pedido. Null si todavía no la tiene. */
export async function fileThumbnail(token: string, fileId: string, width: number): Promise<Response | null> {
  const file = await getFile(token, fileId, 'id,thumbnailLink');
  if (!file?.thumbnailLink) return null;
  // El link viene con el tamaño al final, por ejemplo "=s220".
  const link = file.thumbnailLink.replace(/=s\d+$/, `=s${width}`);
  try {
    const res = await fetch(link, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

// ───────────────────────────── Carpetas ─────────────────────────────

// Una carpeta de la app: su clave, su nombre y la carpeta donde va.
export type FolderSpec = { key: string; name: string; parent: FolderSpec | null };

const ROOT: FolderSpec = { key: 'raiz', name: ROOT_FOLDER_NAME, parent: null };

type Named = { id: string; name: string };
export type FolderOwner = { account: Named; product: Named };

/** La cuenta y el producto, para armar sus carpetas. */
export async function folderOwner(db: PrismaClient, productId: string): Promise<FolderOwner> {
  const p = await db.product.findUniqueOrThrow({ where: { id: productId }, select: { id: true, name: true, account: { select: { id: true, name: true } } } });
  return { account: p.account, product: { id: p.id, name: p.name } };
}

/** E-commerce Studio MRB / cuenta / producto. */
function productFolder(account: Named, product: Named): FolderSpec {
  const accountFolder: FolderSpec = { key: `cuenta:${account.id}`, name: account.name.trim() || 'Cuenta', parent: ROOT };
  return { key: `producto:${product.id}`, name: product.name.trim() || 'Producto', parent: accountFolder };
}

/** E-commerce Studio MRB / cuenta / producto / Videos. */
export function videosFolder(account: Named, product: Named): FolderSpec {
  return { key: `videos:${product.id}`, name: 'Videos', parent: productFolder(account, product) };
}

export type PhotoFolder = 'originales' | 'corregidas' | 'trabajo';
const PHOTO_FOLDER_NAME: Record<PhotoFolder, string> = { originales: 'Originales', corregidas: 'Corregidas', trabajo: 'Trabajo de la app' };

/**
 * Las carpetas de las fotos del producto: los originales, las corregidas
 * aprobadas, y lo que usa la app para mostrarlas (vistas livianas, siluetas y
 * las corregidas que todavía no se aprobaron).
 */
export function photoFolder(account: Named, product: Named, which: PhotoFolder): FolderSpec {
  const photos: FolderSpec = { key: `fotos:${product.id}`, name: 'Fotos', parent: productFolder(account, product) };
  return { key: `${which}:${product.id}`, name: PHOTO_FOLDER_NAME[which], parent: photos };
}

/** Las imágenes y los PDF del fabricante. */
export function manufacturerFolder(account: Named, product: Named): FolderSpec {
  return { key: `fabricante:${product.id}`, name: 'Fabricante', parent: productFolder(account, product) };
}

/** El id de una carpeta que la app ya armó en esta cuenta de Google, sin preguntarle al Drive. */
export async function knownFolderId(db: PrismaClient, key: string, email: string): Promise<string | null> {
  const row = await db.driveFolder.findUnique({ where: { key } });
  return row && row.email === email ? row.folderId : null;
}

/**
 * La carpeta, creada si hace falta. Si alguien la borró, se arma de nuevo; si
 * la movió, se sigue usando donde esté. Cada carpeta lleva una marca de la app
 * para encontrarla aunque se pierda lo guardado.
 */
export async function ensureFolder(db: PrismaClient, token: string, email: string, spec: FolderSpec): Promise<string> {
  const cached = await knownFolderId(db, spec.key, email);
  if (cached) {
    const f = await getFile(token, cached, 'id,trashed');
    if (f && !f.trashed) return f.id;
  }
  const found = await listFiles(
    token,
    `appProperties has { key='mrb' and value='${driveQueryValue(spec.key)}' } and mimeType='${FOLDER_MIME}' and trashed=false`,
    'id',
    1,
  );
  let id = found[0]?.id ?? null;
  if (!id) {
    const parentId = spec.parent ? await ensureFolder(db, token, email, spec.parent) : 'root';
    const created = await driveJson<{ id: string }>(token, '/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: spec.name, mimeType: FOLDER_MIME, parents: [parentId], appProperties: { mrb: spec.key } }),
    });
    id = created.id;
  }
  await db.driveFolder.upsert({
    where: { key: spec.key },
    create: { key: spec.key, folderId: id, email },
    update: { folderId: id, email },
  });
  return id;
}

// ───────────────────────────── Conexión ─────────────────────────────

const CLIENT_ID = /^[\w-]+\.apps\.googleusercontent\.com$/;

/** Guarda el ID y la clave secreta del cliente de Google. Si cambia el cliente, hay que volver a conectar. */
export async function saveDriveCredentials(db: PrismaClient, args: { clientId: string; clientSecret: string | null }): Promise<void> {
  const clientId = args.clientId.trim();
  const secret = args.clientSecret?.trim() ?? '';
  if (!CLIENT_ID.test(clientId)) throw new DriveError('El ID del cliente termina en .apps.googleusercontent.com. Copialo entero de Google Cloud.');
  const current = await db.driveConnection.findUnique({ where: { id: ROW } });
  if (!current && !secret) throw new DriveError('Falta la clave secreta del cliente.');
  if (secret && (secret.length < 10 || /\s/.test(secret))) throw new DriveError('La clave secreta no parece completa.');
  const changed = current !== null && (current.clientId !== clientId || Boolean(secret));
  const data = {
    clientId,
    ...(secret ? { clientSecret: encrypt(secret), clientSecretHint: secret.slice(-4) } : {}),
    // Otro cliente: las llaves del anterior no sirven.
    ...(changed ? { status: 'NOT_CONNECTED' as const, accessToken: null, refreshToken: null, expiresAt: null, lastError: null } : {}),
  };
  if (current) await db.driveConnection.update({ where: { id: ROW }, data });
  else await db.driveConnection.create({ data: { id: ROW, clientId, clientSecret: encrypt(secret), clientSecretHint: secret.slice(-4) } });
}

/** Arma el link para pedirle permiso a Google. Vale 10 minutos y se usa una sola vez. */
export async function startDriveAuthorization(db: PrismaClient, args: { userId: string | null; now?: Date }): Promise<string> {
  const c = await db.driveConnection.findUnique({ where: { id: ROW } });
  if (!c) throw new DriveError('Primero cargá el ID y la clave secreta del cliente de Google.');
  const now = args.now ?? new Date();
  const verifier = randomToken(48);
  const state = randomToken(24);
  await db.driveConnection.update({
    where: { id: ROW },
    data: {
      pendingState: state,
      pendingVerifier: encrypt(verifier),
      pendingUntil: new Date(now.getTime() + ATTEMPT_MINUTES * 60_000),
      pendingById: args.userId,
    },
  });
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: driveRedirectUri(),
    response_type: 'code',
    scope: DRIVE_SCOPE,
    // Sin conexión y con la pantalla de permiso siempre: así Google da la llave de renovación.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: 'S256',
  });
  return `${googleAuthUrl()}?${params}`;
}

export type DriveCompleteOutcome = { ok: true; email: string } | { ok: false; error: string };

/** La vuelta de Google: confirma el código de control, cambia el código por las llaves y anota la cuenta. */
export async function completeDriveAuthorization(
  db: PrismaClient,
  args: { state: string; code: string; now?: Date },
): Promise<DriveCompleteOutcome> {
  const now = args.now ?? new Date();
  const c = args.state ? await db.driveConnection.findUnique({ where: { pendingState: args.state } }) : null;
  // Se marca usado antes de seguir: un mismo link no sirve dos veces.
  const claimed = c
    ? await db.driveConnection.updateMany({
        where: { id: ROW, pendingState: args.state, pendingUntil: { gt: now } },
        data: { pendingState: null, pendingVerifier: null, pendingUntil: null },
      })
    : { count: 0 };
  if (!c || !c.pendingVerifier || claimed.count === 0) {
    return { ok: false, error: 'El link para conectar el Drive venció o ya se usó. Probá de nuevo desde Equipo.' };
  }
  try {
    const tokens = await tokenRequest(
      {
        grant_type: 'authorization_code',
        code: args.code,
        client_id: c.clientId,
        client_secret: decrypt(c.clientSecret),
        redirect_uri: driveRedirectUri(),
        code_verifier: decrypt(c.pendingVerifier),
      },
      now,
    );
    if (!tokens.refreshToken) {
      return { ok: false, error: 'Google no dio la llave de renovación. Sacale el permiso a la app en tu cuenta de Google y conectá de nuevo.' };
    }
    if (!tokens.scope?.split(/\s+/).includes(DRIVE_SCOPE)) {
      return { ok: false, error: 'No tildaste el permiso para ver y editar los archivos del Drive. Conectá de nuevo y tildalo.' };
    }
    const about = await driveJson<{ user?: { emailAddress?: string } }>(tokens.accessToken, '/drive/v3/about?fields=user(emailAddress)');
    const email = about.user?.emailAddress?.toLowerCase();
    if (!email) return { ok: false, error: 'Google no dijo de qué cuenta es el Drive. Probá de nuevo.' };
    // Otra cuenta de Google: las carpetas de la anterior no están en este Drive.
    if (c.email && c.email !== email) await db.driveFolder.deleteMany({});
    await db.driveConnection.update({
      where: { id: ROW },
      data: {
        status: 'ACTIVE',
        email,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        connectedAt: now,
        connectedById: c.pendingById,
        lastError: null,
      },
    });
    return { ok: true, email };
  } catch (e) {
    if (e instanceof DriveError) return { ok: false, error: e.message };
    throw e;
  }
}

async function markReauth(db: PrismaClient, message: string): Promise<void> {
  await db.driveConnection.update({
    where: { id: ROW },
    data: { status: 'NEEDS_REAUTH', lastError: message, accessToken: null, refreshToken: null, expiresAt: null },
  });
}

/**
 * Corre algo con la llave de uso del Drive, renovándola antes si está por
 * vencer. La renovación bloquea la fila, así dos pedidos al mismo tiempo no
 * la renuevan dos veces.
 */
export async function withDriveToken<T>(
  db: PrismaClient,
  run: (token: string, email: string) => Promise<T>,
  opts: { now?: () => Date } = {},
): Promise<T> {
  const now = opts.now ?? (() => new Date());
  const fresh = (c: { expiresAt: Date | null }) => c.expiresAt !== null && c.expiresAt.getTime() - now().getTime() > REFRESH_MARGIN_MS;
  const c = await db.driveConnection.findUnique({ where: { id: ROW } });
  if (!c || c.status !== 'ACTIVE' || !c.accessToken || !c.refreshToken || !c.email) {
    throw new DriveError(c?.status === 'NEEDS_REAUTH' ? 'Hay que volver a conectar el Drive en Equipo.' : NOT_CONNECTED, c?.status === 'NEEDS_REAUTH');
  }
  const email = c.email;
  let token: string;
  if (fresh(c)) token = decrypt(c.accessToken);
  else {
    type Got = { kind: 'token'; token: string } | { kind: 'reauth'; message: string };
    const got = await db.$transaction(
      async (tx): Promise<Got> => {
        await tx.$queryRaw`SELECT id FROM drive_connections WHERE id = ${ROW} FOR UPDATE`;
        const row = await tx.driveConnection.findUniqueOrThrow({ where: { id: ROW } });
        if (row.status !== 'ACTIVE' || !row.accessToken || !row.refreshToken) return { kind: 'reauth', message: 'Hay que volver a conectar el Drive en Equipo.' };
        // Otro pedido ya la renovó mientras esperaba.
        if (fresh(row)) return { kind: 'token', token: decrypt(row.accessToken) };
        try {
          const tokens = await tokenRequest(
            {
              grant_type: 'refresh_token',
              refresh_token: decrypt(row.refreshToken),
              client_id: row.clientId,
              client_secret: decrypt(row.clientSecret),
            },
            now(),
          );
          await tx.driveConnection.update({
            where: { id: ROW },
            data: {
              accessToken: encrypt(tokens.accessToken),
              // Google casi nunca da otra; si la da, vale la nueva.
              ...(tokens.refreshToken ? { refreshToken: encrypt(tokens.refreshToken) } : {}),
              expiresAt: tokens.expiresAt,
              scope: tokens.scope ?? row.scope,
              lastRefreshAt: now(),
              lastError: null,
            },
          });
          return { kind: 'token', token: tokens.accessToken };
        } catch (e) {
          if (e instanceof DriveError && e.reauth) return { kind: 'reauth', message: e.message };
          throw e;
        }
      },
      { timeout: 30_000 },
    );
    if (got.kind === 'reauth') {
      // Fuera de la transacción, así la marca queda guardada.
      await markReauth(db, got.message);
      throw new DriveError(got.message, true);
    }
    token = got.token;
  }
  try {
    return await run(token, email);
  } catch (e) {
    // Google cortó el permiso desde su lado.
    if (e instanceof DriveError && e.reauth) await markReauth(db, e.message);
    throw e;
  }
}

/** Desconecta: le avisa a Google y borra las llaves. El cliente queda, para volver a conectar. */
export async function disconnectDrive(db: PrismaClient): Promise<void> {
  const c = await db.driveConnection.findUnique({ where: { id: ROW } });
  if (!c) return;
  const token = c.refreshToken ?? c.accessToken;
  if (token) {
    try {
      await fetch(`${googleRevokeUrl()}?${new URLSearchParams({ token: decrypt(token) })}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      });
    } catch {
      // Igual se borran las llaves.
    }
  }
  await db.driveConnection.update({
    where: { id: ROW },
    data: { status: 'NOT_CONNECTED', accessToken: null, refreshToken: null, expiresAt: null, lastError: null },
  });
}

/** Lo que muestra la pantalla: nunca la clave secreta ni las llaves. */
export async function driveSummary(db: PrismaClient) {
  return db.driveConnection.findUnique({
    where: { id: ROW },
    select: {
      clientId: true,
      clientSecretHint: true,
      status: true,
      email: true,
      connectedAt: true,
      lastError: true,
      connectedBy: { select: { name: true } },
    },
  });
}

export type DriveSummary = NonNullable<Awaited<ReturnType<typeof driveSummary>>>;

/** La cuenta de Google conectada, o null. Sin preguntarle a Google. */
export async function driveEmail(db: PrismaClient): Promise<string | null> {
  const c = await db.driveConnection.findUnique({ where: { id: ROW }, select: { status: true, email: true } });
  return c?.status === 'ACTIVE' ? c.email : null;
}
