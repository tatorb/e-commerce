import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import type { StepPart, Transfer, UploadKind, WorkerDone } from '@/domain/photo-contract';
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
  setAsIs,
  submitFailure,
  submitResult,
  type JobDeps,
} from '@/lib/photo-queue';
import { addChannelPhotos, addDriveOriginal } from '@/lib/photos';
import { loadPhotoSettings, PhotoSettingsError, savePhotoSettings } from '@/lib/photo-settings';
import { createWorkerKey, revokeWorkerKey, verifyWorkerRequest, workerState } from '@/lib/image-worker';

// Datos inventados.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('línea de imágenes en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const userId = 'u1';
  let accountId = '';
  let productId = '';
  // El Drive simulado: lo que el trabajador "subió", como "<intento>:<tipo>".
  let uploaded: Set<string>;

  const deps: JobDeps = {
    protocol: PHOTO_PROTOCOL,
    download: async (e: { originalUrl: string }): Promise<Transfer> => ({ url: `https://app.example/original?${e.originalUrl}`, metodo: 'GET', encabezados: {} }),
    uploads: async (run: { runId: string }, kinds: UploadKind[]) =>
      Object.fromEntries(
        kinds.map((kind): [UploadKind, Transfer] => [kind, { url: `https://subir.example/?corrida=${run.runId}&tipo=${kind}`, metodo: 'PUT', encabezados: { 'x-tipo': kind } }]),
      ),
  };
  const collect = async (run: { runId: string }) =>
    Object.fromEntries([...uploaded].filter((k) => k.startsWith(`${run.runId}:`)).map((k) => [k.split(':')[1], `drive:${k}`]));

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
    return addDriveOriginal(db, { productId, file: { id: name.toLowerCase(), name, size: '3000000' }, userId });
  }

  const runsOf = (editId: string) => db.photoStepRun.findMany({ where: { editId }, orderBy: { createdAt: 'asc' } });
  const openRun = async (editId: string) => (await runsOf(editId)).find((r) => r.openFor !== null)!;

  /** Lo que el trabajador devuelve de un ajuste: todos con un valor «giro» de -10 a 10. */
  function part(paso: string, extra: Partial<StepPart> = {}): StepPart {
    return {
      paso,
      aplicado: true,
      no_aplica: null,
      propuesta: { valores: { giro: 1.5 }, razon: `Propuesta para ${paso}.`, origen: 'claude' },
      valores: { giro: 1.5 },
      medidas: { medido: -1.4 },
      parametros: [
        { clave: 'giro', etiqueta: 'Giro', ayuda: 'Gira la foto.', minimo: -10, maximo: 10, defecto: 0, paso: 0.1, unidad: '°', tipo: 'numero' },
      ],
      nota: null,
      uso_claude: { costo_usd: 0.01 },
      segundos: 2,
      ...extra,
    };
  }

  function done(job: { id: string; turno: number; pasos?: string[] }, extra: Partial<WorkerDone> = {}): WorkerDone {
    return {
      protocolo: PHOTO_PROTOCOL,
      id: job.id,
      turno: job.turno,
      ok: true,
      partes: (job.pasos ?? ['lente', 'perspectiva', 'blancos', 'luces', 'color', 'fondo', 'recorte', 'sombra', 'exportar']).map((p) => part(p)),
      segundos: 10,
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
    for (const kind of Object.keys(job.subidas) as UploadKind[]) uploaded.add(`${job.id}:${kind}`);
    const r = await submitResult(db, workerId, done(job, { archivos: Object.keys(job.subidas) as UploadKind[], ...extra }), { collect });
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

  it('no acepta originales de otro tipo o muy pesados', async () => {
    const add = (name: string, size: number) => addDriveOriginal(db, { productId, file: { id: name, name, size }, userId });
    await expect(add('x.gif', 1000)).rejects.toThrow('JPG, PNG, HEIC o TIFF');
    await expect(add('x.jpg', 200 * 1024 * 1024)).rejects.toThrow('100 MB');
    expect((await add('x.tif', 1000)).originalType).toBe('image/tiff');
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

  it('el pedido lleva los 9 ajustes, lo que hay que subir y el contexto', async () => {
    const w = await worker();
    const edit = await photo();
    const { job } = await work(w);
    expect([job.grupo, job.indice, job.pasos]).toEqual([
      'corregir',
      0,
      ['lente', 'perspectiva', 'blancos', 'luces', 'color', 'fondo', 'recorte', 'sombra', 'exportar'],
    ]);
    expect(job.producto).toBe('Pistón: Kit de pistones');
    expect(job.pedidos).toBeNull();
    expect(job.original).toEqual({
      nombre: 'IMG_1.HEIC',
      tipo: 'image/heic',
      bajar: { url: `https://app.example/original?${edit.originalUrl}`, metodo: 'GET', encabezados: {} },
    });
    expect(Object.keys(job.subidas).sort()).toEqual(['antes', 'jpg', 'mascara', 'png', 'vista', 'vivo']);
    expect(job.subidas.vista!.url).toBe(`https://subir.example/?corrida=${job.id}&tipo=vista`);
    expect(job.receta).toEqual([]);
  });

  it('a un trabajador con el protocolo anterior no le pide el paquete para editar en vivo', async () => {
    const w = await worker();
    await photo();
    const claimed = await claimNext(db, w);
    const job = await buildJob(db, claimed!.runId, { ...deps, protocol: 2 });
    expect(Object.keys(job.subidas).sort()).toEqual(['antes', 'jpg', 'mascara', 'png', 'vista']);
  });

  it('a un trabajador que todavía no sabe hacer la sombra no se la pide', async () => {
    const w = await worker();
    await photo();
    const claimed = await claimNext(db, w);
    const old = await buildJob(db, claimed!.runId, { ...deps, protocol: 3 });
    expect(old.pasos).not.toContain('sombra');
    expect(Object.keys(old.subidas)).toContain('vivo');
    const now = await buildJob(db, claimed!.runId, deps);
    expect(now.pasos).toContain('sombra');
  });

  it('el pedido tiene la misma forma que el ejemplo que lee el trabajador', async () => {
    // La forma: las claves de cada objeto, sin los valores.
    const shape = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.length ? [shape(v[0])] : []
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, k === 'ajustes' || k === 'valores' || k === 'encabezados' ? 'objeto' : shape((v as Record<string, unknown>)[k])]))
          : typeof v;
    const example = JSON.parse(readFileSync(new URL('../trabajador-imagenes/contrato/trabajo.json', import.meta.url), 'utf8'));
    const w = await worker();
    await photo();
    const claimed = await claimNext(db, w);
    const job = await buildJob(db, claimed!.runId, deps);
    const built = { ...job, pedidos: { valores: {}, apagados: ['luces'] }, subidas: { vista: job.subidas.vista } };
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
    expect((run.parts as StepPart[]).map((p) => p.paso)).toEqual(job.pasos);
    expect((run.parts as StepPart[])[1].propuesta).toEqual({ valores: { giro: 1.5 }, razon: 'Propuesta para perspectiva.', origen: 'claude' });
    // El costo de Claude es la suma de los ajustes.
    expect(run.aiUsage).toEqual({ costo_usd: 0.09 });
    expect(run.previewUrl).toBe(`drive:${job.id}:vista`);
    expect(run.liveUrl).toBe(`drive:${job.id}:vivo`);
    expect(run.leaseUntil).toBeNull();
    const e = await db.photoEdit.findUniqueOrThrow({ where: { id: edit.id } });
    expect([e.width, e.height, e.camera]).toEqual([4032, 3024, { marca: 'Apple' }]);
    expect(e.previewUrl).toBe(`drive:${job.id}:antes`);
  });

  it('un resultado con turno viejo o sin archivos no se acepta', async () => {
    const w = await worker();
    await photo();
    const claimed = await claimNext(db, w);
    const job = await buildJob(db, claimed!.runId, deps);
    const opts = { collect };
    // Faltan los archivos.
    expect(await submitResult(db, w, done(job), opts)).toEqual({ aceptado: false, motivo: 'Falta subir el archivo «vista».' });
    for (const kind of ['vista', 'antes', 'png', 'jpg'] as const) uploaded.add(`${job.id}:${kind}`);
    // La Mac se reinició y lo volvió a tomar: el turno 1 ya no vale.
    await claimNext(db, w);
    expect((await submitResult(db, w, done(job), opts)).aceptado).toBe(false);
    expect(await submitResult(db, w, done({ id: job.id, turno: 2 }), opts)).toEqual({ aceptado: true });
  });

  it('un ajuste que no aplica queda anotado y el paso igual espera aprobación', async () => {
    const w = await worker();
    const edit = await photo();
    const lente = part('lente', { aplicado: false, no_aplica: 'La foto no tiene datos de lente.', propuesta: null, valores: {} });
    const { job } = await work(w, { partes: [lente, ...['perspectiva', 'blancos', 'luces', 'color', 'fondo', 'recorte', 'sombra', 'exportar'].map((p) => part(p))] });
    const run = await openRun(edit.id);
    expect([run.id, run.status]).toEqual([job.id, 'REVIEW']);
    expect((run.parts as StepPart[])[0]).toMatchObject({ paso: 'lente', aplicado: false, no_aplica: 'La foto no tiene datos de lente.' });
  });

  it('avisar que sigue vivo estira el turno; si se sacó la foto, le dice que ya no es suyo', async () => {
    const w = await worker();
    const edit = await photo();
    const claimed = await claimNext(db, w);
    const run = await db.photoStepRun.findUniqueOrThrow({ where: { id: claimed!.runId } });
    expect(await heartbeat(db, w, run.id, run.lease)).toBe(true);
    expect(await heartbeat(db, w, run.id, run.lease - 1)).toBe(false);
    await archivePhoto(db, edit.id);
    expect(await heartbeat(db, w, run.id, run.lease)).toBe(false);
  });

  it('rehacer después de aprobar vuelve a abrir la foto y el trabajador la toma de nuevo', async () => {
    const w = await worker();
    const edit = await photo();
    const { job } = await work(w);
    await approveStep(db, { runId: job.id, userId });
    await redoStep(db, { runId: job.id, userId, request: null });
    expect((await runsOf(edit.id)).map((r) => [r.step, r.status])).toEqual([
      [0, 'REPLACED'],
      [0, 'QUEUED'],
    ]);
    expect(await claimNext(db, w)).not.toBeNull();
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

  it('cada paso guarda los ajustes de la cuenta de ese momento, y aprobar deja la foto lista', async () => {
    const w = await worker();
    await savePhotoSettings(db, { accountId, userId, input: { ...DEFAULT_PHOTO_SETTINGS, margen: 12 } });
    const edit = await photo();
    const { job } = await work(w);
    expect(job.ajustes.margen).toBe(12);
    await approveStep(db, { runId: job.id, userId });
    const approved = await db.photoStepRun.findUniqueOrThrow({ where: { id: job.id } });
    expect([approved.status, approved.openFor, approved.decidedById]).toEqual(['APPROVED', null, userId]);
    expect((await runsOf(edit.id)).filter((r) => r.openFor !== null)).toEqual([]);
    // Aprobar dos veces no se puede.
    await expect(approveStep(db, { runId: job.id, userId })).rejects.toThrow(PhotoQueueError);
  });

  it('rehacer con valores de varios ajustes y ajustes apagados conserva lo que dijo Claude', async () => {
    const w = await worker();
    await photo();
    const { job } = await work(w);
    const redo = (request: Parameters<typeof redoStep>[1]['request']) => redoStep(db, { runId: job.id, userId, request });
    await expect(redo({ valores: { perspectiva: { giro: 30 } }, apagados: [] })).rejects.toThrow('va de -10 a 10');
    const again = await redo({
      valores: { perspectiva: { giro: -2, otro: 5 }, fondo: { giro: 3 }, otro: { giro: 1 } },
      apagados: ['luces', 'luces', 'otro'],
    });
    expect(again.requested).toMatchObject({ valores: { perspectiva: { giro: -2 }, fondo: { giro: 3 } }, apagados: ['luces'] });
    expect((again.requested as { propuestas: Record<string, unknown> }).propuestas.perspectiva).toEqual({
      valores: { giro: 1.5 },
      razon: 'Propuesta para perspectiva.',
      origen: 'claude',
    });
    const claimed = await claimNext(db, w);
    const next = await buildJob(db, claimed!.runId, deps);
    expect(next.pedidos).toEqual({ valores: { perspectiva: { giro: -2 }, fondo: { giro: 3 } }, apagados: ['luces'] });
    // El trabajador no vuelve a preguntarle a Claude: la explicación anterior queda.
    for (const kind of Object.keys(next.subidas) as UploadKind[]) uploaded.add(`${next.id}:${kind}`);
    const partes = next.pasos.map((p) =>
      p === 'luces' ? part(p, { aplicado: false, propuesta: null, valores: {} }) : part(p, p === 'perspectiva' ? { propuesta: null, valores: { giro: -2 } } : {}),
    );
    await submitResult(db, w, done(next, { partes, archivos: ['vista', 'antes', 'png', 'jpg'] }), { collect });
    const run = await db.photoStepRun.findUniqueOrThrow({ where: { id: next.id } });
    const parts = run.parts as StepPart[];
    expect(parts[1]).toMatchObject({ paso: 'perspectiva', valores: { giro: -2 }, propuesta: { razon: 'Propuesta para perspectiva.' } });
    expect(parts[3]).toMatchObject({ paso: 'luces', aplicado: false });
  });

  it('exportar no se puede apagar', async () => {
    const w = await worker();
    await photo();
    const { job } = await work(w);
    await expect(redoStep(db, { runId: job.id, userId, request: { valores: {}, apagados: ['exportar'] } })).rejects.toThrow(
      'Exportar no se puede apagar',
    );
  });

  it('si falla, vuelve a la cola; al tercer error queda fallido y se puede reintentar', async () => {
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
    expect((await openRun(edit.id)).status).toBe('FAILED');
  });

  it('sacar la foto cierra lo que tenía abierto y el trabajador ya no la toma', async () => {
    const w = await worker();
    const edit = await photo();
    await archivePhoto(db, edit.id);
    expect(await claimNext(db, w)).toBeNull();
    expect((await runsOf(edit.id)).map((r) => [r.status, r.openFor])).toEqual([['REPLACED', null]]);
    expect((await db.photoEdit.findUniqueOrThrow({ where: { id: edit.id } })).archivedAt).not.toBeNull();
  });

  it('la que ya viene editada no entra a la cola, y se puede pasar de tal cual a corregir y al revés', async () => {
    const w = await worker();
    const ready = await addDriveOriginal(db, { productId, file: { id: 'lista', name: 'lista.jpg', size: 2000000 }, userId, asIs: true });
    expect(ready.asIs).toBe(true);
    expect(await runsOf(ready.id)).toEqual([]);
    expect(await claimNext(db, w)).toBeNull();

    // Si ya estaba anotada para corregir, por ejemplo al leer la carpeta, se pasa a tal cual.
    const twice = await addDriveOriginal(db, { productId, file: { id: 'otra', name: 'otra.jpg', size: 1000 }, userId });
    await setAsIs(db, { editId: twice.id, asIs: true });
    expect((await runsOf(twice.id)).map((r) => r.status)).toEqual(['REPLACED']);

    // Volver a corregirla: arranca su línea.
    await setAsIs(db, { editId: ready.id, asIs: false });
    expect((await runsOf(ready.id)).map((r) => r.status)).toEqual(['QUEUED']);

    // Mientras la Mac la procesa, se marca tal cual: el trabajo se corta y su resultado no se acepta.
    const claimed = (await claimNext(db, w))!;
    const job = await buildJob(db, claimed.runId, deps);
    await setAsIs(db, { editId: ready.id, asIs: true });
    for (const kind of Object.keys(job.subidas) as UploadKind[]) uploaded.add(`${job.id}:${kind}`);
    const r = await submitResult(db, w, done(job, { archivos: Object.keys(job.subidas) as UploadKind[] }), { collect });
    expect(r.aceptado).toBe(false);
    expect((await runsOf(ready.id)).map((x) => [x.status, x.openFor])).toEqual([['REPLACED', null]]);
    expect(await claimNext(db, w)).toBeNull();

    // Una ya aprobada que pasa a tal cual y vuelve: vale la corrección aprobada, sin rehacerla.
    const edit = await photo('IMG_2.jpg');
    await work(w);
    await approveStep(db, { runId: (await openRun(edit.id)).id, userId });
    await setAsIs(db, { editId: edit.id, asIs: true });
    await setAsIs(db, { editId: edit.id, asIs: false });
    expect((await runsOf(edit.id)).map((x) => x.status)).toEqual(['APPROVED']);
    // Si ya se sacó de la lista, no.
    await archivePhoto(db, edit.id);
    await expect(setAsIs(db, { editId: edit.id, asIs: true })).rejects.toThrow(PhotoQueueError);
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
      put: async (name: string) => {
        stored.push(name);
        return { url: `drive:${stored.length}-${name}` };
      },
    };
    const r = await addChannelPhotos(db, { productId, userId }, channelDeps);
    expect(r).toEqual({ added: 2, already: 0, failed: ['Foto 3: no es un link de un canal conocido.'] });
    expect(asked).toEqual([
      'https://http2.mlstatic.com/D_111-MLA1_012024-F.jpg',
      'https://http2.mlstatic.com/D_222-MLA2_012024-F.jpg',
      'https://http2.mlstatic.com/D_NQ_NP_222-MLA2_012024-O.webp',
    ]);
    expect(stored).toEqual(['publicada-1.jpg', 'publicada-2.webp']);
    const edits = await db.photoEdit.findMany({ orderBy: { position: 'asc' } });
    expect(edits.map((e) => [e.source, e.originalType, e.position])).toEqual([
      ['CHANNEL', 'image/jpeg', 0],
      ['CHANNEL', 'image/webp', 1],
    ]);
    const again = await addChannelPhotos(db, { productId, userId }, channelDeps);
    expect([again.added, again.already]).toEqual([0, 2]);
  });
});
