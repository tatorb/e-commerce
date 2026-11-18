import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import {
  cleanNote,
  cleanTarget,
  clipName,
  clockOf,
  DEFAULT_ACCOUNT_VIDEO,
  DEFAULT_EDITOR_SETTINGS,
  editorAllows,
  editorSummary,
  isLightCopy,
  minuteOf,
  pairKey,
  parsePlan,
  planSeconds,
  VIDEO_PROTOCOL,
  videoHeartbeatSchema,
  videoNextSchema,
  videoResultSchema,
  type EditorSettings,
  type Transfer,
  type VideoDone,
  type VideoPlan,
} from '@/domain/video-edit';
import { MERCADOLIBRE_CLIPS } from '@/channels/mercadolibre/clips';
import { createWorkerKey, verifyWorkerRequest } from '@/lib/image-worker';
import {
  approveEdit,
  buildVideoJob,
  claimNextEdit,
  discardEdit,
  editHeartbeat,
  editQueue,
  editsOfProduct,
  loadAccountVideo,
  loadEditorSettings,
  queueNewVideos,
  saveAccountVideo,
  videoSteps,
  pendingEdits,
  redoEdit,
  releaseEditClaim,
  requestEdit,
  saveEditorSettings,
  submitEditFailure,
  submitEditResult,
  VIDEO_LEASE_MS,
  VIDEO_PIECE_BYTES,
  VideoEditError,
  type UploadedClip,
  type VideoJobDeps,
} from '@/lib/video-edits';

// Datos inventados.

const IMAGE = { cuartos: 1, enderezado: 0, zoom: 1, centro_x: 0.5, centro_y: 0.5, rojo: 1.1, verde: 1.05, azul: 1, contraste: 1, saturacion: 1 };
const PLAN: VideoPlan = {
  imagen: IMAGE,
  tramos: [
    { inicio: 0, fin: 8, velocidad: 2, nombre: 'La caja' },
    { inicio: 8, fin: 30, velocidad: 4, nombre: 'Abrir' },
    { inicio: 30, fin: 60, velocidad: 1, nombre: 'La pieza' },
  ],
  cierre: 2,
};

describe('el plan de edición', () => {
  it('dura la suma de sus tramos y el cierre', () => {
    expect(planSeconds(PLAN)).toBeCloseTo(4 + 5.5 + 30 + 2);
  });

  it('no acepta tramos pisados, al revés ni velocidades fuera de rango', () => {
    expect(parsePlan(PLAN)).toEqual(PLAN);
    expect(parsePlan({ ...PLAN, tramos: [PLAN.tramos[1], PLAN.tramos[0]] })).toBeNull();
    expect(parsePlan({ ...PLAN, tramos: [{ inicio: 10, fin: 5, velocidad: 1 }] })).toBeNull();
    expect(parsePlan({ ...PLAN, tramos: [{ inicio: 0, fin: 20, velocidad: 40 }] })).toBeNull();
    expect(parsePlan({ ...PLAN, imagen: { ...IMAGE, rojo: 3 } })).toBeNull();
    expect(parsePlan(null)).toBeNull();
  });

  it('la duración pedida queda dentro de lo que acepta el canal', () => {
    expect(cleanTarget(45, MERCADOLIBRE_CLIPS)).toBe(45);
    expect(cleanTarget(5, MERCADOLIBRE_CLIPS)).toBe(10);
    expect(cleanTarget(300, MERCADOLIBRE_CLIPS)).toBe(60);
    expect(cleanTarget('mucho', null)).toBe(45);
    expect(cleanNote('  que se lea la etiqueta  ')).toBe('que se lea la etiqueta');
    expect(cleanNote('   ')).toBeNull();
  });

  it('reconoce la copia liviana y arma el nombre del clip', () => {
    expect(isLightCopy('DJI_0073_D.LRF')).toBe(true);
    expect(isLightCopy('dji_0073_d.lrf ')).toBe(true);
    expect(isLightCopy('DJI_0073_D.MP4')).toBe(false);
    expect(pairKey('DJI_0073_D.MP4')).toBe(pairKey('DJI_0073_D.LRF'));
    expect(clipName('DJI_0073_D.MP4')).toBe('DJI_0073_D · editado.mp4');
  });
});

describe('cuándo edita la Mac', () => {
  const night: EditorSettings = { mode: 'SCHEDULE', fromMinute: 22 * 60, toMinute: 7 * 60, pluggedOnly: true };
  const at = (clock: string, plugged: boolean | null = true) => ({ minute: minuteOf(clock), plugged });

  it('apagado no edita nunca, y es como arranca', () => {
    expect(DEFAULT_EDITOR_SETTINGS.mode).toBe('OFF');
    expect(editorAllows(DEFAULT_EDITOR_SETTINGS, at('23:00'))).toEqual({ allowed: false, reason: 'La edición de videos está apagada.' });
  });

  it('prendido edita a cualquier hora', () => {
    expect(editorAllows({ ...night, mode: 'ON' }, at('15:00'))).toEqual({ allowed: true });
  });

  it('con horario que cruza la medianoche, edita de noche y no de día', () => {
    expect(editorAllows(night, at('22:00'))).toEqual({ allowed: true });
    expect(editorAllows(night, at('03:30'))).toEqual({ allowed: true });
    expect(editorAllows(night, at('06:59'))).toEqual({ allowed: true });
    expect(editorAllows(night, at('07:00'))).toEqual({ allowed: false, reason: 'Fuera del horario: edita de 22:00 a 07:00.' });
    expect(editorAllows(night, at('21:59')).allowed).toBe(false);
    expect(editorAllows(night, { minute: null, plugged: true })).toEqual({ allowed: false, reason: 'La Mac no informó su hora.' });
  });

  it('con horario dentro del mismo día', () => {
    const lunch: EditorSettings = { ...night, fromMinute: 13 * 60, toMinute: 14 * 60 };
    expect(editorAllows(lunch, at('13:30')).allowed).toBe(true);
    expect(editorAllows(lunch, at('14:00')).allowed).toBe(false);
    expect(editorAllows(lunch, at('02:00')).allowed).toBe(false);
  });

  it('a batería no edita, salvo que se permita o que la Mac no informe la batería', () => {
    expect(editorAllows(night, at('23:00', false))).toEqual({ allowed: false, reason: 'La Mac está a batería: edita solo enchufada.' });
    expect(editorAllows({ ...night, pluggedOnly: false }, at('23:00', false)).allowed).toBe(true);
    expect(editorAllows(night, at('23:00', null)).allowed).toBe(true);
  });

  it('lo dice en palabras', () => {
    expect(editorSummary(night)).toBe('Con horario: edita de 22:00 a 07:00, solo enchufada.');
    expect(editorSummary({ ...night, mode: 'ON', pluggedOnly: false })).toBe('Prendido: edita cuando hay un video en cola.');
    expect(clockOf(425)).toBe('07:05');
    expect(minuteOf('25:00')).toBeNull();
  });
});

describe('los mensajes con la Mac', () => {
  it('un editor con otra versión de mensajes no entra', () => {
    expect(videoNextSchema.safeParse({ protocolo: VIDEO_PROTOCOL, minuto: 1380, enchufada: true }).success).toBe(true);
    expect(videoNextSchema.safeParse({ protocolo: 99 }).success).toBe(false);
    expect(videoNextSchema.safeParse({ protocolo: VIDEO_PROTOCOL, minuto: 2000 }).success).toBe(false);
    // El aviso de que sigue puede contar en qué anda.
    expect(videoHeartbeatSchema.safeParse({ protocolo: VIDEO_PROTOCOL, id: 'e1', turno: 1 }).success).toBe(true);
    expect(videoHeartbeatSchema.safeParse({ protocolo: VIDEO_PROTOCOL, id: 'e1', turno: 1, avance: { etapa: 'Exportando el clip', porcentaje: 41.7 } }).success).toBe(true);
    expect(videoHeartbeatSchema.safeParse({ protocolo: VIDEO_PROTOCOL, id: 'e1', turno: 1, avance: { etapa: 'x', porcentaje: 140 } }).success).toBe(false);
  });

  it('el resultado trae el plan y el clip, o el motivo del fallo', () => {
    const done = { protocolo: VIDEO_PROTOCOL, id: 'e1', turno: 1, ok: true, plan: PLAN, clip: { ancho: 1080, alto: 1920, segundos: 41.5, bytes: 45_000_000 }, segundos: 170 };
    expect(videoResultSchema.safeParse(done).success).toBe(true);
    expect(videoResultSchema.safeParse({ ...done, plan: { ...PLAN, tramos: [] } }).success).toBe(false);
    expect(videoResultSchema.safeParse({ protocolo: VIDEO_PROTOCOL, id: 'e1', turno: 1, ok: false, error: 'No se pudo leer.', definitivo: true }).success).toBe(true);
  });
});

describe('el contrato con la Mac', () => {
  // Los mismos ejemplos que prueba el trabajador (trabajador-imagenes/tests/test_videos_conexion.py).
  const example = (name: string) => JSON.parse(readFileSync(new URL(`../trabajador-imagenes/contrato/${name}`, import.meta.url), 'utf8'));

  it('acepta el resultado y el fallo de ejemplo', () => {
    expect(example('video_resultado.json').protocolo).toBe(VIDEO_PROTOCOL);
    expect(videoResultSchema.safeParse(example('video_resultado.json')).success).toBe(true);
    expect(videoResultSchema.safeParse(example('video_fallo.json')).success).toBe(true);
  });

  it('el trabajo de ejemplo tiene las partes que arma la app', () => {
    const job = example('video_trabajo.json').trabajo;
    expect(Object.keys(job).sort()).toEqual(
      ['ficha', 'guion', 'id', 'indicacion', 'liviana', 'momentos', 'objetivo_segundos', 'original', 'plan', 'producto', 'reglas', 'sonido', 'subidas', 'turno', 'video', 'video_del_protocolo'].sort(),
    );
    expect(Object.keys(job.original).sort()).toEqual(['bajar', 'bytes', 'carpeta', 'nombre', 'pedazo']);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('la cola del editor de videos en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const userId = 'u1';
  let accountId = '';
  let productId = '';
  let workerId = '';
  // El Drive simulado: los clips que la Mac "subió", por edición.
  let uploaded: Map<string, UploadedClip>;

  const deps: VideoJobDeps = {
    folderPath: async () => ['E-commerce Studio MRB', 'Cuenta de prueba', 'Camisa 384675', 'Videos'],
    download: (videoId, which): Transfer => ({ url: `https://app.example/original?video=${videoId}&cual=${which}`, metodo: 'GET', encabezados: {} }),
    upload: async ({ editId, lease }): Promise<Transfer> => ({ url: `https://subir.example/?edicion=${editId}&turno=${lease}`, metodo: 'PUT', encabezados: { 'Content-Type': 'video/mp4' } }),
  };
  const collect = async (e: { editId: string }) => uploaded.get(e.editId) ?? null;

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE video_edits, video_editor_settings, video_account_settings, image_workers, publication_clips, product_videos, shoot_steps, shoot_protocols, publications, stores, channels, products, accounts, users CASCADE',
    );
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    productId = (await db.product.create({ data: { accountId, name: 'Camisa 384675', productType: 'Camisa de cilindro' } })).id;
    await db.user.create({ data: { id: userId, name: 'Persona', email: 'persona@example.com' } });
    const key = await createWorkerKey(db, userId);
    workerId = (await verifyWorkerRequest(db, `Bearer ${key}`))!.workerId;
    uploaded = new Map();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function video(name = 'DJI_0073_D.MP4', extra: { lightFileId?: string; shootStepId?: string } = {}) {
    return db.productVideo.create({
      data: { productId, driveFileId: `drive-${name}`, name, mimeType: 'video/mp4', size: BigInt(754_155_258), origin: 'DRIVE', lightSize: extra.lightFileId ? BigInt(89_485_333) : null, ...extra },
    });
  }

  const done = (id: string, turno: number, extra: Partial<VideoDone> = {}): VideoDone => ({
    protocolo: VIDEO_PROTOCOL,
    id,
    turno,
    ok: true,
    plan: PLAN,
    medidas: { fondo: [0.63, 0.65, 0.67] },
    propuesta: { razon: 'Girado un cuarto para que la etiqueta se lea.', origen: 'claude', avisos: [], uso: { costo_usd: 0.0123 } },
    clip: { ancho: 1080, alto: 1920, segundos: 41.5, bytes: 45_000_000 },
    avisos: ['La cámara fue cambiando la luz sola durante la grabación.'],
    segundos: 170,
    ...extra,
  });

  const clipFile = (editId: string): UploadedClip => ({
    fileId: `clip-de-${editId}`,
    name: 'DJI_0073_D · editado.mp4',
    mimeType: 'video/mp4',
    size: BigInt(45_000_000),
    webViewLink: 'https://drive.example/clip',
    createdAt: new Date('2026-11-17T22:00:00Z'),
  });

  /** Pide la edición, la toma la Mac y la entrega. */
  async function edited(videoId: string) {
    const { editId } = await requestEdit(db, { accountId, videoId, userId });
    await claimNextEdit(db, workerId);
    uploaded.set(editId, clipFile(editId));
    expect(await submitEditResult(db, workerId, done(editId, 1), { collect })).toEqual({ aceptado: true });
    return db.videoEdit.findUniqueOrThrow({ where: { id: editId } });
  }

  it('arranca apagado y guarda cuándo edita la Mac', async () => {
    expect(await loadEditorSettings(db)).toEqual(DEFAULT_EDITOR_SETTINGS);
    const night = { mode: 'SCHEDULE', fromMinute: 1320, toMinute: 420, pluggedOnly: true };
    expect(await saveEditorSettings(db, night, userId)).toEqual(night);
    expect(await loadEditorSettings(db)).toEqual(night);
    await saveEditorSettings(db, { ...night, mode: 'ON' }, userId);
    expect((await loadEditorSettings(db)).mode).toBe('ON');
    expect(await db.videoEditorSettings.count()).toBe(1);
    await expect(saveEditorSettings(db, { ...night, mode: 'A VECES' }, userId)).rejects.toThrow(VideoEditError);
    await expect(saveEditorSettings(db, { ...night, toMinute: 1320 }, userId)).rejects.toThrow('horas distintas');
  });

  it('pedir una edición la pone en cola, una sola por video', async () => {
    const v = await video();
    const { editId } = await requestEdit(db, { accountId, videoId: v.id, targetSeconds: 300, note: '  que se lea la etiqueta ', userId });
    expect(await db.videoEdit.findUniqueOrThrow({ where: { id: editId } })).toMatchObject({ status: 'QUEUED', openFor: v.id, targetSeconds: 60, note: 'que se lea la etiqueta', askedById: userId });
    await expect(requestEdit(db, { accountId, videoId: v.id, userId })).rejects.toThrow('ya tiene una edición en curso');
    expect(await pendingEdits(db)).toBe(1);
  });

  it('no se pide para un video de otra cuenta, borrado, ni con un plan que no vale', async () => {
    const v = await video();
    const other = await db.account.create({ data: { slug: 'otra', name: 'Otra' } });
    await expect(requestEdit(db, { accountId: other.id, videoId: v.id, userId })).rejects.toThrow('no es de esta cuenta');
    await expect(requestEdit(db, { accountId, videoId: v.id, plan: { tramos: [] }, userId })).rejects.toThrow('El plan de edición no vale');
    await db.productVideo.update({ where: { id: v.id }, data: { goneAt: new Date() } });
    await expect(requestEdit(db, { accountId, videoId: v.id, userId })).rejects.toThrow('ya no está en la carpeta');
    expect(await db.videoEdit.count()).toBe(0);
  });

  it('la Mac toma la más vieja, y el pedido le dice qué editar y por dónde bajar y subir', async () => {
    const protocol = await db.shootProtocol.create({ data: { accountId, name: 'Unboxing' } });
    const step = await db.shootStep.create({ data: { protocolId: protocol.id, title: 'Unboxing', kind: 'VIDEO', editorNotes: ' Mostrar bien la primera pieza. ' } });
    const a = await video('DJI_0073_D.MP4', { lightFileId: 'drive-liviana', shootStepId: step.id });
    const b = await video('DJI_0074_D.MP4');
    const first = await requestEdit(db, { accountId, videoId: a.id, targetSeconds: 40, note: 'Más lento al final.', userId });
    await requestEdit(db, { accountId, videoId: b.id, userId });

    const claimed = await claimNextEdit(db, workerId);
    expect(claimed).toEqual({ editId: first.editId });
    const job = await buildVideoJob(db, first.editId, deps);
    expect(job).toMatchObject({
      id: first.editId,
      turno: 1,
      video: a.id,
      producto: 'Camisa de cilindro: Camisa 384675',
      video_del_protocolo: { titulo: 'Unboxing', indicaciones: 'Mostrar bien la primera pieza.' },
      indicacion: 'Más lento al final.',
      objetivo_segundos: 40,
      plan: null,
      reglas: { min_segundos: 10, max_segundos: 60, ancho: 1080, alto: 1920 },
      original: { nombre: 'DJI_0073_D.MP4', bytes: 754_155_258, carpeta: ['E-commerce Studio MRB', 'Cuenta de prueba', 'Camisa 384675', 'Videos'], pedazo: VIDEO_PIECE_BYTES },
      liviana: { nombre: 'DJI_0073_D.LRF', bytes: 89_485_333 },
      subidas: { clip: { metodo: 'PUT', url: `https://subir.example/?edicion=${first.editId}&turno=1` } },
    });
    expect(Object.keys(job).sort()).toEqual(Object.keys(JSON.parse(readFileSync(new URL('../trabajador-imagenes/contrato/video_trabajo.json', import.meta.url), 'utf8')).trabajo).sort());
    expect(job.original.bajar.url).toContain(`video=${a.id}&cual=original`);
    expect(job.liviana?.bajar.url).toContain('cual=liviana');

    // Si la Mac se reinicia, vuelve a recibir la que tenía.
    expect(await claimNextEdit(db, workerId)).toEqual({ editId: first.editId });
    expect((await db.videoEdit.findUniqueOrThrow({ where: { id: first.editId } })).lease).toBe(2);
  });

  it('un video sin copia liviana se edita igual, y un plan pedido viaja tal cual', async () => {
    const v = await video();
    const { editId } = await requestEdit(db, { accountId, videoId: v.id, plan: PLAN, userId });
    await claimNextEdit(db, workerId);
    const job = await buildVideoJob(db, editId, deps);
    expect(job.liviana).toBeNull();
    expect(job.plan).toEqual(PLAN);
  });

  it('si no se pudo armar el pedido, la edición vuelve a la cola sin contar el intento', async () => {
    const v = await video();
    const { editId } = await requestEdit(db, { accountId, videoId: v.id, userId });
    await claimNextEdit(db, workerId);
    await releaseEditClaim(db, editId, workerId);
    expect(await db.videoEdit.findUniqueOrThrow({ where: { id: editId } })).toMatchObject({ status: 'QUEUED', attempts: 0, workerId: null });
  });

  it('la Mac avisa que sigue; si deja de avisar, la edición vuelve a la cola y a los 3 intentos falla', async () => {
    const v = await video();
    const { editId } = await requestEdit(db, { accountId, videoId: v.id, userId });
    const t0 = new Date('2026-11-17T22:00:00Z');
    await claimNextEdit(db, workerId, t0);
    expect(await editHeartbeat(db, workerId, editId, 1, new Date(t0.getTime() + 60_000))).toBe(true);
    expect(await editHeartbeat(db, workerId, editId, 7)).toBe(false);

    // Otra Mac la toma cuando se vence, y la primera ya no es la dueña.
    const key = await createWorkerKey(db, userId);
    const other = (await verifyWorkerRequest(db, `Bearer ${key}`))!.workerId;
    const later = new Date(t0.getTime() + 60_000 + VIDEO_LEASE_MS + 1000);
    expect(await claimNextEdit(db, other, later)).toEqual({ editId });
    expect(await editHeartbeat(db, workerId, editId, 1, later)).toBe(false);
    expect(await submitEditResult(db, workerId, done(editId, 1), { collect })).toMatchObject({ aceptado: false });

    const much = new Date(later.getTime() + VIDEO_LEASE_MS + 1000);
    expect(await claimNextEdit(db, other, much)).toEqual({ editId });
    const end = new Date(much.getTime() + VIDEO_LEASE_MS + 1000);
    expect(await claimNextEdit(db, workerId, end)).toBeNull();
    expect(await db.videoEdit.findUniqueOrThrow({ where: { id: editId } })).toMatchObject({ status: 'FAILED', attempts: 3 });
  });

  it('la Mac entrega el clip: queda como un video del producto, esperando la aprobación', async () => {
    const v = await db.productVideo.update({ where: { id: (await video()).id }, data: { variantKey: 'sku:STD', variantLabel: 'STD' } });
    const { editId } = await requestEdit(db, { accountId, videoId: v.id, userId });
    await claimNextEdit(db, workerId);
    // Sin el clip en el Drive, no se acepta.
    expect(await submitEditResult(db, workerId, done(editId, 1), { collect })).toEqual({ aceptado: false, motivo: 'Falta subir el clip al Drive.' });
    uploaded.set(editId, clipFile(editId));
    expect(await submitEditResult(db, workerId, done(editId, 1), { collect })).toEqual({ aceptado: true });

    const edit = await db.videoEdit.findUniqueOrThrow({ where: { id: editId }, include: { clip: true } });
    expect(edit).toMatchObject({ status: 'REVIEW', openFor: v.id, seconds: 170, aiUsage: { costo_usd: 0.0123 }, plan: PLAN });
    expect(edit.clip).toMatchObject({
      productId,
      driveFileId: `clip-de-${editId}`,
      name: 'DJI_0073_D · editado.mp4',
      origin: 'APP',
      width: 1080,
      height: 1920,
      durationMs: 41_500,
      variantKey: 'sku:STD',
      variantLabel: 'STD',
    });
    // Entregar dos veces no hace nada.
    expect(await submitEditResult(db, workerId, done(editId, 1), { collect })).toMatchObject({ aceptado: false });
    expect(await db.productVideo.count()).toBe(2);

    const [row] = await editsOfProduct(db, productId);
    expect(row).toMatchObject({
      id: editId,
      videoId: v.id,
      status: 'REVIEW',
      clipId: edit.clipId,
      reason: 'Girado un cuarto para que la etiqueta se lea.',
      origin: 'claude',
      warnings: ['La cámara fue cambiando la luz sola durante la grabación.'],
      costUsd: 0.0123,
      askedBy: 'Persona',
    });
    // El clip no se vuelve a editar: se edita el original.
    await expect(requestEdit(db, { accountId, videoId: edit.clipId!, userId })).rejects.toThrow('ya es un clip editado');
  });

  it('si la Mac no pudo, reintenta; un fallo definitivo no', async () => {
    const a = await video('a.mp4');
    const b = await video('b.mp4');
    const first = await requestEdit(db, { accountId, videoId: a.id, userId });
    const second = await requestEdit(db, { accountId, videoId: b.id, userId });
    await claimNextEdit(db, workerId);
    expect(await submitEditFailure(db, workerId, { id: first.editId, turno: 1, error: 'Se cortó la conexión.' })).toEqual({ aceptado: true });
    expect(await db.videoEdit.findUniqueOrThrow({ where: { id: first.editId } })).toMatchObject({ status: 'QUEUED', error: 'Se cortó la conexión.' });
    // Sigue siendo la más vieja.
    expect(await claimNextEdit(db, workerId)).toEqual({ editId: first.editId });
    await submitEditFailure(db, workerId, { id: first.editId, turno: 2, error: 'El video no se puede leer.', definitivo: true });
    expect(await db.videoEdit.findUniqueOrThrow({ where: { id: first.editId } })).toMatchObject({ status: 'FAILED', openFor: a.id });
    expect(await claimNextEdit(db, workerId)).toEqual({ editId: second.editId });
  });

  it('aprobar deja el clip como un video más y permite editar de nuevo', async () => {
    const v = await video();
    const edit = await edited(v.id);
    await approveEdit(db, { accountId, editId: edit.id, userId });
    expect(await db.videoEdit.findUniqueOrThrow({ where: { id: edit.id } })).toMatchObject({ status: 'APPROVED', openFor: null, reviewedById: userId });
    await expect(approveEdit(db, { accountId, editId: edit.id, userId })).rejects.toThrow('no se puede aprobar ahora');
    const again = await requestEdit(db, { accountId, videoId: v.id, userId });
    // Se muestra la última: la que está en cola.
    expect((await editsOfProduct(db, productId))[0]).toMatchObject({ id: again.editId, status: 'QUEUED' });
  });

  it('pedir de nuevo descarta el clip anterior y pone otra edición en cola', async () => {
    const v = await video();
    const edit = await edited(v.id);
    const r = await redoEdit(db, { accountId, editId: edit.id, note: 'Más corto.', targetSeconds: 30, userId });
    expect(r.clipFileId).toBe(`clip-de-${edit.id}`);
    expect(await db.videoEdit.findUniqueOrThrow({ where: { id: edit.id } })).toMatchObject({ status: 'DISCARDED', openFor: null });
    expect((await db.productVideo.findUniqueOrThrow({ where: { id: edit.clipId! } })).goneAt).not.toBeNull();
    expect(await db.videoEdit.findUniqueOrThrow({ where: { id: r.editId } })).toMatchObject({ status: 'QUEUED', openFor: v.id, note: 'Más corto.', targetSeconds: 30 });
    const rows = await editsOfProduct(db, productId);
    expect(rows.map((e) => e.id)).toEqual([r.editId]);
  });

  it('descartar saca la edición de la cola, o manda el clip a la papelera y lo saca de las publicaciones', async () => {
    const a = await video('a.mp4');
    const queued = await requestEdit(db, { accountId, videoId: a.id, userId });
    expect(await discardEdit(db, { accountId, editId: queued.editId, userId })).toEqual({ clipFileId: null });
    expect(await claimNextEdit(db, workerId)).toBeNull();

    const b = await video('b.mp4');
    const edit = await edited(b.id);
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const store = await db.store.create({ data: { accountId, channelId: channel.id, name: 'Tienda' } });
    const pub = await db.publication.create({ data: { productId, storeId: store.id } });
    await db.publicationClip.create({ data: { publicationId: pub.id, videoId: edit.clipId! } });
    expect(await discardEdit(db, { accountId, editId: edit.id, userId })).toEqual({ clipFileId: `clip-de-${edit.id}` });
    expect(await db.publicationClip.count()).toBe(0);
    await expect(discardEdit(db, { accountId, editId: edit.id, userId })).rejects.toThrow('no se puede descartar ahora');
  });

  it('el pedido lleva los momentos del protocolo, la ficha del producto y el sonido de la cuenta', async () => {
    await db.product.update({ where: { id: productId }, data: { brand: 'Esteem', partNumber: '384675-030', kitContents: '4 camisas', specs: [{ name: 'Diámetro', value: '95 mm' }] } });
    const protocol = await db.shootProtocol.create({ data: { accountId, name: 'Unboxing' } });
    const moments = [
      { texto: 'Mostrar la caja y la etiqueta', importancia: 'IMPORTANTE' },
      { texto: 'Sacar las demás piezas', importancia: 'REPETIDO' },
    ];
    const step = await db.shootStep.create({ data: { protocolId: protocol.id, title: 'Unboxing cenital', kind: 'VIDEO', moments } });
    expect(await videoSteps(db, accountId)).toEqual([{ id: step.id, label: 'Unboxing: Unboxing cenital', moments: 2 }]);
    expect(await loadAccountVideo(db, accountId)).toEqual(DEFAULT_ACCOUNT_VIDEO);
    const settings = { ...DEFAULT_ACCOUNT_VIDEO, targetSeconds: 40, voiceOn: true, voiceId: 'voz1', musicOn: true, subtitlesOn: true, defaultStepId: step.id };
    await saveAccountVideo(db, { accountId, values: settings, userId });
    expect(await loadAccountVideo(db, accountId)).toEqual(settings);

    // Un video copiado al Drive no dice su paso: vale el de la cuenta.
    const v = await db.productVideo.update({ where: { id: (await video()).id }, data: { variantLabel: '0.50' } });
    const { editId } = await requestEdit(db, { accountId, videoId: v.id, userId });
    await claimNextEdit(db, workerId);
    const job = await buildVideoJob(db, editId, deps);
    expect(job.objetivo_segundos).toBe(40);
    expect(job.video_del_protocolo).toEqual({ titulo: 'Unboxing cenital', indicaciones: null });
    expect(job.momentos).toEqual(moments);
    expect(job.ficha).toBe('Producto: Camisa 384675\nTipo: Camisa de cilindro\nMarca: Esteem\nNúmero de pieza: 384675-030\nMedida: 0.50\nContenido: 4 camisas\nDiámetro: 95 mm');
    expect(job.guion).toBeNull();
    expect(job.sonido).toEqual({ voz: { id: 'voz1' }, musica: { estilo: DEFAULT_ACCOUNT_VIDEO.musicStyle }, subtitulos: true });
  });

  it('los ajustes de video de la cuenta se revisan antes de guardarse', async () => {
    const base = { ...DEFAULT_ACCOUNT_VIDEO };
    await expect(saveAccountVideo(db, { accountId, values: { ...base, voiceOn: true }, userId })).rejects.toThrow('ID de la voz');
    await expect(saveAccountVideo(db, { accountId, values: { ...base, subtitlesOn: true }, userId })).rejects.toThrow('prendé la voz primero');
    await expect(saveAccountVideo(db, { accountId, values: { ...base, musicOn: true, musicStyle: '' }, userId })).rejects.toThrow('estilo');
    await expect(saveAccountVideo(db, { accountId, values: { ...base, defaultStepId: 'no-existe' }, userId })).rejects.toThrow('ya no está en los protocolos');
    await expect(saveAccountVideo(db, { accountId, values: { ...base, targetSeconds: 500 }, userId })).rejects.toThrow(VideoEditError);
    expect(await db.videoAccountSettings.count()).toBe(0);
  });

  it('al pedir la edición se puede decir con qué paso se grabó, y pedir de nuevo con cortes y guión', async () => {
    const protocol = await db.shootProtocol.create({ data: { accountId, name: 'Unboxing' } });
    const step = await db.shootStep.create({ data: { protocolId: protocol.id, title: 'Unboxing', kind: 'VIDEO' } });
    const photo = await db.shootStep.create({ data: { protocolId: protocol.id, title: 'Frente', kind: 'PHOTO' } });
    const v = await video();
    await expect(requestEdit(db, { accountId, videoId: v.id, stepId: photo.id, userId })).rejects.toThrow('ya no está en los protocolos');
    await requestEdit(db, { accountId, videoId: v.id, stepId: step.id, userId });
    expect((await db.productVideo.findUniqueOrThrow({ where: { id: v.id } })).shootStepId).toBe(step.id);

    await claimNextEdit(db, workerId);
    const first = (await db.videoEdit.findFirstOrThrow()).id;
    uploaded.set(first, clipFile(first));
    const script = [{ inicio: 0.3, fin: 4.1, texto: 'Así llega la caja.' }];
    await submitEditResult(db, workerId, done(first, 1, { guion: script, sonido: { voz: true, musica: true, subtitulos: false, costo_usd: null } }), { collect });
    expect((await editsOfProduct(db, productId))[0]).toMatchObject({ script, sound: { voz: true, musica: true, subtitulos: false } });

    const lines = ['Así llega la caja, sellada.', '', 'La pieza, sin golpes.'];
    const again = await redoEdit(db, { accountId, editId: first, plan: PLAN, script: lines, userId });
    await claimNextEdit(db, workerId);
    const job = await buildVideoJob(db, again.editId, deps);
    expect(job.plan).toEqual(PLAN);
    expect(job.guion).toEqual(lines);
  });

  it('con la cuenta en automático, el video nuevo se edita solo y el clip sin avisos se aprueba solo', async () => {
    const a = await video('a.mp4');
    expect(await queueNewVideos(db, { accountId, productId })).toBe(0);
    await saveAccountVideo(db, { accountId, values: { ...DEFAULT_ACCOUNT_VIDEO, autoEdit: true, autoApprove: true, targetSeconds: 30 }, userId });
    expect(await queueNewVideos(db, { accountId, productId })).toBe(1);
    // No lo pone dos veces.
    expect(await queueNewVideos(db, { accountId, productId })).toBe(0);
    const edit = await db.videoEdit.findFirstOrThrow({ where: { videoId: a.id } });
    expect(edit).toMatchObject({ status: 'QUEUED', targetSeconds: 30, askedById: null });

    await claimNextEdit(db, workerId);
    uploaded.set(edit.id, clipFile(edit.id));
    await submitEditResult(db, workerId, done(edit.id, 1, { avisos: [] }), { collect });
    expect(await db.videoEdit.findUniqueOrThrow({ where: { id: edit.id } })).toMatchObject({ status: 'APPROVED', openFor: null });
    // El clip editado no vuelve a la cola.
    expect(await queueNewVideos(db, { accountId, productId })).toBe(0);

    // Con un aviso, espera a que alguien lo mire.
    const b = await video('b.mp4');
    expect(await queueNewVideos(db, { accountId, productId })).toBe(1);
    const second = await db.videoEdit.findFirstOrThrow({ where: { videoId: b.id } });
    await claimNextEdit(db, workerId);
    uploaded.set(second.id, { ...clipFile(second.id), name: 'b · editado.mp4' });
    await submitEditResult(db, workerId, done(second.id, 1), { collect });
    expect((await db.videoEdit.findUniqueOrThrow({ where: { id: second.id } })).status).toBe('REVIEW');
  });

  it('la Mac cuenta en qué anda, y la app lo muestra en el video y en la cola', async () => {
    const a = await video('a.mp4');
    const b = await video('b.mp4');
    const first = await requestEdit(db, { accountId, videoId: a.id, userId });
    await requestEdit(db, { accountId, videoId: b.id, userId });
    await claimNextEdit(db, workerId);
    const now = new Date('2026-11-18T03:00:00Z');
    expect(await editHeartbeat(db, workerId, first.editId, 1, now, { etapa: 'Exportando el clip', porcentaje: 41.7 })).toBe(true);
    const rows = await editsOfProduct(db, productId);
    expect(rows.find((r) => r.videoId === a.id)?.progress).toEqual({ stage: 'Exportando el clip', percent: 42, at: now.toISOString() });
    expect(rows.find((r) => r.videoId === b.id)?.progress).toBeNull();
    // Un aviso sin etapa no borra la última.
    await editHeartbeat(db, workerId, first.editId, 1, now);
    // La cola: primero el que se está editando, después los que esperan.
    expect(await editQueue(db)).toMatchObject([
      { status: 'PROCESSING', account: 'Cuenta de prueba', product: 'Camisa 384675', video: 'a.mp4', progress: { stage: 'Exportando el clip', percent: 42 } },
      { status: 'QUEUED', video: 'b.mp4', progress: null },
    ]);
    // Un aviso con otro turno no cuenta.
    expect(await editHeartbeat(db, workerId, first.editId, 9, now, { etapa: 'Otra', porcentaje: 1 })).toBe(false);
    // Al entregar sale de la cola, y si se vuelve a tomar arranca sin avance.
    uploaded.set(first.editId, clipFile(first.editId));
    await submitEditResult(db, workerId, done(first.editId, 1), { collect });
    expect((await editQueue(db)).map((q) => q.video)).toEqual(['b.mp4']);
    expect((await editsOfProduct(db, productId)).find((r) => r.videoId === a.id)?.progress).toBeNull();
  });

  it('una edición descartada mientras la Mac trabajaba ya no acepta su resultado', async () => {
    const v = await video();
    const { editId } = await requestEdit(db, { accountId, videoId: v.id, userId });
    await claimNextEdit(db, workerId);
    await discardEdit(db, { accountId, editId, userId });
    expect(await editHeartbeat(db, workerId, editId, 1)).toBe(false);
    uploaded.set(editId, clipFile(editId));
    expect(await submitEditResult(db, workerId, done(editId, 1), { collect })).toMatchObject({ aceptado: false });
    expect(await db.productVideo.count()).toBe(1);
  });
});
