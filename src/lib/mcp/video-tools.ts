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
import { offerApprovedClips, pendingClipUploads } from '@/lib/clip-uploads';
import { CryptoError } from '@/lib/crypto';
import { DriveError, trashFile, withDriveToken } from '@/lib/drive';
import { workerState } from '@/lib/image-worker';
import { ShootError, updateStep } from '@/lib/shoot';
import { storageError } from '@/lib/stored-files';
import {
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
import { saveVideoScript, VideoScriptError } from '@/lib/video-script';
import { loadVideosStep, markClipUploaded, VideoError } from '@/lib/videos';
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
        paso_del_protocolo: v.stepId,
        es_clip_de_esta_publicacion: clipIds.has(v.id),
        ...(editOf.has(v.id) ? { edicion: editOut(editOf.get(v.id)!, account) } : {}),
      })),
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
        paso_para_los_videos_copiados_al_drive: s.accountVideo.defaultStepId,
      },
      mac_del_estudio: { cuando_edita: s.editor.summary, conectada: s.editor.connected, tiene_llave: s.editor.hasKey },
      pasos_de_video_de_los_protocolos: s.videoSteps.map((st) => {
        const row = steps.find((x) => x.id === st.id);
        return { paso: st.id, nombre: st.label, indicaciones_para_el_editor: row?.editorNotes.trim() || null, momentos: parseMoments(row?.moments) };
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
    paso: z.string().nullable().optional().describe('Con qué paso de video del protocolo se grabó: la clave «paso» de get_videos_step. null: ninguno, el editor marca los momentos por lo que ve.'),
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
      if (args.paso !== undefined) await ctx.db.productVideo.update({ where: { id: video.id }, data: { shootStepId: args.paso } });
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
      return { estado: 'clip aprobado', clip: edit.clipId, siguiente: 'Quedó elegido en las publicaciones activas del producto que no tenían clip, y en Clips por subir (list_clips_to_upload): hay que subirlo a mano a Mercado Libre. Para sumarlo a una publicación que ya tenía otro clip, usá set_publication_media.' };
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
    'Cambia cómo arma la Mac el clip de cada video de la cuenta. Lo que no mandes queda como está. La voz en off necesita el ID de una voz de ElevenLabs; los subtítulos necesitan la voz. color_de_los_subtitulos es el color de la palabra que se está diciendo, el de la marca, como #6FA82C. paso_para_los_videos_copiados_al_drive es la clave «paso» de un paso de video del protocolo, de get_videos_step: vale para los videos que no dicen con cuál se grabaron. Lo automático conviene prenderlo cuando los clips ya salen bien: editar solo cada video nuevo, que Claude escriba el guión del producto que no tiene, y aprobar solo el clip que salió sin avisos. Con modo_de_la_mac, además, cambia cuándo puede editar la Mac del estudio, para todas las cuentas: solo lo puede hacer un administrador.',
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
    paso_para_los_videos_copiados_al_drive: z.string().nullable().optional(),
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
      ...(args.paso_para_los_videos_copiados_al_drive !== undefined ? { defaultStepId: args.paso_para_los_videos_copiados_al_drive } : {}),
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
        paso_para_los_videos_copiados_al_drive: saved.defaultStepId,
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
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const known = await videoSteps(ctx.db, account.id);
    const step = known.find((s) => s.id === args.paso.trim());
    if (!step) throw new McpToolError(`No hay un paso de video «${args.paso}» en los protocolos de la cuenta. Pasos: ${known.map((s) => `${s.label} (${s.id})`).join(', ') || 'ninguno'}.`);
    const row = await ctx.db.shootStep.findUniqueOrThrow({ where: { id: step.id }, select: { title: true, kind: true, explanation: true, editorNotes: true } });
    const input = stepInput.parse({ title: row.title, kind: row.kind, explanation: row.explanation, editorNotes: args.indicaciones_para_el_editor ?? row.editorNotes, moments: args.momentos });
    await asToolError(() => updateStep(ctx.db, { accountId: account.id, stepId: step.id, input }));
    return { paso: step.id, nombre: step.label, indicaciones_para_el_editor: input.editorNotes || null, momentos: input.moments, link_app: `${ctx.baseUrl}/a/${account.slug}/protocolos` };
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
    'Lista los clips aprobados y elegidos que falta subir a mano a Mercado Libre, de las publicaciones activas de la cuenta, como la pantalla Clips por subir. Mercado Libre no deja subirlos por programa a las cuentas locales. De cada uno da el link para bajar el archivo y el link a la publicación en el listado del vendedor, donde está la opción de subir el video. Al aprobar un clip, queda elegido solo en las publicaciones activas del producto que no tienen clip.',
  input: z.object({ cuenta: accountArg }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    await offerApprovedClips(ctx.db, account.id);
    const clips = await pendingClipUploads(ctx.db, account.id);
    return {
      faltan: clips.length,
      clips: clips.map((c) => ({
        publicacion: c.publicationId,
        codigo: c.externalId,
        medida: c.measure,
        titulo: c.title,
        producto: c.product,
        video: c.videoId,
        archivo: c.fileName,
        bajar: c.downloadLink,
        subir_en: c.channelLink,
        elegido: when(c.chosenAt, account),
      })),
      link_app: `${ctx.baseUrl}/a/${account.slug}/clips-por-subir`,
    };
  },
});

const uploadedTool = defineTool({
  name: 'mark_clip_uploaded',
  section: ['pipeline', 'publicaciones'],
  title: 'Anotar que un clip ya se subió a Mercado Libre',
  description:
    'Anota que la persona ya subió a mano un clip a Mercado Libre, o lo desmarca. No sube nada: solo lo saca de Clips por subir. Usala cuando la persona dice que ya lo subió.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    video: z.string().min(1).describe('El clip: el id que da list_clips_to_upload o get_videos_step.'),
    subido: z.boolean().default(true).describe('true = ya se subió; false = desmarcarlo.'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    await asToolError(() => markClipUploaded(ctx.db, { accountId: account.id, publicationId: id, videoId: args.video, uploaded: args.subido, userId: ctx.userId }));
    return { publicacion: id, video: args.video, subido: args.subido, faltan: (await pendingClipUploads(ctx.db, account.id)).length };
  },
});

export const VIDEO_TOOLS = [getStep, saveScript, requestTool, reviewTool, queueTool, settingsTool, momentsTool, clipsProbe, uploadsList, uploadedTool];
