import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import type { Transfer, UploadKind, WorkerDone } from '@/domain/photo-contract';
import { PHOTO_PROTOCOL } from '@/domain/photo-contract';
import { DEFAULT_PHOTO_SETTINGS } from '@/domain/photo-settings';
import {
  approveStep,
  archivePhoto,
  buildJob,
  claimNext,
  heartbeat,
  idlePollSeconds,
  LEASE_MS,
  PhotoQueueError,
  redoStep,
  retryStep,
  skipStep,
  submitFailure,
  submitResult,
} from '@/lib/photo-queue';
import { addChannelPhotos, addUploadedOriginal, PhotoError } from '@/lib/photos';
import { loadPhotoSettings, PhotoSettingsError, savePhotoSettings } from '@/lib/photo-settings';
import { createWorkerKey, revokeWorkerKey, verifyWorkerRequest, workerState } from '@/lib/image-worker';
import { outputPathname } from '@/lib/photo-files';

// Datos inventados.

const url = process.env.TEST_DATABASE_URL;
const BLOB = 'https://abc123.private.blob.vercel-storage.com/';

describe.skipIf(!url)('línea de imágenes en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const userId = 'u1';
  let accountId = '';
  let productId = '';
  // El depósito simulado: lo que el trabajador "subió".
  let uploaded: Set<string>;

  const deps = {
    download: async (e: { originalUrl: string }): Promise<Transfer> => ({ url: `${e.originalUrl}?firmado=1`, metodo: 'GET', encabezados: {} }),
    upload: async (kind: UploadKind, pathname: string): Promise<Transfer> => ({
      url: `https://subir.example/?pathname=${pathname}`,
      metodo: 'PUT',
      encabezados: { 'x-tipo': kind },
    }),
    pathnameFor: outputPathname,
  };
  const verify = async (pathname: string) =>
    uploaded.has(pathname) ? { url: `${BLOB}${pathname}`, size: 10, contentType: 'image/jpeg' } : null;

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE photo_step_runs, photo_edits, photo_settings, image_workers, assets, products, accounts, users CASCADE',
    );
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    productId = (await db.product.create({ data: { accountId, name: 'Kit de pistones', productType: 'Pistón' } })).id;
    await db.user.create({ data: { id: userId, name: 'Persona', email: 'persona@example.com' } });
    uploaded = new Set();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function photo(name = 'IMG_1.HEIC') {
    const pathname = `imagenes/${productId}/originales/${name.toLowerCase()}`;
    return addUploadedOriginal(
      db,
      { productId, url: `${BLOB}${pathname}`, name, userId },
      { head: async (u) => ({ url: u, pathname, size: 3_000_000, contentType: 'image/heic' }) },
    );
  }

  const runsOf = (editId: string) => db.photoStepRun.findMany({ where: { editId }, orderBy: { createdAt: 'asc' } });
  const openRun = async (editId: string) => (await runsOf(editId)).find((r) => r.openFor !== null)!;

  function done(job: { id: string; turno: number }, extra: Partial<WorkerDone> = {}): WorkerDone {
    return {
      protocolo: PHOTO_PROTOCOL,
      id: job.id,
      turno: job.turno,
      ok: true,
      propuesta: { valores: { giro: 1.5 }, razon: 'Está torcida a la izquierda.', origen: 'claude' },
      valores: { giro: 1.5 },
      medidas: { torcida_grados: -1.4 },
      parametros: [
        { clave: 'giro', etiqueta: 'Giro', ayuda: 'Gira la foto.', minimo: -10, maximo: 10, defecto: 0, paso: 0.1, unidad: '°', tipo: 'numero' },
      ],
      nota: null,
      no_aplica: null,
      uso_claude: { costo_usd: 0.012 },
      segundos: 3.2,
      archivos: ['vista'],
      original: null,
      ...extra,
    };
  }

  /** El trabajador toma el próximo paso, "sube" lo que se le pide y lo entrega. */
  async function work(workerId: string, extra: Partial<WorkerDone> = {}) {
    const claimed = await claimNext(db, workerId);
    if (!claimed) throw new Error('No había trabajo.');
    const job = await buildJob(db, claimed.runId, deps);
    for (const kind of Object.keys(job.subidas) as UploadKind[]) {
      uploaded.add(outputPathname(productId, job.foto, job.id, kind));
    }
    const r = await submitResult(db, workerId, done(job, { archivos: Object.keys(job.subidas) as UploadKind[], ...extra }), {
      verify,
      pathnameFor: outputPathname,
    });
    return { job, r };
  }

  async function worker() {
    const key = await createWorkerKey(db, userId);
    return (await verifyWorkerRequest(db, `Bearer ${key}`))!.workerId;
  }

  // Otro trabajador, por ejemplo una Mac que se despertó con una llave vieja.
  const another = async () => (await db.imageWorker.create({ data: { keyHash: `h${Math.random()}`, keyHint: 'xxxx' } })).id;

  it('una foto subida arranca con el primer paso en cola', async () => {
    const edit = await photo();
    expect(edit.source).toBe('UPLOAD');
    expect(edit.originalType).toBe('image/heic');
    const runs = await runsOf(edit.id);
    expect(runs.map((r) => [r.step, r.status, r.openFor])).toEqual([[0, 'QUEUED', edit.id]]);
    expect(runs[0].settings).toEqual(DEFAULT_PHOTO_SETTINGS);
    // Anotar dos veces el mismo original no la repite.
    expect((await photo()).id).toBe(edit.id);
  });

  it('no acepta originales de otro producto, de otro tipo o fuera del depósito', async () => {
    const head = (pathname: string, contentType = 'image/jpeg', size = 1000) => ({
      head: async (u: string) => ({ url: u, pathname, size, contentType }),
    });
    const add = (u: string, h: ReturnType<typeof head>) => addUploadedOriginal(db, { productId, url: u, name: 'x.jpg', userId }, h);
    await expect(add('https://otro-sitio.com/x.jpg', head('x'))).rejects.toThrow(PhotoError);
    await expect(add(`${BLOB}imagenes/otro/originales/x.jpg`, head('imagenes/otro/originales/x.jpg'))).rejects.toThrow('otro producto');
    const mine = `imagenes/${productId}/originales/x.jpg`;
    await expect(add(`${BLOB}${mine}`, head(mine, 'image/png'))).rejects.toThrow('JPG, PNG, HEIC o TIFF');
    await expect(add(`${BLOB}${mine}`, head(mine, 'image/jpeg', 200 * 1024 * 1024))).rejects.toThrow('100 MB');
  });

  it('el trabajador toma el paso, con su turno, y nadie más lo toma', async () => {
    const w = await worker();
    const edit = await photo();
    const claimed = await claimNext(db, w);
    expect(claimed).not.toBeNull();
    const run = await db.photoStepRun.findUniqueOrThrow({ where: { id: claimed!.runId } });
    expect([run.status, run.lease, run.attempts, run.workerId]).toEqual(['PROCESSING', 1, 1, w]);
    expect(run.leaseUntil!.getTime()).toBeGreaterThan(Date.now() + LEASE_MS - 60_000);
    // Otro trabajador no lo toma mientras el turno está vigente.
    expect(await claimNext(db, await another())).toBeNull();
    expect(run.editId).toBe(edit.id);
  });

  it('dos pedidos a la vez nunca toman el mismo paso', async () => {
    const w = await worker();
    await photo('a.heic');
    await photo('b.heic');
    await photo('c.heic');
    const others = [await another(), await another(), await another()];
    const got = await Promise.all([claimNext(db, w), ...others.map((o) => claimNext(db, o))]);
    const ids = got.filter(Boolean).map((g) => g!.runId);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('si el trabajador se reinicia, recupera lo que tenía con turno nuevo', async () => {
    const w = await worker();
    await photo();
    const first = await claimNext(db, w);
    const again = await claimNext(db, w);
    expect(again!.runId).toBe(first!.runId);
    const run = await db.photoStepRun.findUniqueOrThrow({ where: { id: first!.runId } });
    expect([run.lease, run.attempts]).toEqual([2, 2]);
  });

  it('si el trabajador se apaga, a los 15 minutos vuelve a la cola, y a los 3 intentos falla', async () => {
    const w = await worker();
    const edit = await photo();
    const t0 = new Date();
    const later = (n: number) => new Date(t0.getTime() + n * (LEASE_MS + 1000));
    const other = await another();
    await claimNext(db, w, t0);
    expect(await claimNext(db, other, new Date(t0.getTime() + 60_000))).toBeNull();
    expect(await claimNext(db, other, later(1))).not.toBeNull();
    expect(await claimNext(db, other, later(2))).not.toBeNull();
    // Tres intentos sin terminar: queda fallido y no se vuelve a dar.
    expect(await claimNext(db, other, later(3))).toBeNull();
    const run = await openRun(edit.id);
    expect(run.status).toBe('FAILED');
    expect(run.error).toMatch(/3 veces/);
  });

  it('el pedido lleva lo que hay que subir en cada paso, la receta y el contexto', async () => {
    const w = await worker();
    const edit = await photo();
    const { job } = await work(w);
    expect(job.paso).toBe('lente');
    expect(job.producto).toBe('Pistón: Kit de pistones');
    expect(job.pedidos).toBeNull();
    expect(job.original).toEqual({
      nombre: 'IMG_1.HEIC',
      tipo: 'image/heic',
      bajar: { url: `${edit.originalUrl}?firmado=1`, metodo: 'GET', encabezados: {} },
    });
    expect(Object.keys(job.subidas).sort()).toEqual(['antes', 'vista']);
    expect(job.subidas.vista!.url).toContain(`imagenes/${productId}/${edit.id}/${job.id}/vista.jpg`);
    expect(job.receta).toEqual([]);

    await approveStep(db, { runId: job.id, userId });
    // Paso 2, perspectiva: la receta trae el lente aprobado.
    const second = await work(w);
    expect(second.job.paso).toBe('perspectiva');
    expect(Object.keys(second.job.subidas)).toEqual(['vista']);
    expect(second.job.receta).toEqual([
      { id: job.id, paso: 'lente', indice: 0, valores: { giro: 1.5 }, salteado: false, ajustes: DEFAULT_PHOTO_SETTINGS },
    ]);
    await skipStep(db, { runId: second.job.id, userId });
    for (let i = 2; i < 5; i++) {
      const { job: j } = await work(w);
      await approveStep(db, { runId: j.id, userId });
    }
    const fondo = await work(w);
    expect(fondo.job.paso).toBe('fondo');
    expect(Object.keys(fondo.job.subidas).sort()).toEqual(['mascara', 'vista']);
    expect(fondo.job.receta.map((r) => [r.paso, r.salteado])).toEqual([
      ['lente', false],
      ['perspectiva', true],
      ['blancos', false],
      ['luces', false],
      ['color', false],
    ]);
  });

  it('el pedido tiene la misma forma que el ejemplo que lee el trabajador', async () => {
    // La forma: las claves de cada objeto, sin los valores.
    const shape = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.length ? [shape(v[0])] : []
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, k === 'ajustes' || k === 'valores' || k === 'pedidos' || k === 'encabezados' ? 'objeto' : shape((v as Record<string, unknown>)[k])]))
          : typeof v;
    const example = JSON.parse(readFileSync(new URL('../trabajador-imagenes/contrato/trabajo.json', import.meta.url), 'utf8'));
    const w = await worker();
    await photo();
    const first = await work(w);
    await skipStep(db, { runId: first.job.id, userId });
    const claimed = await claimNext(db, w);
    const job = await buildJob(db, claimed!.runId, deps);
    const built = { ...job, pedidos: { giro: 1 }, subidas: { vista: job.subidas.vista } };
    const expected = { ...example.trabajo, subidas: { vista: example.trabajo.subidas.vista } };
    expect(shape(built)).toEqual(shape(expected));
  });

  it('el resultado deja el paso para revisar y anota el original', async () => {
    const w = await worker();
    const edit = await photo();
    const { job, r } = await work(w, { original: { ancho: 4032, alto: 3024, camara: { marca: 'Apple' } } });
    expect(r).toEqual({ aceptado: true });
    const run = await db.photoStepRun.findUniqueOrThrow({ where: { id: job.id } });
    expect(run.status).toBe('REVIEW');
    expect(run.openFor).toBe(edit.id);
    expect(run.values).toEqual({ giro: 1.5 });
    expect(run.proposal).toEqual({ valores: { giro: 1.5 }, razon: 'Está torcida a la izquierda.', origen: 'claude' });
    expect(run.previewUrl).toBe(`${BLOB}${outputPathname(productId, edit.id, job.id, 'vista')}`);
    expect(run.leaseUntil).toBeNull();
    const e = await db.photoEdit.findUniqueOrThrow({ where: { id: edit.id } });
    expect([e.width, e.height, e.camera]).toEqual([4032, 3024, { marca: 'Apple' }]);
    expect(e.previewUrl).toBe(`${BLOB}${outputPathname(productId, edit.id, job.id, 'antes')}`);
  });

  it('un resultado con turno viejo o sin archivos no se acepta', async () => {
    const w = await worker();
    await photo();
    const claimed = await claimNext(db, w);
    const job = await buildJob(db, claimed!.runId, deps);
    const opts = { verify, pathnameFor: outputPathname };
    // Faltan los archivos.
    expect(await submitResult(db, w, done(job), opts)).toEqual({ aceptado: false, motivo: 'Falta subir el archivo «vista».' });
    for (const kind of ['vista', 'antes'] as const) uploaded.add(outputPathname(productId, job.foto, job.id, kind));
    // La Mac se reinició y lo volvió a tomar: el turno 1 ya no vale.
    await claimNext(db, w);
    expect((await submitResult(db, w, done(job), opts)).aceptado).toBe(false);
    expect(await submitResult(db, w, done({ id: job.id, turno: 2 }), opts)).toEqual({ aceptado: true });
  });

  it('un paso que no aplica se saltea solo y sigue el próximo', async () => {
    const w = await worker();
    const edit = await photo();
    const { job } = await work(w, { no_aplica: 'La foto no tiene datos de lente.', archivos: ['antes'], propuesta: null, valores: {} });
    const runs = await runsOf(edit.id);
    expect(runs.map((r) => [r.step, r.status])).toEqual([
      [0, 'SKIPPED'],
      [1, 'QUEUED'],
    ]);
    expect(runs[0].notApplicable).toBe('La foto no tiene datos de lente.');
    expect(runs[0].id).toBe(job.id);
  });

  it('avisar que sigue vivo estira el turno; si se rehízo, le dice que ya no es suyo', async () => {
    const w = await worker();
    const edit = await photo();
    const { job } = await work(w);
    await approveStep(db, { runId: job.id, userId });
    const claimed = await claimNext(db, w);
    const run = await db.photoStepRun.findUniqueOrThrow({ where: { id: claimed!.runId } });
    expect(await heartbeat(db, w, run.id, run.lease)).toBe(true);
    expect(await heartbeat(db, w, run.id, run.lease - 1)).toBe(false);
    // Se rehace el lente mientras procesa la perspectiva.
    await redoStep(db, { runId: job.id, userId, values: null });
    expect(await heartbeat(db, w, run.id, run.lease)).toBe(false);
    const runs = await runsOf(edit.id);
    expect(runs.map((r) => [r.step, r.status])).toEqual([
      [0, 'REPLACED'],
      [1, 'REPLACED'],
      [0, 'QUEUED'],
    ]);
  });

  it('sin trabajo pregunta cada minuto, y cada 5 segundos si alguien está trabajando en la línea', async () => {
    const w = await worker();
    expect(await idlePollSeconds(db)).toBe(60);
    await photo();
    await work(w);
    expect(await idlePollSeconds(db)).toBe(5);
    // Un movimiento de hace horas no cuenta: nadie está mirando.
    expect(await idlePollSeconds(db, new Date(Date.now() + 2 * 3600_000))).toBe(60);
  });

  it('aprobar pone el siguiente en cola con los ajustes de ese momento; el último deja la foto lista', async () => {
    const w = await worker();
    const edit = await photo();
    await savePhotoSettings(db, { accountId, userId, input: { ...DEFAULT_PHOTO_SETTINGS, margen: 12 } });
    const { job } = await work(w);
    await approveStep(db, { runId: job.id, userId });
    const next = await openRun(edit.id);
    expect([next.step, next.status]).toEqual([1, 'QUEUED']);
    expect((next.settings as { margen: number }).margen).toBe(12);
    const approved = await db.photoStepRun.findUniqueOrThrow({ where: { id: job.id } });
    expect([approved.status, approved.openFor, approved.decidedById]).toEqual(['APPROVED', null, userId]);
    // Aprobar dos veces no se puede.
    await expect(approveStep(db, { runId: job.id, userId })).rejects.toThrow(PhotoQueueError);
    for (let i = 1; i < 8; i++) {
      const { job: j } = await work(w);
      await approveStep(db, { runId: j.id, userId });
    }
    const runs = await runsOf(edit.id);
    expect(runs.filter((r) => r.openFor !== null)).toEqual([]);
    expect(runs.map((r) => r.step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('rehacer con valores reemplaza ese paso y los siguientes, y conserva la explicación de Claude', async () => {
    const w = await worker();
    const edit = await photo();
    const { job } = await work(w);
    await expect(redoStep(db, { runId: job.id, userId, values: { giro: 30 } })).rejects.toThrow('va de -10 a 10');
    const redo = await redoStep(db, { runId: job.id, userId, values: { giro: -2, otro: 5 } });
    expect(redo.requested).toEqual({ giro: -2 });
    expect(redo.proposal).toEqual({ valores: { giro: 1.5 }, razon: 'Está torcida a la izquierda.', origen: 'claude' });
    const claimed = await claimNext(db, w);
    const again = await buildJob(db, claimed!.runId, deps);
    expect(again.pedidos).toEqual({ giro: -2 });
    // El trabajador no vuelve a preguntarle a Claude: la explicación anterior queda.
    for (const kind of Object.keys(again.subidas) as UploadKind[]) uploaded.add(outputPathname(productId, edit.id, again.id, kind));
    await submitResult(db, w, done(again, { propuesta: null, valores: { giro: -2 }, archivos: ['vista', 'antes'] }), {
      verify,
      pathnameFor: outputPathname,
    });
    const run = await db.photoStepRun.findUniqueOrThrow({ where: { id: again.id } });
    expect(run.proposal).toEqual(redo.proposal);
    expect(run.values).toEqual({ giro: -2 });
  });

  it('si falla, vuelve a la cola; al tercer error queda fallido y se puede reintentar o saltear', async () => {
    const w = await worker();
    const edit = await photo();
    for (let i = 1; i <= 3; i++) {
      const claimed = await claimNext(db, w);
      const run = await db.photoStepRun.findUniqueOrThrow({ where: { id: claimed!.runId } });
      expect(await submitFailure(db, w, { id: run.id, turno: run.lease, error: `No se pudo leer la foto (${i}).` })).toEqual({ aceptado: true });
    }
    const failed = await openRun(edit.id);
    expect([failed.status, failed.error]).toEqual(['FAILED', 'No se pudo leer la foto (3).']);
    expect(await claimNext(db, w)).toBeNull();
    const retry = await retryStep(db, { runId: failed.id, userId });
    expect([retry.step, retry.status, retry.attempts]).toEqual([0, 'QUEUED', 0]);
    const claimed = await claimNext(db, w);
    const run = await db.photoStepRun.findUniqueOrThrow({ where: { id: claimed!.runId } });
    for (let i = 0; i < 2; i++) {
      await submitFailure(db, w, { id: run.id, turno: (await db.photoStepRun.findUniqueOrThrow({ where: { id: run.id } })).lease, error: 'x' });
      await claimNext(db, w);
    }
    const r = await db.photoStepRun.findUniqueOrThrow({ where: { id: run.id } });
    await submitFailure(db, w, { id: r.id, turno: r.lease, error: 'x' });
    await skipStep(db, { runId: r.id, userId });
    expect((await openRun(edit.id)).step).toBe(1);
  });

  it('sacar la foto cierra lo que tenía abierto y el trabajador ya no la toma', async () => {
    const w = await worker();
    const edit = await photo();
    await archivePhoto(db, edit.id);
    expect(await claimNext(db, w)).toBeNull();
    expect((await runsOf(edit.id)).map((r) => [r.status, r.openFor])).toEqual([['REPLACED', null]]);
    expect((await db.photoEdit.findUniqueOrThrow({ where: { id: edit.id } })).archivedAt).not.toBeNull();
  });

  it('la llave: vale una sola, se corta, y el estado dice si está conectado', async () => {
    expect(await workerState(db)).toEqual({ kind: 'none' });
    const first = await createWorkerKey(db, userId);
    expect(first.startsWith('mrbimg_')).toBe(true);
    expect((await workerState(db)).kind).toBe('never');
    const second = await createWorkerKey(db, userId);
    expect(await verifyWorkerRequest(db, `Bearer ${first}`)).toBeNull();
    expect(await verifyWorkerRequest(db, `Bearer ${second}`, new Date(), { version: '0.2.0', modelo_fondo: 'isnet-general-use' })).not.toBeNull();
    expect(await verifyWorkerRequest(db, 'Bearer mcp_otra')).toBeNull();
    expect(await verifyWorkerRequest(db, null)).toBeNull();
    const state = await workerState(db);
    expect(state.kind).toBe('connected');
    if (state.kind !== 'none') {
      expect(state.keyHint).toBe(second.slice(-4));
      expect(state.info.modelo_fondo).toBe('isnet-general-use');
    }
    expect((await workerState(db, new Date(Date.now() + 10 * 60_000))).kind).toBe('disconnected');
    expect(await revokeWorkerKey(db)).toBe(true);
    expect(await verifyWorkerRequest(db, `Bearer ${second}`)).toBeNull();
    expect(await workerState(db)).toEqual({ kind: 'none' });
  });

  it('los ajustes: se guardan, se validan y sin cargar valen los de siempre', async () => {
    expect(await loadPhotoSettings(db, accountId)).toEqual(DEFAULT_PHOTO_SETTINGS);
    await savePhotoSettings(db, {
      accountId,
      userId,
      input: { margen: '10,5', fondo: '#f5f5f5', calidad_jpg: 92, topes: { ...DEFAULT_PHOTO_SETTINGS.topes, giro: 5 } },
    });
    const s = await loadPhotoSettings(db, accountId);
    expect([s.margen, s.fondo, s.calidad_jpg, s.topes.giro]).toEqual([10.5, '#F5F5F5', 92, 5]);
    await expect(savePhotoSettings(db, { accountId, userId, input: { ...DEFAULT_PHOTO_SETTINGS, fondo: 'blanco' } })).rejects.toThrow(
      PhotoSettingsError,
    );
    await expect(
      savePhotoSettings(db, { accountId, userId, input: { ...DEFAULT_PHOTO_SETTINGS, topes: { ...DEFAULT_PHOTO_SETTINGS.topes, giro: 21 } } }),
    ).rejects.toThrow('Giro: el tope va de 0 a 20.');
  });

  it('las fotos publicadas se bajan en su tamaño más grande, sin repetir', async () => {
    await db.asset.createMany({
      data: [
        { productId, kind: 'PHOTO', url: 'https://http2.mlstatic.com/D_111-MLA1_012024-O.jpg', position: 0 },
        { productId, kind: 'PHOTO', url: 'https://http2.mlstatic.com/D_NQ_NP_222-MLA2_012024-O.webp', position: 1 },
        { productId, kind: 'PHOTO', url: 'https://otro-sitio.com/foto.jpg', position: 2 },
        { productId, kind: 'VIDEO', url: 'https://youtube.com/x', position: 3 },
      ],
    });
    const asked: string[] = [];
    const stored: string[] = [];
    const channelDeps = {
      fetch: (async (u: string) => {
        asked.push(u);
        // La segunda no está en tamaño grande: vale la publicada.
        if (u.includes('222') && u.endsWith('-F.jpg')) return new Response('no', { status: 404 });
        return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': u.endsWith('.webp') ? 'image/webp' : 'image/jpeg' } });
      }) as typeof fetch,
      put: async (pathname: string) => {
        stored.push(pathname);
        return { url: `${BLOB}${pathname.replace('.', `-${stored.length}.`)}` };
      },
    };
    const r = await addChannelPhotos(db, { productId, userId }, channelDeps);
    expect(r).toEqual({ added: 2, already: 0, failed: ['Foto 3: no es un link de un canal conocido.'] });
    expect(asked).toEqual([
      'https://http2.mlstatic.com/D_111-MLA1_012024-F.jpg',
      'https://http2.mlstatic.com/D_222-MLA2_012024-F.jpg',
      'https://http2.mlstatic.com/D_NQ_NP_222-MLA2_012024-O.webp',
    ]);
    expect(stored).toEqual([`imagenes/${productId}/originales/publicada-1.jpg`, `imagenes/${productId}/originales/publicada-2.webp`]);
    const edits = await db.photoEdit.findMany({ orderBy: { position: 'asc' } });
    expect(edits.map((e) => [e.source, e.originalType, e.position])).toEqual([
      ['CHANNEL', 'image/jpeg', 0],
      ['CHANNEL', 'image/webp', 1],
    ]);
    const again = await addChannelPhotos(db, { productId, userId }, channelDeps);
    expect([again.added, again.already]).toEqual([0, 2]);
  });
});
