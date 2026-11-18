import { z } from 'zod';
import { stepInput } from '@/domain/shoot';
import {
  accountVideoSchema,
  countWords,
  EDITOR_MODES,
  EDITOR_MODE_LABEL,
  editorSummary,
  MOMENT_LEVELS,
  MOMENTS_MAX,
  parseMoments,
  planSchema,
  planSeconds,
  SCRIPT_LINE_MAX,
  SCRIPT_LINES_MAX,
  scriptSeconds,
  scriptWordBudget,
} from '@/domain/video-edit';
import { formatSeconds } from '@/domain/videos';
import { ConnectError } from '@/channels/connect-types';
import { askClips, readClipsAnswer } from '@/channels/mercadolibre/clips-api';
import { withAccessToken } from '@/lib/connections';
import { activeUploaders, offerApprovedClips, pendingClipUploads, queueClipUploads, UPLOAD_PAUSE_S } from '@/lib/clip-uploads';
import { CryptoError } from '@/lib/crypto';
import { DriveError, trashFile, withDriveToken } from '@/lib/drive';
import { workerState } from '@/lib/image-worker';
import { listProtocols, ShootError, updateProtocol, updateStep } from '@/lib/shoot';
import { storageError } from '@/lib/stored-files';
import {
  STEP_REASON_TEXT,
  chooseVideoStep,
  approveEdit,
  clipRulesFor,
  discardEdit,
  editQueue,
  loadAccountVideo,
  loadEditorSettings,
  redoEdit,
  requestEdit,
  saveAccountVideo,
  saveEditorSettings,
  VideoEditError,
  videoSteps,
  type EditRow,
} from '@/lib/video-edits';
import { productMeasures, setVideoMeasure, VideoMeasureError } from '@/lib/video-measure';
import { saveVideoScript, VideoScriptError } from '@/lib/video-script';
import { loadVideosStep, markClipUploaded, syncProductVideos, VideoError } from '@/lib/videos';
import { McpToolError, accountArg, appLink, defineTool, publicationArg, resolveAccount, resolvePublication, when, type AccountRef, type McpContext } from './tool';

// El editor de videos para Claude: ver el paso Videos con sus ediciones y su
// guión, escribir el guión del clip, pedir, aprobar, rehacer y descartar
// ediciones, ver la cola de la Mac, y cambiar cómo se editan los videos de la
// cuenta y los momentos de cada paso de video del protocolo. Usa las mismas
// funciones que las pantallas.

async function target(ctx: McpContext, args: { cuenta?: string; publicacion: string }) {
  const account = await resolveAccount(ctx, args.cuenta);
  const id = await resolvePublication(ctx, account.id, args.publicacion);
  return { account, id };
}

async function asToolError<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof VideoEditError || e instanceof VideoScriptError || e instanceof VideoError || e instanceof ShootError || e instanceof DriveError || e instanceof CryptoError) {
      throw new McpToolError(e.message);
    }
    const storage = storageError(e);
    if (storage) throw new McpToolError(storage);
    throw e;
  }
}

const SCRIPT_RULES = `Reglas del guión: es la voz en off de un clip de unboxing, pero NO relata lo que se ve. Aprovecha ese tiempo para dar las certezas que da la imagen con texto. En este orden, y solo lo que tenga datos: (1) qué es y para qué motor o vehículo; (2) con qué es compatible, lo confirmado en la ficha, lo más buscado primero; (3) con qué NO es compatible, si en preguntas, dolores u objeciones aparece una confusión real; (4) entre una y tres dudas que se repiten, con una certeza concreta cada una; (5) un cierre con una certeza más (contenido, marca, origen o garantía), si queda lugar. Frases cortas para escuchar, de 6 a 18 palabras, una idea cada una, hasta ${SCRIPT_LINES_MAX} frases de hasta ${SCRIPT_LINE_MAX} caracteres. Voseo rioplatense, sin signos de exclamación, sin saludos, sin "en este video", sin pedir que compren ni consulten. Números y medidas como se dicen en voz alta; sin abreviaturas, paréntesis, barras ni rayas largas. Nunca precios, descuentos, envíos, plazos, teléfonos, links ni otras tiendas. Todo sale del paso Información y de Preguntas y respuestas (get_publication): no inventes nada.`;

const STATUS: Record<EditRow['status'], string> = {
  QUEUED: 'en cola',
  PROCESSING: 'la Mac lo está editando',
  REVIEW: 'clip listo, espera la aprobación',
  APPROVED: 'clip aprobado',
  DISCARDED: 'descartada',
  FAILED: 'no se pudo editar',
};

const speed = (v: number) => (Math.abs(v - 1) < 0.01 ? 'velocidad normal' : `${String(Math.round(v * 10) / 10).replace('.', ',')} veces más rápido`);

function editOut(e: EditRow, account: AccountRef) {
  return {
    edicion: e.id,
    estado: STATUS[e.status],
    pedida: when(e.createdAt, account),
    pedida_por: e.askedBy,
    segundos_pedidos: e.targetSeconds,
    indicacion: e.note,
    ...(e.progress ? { avance: { etapa: e.progress.stage, porcentaje: e.progress.percent } } : {}),
    ...(e.error ? { error: e.error } : {}),
    clip: e.clipId,
    explicacion: e.reason,
    avisos: e.warnings,
    sonido: e.sound ? { voz: e.sound.voz, musica: e.sound.musica, subtitulos: e.sound.subtitulos } : null,
    lo_que_dice_la_voz: e.script.map((l) => ({ segundo: Math.round(l.inicio * 10) / 10, texto: l.texto })),
    plan: e.plan
      ? {
          segundos: Math.round(planSeconds(e.plan) * 10) / 10,
          tramos: e.plan.tramos.map((t) => ({ desde: t.inicio, hasta: t.fin, nombre: t.nombre, importancia: t.importancia ?? null, velocidad: t.velocidad, en_palabras: speed(t.velocidad) })),
          cierre: e.plan.cierre,
          imagen: e.plan.imagen,
        }
      : null,
    ...(e.costUsd !== null ? { costo_de_claude_usd: e.costUsd } : {}),
    ...(e.seconds !== null ? { tardo_segundos: e.seconds } : {}),
  };
}

const getStep = defineTool({
  name: 'get_videos_step',
  section: ['pipeline', 'publicaciones'],
  title: 'Ver el paso Videos y el editor de videos',
  description: `Muestra el paso Videos de una publicación: los videos del producto (los originales y los clips que armó el editor), la última edición de cada video con su estado, su avance mientras la Mac lo edita, cómo se editó, lo que dice la voz y sus avisos, el guión del clip del producto con cuántas palabras tiene y cuántos segundos lleva, cómo se editan los videos de la cuenta (duración, voz, música, subtítulos y lo que se hace solo), cuándo edita la Mac y si está conectada, y los pasos de video de los protocolos con sus momentos. El editor corre en la Mac del estudio: gira el video a vertical, corrige luz y color, da a cada momento su velocidad según su importancia, pone la voz en off, la música y los subtítulos, y deja el clip en la carpeta de videos del producto. Los videos, el guión y los clips son del producto: los ven todas sus publicaciones. ${SCRIPT_RULES}`,
  input: z.object({ cuenta: accountArg, publicacion: publicationArg }),
  readOnly: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const s = await asToolError(() => loadVideosStep(ctx.db, { accountId: account.id, publicationId: id }));
    const steps = await ctx.db.shootStep.findMany({ where: { id: { in: s.videoSteps.map((x) => x.id) } }, select: { id: true, editorNotes: true, moments: true } });
    const rules = await clipRulesFor(ctx.db, s.productId);
    const editOf = new Map(s.edits.map((e) => [e.videoId, e]));
    const clipIds = new Set(s.clips.map((c) => c.videoId));
    const clipSeconds = s.accountVideo.targetSeconds;
    return {
      videos: s.videos.map((v) => ({
        video: v.id,
        nombre: v.name,
        duracion: v.durationMs !== null ? formatSeconds(v.durationMs) : null,
        tamano: v.width && v.height ? `${v.width} × ${v.height}` : null,
        ...(v.gone ? { ya_no_esta_en_el_drive: true } : {}),
        ...(v.editedFrom ? { clip_editado_de: v.editedFrom.name, aprobado: v.editedFrom.approved } : {}),
        ...(v.hasLightCopy ? { con_copia_liviana: true } : {}),
        paso_con_que_se_edita: v.usedStep ? v.usedStep.id : null,
        por_que_ese_paso: STEP_REASON_TEXT[v.stepReason],
        medida: v.measureLabel ?? 'todas',
        ...(v.measureSource ? { la_medida_salio_de: v.measureSource === 'archivo' ? 'el nombre del archivo' : v.measureSource === 'persona' ? 'la eligió una persona' : 'cómo se grabó en Registro de productos' } : {}),
        es_clip_de_esta_publicacion: clipIds.has(v.id),
        ...(editOf.has(v.id) ? { edicion: editOut(editOf.get(v.id)!, account) } : {}),
      })),
      medidas_del_producto: s.measures.map((m) => m.label),
      guion_del_clip: s.script
        ? {
            frases: s.script.lines,
            palabras: s.script.lines.reduce((n, l) => n + countWords(l), 0),
            segundos: Math.round(s.script.seconds),
            lo_escribio: s.script.source === 'claude' ? 'Claude, sin corregir' : 'una persona, o se corrigió a mano',
            cambiado: when(s.script.updatedAt, account),
          }
        : null,
      para_escribir_el_guion: {
        segundos_del_clip: clipSeconds,
        palabras_que_entran: scriptWordBudget(clipSeconds),
        lo_mas_que_acepta_el_canal_en_segundos: rules?.maxSeconds ?? 60,
        nota: 'Si el guión dura más que el clip pedido, el editor alarga el clip para que entre, hasta lo que acepta el canal.',
      },
      como_se_editan_los_videos_de_la_cuenta: {
        segundos_del_clip: s.accountVideo.targetSeconds,
        voz_en_off: s.accountVideo.voiceOn,
        voz_de_elevenlabs: s.accountVideo.voiceId || null,
        musica: s.accountVideo.musicOn,
        estilo_de_la_musica: s.accountVideo.musicStyle,
        subtitulos: s.accountVideo.subtitlesOn,
        color_de_los_subtitulos: s.accountVideo.subtitleColor,
        editar_solo_cada_video_nuevo: s.accountVideo.autoEdit,
        claude_escribe_el_guion_solo: s.accountVideo.autoScript,
        aprobar_solo_el_clip_sin_avisos: s.accountVideo.autoApprove,
      },
      mac_del_estudio: { cuando_edita: s.editor.summary, conectada: s.editor.connected, tiene_llave: s.editor.hasKey },
      pasos_de_video_de_los_protocolos: s.videoSteps.map((st) => {
        const row = steps.find((x) => x.id === st.id);
        return {
          paso: st.id,
          nombre: st.label,
          tipo_de_producto_del_protocolo: st.productType,
          se_usa_para_los_videos_copiados_al_drive: st.forDrive,
          indicaciones_para_el_editor: row?.editorNotes.trim() || null,
          momentos: parseMoments(row?.moments),
        };
      }),
      drive_conectado: Boolean(s.driveEmail),
      link_app: `${appLink(ctx, account, id)}?paso=videos`,
    };
  },
});

const saveScript = defineTool({
  name: 'save_video_script',
  section: ['pipeline', 'publicaciones'],
  title: 'Guardar el guión del clip',
  description: `Guarda el guión de la voz en off de los clips del producto de una publicación: las frases, en orden, que reemplazan a las que había. Con una lista vacía, lo borra. Es del producto: vale para todos sus videos y publicaciones. Los clips ya editados no cambian: para que digan el guión nuevo hay que pedirlos de nuevo con request_video_edit. Antes de escribirlo, leé el paso Información y Preguntas y respuestas con get_publication, y mirá en get_videos_step cuántas palabras entran. ${SCRIPT_RULES}`,
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    frases: z.array(z.string().max(SCRIPT_LINE_MAX)).max(SCRIPT_LINES_MAX).describe('Las frases del guión, en orden. Cada una se dice de corrido, con una pausa corta entre una y otra.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const pub = await ctx.db.publication.findUniqueOrThrow({ where: { id }, select: { productId: true } });
    const rules = await clipRulesFor(ctx.db, pub.productId);
    const saved = await asToolError(() => saveVideoScript(ctx.db, { accountId: account.id, productId: pub.productId, lines: args.frases, userId: ctx.userId, rules, source: 'claude' }));
    if (!saved) return { guion_del_clip: null, aviso: 'El guión quedó borrado: los clips nuevos salen sin voz.' };
    const settings = await loadAccountVideo(ctx.db, account.id);
    const seconds = scriptSeconds(saved.lines);
    return {
      guion_del_clip: { frases: saved.lines, palabras: saved.lines.reduce((n, l) => n + countWords(l), 0), segundos: Math.round(seconds) },
      ...(seconds > settings.targetSeconds ? { aviso: `El guión lleva unos ${Math.round(seconds)} segundos y el clip se pide de ${settings.targetSeconds}: el editor lo va a hacer más largo para que entre.` } : {}),
      ...(!settings.voiceOn ? { voz_apagada: 'La voz en off está apagada en esta cuenta: el guión no se dice hasta prenderla con update_video_settings.' } : {}),
      link_app: `${appLink(ctx, account, id)}?paso=videos`,
    };
  },
});

async function videoIn(ctx: McpContext, account: AccountRef, publicationId: string, videoId: string) {
  const s = await asToolError(() => loadVideosStep(ctx.db, { accountId: account.id, publicationId }));
  const video = s.videos.find((v) => v.id === videoId.trim());
  if (!video) throw new McpToolError(`No hay un video «${videoId}» en el producto. Usá la clave «video» de get_videos_step.`);
  return { video, edit: s.edits.find((e) => e.videoId === video.id) ?? null };
}

/** El clip descartado va a la papelera del Drive. Si no se puede, queda ahí: ya salió de la lista. */
async function trashClip(ctx: McpContext, fileId: string | null): Promise<void> {
  if (!fileId) return;
  await withDriveToken(ctx.db, (token) => trashFile(token, fileId)).catch(() => undefined);
}

const requestTool = defineTool({
  name: 'request_video_edit',
  section: ['pipeline', 'publicaciones'],
  title: 'Pedir la edición de un video',
  description:
    'Pone un video del producto en la cola del editor: la Mac del estudio lo toma cuando puede y arma el clip, que queda esperando la aprobación. Usá la clave «video» de un video original de get_videos_step, no la de un clip editado. Si el video ya tiene una edición esperando la aprobación o fallida, la pide de nuevo: el clip anterior se descarta y va a la papelera del Drive. Si está en cola o editándose, no hace nada. La voz dice el guión del clip como está en ese momento: si hace falta, guardalo antes con save_video_script. Con plan, la Mac aplica esos cortes y velocidades tal cual, sin consultar a Claude; sin plan, los propone el editor siguiendo los momentos del protocolo. El avance se ve con get_videos_step o get_video_queue.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    video: z.string().min(1).describe('La clave «video» del video original, de get_videos_step.'),
    segundos: z.number().int().min(10).max(60).optional().describe('Cuánto tiene que durar el clip. Sin decir, lo de la cuenta. Si el guión dura más, el clip se alarga.'),
    indicacion: z.string().max(1000).optional().describe('Una indicación puntual para el editor, que manda sobre las del protocolo.'),
    paso: z.string().nullable().optional().describe('Con qué paso de video del protocolo se edita: la clave «paso» de get_videos_step. null: sin protocolo, el editor marca los momentos por lo que ve. "auto": vuelve al que sale solo. Sin mandarlo, queda como está: el que eligió una persona, el paso con que se grabó en Registro de productos o, en un video copiado al Drive, el paso de video del protocolo del tipo del producto. Lo que se elige acá manda sobre eso.'),
    plan: planSchema.optional().describe('Los cortes a aplicar tal cual: el plan de una edición anterior, de get_videos_step, con los cambios que haga falta.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const { video, edit } = await videoIn(ctx, account, id, args.video);
    if (edit && (edit.status === 'QUEUED' || edit.status === 'PROCESSING')) {
      return { edicion: editOut(edit, account), aviso: 'Ese video ya está en la cola o editándose: no se pidió de nuevo.' };
    }
    const ask = { accountId: account.id, targetSeconds: args.segundos, note: args.indicacion, plan: args.plan, userId: ctx.userId };
    let redone = false;
    if (edit && (edit.status === 'REVIEW' || edit.status === 'FAILED')) {
      if (args.paso !== undefined) await asToolError(() => chooseVideoStep(ctx.db, { accountId: account.id, videoId: video.id, stepId: args.paso === 'auto' ? 'auto' : args.paso! }));
      const r = await asToolError(() => redoEdit(ctx.db, { ...ask, editId: edit.id }));
      await trashClip(ctx, r.clipFileId);
      redone = true;
    } else {
      await asToolError(() => requestEdit(ctx.db, { ...ask, videoId: video.id, ...(args.paso !== undefined ? { stepId: args.paso } : {}) }));
    }
    const now = await videoIn(ctx, account, id, video.id);
    const [editor, worker] = await Promise.all([loadEditorSettings(ctx.db), workerState(ctx.db)]);
    return {
      edicion: now.edit ? editOut(now.edit, account) : null,
      ...(redone ? { clip_anterior: 'Se descartó y fue a la papelera del Drive.' } : {}),
      mac_del_estudio: { cuando_edita: editorSummary(editor), conectada: worker.kind === 'connected' },
      link_app: `${appLink(ctx, account, id)}?paso=videos`,
    };
  },
});

const reviewTool = defineTool({
  name: 'review_video_edit',
  section: ['pipeline', 'publicaciones'],
  title: 'Aprobar o descartar la edición de un video',
  description:
    'Aprueba el clip que armó el editor para un video, o descarta la edición. Aprobar deja el clip como un video más del producto, listo para elegirlo como clip de la publicación con set_publication_media. Descartar saca la edición de la cola, frena a la Mac si lo estaba editando o, si el clip ya estaba listo, lo manda a la papelera del Drive y lo saca de las publicaciones donde estaba elegido. Antes de aprobar, mostrale a la persona cómo se editó, lo que dice la voz y los avisos: Claude no puede ver ni escuchar el clip. Usá la clave «video» del video original.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    video: z.string().min(1).describe('La clave «video» del video original, de get_videos_step.'),
    decision: z.enum(['aprobar', 'descartar']),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const { video, edit } = await videoIn(ctx, account, id, args.video);
    if (!edit || edit.status === 'APPROVED') throw new McpToolError(edit ? 'El clip de ese video ya está aprobado.' : 'Ese video no tiene ninguna edición.');
    if (args.decision === 'aprobar') {
      await asToolError(() => approveEdit(ctx.db, { accountId: account.id, editId: edit.id, userId: ctx.userId }));
      return { estado: 'clip aprobado', clip: edit.clipId, siguiente: 'Quedó elegido en las publicaciones activas del producto que no tenían clip, y en Por subir (list_clips_to_upload): la persona lo sube a Mercado Libre cuando quiera, desde su Chrome. Para sumarlo a una publicación que ya tenía otro clip, usá set_publication_media.' };
    }
    const r = await asToolError(() => discardEdit(ctx.db, { accountId: account.id, editId: edit.id, userId: ctx.userId }));
    await trashClip(ctx, r.clipFileId);
    return { estado: 'edición descartada', video: video.id, ...(r.clipFileId ? { clip: 'Fue a la papelera del Drive.' } : {}) };
  },
});

const queueTool = defineTool({
  name: 'get_video_queue',
  section: ['pipeline', 'publicaciones'],
  title: 'Ver la cola del editor de videos',
  description:
    'Muestra los videos que están en la cola del editor y el que la Mac está editando, con su etapa y su porcentaje, en el orden en que los toma, y cuándo puede editar la Mac (apagado, prendido o con horario) y si está conectada. Con cuenta, solo los de esa cuenta.',
  input: z.object({ cuenta: accountArg }),
  readOnly: true,
  async run(ctx, args) {
    const accounts = (await ctx.db.account.findMany({ select: { id: true, slug: true, name: true, timezone: true } })).filter((a) => ctx.access.isAdmin || ctx.access.accountIds.includes(a.id));
    const only = args.cuenta ? await resolveAccount(ctx, args.cuenta) : null;
    const visible = new Set((only ? [only] : accounts).map((a) => a.slug));
    const [queue, editor, worker] = await Promise.all([editQueue(ctx.db, 100), loadEditorSettings(ctx.db), workerState(ctx.db)]);
    return {
      mac_del_estudio: { cuando_edita: editorSummary(editor), modo: EDITOR_MODE_LABEL[editor.mode], conectada: worker.kind === 'connected' },
      cola: queue
        .filter((q) => visible.has(q.accountSlug))
        .map((q, i) => ({
          orden: i + 1,
          cuenta: q.account,
          producto: q.product,
          video: q.video,
          estado: STATUS[q.status],
          ...(q.progress ? { etapa: q.progress.stage, porcentaje: q.progress.percent } : {}),
          intentos: q.attempts,
          pedida: when(q.createdAt, accounts.find((a) => a.slug === q.accountSlug) ?? null),
        })),
    };
  },
});

const settingsTool = defineTool({
  name: 'update_video_settings',
  section: 'protocolos',
  title: 'Cambiar cómo se editan los videos de la cuenta',
  description:
    'Cambia cómo arma la Mac el clip de cada video de la cuenta. Lo que no mandes queda como está. La voz en off necesita el ID de una voz de ElevenLabs; los subtítulos necesitan la voz. color_de_los_subtitulos es el color de la palabra que se está diciendo, el de la marca, como #6FA82C. Lo automático conviene prenderlo cuando los clips ya salen bien: editar solo cada video nuevo, que Claude escriba el guión del producto que no tiene, y aprobar solo el clip que salió sin avisos. Con modo_de_la_mac, además, cambia cuándo puede editar la Mac del estudio, para todas las cuentas: solo lo puede hacer un administrador.',
  input: z.object({
    cuenta: accountArg,
    segundos_del_clip: z.number().int().min(10).max(60).optional(),
    voz_en_off: z.boolean().optional(),
    voz_de_elevenlabs: z.string().max(80).optional().describe('El ID de la voz, de ElevenLabs.'),
    musica: z.boolean().optional(),
    estilo_de_la_musica: z.string().max(500).optional(),
    subtitulos: z.boolean().optional(),
    color_de_los_subtitulos: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    editar_solo_cada_video_nuevo: z.boolean().optional(),
    claude_escribe_el_guion_solo: z.boolean().optional(),
    aprobar_solo_el_clip_sin_avisos: z.boolean().optional(),
    modo_de_la_mac: z
      .object({
        modo: z.enum(EDITOR_MODES).describe('OFF: no edita. ON: edita cuando hay un video en cola. SCHEDULE: solo entre las dos horas.'),
        desde: z.string().regex(/^\d{1,2}:\d{2}$/).optional().describe('Con horario: desde qué hora de la Mac, por ejemplo 22:00.'),
        hasta: z.string().regex(/^\d{1,2}:\d{2}$/).optional().describe('Con horario: hasta qué hora, por ejemplo 07:00.'),
        solo_enchufada: z.boolean().optional(),
      })
      .optional(),
  }),
  readOnly: false,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const before = await loadAccountVideo(ctx.db, account.id);
    const next = accountVideoSchema.parse({
      ...before,
      ...(args.segundos_del_clip !== undefined ? { targetSeconds: args.segundos_del_clip } : {}),
      ...(args.voz_en_off !== undefined ? { voiceOn: args.voz_en_off } : {}),
      ...(args.voz_de_elevenlabs !== undefined ? { voiceId: args.voz_de_elevenlabs } : {}),
      ...(args.musica !== undefined ? { musicOn: args.musica } : {}),
      ...(args.estilo_de_la_musica !== undefined ? { musicStyle: args.estilo_de_la_musica } : {}),
      ...(args.subtitulos !== undefined ? { subtitlesOn: args.subtitulos } : {}),
      ...(args.color_de_los_subtitulos !== undefined ? { subtitleColor: args.color_de_los_subtitulos.toUpperCase() } : {}),
      ...(args.editar_solo_cada_video_nuevo !== undefined ? { autoEdit: args.editar_solo_cada_video_nuevo } : {}),
      ...(args.claude_escribe_el_guion_solo !== undefined ? { autoScript: args.claude_escribe_el_guion_solo } : {}),
      ...(args.aprobar_solo_el_clip_sin_avisos !== undefined ? { autoApprove: args.aprobar_solo_el_clip_sin_avisos } : {}),
    });
    const saved = await asToolError(() => saveAccountVideo(ctx.db, { accountId: account.id, values: next, userId: ctx.userId }));
    let editor = await loadEditorSettings(ctx.db);
    if (args.modo_de_la_mac) {
      if (!ctx.access.isAdmin) throw new McpToolError('Los ajustes de la cuenta se guardaron, pero cuándo edita la Mac lo cambia solo un administrador, en Equipo.');
      const m = args.modo_de_la_mac;
      const minute = (text: string | undefined, fallback: number) => {
        if (!text) return fallback;
        const [h, min] = text.split(':').map(Number);
        if (h > 23 || min > 59) throw new McpToolError(`«${text}» no es una hora.`);
        return h * 60 + min;
      };
      editor = await asToolError(() =>
        saveEditorSettings(ctx.db, { mode: m.modo, fromMinute: minute(m.desde, editor.fromMinute), toMinute: minute(m.hasta, editor.toMinute), pluggedOnly: m.solo_enchufada ?? editor.pluggedOnly }, ctx.userId),
      );
    }
    return {
      como_se_editan_los_videos_de_la_cuenta: {
        segundos_del_clip: saved.targetSeconds,
        voz_en_off: saved.voiceOn,
        voz_de_elevenlabs: saved.voiceId || null,
        musica: saved.musicOn,
        estilo_de_la_musica: saved.musicStyle,
        subtitulos: saved.subtitlesOn,
        color_de_los_subtitulos: saved.subtitleColor,
        editar_solo_cada_video_nuevo: saved.autoEdit,
        claude_escribe_el_guion_solo: saved.autoScript,
        aprobar_solo_el_clip_sin_avisos: saved.autoApprove,
      },
      mac_del_estudio: { cuando_edita: editorSummary(editor) },
      link_app: `${ctx.baseUrl}/a/${account.slug}/protocolos`,
    };
  },
});

const momentsTool = defineTool({
  name: 'set_video_moments',
  section: 'protocolos',
  title: 'Cargar los momentos de un paso de video del protocolo',
  description: `Guarda los momentos de un paso de video de un protocolo, en orden, que reemplazan a los que había, y, si se mandan, sus indicaciones para el editor. Cada momento dice qué pasa en el video y qué tan importante es: IMPORTANTE va a velocidad normal (la etiqueta de la caja, la pieza en detalle la primera vez, el final con todo a la vista), NORMAL se acelera (abrir la caja, sacar envoltorios) y REPETIDO va lo más rápido (lo mismo que ya se mostró, hecho otra vez, como sacar la segunda, la tercera y la cuarta pieza iguales). El editor ubica cada momento en cada video grabado con ese paso y calcula las velocidades para que el clip dure lo pedido. Hasta ${MOMENTS_MAX} momentos. Usá la clave «paso» de get_videos_step.`,
  input: z.object({
    cuenta: accountArg,
    paso: z.string().min(1).describe('La clave «paso» del paso de video, de get_videos_step.'),
    momentos: z.array(z.object({ texto: z.string().min(1).max(300), importancia: z.enum(MOMENT_LEVELS) })).max(MOMENTS_MAX),
    indicaciones_para_el_editor: z.string().max(2000).optional().describe('Lo que el editor tiene que tener en cuenta en todos los videos de este paso. Sin mandar, quedan las que había.'),
    usar_para_los_videos_copiados_al_drive: z.boolean().optional().describe('Hace falta cuando el protocolo tiene más de un paso de video: marca este como el que se usa para los videos copiados al Drive, y desmarca los otros. Sin mandar, queda como está.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const known = await videoSteps(ctx.db, account.id);
    const step = known.find((s) => s.id === args.paso.trim());
    if (!step) throw new McpToolError(`No hay un paso de video «${args.paso}» en los protocolos de la cuenta. Pasos: ${known.map((s) => `${s.label} (${s.id})`).join(', ') || 'ninguno'}.`);
    const row = await ctx.db.shootStep.findUniqueOrThrow({ where: { id: step.id }, select: { title: true, kind: true, explanation: true, editorNotes: true, driveDefault: true } });
    const input = stepInput.parse({
      title: row.title,
      kind: row.kind,
      explanation: row.explanation,
      editorNotes: args.indicaciones_para_el_editor ?? row.editorNotes,
      moments: args.momentos,
      driveDefault: args.usar_para_los_videos_copiados_al_drive ?? row.driveDefault,
    });
    await asToolError(() => updateStep(ctx.db, { accountId: account.id, stepId: step.id, input }));
    const after = (await videoSteps(ctx.db, account.id)).find((s) => s.id === step.id);
    return {
      paso: step.id,
      nombre: step.label,
      se_usa_para_los_videos_copiados_al_drive: after?.forDrive ?? false,
      indicaciones_para_el_editor: input.editorNotes || null,
      momentos: input.moments,
      link_app: `${ctx.baseUrl}/a/${account.slug}/protocolos`,
    };
  },
});

// Cuánto dura una vuelta de la revisión de toda la cuenta.
const SYNC_ROUND_MS = 20_000;

const syncTool = defineTool({
  name: 'sync_videos',
  section: ['pipeline', 'publicaciones'],
  title: 'Revisar las carpetas de videos del Drive',
  description:
    'Lee la carpeta de videos del Drive de cada producto y pone al día la lista de videos de la app, como el botón de actualizar del paso Videos: suma los videos que se copiaron a la carpeta, saca de la lista los que se borraron o se movieron y anota las medidas que informa Google. Los videos son del producto: los ven todas sus publicaciones. Con publicaciones (hasta 20: id, código o link), revisa las carpetas de sus productos y las crea si no existen. Sin publicaciones, revisa de a una vuelta las carpetas de videos que ya existen en la cuenta, sin crear ninguna, y dice cuántas faltan: llamala de nuevo con «desde» hasta que falten 0. Con la cuenta en automático, los videos nuevos van solos a la cola del editor. No edita ni sube nada.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z.array(z.string().min(1)).min(1).max(20).optional().describe('Las publicaciones: su id en la app, su código en el canal o su link. Sin la lista, las carpetas que ya existen en toda la cuenta.'),
    desde: z.number().int().min(0).default(0).describe('Para seguir la revisión de toda la cuenta: el valor de «seguir_desde» de la vuelta anterior.'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    let productIds: string[];
    let total: number;
    if (args.publicaciones) {
      const ids = await Promise.all(args.publicaciones.map((ref) => resolvePublication(ctx, account.id, ref)));
      const pubs = await ctx.db.publication.findMany({ where: { id: { in: ids } }, select: { productId: true } });
      productIds = [...new Set(pubs.map((p) => p.productId))];
      total = productIds.length;
    } else {
      // Solo las carpetas que ya existen: revisar no crea una carpeta por cada producto de la cuenta.
      const products = await ctx.db.product.findMany({ where: { accountId: account.id }, orderBy: { id: 'asc' }, select: { id: true } });
      const folders = new Set((await ctx.db.driveFolder.findMany({ where: { key: { in: products.map((p) => `videos:${p.id}`) } }, select: { key: true } })).map((f) => f.key));
      const withFolder = products.filter((p) => folders.has(`videos:${p.id}`)).map((p) => p.id);
      total = withFolder.length;
      productIds = withFolder.slice(args.desde);
    }
    const started = Date.now();
    const out: Record<string, unknown>[] = [];
    let done = 0;
    for (const productId of productIds) {
      if (!args.publicaciones && done > 0 && Date.now() - started > SYNC_ROUND_MS) break;
      const product = await ctx.db.product.findUniqueOrThrow({ where: { id: productId }, select: { name: true } });
      try {
        const r = await syncProductVideos(ctx.db, { accountId: account.id, productId });
        const [videos, toEdit] = await Promise.all([
          ctx.db.productVideo.count({ where: { productId, goneAt: null } }),
          ctx.db.productVideo.count({ where: { productId, goneAt: null, editedBy: null, edits: { none: {} } } }),
        ]);
        // De toda la cuenta, solo se cuentan las carpetas con novedades o con videos sin editar.
        if (args.publicaciones || r.added > 0 || r.gone > 0 || toEdit > 0) {
          out.push({ producto: product.name, videos_nuevos: r.added, videos_que_ya_no_estan: r.gone, videos_en_la_carpeta: videos, videos_sin_editar: toEdit, carpeta: r.folderUrl });
        }
      } catch (e) {
        if (!(e instanceof VideoError || e instanceof DriveError || e instanceof CryptoError) && !storageError(e)) throw e;
        const message = e instanceof Error && !storageError(e) ? e.message : (storageError(e) ?? 'No se pudo leer la carpeta.');
        // Sin el Drive conectado no tiene sentido seguir con las demás.
        if (done === 0 && out.length === 0) throw new McpToolError(message);
        out.push({ producto: product.name, error: message });
      }
      done += 1;
    }
    const left = productIds.length - done;
    return {
      carpetas_revisadas: done,
      ...(args.publicaciones ? {} : { carpetas_con_videos_en_la_cuenta: total, faltan: left, ...(left > 0 ? { seguir_desde: args.desde + done } : {}) }),
      productos: out,
      ...(args.publicaciones || out.length > 0 ? {} : { nota: 'Ninguna de las carpetas revisadas tiene videos nuevos ni videos sin editar.' }),
    };
  },
});

const protocolTypeTool = defineTool({
  name: 'set_protocol_product_type',
  section: 'protocolos',
  title: 'Decir para qué tipo de producto es un protocolo',
  description:
    'Asocia un protocolo de fotos y videos a un tipo de producto de la lista de la cuenta (Tipos y marcas). Cada tipo tiene un solo protocolo. Sirve para los videos copiados al Drive, que no dicen con qué paso se grabaron: la app mira el tipo del producto y usa el paso de video del protocolo de ese tipo, el único que tenga o el marcado con set_video_moments si tiene varios. Si el tipo no tiene protocolo, el editor marca los momentos por lo que ve. Sin protocolo, lista los de la cuenta con su tipo.',
  input: z.object({
    cuenta: accountArg,
    protocolo: z.string().min(1).optional().describe('El protocolo: su nombre o su id. Sin mandarlo, solo lista los protocolos.'),
    tipo_de_producto: z.string().min(1).optional().describe('El tipo, como está en la lista de la cuenta, por ejemplo "Camisas".'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const list = async () => (await listProtocols(ctx.db, account.id)).map((p) => ({ protocolo: p.id, nombre: p.name, tipo_de_producto: p.productType, pasos_de_video: p.steps.filter((s) => s.kind === 'VIDEO').length }));
    if (!args.protocolo) return { protocolos: await list() };
    const wanted = args.protocolo.trim().toLowerCase();
    const protocols = await listProtocols(ctx.db, account.id);
    const protocol = protocols.find((p) => p.id === args.protocolo || p.name.toLowerCase() === wanted);
    if (!protocol) throw new McpToolError(`No hay un protocolo «${args.protocolo}» en la cuenta. Protocolos: ${protocols.map((p) => p.name).join(', ') || 'ninguno'}.`);
    if (!args.tipo_de_producto) throw new McpToolError('Falta el tipo de producto.');
    await asToolError(() => updateProtocol(ctx.db, { accountId: account.id, protocolId: protocol.id, input: { name: protocol.name, description: protocol.description, productType: args.tipo_de_producto } }));
    return { protocolos: await list(), link_app: `${ctx.baseUrl}/a/${account.slug}/protocolos` };
  },
});

const clipsProbe = defineTool({
  name: 'check_channel_clips',
  section: ['pipeline', 'publicaciones'],
  title: 'Preguntar a Mercado Libre por los clips de una publicación',
  description:
    'Pregunta a Mercado Libre, con la conexión de la tienda, qué clips tiene una publicación. Solo consulta, no sube ni cambia nada. Sirve para saber si la cuenta puede manejar clips por programa: devuelve lo que respondió Mercado Libre por cada dirección conocida y qué significa.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg }),
  readOnly: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const pub = await ctx.db.publication.findFirstOrThrow({
      where: { id, store: { accountId: account.id } },
      select: { externalId: true, storeId: true, store: { select: { name: true, channel: { select: { kind: true } } } } },
    });
    if (pub.store.channel.kind !== 'MERCADOLIBRE') throw new McpToolError('Los clips son de Mercado Libre y esta publicación es de otro canal.');
    if (!pub.externalId) throw new McpToolError('La publicación todavía no está en Mercado Libre: no tiene código para consultar.');
    const externalId = pub.externalId;
    try {
      const answers = await withAccessToken(ctx.db, pub.storeId, (token) => askClips(token, externalId));
      return {
        publicacion: externalId,
        tienda: pub.store.name,
        respuestas: answers.map((a) => ({ direccion: a.path, codigo: a.status, significa: readClipsAnswer(a), respuesta: a.body })),
      };
    } catch (e) {
      if (e instanceof ConnectError) throw new McpToolError(e.message);
      throw e;
    }
  },
});

const uploadsList = defineTool({
  name: 'list_clips_to_upload',
  section: ['pipeline', 'publicaciones'],
  title: 'Ver los clips que falta subir a Mercado Libre',
  description:
    'Lista los clips aprobados y elegidos que falta subir a mano a Mercado Libre, de las publicaciones activas de la cuenta, como la sección Clips de Por subir. Mercado Libre no deja subirlos por programa a las cuentas locales. Mercado Libre lleva un video por producto, que se ve en todas sus medidas y formas de cobro: hay una fila por producto y clip, aunque esté elegido en varias publicaciones, y se sube una sola vez. Si el clip está elegido solo en algunas medidas del producto, hay una fila por medida y se sube una vez por medida (va_en lo dice). Aprobar un clip no lo sube: queda en Por subir hasta que la persona lo suba. De cada uno da el link para bajar el archivo y el link a la publicación en el listado del vendedor, donde está la opción de subir el video. Al aprobar un clip, queda elegido solo en las publicaciones activas del producto que no tienen clip.',
  input: z.object({ cuenta: accountArg }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    await offerApprovedClips(ctx.db, account.id);
    const clips = await pendingClipUploads(ctx.db, account.id);
    return {
      faltan: clips.length,
      en_la_cola: clips.filter((c) => c.queuedAt).length,
      quien_atiende_la_cola: await uploadersText(ctx),
      clips: clips.map((c) => ({
        publicacion: c.publicationId,
        codigo: c.externalId,
        publicaciones_del_producto: c.publications,
        estado: c.queuedAt ? (c.triedAt ? 'en la cola, la extensión lo está subiendo' : 'en la cola de subida') : c.error ? `sin pedir: la última vez falló. ${c.error}` : 'sin pedir',
        va_en: c.allMeasures ? 'todas las medidas del producto' : `solo la medida ${c.measure ?? 'de esta publicación'}`,
        titulo: c.title,
        producto: c.product,
        video: c.videoId,
        archivo: c.fileName,
        bajar: c.downloadLink,
        subir_en: c.channelLink,
        elegido: when(c.chosenAt, account),
      })),
      link_app: `${ctx.baseUrl}/a/${account.slug}/pipeline?vista=por-subir`,
    };
  },
});

const measureTool = defineTool({
  name: 'set_video_measure',
  section: ['pipeline', 'publicaciones'],
  title: 'Elegir de qué medida es un video',
  description:
    'Elige de qué medida del producto es un video o un clip, o que es de todas. La medida sale sola del nombre del archivo, cuando trae el SKU de la medida, o de cómo se grabó en Registro de productos; esto la cambia a mano. El clip que el editor armó con ese video queda con la misma medida. Importa al aprobar el clip: uno de una medida va solo a las publicaciones de esa medida y ahí reemplaza al que era de otra o de todas, así cada medida queda con su video; uno de todas va a las publicaciones que no tienen clip. get_videos_step muestra la medida de cada video y las medidas del producto.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    video: z.string().min(1).describe('El video o el clip: el id que da get_videos_step.'),
    medida: z.string().min(1).nullable().describe('La medida, como la nombra medidas_del_producto en get_videos_step, por ejemplo "STD". null = es de todas las medidas.'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const pub = await ctx.db.publication.findUniqueOrThrow({ where: { id }, select: { productId: true } });
    const video = await ctx.db.productVideo.findFirst({ where: { id: args.video, productId: pub.productId }, select: { id: true } });
    if (!video) throw new McpToolError(`No hay un video «${args.video}» en este producto.`);
    const measures = await productMeasures(ctx.db, pub.productId);
    const wanted = args.medida === null ? null : args.medida.trim().toLowerCase();
    const measure = wanted === null ? null : measures.find((m) => m.label.toLowerCase() === wanted || m.key.toLowerCase() === wanted || m.sku?.toLowerCase() === wanted);
    if (measure === undefined) throw new McpToolError(`El producto no tiene la medida «${args.medida}». Medidas: ${measures.map((m) => m.label).join(', ') || 'ninguna, tiene una sola'}.`);
    try {
      const r = await setVideoMeasure(ctx.db, { accountId: account.id, videoId: video.id, variantKey: measure?.key ?? null });
      return { video: video.id, medida: r.label ?? 'todas' };
    } catch (e) {
      if (e instanceof VideoMeasureError) throw new McpToolError(e.message);
      throw e;
    }
  },
});

// Quién está atendiendo la cola, en palabras: sin una extensión con la cola prendida, nada se sube solo.
async function uploadersText(ctx: McpContext): Promise<string> {
  const alive = await activeUploaders(ctx.db);
  return alive.length > 0
    ? `La extensión de Chrome de ${alive.map((u) => u.name).join(', ')} está atendiendo la cola: sube de a un clip, con una pausa de unos ${Math.round(UPLOAD_PAUSE_S / 60)} minutos entre uno y otro.`
    : 'Ninguna extensión está atendiendo la cola ahora. Para que se suban, alguien tiene que tener Chrome abierto, con la sesión de la app y la de Mercado Libre, la extensión de Studio MRB instalada y «Subir sola la cola» prendido en Por subir.';
}

const queueUploadsTool = defineTool({
  name: 'queue_clip_uploads',
  section: ['pipeline', 'publicaciones'],
  title: 'Pedir que se suban clips a Mercado Libre',
  description:
    'Pone clips en la cola de subida a Mercado Libre, o los saca. Mercado Libre no deja subir clips por programa a las cuentas locales, así que la app no los sube: los sube la extensión de Chrome de Studio MRB desde el navegador de una persona, que toma la cola sola cuando tiene «Subir sola la cola» prendido. Esta herramienta deja el pedido; la subida ocurre de a un clip, con pausas, mientras ese Chrome esté abierto. La respuesta dice si hay una extensión atendiendo la cola: si no la hay, avisale a la persona. Con «todos», pone en la cola todos los clips que faltan subir en la cuenta; si no, los de «clips» (publicación y video, como los da list_clips_to_upload). Solo entran los clips aprobados y elegidos que faltan subir. Para ver cómo va, list_clips_to_upload: cada clip dice si está en la cola, si se está subiendo o por qué falló; el que falló sale de la cola y se puede pedir de nuevo. Subir un clip lo publica en la tienda después de la revisión de Mercado Libre: confirmalo con la persona antes, salvo que ya te haya pedido subir en lote.',
  input: z.object({
    cuenta: accountArg,
    todos: z.boolean().default(false).describe('true = todos los clips que faltan subir en la cuenta.'),
    clips: z
      .array(z.object({ publicacion: z.string().min(1).describe('La publicación: su id, su código en el canal o su link.'), video: z.string().min(1).describe('El clip: la clave «video» de list_clips_to_upload.') }))
      .max(200)
      .optional(),
    sacar: z.boolean().default(false).describe('true = sacarlos de la cola en vez de ponerlos.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    if (!args.todos && (!args.clips || args.clips.length === 0)) throw new McpToolError('Decí qué clips: mandá «clips», o «todos» en true.');
    await offerApprovedClips(ctx.db, account.id);
    const items = args.todos ? undefined : await Promise.all(args.clips!.map(async (c) => ({ publicationId: await resolvePublication(ctx, account.id, c.publicacion), videoId: c.video })));
    const r = await queueClipUploads(ctx.db, { accountId: account.id, items, queued: !args.sacar });
    const clips = await pendingClipUploads(ctx.db, account.id);
    return {
      [args.sacar ? 'sacados_de_la_cola' : 'puestos_en_la_cola']: r.changed,
      ...(r.skipped.length > 0 ? { no_estan_para_subir: r.skipped.map((s) => ({ publicacion: s.publicationId, video: s.videoId })), aviso: 'Esos no son clips aprobados y elegidos que falten subir: fijate en list_clips_to_upload.' } : {}),
      en_la_cola: clips.filter((c) => c.queuedAt).length,
      faltan_subir: clips.length,
      quien_atiende_la_cola: await uploadersText(ctx),
      link_app: `${ctx.baseUrl}/a/${account.slug}/pipeline?vista=por-subir`,
    };
  },
});

const uploadedTool = defineTool({
  name: 'mark_clip_uploaded',
  section: ['pipeline', 'publicaciones'],
  title: 'Anotar que un clip ya se subió a Mercado Libre',
  description:
    'Anota que la persona ya subió a mano un clip a Mercado Libre, o lo desmarca. No sube nada: solo lo saca de Clips por subir, en todas las publicaciones del producto que lo tienen elegido. Usala cuando la persona dice que ya lo subió.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    video: z.string().min(1).describe('El clip: el id que da list_clips_to_upload o get_videos_step.'),
    subido: z.boolean().default(true).describe('true = ya se subió; false = desmarcarlo.'),
    solo_esta_medida: z.boolean().default(false).describe('true cuando list_clips_to_upload dice que el clip va solo en la medida de esta publicación: se anota en esa medida y no en las demás.'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    await asToolError(() => markClipUploaded(ctx.db, { accountId: account.id, publicationId: id, videoId: args.video, uploaded: args.subido, userId: ctx.userId, onlyMeasure: args.solo_esta_medida }));
    return { publicacion: id, video: args.video, subido: args.subido, faltan: (await pendingClipUploads(ctx.db, account.id)).length };
  },
});

export const VIDEO_TOOLS = [getStep, saveScript, requestTool, reviewTool, queueTool, settingsTool, momentsTool, clipsProbe, uploadsList, uploadedTool, measureTool, protocolTypeTool, syncTool, queueUploadsTool];
