import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { decrypt } from '@/lib/crypto';
import {
  completeDriveAuthorization,
  disconnectDrive,
  driveFailure,
  driveQueryValue,
  driveSummary,
  ensureFolder,
  isUploadSessionUrl,
  parseGoogleTokens,
  saveDriveCredentials,
  startDriveAuthorization,
  videosFolder,
  withDriveToken,
} from '@/lib/drive';
import {
  chooseClip,
  clearClip,
  finishVideoUpload,
  loadVideosStep,
  markClipUploaded,
  saveVideoMeasure,
  startVideoUpload,
  syncProductVideos,
  trashVideo,
  validMeasure,
} from '@/lib/videos';
import { checkClip, videoPieceRange, videoUploadType } from '@/domain/videos';
import { MERCADOLIBRE_CLIPS } from '@/channels/mercadolibre/clips';
import { startFakeGoogle, type FakeGoogle } from './fake-google';

// El Drive del estudio y los videos de los productos, contra un Google
// simulado. Los datos son de prueba.

const CLIENT_ID = '123-prueba.apps.googleusercontent.com';
const SECRET = 'secreto-del-cliente-123';

describe('reglas de los videos', () => {
  const v = { name: 'clip.mp4', mimeType: 'video/mp4', size: 30 * 1024 ** 2, width: 1080, height: 1920, durationMs: 25_000 };

  it('un video vertical de 25 segundos sirve como clip', () => {
    expect(checkClip(v, MERCADOLIBRE_CLIPS)).toEqual({ pending: false, problems: [], notes: [] });
  });

  it('dice qué le falta: horizontal, corto, largo, pesado, chico o en otro formato', () => {
    expect(checkClip({ ...v, width: 1920, height: 1080 }, MERCADOLIBRE_CLIPS).problems).toEqual([
      'Es horizontal (1920 × 1080): el clip tiene que ser vertical.',
    ]);
    expect(checkClip({ ...v, durationMs: 6_000 }, MERCADOLIBRE_CLIPS).problems[0]).toContain('al menos 10 segundos');
    expect(checkClip({ ...v, durationMs: 95_000 }, MERCADOLIBRE_CLIPS).problems[0]).toBe('Dura 1 min 35 s: el clip puede durar hasta 60 segundos.');
    expect(checkClip({ ...v, size: 400 * 1024 ** 2 }, MERCADOLIBRE_CLIPS).problems[0]).toBe('Pesa 400 MB: el clip puede pesar hasta 280 MB.');
    expect(checkClip({ ...v, width: 240, height: 426 }, MERCADOLIBRE_CLIPS).problems[0]).toContain('muy chico');
    expect(checkClip({ ...v, name: 'clip.webm' }, MERCADOLIBRE_CLIPS).problems[0]).toContain('MP4, MOV');
    // Al borde no falla por medio segundo.
    expect(checkClip({ ...v, durationMs: 9_700 }, MERCADOLIBRE_CLIPS).problems).toEqual([]);
  });

  it('avisa lo que conviene mejorar, aunque sirve', () => {
    expect(checkClip({ ...v, width: 1080, height: 1350 }, MERCADOLIBRE_CLIPS)).toMatchObject({ problems: [], notes: ['No es 9:16: el canal puede recortar los bordes.'] });
    expect(checkClip({ ...v, width: 540, height: 960 }, MERCADOLIBRE_CLIPS).notes).toEqual(['Se ve mejor desde 720 × 1280.']);
  });

  it('sin medidas queda pendiente, pero el peso y el formato se ven igual', () => {
    expect(checkClip({ ...v, width: null, height: null, durationMs: null, size: 300 * 1024 ** 2 }, MERCADOLIBRE_CLIPS)).toMatchObject({
      pending: true,
      problems: ['Pesa 300 MB: el clip puede pesar hasta 280 MB.'],
    });
  });

  it('acepta los videos por extensión aunque el navegador no diga el tipo', () => {
    expect(videoUploadType({ name: 'IMG_1234.MOV', size: 10, type: '' })).toEqual({ ok: true, type: 'video/quicktime' });
    expect(videoUploadType({ name: 'foto.jpg', size: 10, type: 'image/jpeg' })).toMatchObject({ ok: false });
    expect(videoUploadType({ name: 'largo.mp4', size: 3 * 1024 ** 3, type: 'video/mp4' })).toMatchObject({ ok: false, error: expect.stringContaining('2 GB') });
  });

  it('al ver un video pide de a pedazos de 4 MB', () => {
    expect(videoPieceRange('bytes=0-')).toBe('bytes=0-4194303');
    expect(videoPieceRange('bytes=100-200')).toBe('bytes=100-200');
    expect(videoPieceRange('bytes=10-99999999')).toBe('bytes=10-4194313');
    expect(videoPieceRange(null)).toBe('bytes=0-4194303');
  });

  it('solo acepta medidas con sentido', () => {
    expect(validMeasure({ width: 1080, height: 1920, durationMs: 1000 })).toEqual({ width: 1080, height: 1920, durationMs: 1000 });
    expect(validMeasure({ width: 1080.5, height: 1920, durationMs: 1000 })).toBeNull();
    expect(validMeasure({ width: -1, height: 1920, durationMs: 1000 })).toBeNull();
    expect(validMeasure('nada')).toBeNull();
  });
});

describe('respuestas de Google', () => {
  it('lee las llaves y traduce los errores', () => {
    const now = new Date('2026-10-23T12:00:00Z');
    expect(parseGoogleTokens(200, { access_token: 'a', refresh_token: 'r', expires_in: 3599, scope: 'x' }, now)).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: new Date('2026-10-23T12:59:59Z'),
      scope: 'x',
    });
    expect(() => parseGoogleTokens(400, { error: 'invalid_grant' })).toThrow('volver a conectar');
    expect(() => parseGoogleTokens(401, { error: 'invalid_client' })).toThrow('ID o la clave secreta');
    expect(driveFailure(403, { error: { errors: [{ reason: 'storageQuotaExceeded' }] } }).message).toBe('El Drive del estudio está lleno.');
    expect(driveFailure(401, null).reauth).toBe(true);
    expect(driveFailure(404, null).status).toBe(404);
  });

  it('solo reenvía partes a una subida del Drive', () => {
    expect(isUploadSessionUrl('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=abc')).toBe(true);
    expect(isUploadSessionUrl('https://evil.example/upload/drive/v3/files?uploadType=resumable&upload_id=abc')).toBe(false);
    expect(isUploadSessionUrl('https://www.googleapis.com/drive/v3/files?uploadType=resumable&upload_id=abc')).toBe(false);
    expect(isUploadSessionUrl('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable')).toBe(false);
    expect(driveQueryValue("Kit d'Embrague \\ 1")).toBe("Kit d\\'Embrague \\\\ 1");
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('el Drive y los videos en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let google: FakeGoogle;
  let accountId = '';
  let productId = '';
  let publicationId = '';
  let userId = '';

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    process.env.BETTER_AUTH_URL = 'http://app.prueba';
    google = await startFakeGoogle();
    process.env.GOOGLE_AUTH_URL = `${google.url}/auth`;
    process.env.GOOGLE_TOKEN_URL = `${google.url}/token`;
    process.env.GOOGLE_REVOKE_URL = `${google.url}/revoke`;
    process.env.GOOGLE_API_URL = google.url;
  });

  afterAll(async () => {
    await google.close();
    for (const k of ['GOOGLE_AUTH_URL', 'GOOGLE_TOKEN_URL', 'GOOGLE_REVOKE_URL', 'GOOGLE_API_URL', 'BETTER_AUTH_URL']) delete process.env[k];
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE drive_connections, drive_folders, product_videos, publication_clips, channel_copies, publications, products, stores, channels, accounts, users CASCADE',
    );
    google.files.clear();
    google.calls.length = 0;
    Object.assign(google.state, { email: 'martin@studiomrb.com', nextScope: 'https://www.googleapis.com/auth/drive', refreshFails: false, cors: true });
    const user = await db.user.create({ data: { id: 'u1', name: 'Juani', email: 'juani@prueba.com' } });
    userId = user.id;
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    const product = await db.product.create({ data: { accountId: account.id, name: 'Kit de embrague PD-1' } });
    const pub = await db.publication.create({ data: { productId: product.id, storeId: store.id, externalId: 'MLA1', title: 'Kit de embrague' } });
    accountId = account.id;
    productId = product.id;
    publicationId = pub.id;
  });

  /** Conecta como lo haría la persona: pide el link, Google vuelve con el código. */
  async function connect(): Promise<string> {
    await saveDriveCredentials(db, { clientId: CLIENT_ID, clientSecret: SECRET });
    const link = await startDriveAuthorization(db, { userId });
    const res = await fetch(link, { redirect: 'manual' });
    const back = new URL(res.headers.get('location')!);
    const r = await completeDriveAuthorization(db, { state: back.searchParams.get('state')!, code: back.searchParams.get('code')! });
    expect(r).toEqual({ ok: true, email: 'martin@studiomrb.com' });
    return back.searchParams.get('state')!;
  }

  it('guarda el cliente sin mostrar la clave y pide los datos bien', async () => {
    await expect(saveDriveCredentials(db, { clientId: 'otra-cosa', clientSecret: SECRET })).rejects.toThrow('apps.googleusercontent.com');
    await expect(saveDriveCredentials(db, { clientId: CLIENT_ID, clientSecret: null })).rejects.toThrow('Falta la clave');
    await saveDriveCredentials(db, { clientId: CLIENT_ID, clientSecret: SECRET });
    const row = await db.driveConnection.findUniqueOrThrow({ where: { id: 'estudio' } });
    expect(row.clientSecret).not.toContain(SECRET);
    expect(decrypt(row.clientSecret)).toBe(SECRET);
    expect(await driveSummary(db)).toMatchObject({ clientId: CLIENT_ID, clientSecretHint: '-123', status: 'NOT_CONNECTED' });
  });

  it('el link pide permiso sin conexión, con PKCE y el permiso del Drive', async () => {
    await saveDriveCredentials(db, { clientId: CLIENT_ID, clientSecret: SECRET });
    const link = new URL(await startDriveAuthorization(db, { userId }));
    expect(Object.fromEntries(link.searchParams)).toMatchObject({
      client_id: CLIENT_ID,
      redirect_uri: 'http://app.prueba/api/google/vuelta',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/drive',
      code_challenge_method: 'S256',
    });
  });

  it('conecta, anota la cuenta y el link no sirve dos veces', async () => {
    const state = await connect();
    expect(await driveSummary(db)).toMatchObject({ status: 'ACTIVE', email: 'martin@studiomrb.com', connectedBy: { name: 'Juani' } });
    expect(await completeDriveAuthorization(db, { state, code: 'otro' })).toMatchObject({ ok: false, error: expect.stringContaining('venció o ya se usó') });
  });

  it('si no se tilda el permiso del Drive, no conecta', async () => {
    google.state.nextScope = 'openid';
    await saveDriveCredentials(db, { clientId: CLIENT_ID, clientSecret: SECRET });
    const res = await fetch(await startDriveAuthorization(db, { userId }), { redirect: 'manual' });
    const back = new URL(res.headers.get('location')!);
    const r = await completeDriveAuthorization(db, { state: back.searchParams.get('state')!, code: back.searchParams.get('code')! });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('No tildaste el permiso') });
    expect((await driveSummary(db))?.status).toBe('NOT_CONNECTED');
  });

  it('renueva la llave cuando está por vencer, y si Google la corta pide volver a conectar', async () => {
    await connect();
    const later = () => new Date(Date.now() + 58 * 60_000);
    const first = await withDriveToken(db, async (t) => t, { now: later });
    expect(google.calls.filter((c) => c === 'POST /token refresh_token')).toHaveLength(1);
    expect(google.tokens.has(first)).toBe(true);
    // Con la nueva, no renueva otra vez.
    await withDriveToken(db, async (t) => t);
    expect(google.calls.filter((c) => c === 'POST /token refresh_token')).toHaveLength(1);

    google.state.refreshFails = true;
    await expect(withDriveToken(db, async (t) => t, { now: () => new Date(Date.now() + 2 * 3600_000) })).rejects.toThrow('volver a conectar');
    expect((await driveSummary(db))?.status).toBe('NEEDS_REAUTH');
  });

  it('desconectar le avisa a Google y borra las llaves', async () => {
    await connect();
    await disconnectDrive(db);
    expect(google.calls).toContain('POST /revoke');
    const row = await db.driveConnection.findUniqueOrThrow({ where: { id: 'estudio' } });
    expect(row).toMatchObject({ status: 'NOT_CONNECTED', accessToken: null, refreshToken: null, clientId: CLIENT_ID });
    await expect(withDriveToken(db, async () => 1)).rejects.toThrow('no está conectado');
  });

  it('arma las carpetas una vez, las vuelve a crear si se borran y las encuentra aunque se pierda lo guardado', async () => {
    await connect();
    const spec = videosFolder({ id: accountId, name: 'Cuenta de prueba' }, { id: productId, name: 'Kit de embrague PD-1' });
    const folderId = await withDriveToken(db, (t, email) => ensureFolder(db, t, email, spec));
    const names = (id: string): string[] => {
      const f = google.files.get(id)!;
      return f.parents[0] === 'root' ? [f.name] : [...names(f.parents[0]), f.name];
    };
    expect(names(folderId)).toEqual(['E-commerce Studio MRB', 'Cuenta de prueba', 'Kit de embrague PD-1', 'Videos']);
    const folders = google.files.size;
    expect(await withDriveToken(db, (t, email) => ensureFolder(db, t, email, spec))).toBe(folderId);
    expect(google.files.size).toBe(folders);

    // Lo guardado se pierde: la encuentra por su marca.
    await db.driveFolder.deleteMany({});
    expect(await withDriveToken(db, (t, email) => ensureFolder(db, t, email, spec))).toBe(folderId);

    // Alguien manda la carpeta del producto a la papelera: arma otra.
    google.files.get(google.files.get(folderId)!.parents[0])!.trashed = true;
    const again = await withDriveToken(db, (t, email) => ensureFolder(db, t, email, spec));
    expect(again).not.toBe(folderId);
    expect(names(again)).toEqual(['E-commerce Studio MRB', 'Cuenta de prueba', 'Kit de embrague PD-1', 'Videos']);
  });

  it('lee la carpeta: suma lo que se agregó desde la Mac y marca lo que se borró', async () => {
    await connect();
    const first = await syncProductVideos(db, { accountId, productId });
    expect(first).toMatchObject({ added: 0, gone: 0 });
    const mac = google.addFile({
      name: 'desde-la-mac.mov',
      mimeType: 'video/quicktime',
      parents: [first.folderId],
      data: Buffer.alloc(1000),
      videoMediaMetadata: { width: 1080, height: 1920, durationMillis: '24000' },
    });
    google.addFile({ name: 'nota.txt', mimeType: 'text/plain', parents: [first.folderId] });
    expect(await syncProductVideos(db, { accountId, productId })).toMatchObject({ added: 1, gone: 0 });
    const row = await db.productVideo.findUniqueOrThrow({ where: { driveFileId: mac.id } });
    expect(row).toMatchObject({ origin: 'DRIVE', width: 1080, height: 1920, durationMs: 24000, measuredBy: 'drive', size: BigInt(1000) });

    // Lo mide el navegador: Google ya no lo pisa.
    expect(await saveVideoMeasure(db, { accountId, videoId: row.id, measure: { width: 1920, height: 1080, durationMs: 24010 } })).toBe(true);
    await syncProductVideos(db, { accountId, productId });
    expect(await db.productVideo.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ width: 1920, measuredBy: 'navegador' });

    mac.trashed = true;
    expect(await syncProductVideos(db, { accountId, productId })).toMatchObject({ gone: 1 });
    expect((await db.productVideo.findUniqueOrThrow({ where: { id: row.id } })).goneAt).not.toBeNull();
    // Vuelve de la papelera.
    mac.trashed = false;
    await syncProductVideos(db, { accountId, productId });
    expect((await db.productVideo.findUniqueOrThrow({ where: { id: row.id } })).goneAt).toBeNull();
  });

  it('sube un video por partes, con el origen de la app, y lo anota con las medidas del navegador', async () => {
    await connect();
    const data = Buffer.alloc(600 * 1024, 7);
    const { uploadUrl } = await startVideoUpload(db, {
      accountId,
      productId,
      file: { name: 'clip.mp4', size: data.length, type: 'video/mp4' },
      origin: 'http://app.prueba',
    });
    expect(isUploadSessionUrl(uploadUrl)).toBe(true);
    // Dos partes, como el navegador: la primera de 256 KB.
    const first = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes 0-262143/${data.length}`, Origin: 'http://app.prueba' }, body: data.subarray(0, 262144) });
    expect(first.status).toBe(308);
    expect(first.headers.get('access-control-allow-origin')).toBe('http://app.prueba');
    const last = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes 262144-${data.length - 1}/${data.length}` }, body: data.subarray(262144) });
    const file = (await last.json()) as { id: string };

    const { videoId } = await finishVideoUpload(db, {
      accountId,
      productId,
      fileId: file.id,
      size: data.length,
      measure: { width: 1080, height: 1920, durationMs: 15000 },
      userId,
    });
    expect(await db.productVideo.findUniqueOrThrow({ where: { id: videoId } })).toMatchObject({
      origin: 'APP',
      uploadedById: userId,
      measuredBy: 'navegador',
      width: 1080,
      durationMs: 15000,
    });
    expect(google.files.get(file.id)!.appProperties).toEqual({ mrbProducto: productId });
  });

  it('si el archivo llegó incompleto o está en otra carpeta, no lo anota', async () => {
    await connect();
    const { folderId } = await syncProductVideos(db, { accountId, productId });
    const short = google.addFile({ name: 'corto.mp4', parents: [folderId], data: Buffer.alloc(10) });
    await expect(finishVideoUpload(db, { accountId, productId, fileId: short.id, size: 20, measure: null, userId })).rejects.toThrow('incompleto');
    expect(google.files.get(short.id)!.trashed).toBe(true);
    const other = google.addFile({ name: 'otro.mp4', parents: ['root'], data: Buffer.alloc(10) });
    await expect(finishVideoUpload(db, { accountId, productId, fileId: other.id, size: 10, measure: null, userId })).rejects.toThrow('carpeta del producto');
    expect(await db.productVideo.count()).toBe(0);
  });

  it('no acepta archivos que no son videos ni productos de otra cuenta', async () => {
    await connect();
    await expect(
      startVideoUpload(db, { accountId, productId, file: { name: 'foto.jpg', size: 10, type: 'image/jpeg' }, origin: 'http://app.prueba' }),
    ).rejects.toThrow('no es un video');
    await expect(
      startVideoUpload(db, { accountId: 'otra', productId, file: { name: 'a.mp4', size: 10, type: 'video/mp4' }, origin: 'http://app.prueba' }),
    ).rejects.toThrow('no es de esta cuenta');
  });

  it('elige el clip, lo marca subido y si cambia hay que volver a subirlo', async () => {
    await connect();
    const { folderId } = await syncProductVideos(db, { accountId, productId });
    for (const name of ['a.mp4', 'b.mp4']) {
      google.addFile({ name, parents: [folderId], data: Buffer.alloc(5), videoMediaMetadata: { width: 720, height: 1280, durationMillis: '20000' } });
    }
    await syncProductVideos(db, { accountId, productId });
    const [a, b] = await db.productVideo.findMany({ orderBy: { name: 'asc' } });

    await expect(markClipUploaded(db, { accountId, publicationId, uploaded: true, userId })).rejects.toThrow('Primero elegí');
    await chooseClip(db, { accountId, publicationId, videoId: a.id, userId });
    await markClipUploaded(db, { accountId, publicationId, uploaded: true, userId });
    let step = await loadVideosStep(db, { accountId, publicationId });
    expect(step.clip).toMatchObject({ videoId: a.id, uploadedBy: 'Juani' });
    expect(step.videos.map((v) => v.name)).toEqual(['a.mp4', 'b.mp4']);
    expect(step.folderUrl).toBe(`https://drive.google.com/drive/folders/${folderId}`);

    // El mismo: no cambia nada.
    await chooseClip(db, { accountId, publicationId, videoId: a.id, userId });
    expect((await db.publicationClip.findUniqueOrThrow({ where: { publicationId } })).uploadedAt).not.toBeNull();
    await chooseClip(db, { accountId, publicationId, videoId: b.id, userId });
    expect((await db.publicationClip.findUniqueOrThrow({ where: { publicationId } })).uploadedAt).toBeNull();

    // A la papelera: sale de la lista, salvo si es el clip de esta publicación.
    await trashVideo(db, { accountId, videoId: a.id });
    expect(google.files.get(a.driveFileId)!.trashed).toBe(true);
    step = await loadVideosStep(db, { accountId, publicationId });
    expect(step.videos.map((v) => v.name)).toEqual(['b.mp4']);
    await trashVideo(db, { accountId, videoId: b.id });
    step = await loadVideosStep(db, { accountId, publicationId });
    expect(step.videos).toMatchObject([{ name: 'b.mp4', gone: true }]);
    await expect(chooseClip(db, { accountId, publicationId, videoId: a.id, userId })).rejects.toThrow('no está entre los del producto');
    await clearClip(db, { accountId, publicationId });
    expect((await loadVideosStep(db, { accountId, publicationId })).clip).toBeNull();
  });

  it('sin el Drive conectado, el paso lo dice y no intenta leer', async () => {
    const step = await loadVideosStep(db, { accountId, publicationId });
    expect(step).toMatchObject({ driveEmail: null, folderUrl: null, videos: [] });
    await expect(syncProductVideos(db, { accountId, productId })).rejects.toThrow('no está conectado');
  });
});
