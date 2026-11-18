import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import type { VideoEditStatus } from '@/generated/prisma/enums';
import { getChannelAdapter } from '@/channels';
import type { ClipRules } from '@/domain/videos';
import { proposeVideoScript, scriptLinesOf } from '@/lib/video-script';
import {
  accountVideoSchema,
  cleanNote,
  cleanTarget,
  clipName,
  DEFAULT_EDITOR_SETTINGS,
  EDITOR_MODES,
  editorSettingsSchema,
  parseAccountVideo,
  parseMoments,
  parsePlan,
  parseProgress,
  parseRequestedScript,
  parseScript,
  planSeconds,
  type AccountVideoSettings,
  type EditProgress,
  type EditorMode,
  type EditorSettings,
  type ScriptLine,
  type Transfer,
  type VideoDone,
  type VideoJob,
  type VideoMoment,
  type VideoPlan,
  type VideoSource,
} from '@/domain/video-edit';

// La cola del editor de videos. Una persona pide editar un video del
// producto; la Mac del estudio lo toma cuando puede, arma el clip y lo deja en
// la carpeta de videos del producto, como un video más; y una persona lo
// aprueba o lo pide de nuevo. Recibe la base por parámetro para poder probarlo
// con una base de prueba.
//
// Las reglas que cuidan que nada se pise, las mismas de la línea de imágenes:
// - Hay una sola edición abierta por video (openFor, único).
// - Tomar es una sola consulta con FOR UPDATE SKIP LOCKED.
// - Cada vez que se toma, el turno sube. Un resultado con un turno viejo no se acepta.
// - Si la Mac no avisa durante 15 minutos, la edición vuelve a la cola. A los
//   3 intentos queda fallida, con el motivo.

export const VIDEO_LEASE_MS = 15 * 60 * 1000;
export const VIDEO_MAX_ATTEMPTS = 3;
// Cada cuánto vuelve a preguntar la Mac: sin trabajo y con trabajo.
export const VIDEO_POLL_IDLE_S = 120;
export const VIDEO_POLL_BUSY_S = 10;
// De a cuánto baja la Mac un archivo a través de la app: entra en lo que Vercel deja mandar por pedido.
export const VIDEO_PIECE_BYTES = 4 * 1024 * 1024;

export const OPEN_EDIT_STATUSES: VideoEditStatus[] = ['QUEUED', 'PROCESSING', 'REVIEW', 'FAILED'];

export class VideoEditError extends Error {}

type Tx = Prisma.TransactionClient;

const json = (value: unknown) => (value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue));

// ───────────────────────────── Cuándo edita la Mac ─────────────────────────────

const SETTINGS_ID = 'estudio';

export async function loadEditorSettings(db: PrismaClient | Tx): Promise<EditorSettings> {
  const row = await db.videoEditorSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (!row) return DEFAULT_EDITOR_SETTINGS;
  const mode = (EDITOR_MODES as readonly string[]).includes(row.mode) ? (row.mode as EditorMode) : 'OFF';
  return { mode, fromMinute: row.fromMinute, toMinute: row.toMinute, pluggedOnly: row.pluggedOnly };
}

export async function saveEditorSettings(db: PrismaClient, values: unknown, userId: string | null): Promise<EditorSettings> {
  const parsed = editorSettingsSchema.safeParse(values);
  if (!parsed.success) throw new VideoEditError('Revisá el modo y las horas del editor de videos.');
  if (parsed.data.mode === 'SCHEDULE' && parsed.data.fromMinute === parsed.data.toMinute) {
    throw new VideoEditError('El horario tiene que empezar y terminar a horas distintas.');
  }
  const data = { ...parsed.data, updatedById: userId };
  await db.videoEditorSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID, ...data }, update: data });
  return parsed.data;
}

// ───────────────────────────── Cómo se editan los videos de una cuenta ─────────────────────────────

export async function loadAccountVideo(db: PrismaClient | Tx, accountId: string): Promise<AccountVideoSettings> {
  const row = await db.videoAccountSettings.findUnique({ where: { accountId } });
  return parseAccountVideo(row?.values);
}

/** Los pasos de video de los protocolos de la cuenta, para elegir con cuál se grabó un video. */
export async function videoSteps(db: PrismaClient | Tx, accountId: string): Promise<{ id: string; label: string; moments: number }[]> {
  const steps = await db.shootStep.findMany({
    where: { kind: 'VIDEO', archivedAt: null, protocol: { accountId, archivedAt: null } },
    orderBy: [{ protocol: { position: 'asc' } }, { position: 'asc' }],
    select: { id: true, title: true, moments: true, protocol: { select: { name: true } } },
  });
  return steps.map((s) => ({ id: s.id, label: `${s.protocol.name}: ${s.title}`, moments: parseMoments(s.moments).length }));
}

export async function saveAccountVideo(db: PrismaClient, args: { accountId: string; values: unknown; userId: string | null }): Promise<AccountVideoSettings> {
  const parsed = accountVideoSchema.safeParse(args.values);
  if (!parsed.success) throw new VideoEditError(`Revisá los ajustes de video: ${parsed.error.issues[0]?.path.join('.')}.`);
  const v = parsed.data;
  if (v.voiceOn && !v.voiceId) throw new VideoEditError('Para prender la voz en off hace falta el ID de la voz de ElevenLabs.');
  if (v.subtitlesOn && !v.voiceOn) throw new VideoEditError('Los subtítulos escriben lo que dice la voz en off: prendé la voz primero.');
  if (v.musicOn && !v.musicStyle) throw new VideoEditError('Para prender la música hace falta describir el estilo.');
  if (v.defaultStepId && !(await videoSteps(db, args.accountId)).some((s) => s.id === v.defaultStepId)) {
    throw new VideoEditError('Ese paso de video ya no está en los protocolos de la cuenta.');
  }
  const data = { values: v as unknown as Prisma.InputJsonValue, updatedById: args.userId };
  await db.videoAccountSettings.upsert({ where: { accountId: args.accountId }, create: { accountId: args.accountId, ...data }, update: data });
  return v;
}

// ───────────────────────────── Pedir una edición ─────────────────────────────

/** Lo que pide para un clip el canal más exigente donde está el producto. Null si ninguno tiene clips. */
export async function clipRulesFor(db: PrismaClient | Tx, productId: string): Promise<ClipRules | null> {
  const pubs = await db.publication.findMany({ where: { productId }, select: { store: { select: { channel: { select: { kind: true, name: true } } } } } });
  const all = pubs.map((p) => getChannelAdapter(p.store.channel.kind, p.store.channel.name).clips).filter((r): r is ClipRules => r !== null);
  if (all.length === 0) return null;
  return all.reduce((a, b) => (b.maxSeconds < a.maxSeconds ? b : a));
}

async function videoOf(db: PrismaClient | Tx, accountId: string, videoId: string) {
  const video = await db.productVideo.findFirst({
    where: { id: videoId, product: { accountId } },
    select: { id: true, productId: true, name: true, goneAt: true, shootStepId: true, editedBy: { select: { id: true } } },
  });
  if (!video) throw new VideoEditError('El video no es de esta cuenta.');
  return video;
}

async function lockVideo(tx: Tx, videoId: string) {
  await tx.$queryRaw`SELECT id FROM product_videos WHERE id = ${videoId} FOR UPDATE`;
}

/**
 * Pone un video en la cola del editor. Con un plan, la Mac lo aplica tal cual;
 * sin plan, propone Claude. Si el video ya tiene una edición abierta, no se pide otra.
 */
export async function requestEdit(
  db: PrismaClient,
  args: { accountId: string; videoId: string; targetSeconds?: unknown; note?: unknown; plan?: unknown; script?: unknown; stepId?: string | null; userId: string | null },
): Promise<{ editId: string }> {
  const video = await videoOf(db, args.accountId, args.videoId);
  const settings = await loadAccountVideo(db, args.accountId);
  // Con qué paso del protocolo se grabó, si la persona lo dice.
  if (args.stepId !== undefined && args.stepId !== video.shootStepId) {
    if (args.stepId !== null && !(await videoSteps(db, args.accountId)).some((st) => st.id === args.stepId)) {
      throw new VideoEditError('Ese paso de video ya no está en los protocolos de la cuenta.');
    }
    await db.productVideo.update({ where: { id: video.id }, data: { shootStepId: args.stepId } });
  }
  if (video.goneAt) throw new VideoEditError('Ese video ya no está en la carpeta del Drive.');
  if (video.editedBy) throw new VideoEditError('Ese video ya es un clip editado. Editá el original.');
  const rules = await clipRulesFor(db, video.productId);
  // La voz dice el guión del producto, como está en este momento. Con otro guión pedido, ese.
  let script = settings.voiceOn ? (parseRequestedScript(args.script) ?? (await scriptLinesOf(db, video.productId))) : null;
  if (settings.voiceOn && !script && settings.autoScript) script = await writeScript(db, args.accountId, video.productId, cleanTarget(args.targetSeconds ?? settings.targetSeconds, rules), rules);
  let plan: VideoPlan | null = null;
  if (args.plan !== undefined && args.plan !== null) {
    plan = parsePlan(args.plan);
    if (!plan) throw new VideoEditError('El plan de edición no vale: revisá los tramos y las velocidades.');
    const seconds = planSeconds(plan);
    if (rules && (seconds < rules.minSeconds || seconds > rules.maxSeconds)) {
      throw new VideoEditError(`Con ese plan el clip dura ${seconds.toFixed(1)} segundos y tiene que durar de ${rules.minSeconds} a ${rules.maxSeconds}.`);
    }
  }
  return db.$transaction(async (tx) => {
    await lockVideo(tx, video.id);
    const open = await tx.videoEdit.findUnique({ where: { openFor: video.id }, select: { id: true } });
    if (open) throw new VideoEditError('Ese video ya tiene una edición en curso.');
    const edit = await tx.videoEdit.create({
      data: {
        videoId: video.id,
        openFor: video.id,
        targetSeconds: cleanTarget(args.targetSeconds ?? settings.targetSeconds, rules),
        note: cleanNote(args.note),
        requested: json(plan),
        requestedScript: json(script),
        askedById: args.userId,
      },
    });
    return { editId: edit.id };
  });
}

/**
 * Con la cuenta en automático, Claude escribe el guión del producto que todavía
 * no tiene, con la información de una de sus publicaciones. Si no se puede, el
 * clip sale sin voz: no frena la edición.
 */
async function writeScript(db: PrismaClient, accountId: string, productId: string, clipSeconds: number, rules: ClipRules | null): Promise<string[] | null> {
  try {
    const pub = await db.publication.findFirst({ where: { productId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    if (!pub) return null;
    const r = await proposeVideoScript(db, { accountId, publicationId: pub.id, clipSeconds, userId: null, rules });
    return r.ok ? r.script.lines : null;
  } catch (e) {
    console.error('No se pudo escribir el guión del clip.', e);
    return null;
  }
}

/**
 * Si la cuenta edita sola, pone en cola los videos del producto que nunca se
 * editaron. No falla: es un extra de leer la carpeta o de registrar un video.
 */
export async function queueNewVideos(db: PrismaClient, args: { accountId: string; productId: string }): Promise<number> {
  try {
    const settings = await loadAccountVideo(db, args.accountId);
    if (!settings.autoEdit) return 0;
    const fresh = await db.productVideo.findMany({
      where: { productId: args.productId, product: { accountId: args.accountId }, goneAt: null, editedBy: null, edits: { none: {} } },
      select: { id: true },
    });
    let queued = 0;
    for (const v of fresh) {
      await requestEdit(db, { accountId: args.accountId, videoId: v.id, userId: null }).then(
        () => queued++,
        () => undefined,
      );
    }
    return queued;
  } catch (e) {
    console.error('No se pudieron poner en cola los videos nuevos.', e);
    return 0;
  }
}

// ───────────────────────────── La Mac ─────────────────────────────

/**
 * Le da a la Mac la próxima edición, o null. Primero la que ya tenía tomada,
 * por si se reinició, y después la más vieja de la cola.
 */
export async function claimNextEdit(db: PrismaClient, workerId: string, now = new Date()): Promise<{ editId: string } | null> {
  return db.$transaction(async (tx) => {
    for (;;) {
      const rows = await tx.$queryRaw<{ id: string; attempts: number }[]>`
        SELECT e.id, e.attempts
        FROM video_edits e
        JOIN product_videos v ON v.id = e."videoId"
        WHERE v."goneAt" IS NULL
          AND (e.status = 'QUEUED'
            OR (e.status = 'PROCESSING' AND (e."leaseUntil" < ${now} OR e."workerId" = ${workerId})))
        ORDER BY (e.status = 'PROCESSING' AND e."workerId" = ${workerId}) DESC, e."createdAt" ASC
        LIMIT 1
        FOR UPDATE OF e SKIP LOCKED`;
      const row = rows[0];
      if (!row) return null;
      if (row.attempts >= VIDEO_MAX_ATTEMPTS) {
        await tx.videoEdit.update({
          where: { id: row.id },
          data: {
            status: 'FAILED',
            leaseUntil: null,
            workerId: null,
            error: `La Mac empezó esta edición ${VIDEO_MAX_ATTEMPTS} veces y no la terminó. Puede que se haya apagado, o que se haya apagado la edición de videos mientras trabajaba.`,
          },
        });
        continue;
      }
      await tx.videoEdit.update({
        where: { id: row.id },
        data: { status: 'PROCESSING', workerId, lease: { increment: 1 }, attempts: { increment: 1 }, leaseUntil: new Date(now.getTime() + VIDEO_LEASE_MS), progress: Prisma.DbNull },
      });
      return { editId: row.id };
    }
  });
}

/** Si hay ediciones esperando a la Mac. */
export async function pendingEdits(db: PrismaClient): Promise<number> {
  return db.videoEdit.count({ where: { status: { in: ['QUEUED', 'PROCESSING'] }, video: { goneAt: null } } });
}

export type VideoJobDeps = {
  // La ruta de carpetas del Drive hasta la de videos del producto, y los permisos para bajar y subir.
  folderPath: (productId: string) => Promise<string[]>;
  download: (videoId: string, which: 'original' | 'liviana') => Transfer;
  upload: (args: { productId: string; editId: string; lease: number; name: string }) => Promise<Transfer>;
};

/** Arma el pedido completo para la Mac: qué editar, cómo, y los permisos para bajar el original y subir el clip. */
export async function buildVideoJob(db: PrismaClient, editId: string, deps: VideoJobDeps): Promise<VideoJob> {
  const edit = await db.videoEdit.findUniqueOrThrow({
    where: { id: editId },
    include: {
      video: {
        include: {
          product: {
            select: { id: true, accountId: true, name: true, productType: true },
          },
          shootStep: { select: { title: true, editorNotes: true, moments: true } },
        },
      },
    },
  });
  const { video } = edit;
  const settings = await loadAccountVideo(db, video.product.accountId);
  // Un video copiado al Drive no dice con qué paso se grabó: vale el de la cuenta.
  const step =
    video.shootStep ??
    (settings.defaultStepId
      ? await db.shootStep.findFirst({ where: { id: settings.defaultStepId, kind: 'VIDEO', archivedAt: null }, select: { title: true, editorNotes: true, moments: true } })
      : null);
  const momentos: VideoMoment[] = parseMoments(step?.moments);
  const voice = settings.voiceOn && settings.voiceId ? { id: settings.voiceId } : null;
  const music = settings.musicOn && settings.musicStyle ? { estilo: settings.musicStyle } : null;
  const rules = await clipRulesFor(db, video.productId);
  const carpeta = await deps.folderPath(video.productId);
  const source = (which: 'original' | 'liviana', nombre: string, bytes: bigint | null): VideoSource => ({
    nombre,
    bytes: bytes === null ? null : Number(bytes),
    carpeta,
    bajar: deps.download(video.id, which),
    pedazo: VIDEO_PIECE_BYTES,
  });
  return {
    id: edit.id,
    turno: edit.lease,
    video: video.id,
    producto: [video.product.productType, video.product.name].filter(Boolean).join(': ') || null,
    video_del_protocolo: step ? { titulo: step.title, indicaciones: step.editorNotes.trim() || null } : null,
    indicacion: edit.note?.trim() || null,
    objetivo_segundos: edit.targetSeconds,
    plan: parsePlan(edit.requested),
    momentos,
    guion: parseRequestedScript(edit.requestedScript),
    sonido: voice || music ? { voz: voice, musica: music, subtitulos: Boolean(voice) && settings.subtitlesOn, color_subtitulos: settings.subtitleColor.toUpperCase() } : null,
    reglas: {
      min_segundos: rules?.minSeconds ?? 10,
      max_segundos: rules?.maxSeconds ?? 60,
      // Lo que recomienda el canal es un piso: el clip sale en 1080 × 1920, que se ve mejor y pesa poco.
      ancho: Math.max(rules?.idealSize.short ?? 0, 1080),
      alto: Math.max(rules?.idealSize.long ?? 0, 1920),
      max_bytes: rules?.maxBytes ?? 280 * 1024 ** 2,
    },
    original: source('original', video.name, video.size),
    liviana: video.lightFileId ? source('liviana', video.name.replace(/\.[^.]+$/, '') + '.LRF', video.lightSize) : null,
    subidas: { clip: await deps.upload({ productId: video.productId, editId: edit.id, lease: edit.lease, name: clipName(video.name) }) },
  };
}

/** No se pudo armar el trabajo, por ejemplo porque el Drive no respondió: vuelve a la cola sin contar el intento. */
export async function releaseEditClaim(db: PrismaClient, editId: string, workerId: string): Promise<void> {
  await db.videoEdit.updateMany({
    where: { id: editId, status: 'PROCESSING', workerId },
    data: { status: 'QUEUED', workerId: null, leaseUntil: null, attempts: { decrement: 1 } },
  });
}

/** La Mac avisa que sigue con esta edición. Si ya no es suya, se lo dice. */
export async function editHeartbeat(
  db: PrismaClient,
  workerId: string,
  editId: string,
  lease: number,
  now = new Date(),
  // En qué anda, para mostrarlo en la app.
  progress?: { etapa: string; porcentaje?: number | null } | null,
): Promise<boolean> {
  const r = await db.videoEdit.updateMany({
    where: { id: editId, status: 'PROCESSING', workerId, lease },
    data: {
      leaseUntil: new Date(now.getTime() + VIDEO_LEASE_MS),
      ...(progress ? { progress: { etapa: progress.etapa.slice(0, 120), porcentaje: progress.porcentaje ?? null, at: now.toISOString() } } : {}),
    },
  });
  return r.count > 0;
}

export type SubmitOutcome = { aceptado: true } | { aceptado: false; motivo: string };

const STALE = 'Esta edición ya no es de este intento: se pidió de nuevo, se descartó o la tomó otro intento.';

// El clip que subió la Mac, como lo informa el Drive.
export type UploadedClip = { fileId: string; name: string; mimeType: string; size: bigint | null; webViewLink: string | null; createdAt: Date | null };

/** Recibe el clip de la Mac, comprueba que esté en el Drive y lo deja como un video del producto, esperando la aprobación. */
export async function submitEditResult(
  db: PrismaClient,
  workerId: string,
  done: VideoDone,
  deps: { collect: (edit: { editId: string; lease: number }) => Promise<UploadedClip | null> },
): Promise<SubmitOutcome> {
  const edit = await db.videoEdit.findUnique({
    where: { id: done.id },
    include: { video: { select: { productId: true, variantKey: true, variantLabel: true, product: { select: { accountId: true } } } } },
  });
  if (!edit || edit.status !== 'PROCESSING' || edit.lease !== done.turno || edit.workerId !== workerId) return { aceptado: false, motivo: STALE };
  const settings = await loadAccountVideo(db, edit.video.product.accountId);
  const file = await deps.collect({ editId: edit.id, lease: edit.lease });
  if (!file) return { aceptado: false, motivo: 'Falta subir el clip al Drive.' };

  return db.$transaction(async (tx) => {
    await lockVideo(tx, edit.videoId);
    const fresh = await tx.videoEdit.findUniqueOrThrow({ where: { id: edit.id } });
    if (fresh.status !== 'PROCESSING' || fresh.lease !== done.turno) return { aceptado: false as const, motivo: STALE };
    const fields = {
      productId: edit.video.productId,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      webViewLink: file.webViewLink,
      driveCreatedAt: file.createdAt,
      origin: 'APP' as const,
      goneAt: null,
      width: done.clip.ancho,
      height: done.clip.alto,
      durationMs: Math.round(done.clip.segundos * 1000),
      measuredBy: 'editor',
      // El clip es de la misma medida que el video del que salió.
      variantKey: edit.video.variantKey,
      variantLabel: edit.video.variantLabel,
    };
    const clip = await tx.productVideo.upsert({ where: { driveFileId: file.fileId }, create: { driveFileId: file.fileId, ...fields }, update: fields });
    const cost = (typeof done.propuesta?.uso?.costo_usd === 'number' ? done.propuesta.uso.costo_usd : 0) + (typeof done.sonido?.costo_usd === 'number' ? done.sonido.costo_usd : 0);
    const warnings = [...(done.propuesta?.avisos ?? []), ...done.avisos];
    // Con la cuenta en automático, un clip que salió sin avisos no espera a nadie.
    const auto = settings.autoApprove && warnings.length === 0;
    await tx.videoEdit.update({
      where: { id: edit.id },
      data: {
        status: auto ? 'APPROVED' : 'REVIEW',
        openFor: auto ? null : edit.videoId,
        reviewedAt: auto ? new Date() : null,
        script: json(done.guion && done.guion.length > 0 ? done.guion : null),
        sound: json(done.sonido ? { voz: done.sonido.voz, musica: done.sonido.musica, subtitulos: done.sonido.subtitulos } : null),
        plan: json(done.plan),
        measures: json(done.medidas ?? null),
        proposal: json(done.propuesta ? { razon: done.propuesta.razon, origen: done.propuesta.origen, avisos: [...done.propuesta.avisos, ...done.avisos] } : { razon: '', origen: 'pedido', avisos: done.avisos }),
        clipId: clip.id,
        aiUsage: cost > 0 ? { costo_usd: Math.round(cost * 100000) / 100000 } : Prisma.DbNull,
        seconds: done.segundos,
        leaseUntil: null,
        error: null,
      },
    });
    return { aceptado: true as const };
  });
}

/** La Mac no pudo: vuelve a la cola, o queda fallida si ya no hay más intentos o el fallo es definitivo. */
export async function submitEditFailure(
  db: PrismaClient,
  workerId: string,
  args: { id: string; turno: number; error: string; definitivo?: boolean | null },
): Promise<SubmitOutcome> {
  const edit = await db.videoEdit.findUnique({ where: { id: args.id } });
  if (!edit || edit.status !== 'PROCESSING' || edit.lease !== args.turno || edit.workerId !== workerId) return { aceptado: false, motivo: STALE };
  const last = args.definitivo === true || edit.attempts >= VIDEO_MAX_ATTEMPTS;
  const r = await db.videoEdit.updateMany({
    where: { id: edit.id, status: 'PROCESSING', lease: args.turno },
    data: { status: last ? 'FAILED' : 'QUEUED', workerId: null, leaseUntil: null, error: args.error.slice(0, 4000) },
  });
  return r.count > 0 ? { aceptado: true } : { aceptado: false, motivo: STALE };
}

// ───────────────────────────── Las decisiones de la persona ─────────────────────────────

async function openEdit(tx: Tx, accountId: string, editId: string, allowed: VideoEditStatus[], what: string) {
  const edit = await tx.videoEdit.findFirst({ where: { id: editId, video: { product: { accountId } } } });
  if (!edit) throw new VideoEditError('Esa edición ya no existe.');
  await lockVideo(tx, edit.videoId);
  const fresh = await tx.videoEdit.findUniqueOrThrow({ where: { id: editId } });
  if (!allowed.includes(fresh.status)) throw new VideoEditError(`Esta edición no se puede ${what} ahora: la pantalla estaba desactualizada.`);
  return fresh;
}

/** Aprueba el clip: queda como un video más del producto, listo para elegirlo. */
export async function approveEdit(db: PrismaClient, args: { accountId: string; editId: string; userId: string | null; now?: Date }): Promise<void> {
  await db.$transaction(async (tx) => {
    const edit = await openEdit(tx, args.accountId, args.editId, ['REVIEW'], 'aprobar');
    await tx.videoEdit.update({ where: { id: edit.id }, data: { status: 'APPROVED', openFor: null, reviewedById: args.userId, reviewedAt: args.now ?? new Date() } });
  });
}

/**
 * Descarta la edición: la que estaba en cola o fallida deja de estarlo, y el
 * clip de la que esperaba aprobación sale de la lista. Devuelve el archivo del
 * clip, para mandarlo a la papelera del Drive.
 */
export async function discardEdit(db: PrismaClient, args: { accountId: string; editId: string; userId: string | null; now?: Date }): Promise<{ clipFileId: string | null }> {
  return db.$transaction((tx) => discardIn(tx, args));
}

async function discardIn(tx: Tx, args: { accountId: string; editId: string; userId: string | null; now?: Date }): Promise<{ clipFileId: string | null }> {
  const now = args.now ?? new Date();
  const edit = await openEdit(tx, args.accountId, args.editId, ['QUEUED', 'PROCESSING', 'REVIEW', 'FAILED'], 'descartar');
  await tx.videoEdit.update({
    where: { id: edit.id },
    data: { status: 'DISCARDED', openFor: null, workerId: null, leaseUntil: null, reviewedById: args.userId, reviewedAt: now },
  });
  if (!edit.clipId) return { clipFileId: null };
  const clip = await tx.productVideo.update({ where: { id: edit.clipId }, data: { goneAt: now }, select: { driveFileId: true } });
  await tx.publicationClip.deleteMany({ where: { videoId: edit.clipId } });
  return { clipFileId: clip.driveFileId };
}

/**
 * Pide la edición de nuevo: descarta la abierta y pone otra en cola, con la
 * indicación, la duración y, si se manda, el plan a aplicar tal cual.
 */
export async function redoEdit(
  db: PrismaClient,
  args: { accountId: string; editId: string; targetSeconds?: unknown; note?: unknown; plan?: unknown; script?: unknown; userId: string | null; now?: Date },
): Promise<{ editId: string; clipFileId: string | null }> {
  const before = await db.videoEdit.findFirst({ where: { id: args.editId, video: { product: { accountId: args.accountId } } }, include: { video: { select: { productId: true } } } });
  if (!before) throw new VideoEditError('Esa edición ya no existe.');
  const rules = await clipRulesFor(db, before.video.productId);
  let plan: VideoPlan | null = null;
  if (args.plan !== undefined && args.plan !== null) {
    plan = parsePlan(args.plan);
    if (!plan) throw new VideoEditError('El plan de edición no vale: revisá los tramos y las velocidades.');
  }
  const settings = await loadAccountVideo(db, args.accountId);
  // Se rehace con el guión del producto como está ahora: si se corrigió, sale corregido.
  const script = settings.voiceOn ? (parseRequestedScript(args.script) ?? (await scriptLinesOf(db, before.video.productId))) : null;
  return db.$transaction(async (tx) => {
    const { clipFileId } = await discardIn(tx, args);
    const edit = await tx.videoEdit.create({
      data: {
        videoId: before.videoId,
        openFor: before.videoId,
        targetSeconds: cleanTarget(args.targetSeconds ?? before.targetSeconds, rules),
        note: cleanNote(args.note),
        requested: json(plan),
        requestedScript: json(script),
        askedById: args.userId,
      },
    });
    return { editId: edit.id, clipFileId };
  });
}

// ───────────────────────────── Lo que muestra la app ─────────────────────────────

export type EditRow = {
  id: string;
  videoId: string;
  status: VideoEditStatus;
  targetSeconds: number;
  note: string | null;
  plan: VideoPlan | null;
  // El guión que se dijo, y el sonido que se le puso.
  script: ScriptLine[];
  sound: { voz: boolean; musica: boolean; subtitulos: boolean } | null;
  reason: string | null;
  // claude, medido, simulado o pedido.
  origin: string | null;
  warnings: string[];
  clipId: string | null;
  error: string | null;
  attempts: number;
  seconds: number | null;
  costUsd: number | null;
  // En qué anda la Mac, mientras lo edita.
  progress: EditProgress | null;
  askedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function proposalOf(raw: unknown): { razon: string; origen: string; avisos: string[] } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as { razon?: unknown; origen?: unknown; avisos?: unknown };
  return {
    razon: typeof p.razon === 'string' ? p.razon : '',
    origen: typeof p.origen === 'string' ? p.origen : '',
    avisos: Array.isArray(p.avisos) ? p.avisos.filter((a): a is string => typeof a === 'string') : [],
  };
}

function soundOf(raw: unknown): { voz: boolean; musica: boolean; subtitulos: boolean } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const x = raw as Record<string, unknown>;
  return { voz: x.voz === true, musica: x.musica === true, subtitulos: x.subtitulos === true };
}

/** La última edición de cada video del producto: la abierta, o la última aprobada. */
export async function editsOfProduct(db: PrismaClient, productId: string): Promise<EditRow[]> {
  const rows = await db.videoEdit.findMany({
    where: { video: { productId }, status: { not: 'DISCARDED' } },
    orderBy: { createdAt: 'desc' },
    include: { askedBy: { select: { name: true } } },
  });
  const seen = new Set<string>();
  const out: EditRow[] = [];
  for (const r of rows) {
    if (seen.has(r.videoId)) continue;
    seen.add(r.videoId);
    const proposal = proposalOf(r.proposal);
    const usage = r.aiUsage && typeof r.aiUsage === 'object' && !Array.isArray(r.aiUsage) ? (r.aiUsage as { costo_usd?: unknown }).costo_usd : null;
    out.push({
      id: r.id,
      videoId: r.videoId,
      status: r.status,
      targetSeconds: r.targetSeconds,
      note: r.note,
      plan: parsePlan(r.plan ?? r.requested),
      script: parseScript(r.script),
      sound: soundOf(r.sound),
      reason: proposal?.razon || null,
      origin: proposal?.origen || null,
      warnings: proposal?.avisos ?? [],
      clipId: r.clipId,
      error: r.error,
      attempts: r.attempts,
      seconds: r.seconds,
      costUsd: typeof usage === 'number' ? usage : null,
      progress: r.status === 'PROCESSING' ? parseProgress(r.progress) : null,
      askedBy: r.askedBy?.name ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
  return out;
}

export type QueueRow = { id: string; status: VideoEditStatus; account: string; accountSlug: string; product: string; video: string; progress: EditProgress | null; attempts: number; createdAt: Date };

/** Los videos en la cola del editor y el que se está editando, de todas las cuentas, en el orden en que los toma la Mac. */
export async function editQueue(db: PrismaClient, max = 30): Promise<QueueRow[]> {
  const rows = await db.videoEdit.findMany({
    where: { status: { in: ['QUEUED', 'PROCESSING'] }, video: { goneAt: null } },
    orderBy: [{ status: 'desc' }, { createdAt: 'asc' }],
    take: max,
    select: {
      id: true,
      status: true,
      progress: true,
      attempts: true,
      createdAt: true,
      video: { select: { name: true, product: { select: { name: true, account: { select: { name: true, slug: true } } } } } },
    },
  });
  return rows
    .map((r) => ({
      id: r.id,
      status: r.status,
      account: r.video.product.account.name,
      accountSlug: r.video.product.account.slug,
      product: r.video.product.name,
      video: r.video.name,
      progress: r.status === 'PROCESSING' ? parseProgress(r.progress) : null,
      attempts: r.attempts,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => Number(b.status === 'PROCESSING') - Number(a.status === 'PROCESSING') || a.createdAt.getTime() - b.createdAt.getTime());
}
