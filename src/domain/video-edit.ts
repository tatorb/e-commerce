import { z } from 'zod';
import type { ClipRules } from './videos';

// El editor de videos: lo que se habla con el trabajador de la Mac, el plan
// de edición y cuándo puede editar la Mac. Sin la base de datos, para poder
// probarlo solo. Los mismos mensajes están en trabajador-imagenes/mrb_videos/.

// La versión de los mensajes. Sube cuando cambia algo que un trabajador viejo no entiende.
export const VIDEO_PROTOCOL = 1;
export const VIDEO_PROTOCOLS = [1] as const;

// ───────────────────────────── Los momentos del video ─────────────────────────────

// En el protocolo, cada paso de video cuenta sus momentos en orden y qué tan
// importante es cada uno. Lo importante va a velocidad normal, lo normal se
// acelera y lo repetido, que ya se mostró antes, va lo más rápido.
export const MOMENT_LEVELS = ['IMPORTANTE', 'NORMAL', 'REPETIDO'] as const;
export type MomentLevel = (typeof MOMENT_LEVELS)[number];

export const MOMENT_LEVEL_LABEL: Record<MomentLevel, string> = { IMPORTANTE: 'Importante', NORMAL: 'Normal', REPETIDO: 'Repetido' };
export const MOMENT_LEVEL_HELP: Record<MomentLevel, string> = {
  IMPORTANTE: 'Va a velocidad normal.',
  NORMAL: 'Se acelera.',
  REPETIDO: 'Ya se mostró antes: va lo más rápido.',
};

export const MOMENTS_MAX = 30;
export const momentSchema = z.object({ texto: z.string().trim().min(1).max(300), importancia: z.enum(MOMENT_LEVELS) });
export const momentsSchema = z.array(momentSchema).max(MOMENTS_MAX, 'Son demasiados momentos.');
export type VideoMoment = z.infer<typeof momentSchema>;

/** Los momentos guardados de un paso. Lo que no vale se saltea. */
export function parseMoments(raw: unknown): VideoMoment[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((m) => {
    const r = momentSchema.safeParse(m);
    return r.success ? [r.data] : [];
  });
}

// ───────────────────────────── El plan ─────────────────────────────

export const SPEED_MIN = 0.5;
export const SPEED_MAX = 12;

// La corrección de imagen, una sola para todo el video porque la cámara está fija.
export const imageSchema = z.object({
  // Cuartos de vuelta en sentido horario para dejarlo vertical y derecho.
  cuartos: z.number().int().min(0).max(3),
  enderezado: z.number().min(-8).max(8),
  zoom: z.number().min(1).max(2.5),
  centro_x: z.number().min(0).max(1),
  centro_y: z.number().min(0).max(1),
  rojo: z.number().min(0.6).max(1.6),
  verde: z.number().min(0.6).max(1.6),
  azul: z.number().min(0.6).max(1.6),
  contraste: z.number().min(0.8).max(1.3),
  saturacion: z.number().min(0.5).max(1.5),
});

// Un pedazo del original, en segundos del original, y a qué velocidad va.
export const segmentSchema = z
  .object({
    inicio: z.number().min(0),
    fin: z.number().positive(),
    velocidad: z.number().min(SPEED_MIN).max(SPEED_MAX),
    nombre: z.string().max(120).default(''),
    // Qué tan importante es lo que se ve: de ahí sale la velocidad cuando la elige el código.
    importancia: z.enum(MOMENT_LEVELS).nullish(),
  })
  .refine((t) => t.fin - t.inicio >= 0.2, { error: 'Un tramo tiene que durar al menos 0,2 segundos.' });

export const planSchema = z
  .object({
    imagen: imageSchema,
    tramos: z.array(segmentSchema).min(1).max(60),
    // Segundos de imagen quieta al final, con el último cuadro.
    cierre: z.number().min(0).max(6).default(0),
  })
  .refine((p) => p.tramos.every((t, i) => i === 0 || t.inicio >= p.tramos[i - 1].fin - 1e-6), {
    error: 'Los tramos tienen que ir en orden y sin pisarse.',
  });

export type VideoPlan = z.infer<typeof planSchema>;

/** Cuánto dura el clip que sale de un plan, en segundos. */
export function planSeconds(plan: VideoPlan): number {
  return plan.tramos.reduce((sum, t) => sum + (t.fin - t.inicio) / t.velocidad, 0) + plan.cierre;
}

export function parsePlan(raw: unknown): VideoPlan | null {
  const r = planSchema.safeParse(raw);
  return r.success ? r.data : null;
}

// Cuánto puede durar el clip que se pide, si el canal no dice otra cosa.
export const TARGET_DEFAULT = 45;
export const NOTE_MAX = 1000;

/** Los segundos pedidos, dentro de lo que acepta el canal. */
export function cleanTarget(seconds: unknown, rules: Pick<ClipRules, 'minSeconds' | 'maxSeconds'> | null): number {
  const n = typeof seconds === 'number' && Number.isFinite(seconds) ? Math.round(seconds) : TARGET_DEFAULT;
  return Math.min(Math.max(n, rules?.minSeconds ?? 10), rules?.maxSeconds ?? 60);
}

export function cleanNote(note: unknown): string | null {
  const text = typeof note === 'string' ? note.trim().slice(0, NOTE_MAX) : '';
  return text || null;
}

// ───────────────────────────── El guión y el sonido ─────────────────────────────

export const SCRIPT_LINE_MAX = 400;

// El guión del clip: las frases que dice la voz, en orden. No relata el video:
// da las certezas de la publicación. Se escribe antes de editar.
export const SCRIPT_LINES_MAX = 14;
export const scriptLinesSchema = z.array(z.string().trim().max(SCRIPT_LINE_MAX, 'Una frase del guión es muy larga.')).max(SCRIPT_LINES_MAX, 'El guión tiene demasiadas frases.');

// Cuántas palabras por segundo dice la voz, hablando tranquila, y la pausa entre una frase y la siguiente.
export const WORDS_PER_SECOND = 2.3;
export const SCRIPT_PAUSE_SECONDS = 0.4;
// Lo que queda en silencio al principio y al final del clip.
const SCRIPT_EDGES_SECONDS = 1.2;

/** Las frases limpias: sin vacías y sin espacios de más. */
export function cleanScriptLines(raw: unknown): string[] {
  const r = scriptLinesSchema.safeParse(Array.isArray(raw) ? raw.filter((l) => typeof l === 'string') : []);
  return r.success ? r.data.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean) : [];
}

/**
 * Cómo se escribe cada frase en los subtítulos: una por frase del guión, vacía
 * cuando se escribe igual que lo que dice la voz. Null si todas son iguales.
 */
export function cleanShownLines(lines: string[], raw: unknown): string[] | null {
  const list = Array.isArray(raw) ? raw : [];
  const shown = lines.map((line, i) => {
    const text = typeof list[i] === 'string' ? (list[i] as string).replace(/\s+/g, ' ').trim().slice(0, SCRIPT_LINE_MAX) : '';
    return text === line ? '' : text;
  });
  return shown.some(Boolean) ? shown : null;
}

export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Cuántos segundos lleva decir el guión, a ojo: sirve para avisar antes de editar. */
export function scriptSeconds(lines: string[]): number {
  const said = lines.filter((l) => l.trim());
  if (said.length === 0) return 0;
  const words = said.reduce((sum, l) => sum + countWords(l), 0);
  return words / WORDS_PER_SECOND + (said.length - 1) * SCRIPT_PAUSE_SECONDS + SCRIPT_EDGES_SECONDS;
}

/** Cuántas palabras entran, como mucho, en un clip de esos segundos. */
export function scriptWordBudget(clipSeconds: number, lines = 7): number {
  return Math.max(10, Math.floor((clipSeconds - SCRIPT_EDGES_SECONDS - (lines - 1) * SCRIPT_PAUSE_SECONDS) * WORDS_PER_SECOND));
}

// El guión que pide la persona: una línea por tramo del plan, en orden. Una línea vacía es un tramo en silencio.
export const requestedScriptSchema = z.array(z.string().trim().max(SCRIPT_LINE_MAX)).max(60);

// El guión que se dijo: cada línea con los segundos del clip en que empieza y termina.
export const scriptLineSchema = z.object({ inicio: z.number().min(0), fin: z.number().min(0), texto: z.string().max(SCRIPT_LINE_MAX) });
export type ScriptLine = z.infer<typeof scriptLineSchema>;

export function parseScript(raw: unknown): ScriptLine[] {
  const r = z.array(scriptLineSchema).max(60).safeParse(raw);
  return r.success ? r.data : [];
}

export function parseRequestedScript(raw: unknown): string[] | null {
  const r = requestedScriptSchema.safeParse(raw);
  return r.success && r.data.some((l) => l) ? r.data : null;
}

// Cómo se editan los videos de una cuenta.
export const accountVideoSchema = z.object({
  // Cuánto dura el clip, si no se pide otra cosa.
  targetSeconds: z.number().int().min(10).max(60),
  // La voz en off: Claude escribe el guión y ElevenLabs lo dice con esta voz.
  voiceOn: z.boolean(),
  voiceId: z.string().trim().max(80),
  // La música de fondo, que genera ElevenLabs con este estilo.
  musicOn: z.boolean(),
  musicStyle: z.string().trim().max(500),
  // El guión escrito sobre el video, palabra por palabra.
  subtitlesOn: z.boolean(),
  // El color de la palabra que se está diciendo, como #6FA82C: el de la marca.
  subtitleColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'El color va como #6FA82C.'),
  // Editar solo cada video nuevo, aprobar solo el clip que no tuvo avisos, y que Claude
  // escriba el guión, sin que nadie lo revise, cuando el producto todavía no tiene uno.
  autoEdit: z.boolean(),
  autoApprove: z.boolean(),
  autoScript: z.boolean(),
  // Las reglas de redacción del guión de esta cuenta, en palabras: Claude las sigue además de las fijas.
  scriptRules: z.string().max(4000).default(''),
});
export type AccountVideoSettings = z.infer<typeof accountVideoSchema>;

// Amarillo: se lee sobre casi cualquier imagen.
export const DEFAULT_SUBTITLE_COLOR = '#FFE633';

export const DEFAULT_MUSIC_STYLE = 'Instrumental suave y moderno de fondo, electrónica lo-fi tranquila, sin voces, unos 95 BPM, para un video de producto.';

export const DEFAULT_ACCOUNT_VIDEO: AccountVideoSettings = {
  targetSeconds: TARGET_DEFAULT,
  voiceOn: false,
  voiceId: '',
  musicOn: false,
  musicStyle: DEFAULT_MUSIC_STYLE,
  subtitlesOn: false,
  subtitleColor: DEFAULT_SUBTITLE_COLOR,
  autoEdit: false,
  autoApprove: false,
  autoScript: false,
  scriptRules: '',
};

export function parseAccountVideo(raw: unknown): AccountVideoSettings {
  const merged = { ...DEFAULT_ACCOUNT_VIDEO, ...(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) };
  const r = accountVideoSchema.safeParse(merged);
  return r.success ? r.data : DEFAULT_ACCOUNT_VIDEO;
}

// ───────────────────────────── Cuándo edita la Mac ─────────────────────────────

export const EDITOR_MODES = ['OFF', 'ON', 'SCHEDULE'] as const;
export type EditorMode = (typeof EDITOR_MODES)[number];

export const EDITOR_MODE_LABEL: Record<EditorMode, string> = { OFF: 'Apagado', ON: 'Prendido', SCHEDULE: 'Con horario' };

export type EditorSettings = { mode: EditorMode; fromMinute: number; toMinute: number; pluggedOnly: boolean };

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = { mode: 'OFF', fromMinute: 22 * 60, toMinute: 7 * 60, pluggedOnly: true };

export const editorSettingsSchema = z.object({
  mode: z.enum(EDITOR_MODES),
  fromMinute: z.number().int().min(0).max(1439),
  toMinute: z.number().int().min(0).max(1439),
  pluggedOnly: z.boolean(),
});

/** "22:00" a minutos desde la medianoche. Null si no es una hora. */
export function minuteOf(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

export function clockOf(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

// Lo que cuenta la Mac de sí misma cuando pregunta si hay un video para editar.
export type MacState = { minute: number | null; plugged: boolean | null };

/**
 * Si la Mac puede editar ahora, y si no, por qué. La hora es la de la Mac. Si
 * "desde" es mayor que "hasta", el horario cruza la medianoche.
 */
export function editorAllows(s: EditorSettings, mac: MacState): { allowed: true } | { allowed: false; reason: string } {
  if (s.mode === 'OFF') return { allowed: false, reason: 'La edición de videos está apagada.' };
  if (s.mode === 'SCHEDULE') {
    if (mac.minute === null) return { allowed: false, reason: 'La Mac no informó su hora.' };
    const inside = s.fromMinute <= s.toMinute ? mac.minute >= s.fromMinute && mac.minute < s.toMinute : mac.minute >= s.fromMinute || mac.minute < s.toMinute;
    if (!inside) return { allowed: false, reason: `Fuera del horario: edita de ${clockOf(s.fromMinute)} a ${clockOf(s.toMinute)}.` };
  }
  // Sin dato de la batería, por ejemplo en una Mac de escritorio, se la toma por enchufada.
  if (s.pluggedOnly && mac.plugged === false) return { allowed: false, reason: 'La Mac está a batería: edita solo enchufada.' };
  return { allowed: true };
}

/** En palabras, cuándo edita: "Con horario, de 22:00 a 07:00, solo enchufada". */
export function editorSummary(s: EditorSettings): string {
  if (s.mode === 'OFF') return 'Apagado: la Mac no edita videos.';
  const plugged = s.pluggedOnly ? ', solo enchufada' : '';
  return s.mode === 'ON' ? `Prendido: edita cuando hay un video en cola${plugged}.` : `Con horario: edita de ${clockOf(s.fromMinute)} a ${clockOf(s.toMinute)}${plugged}.`;
}

// ───────────────────────────── Los mensajes con el trabajador ─────────────────────────────

export type Transfer = { url: string; metodo: 'GET' | 'PUT'; encabezados: Record<string, string> };

// Un archivo del Drive que la Mac necesita: lo busca primero en su carpeta de
// Google Drive, por la ruta de carpetas, y si no está lo baja de a pedazos a
// través de la app.
export type VideoSource = { nombre: string; bytes: number | null; carpeta: string[]; bajar: Transfer; pedazo: number };

export type VideoJob = {
  id: string;
  turno: number;
  video: string;
  producto: string | null;
  // El paso del protocolo con que se grabó, con sus indicaciones para el editor.
  video_del_protocolo: { titulo: string; indicaciones: string | null } | null;
  // La indicación puntual de la persona para esta edición.
  indicacion: string | null;
  objetivo_segundos: number;
  // El plan que pidió la persona: se aplica tal cual, sin consultar a Claude.
  plan: VideoPlan | null;
  // Los momentos del video según el protocolo, para que Claude ubique los cortes.
  momentos: VideoMoment[];
  // El guión del clip, ya escrito y revisado: las frases que dice la voz, en orden. Null: sin voz.
  guion: string[] | null;
  // Cómo se escribe cada frase en los subtítulos, en el mismo orden; vacía si es igual. Null: todas iguales.
  guion_en_pantalla: string[] | null;
  // El sonido del clip. Null: sale en silencio.
  sonido: { voz: { id: string } | null; musica: { estilo: string } | null; subtitulos: boolean; color_subtitulos: string } | null;
  reglas: { min_segundos: number; max_segundos: number; ancho: number; alto: number; max_bytes: number };
  original: VideoSource;
  liviana: VideoSource | null;
  subidas: { clip: Transfer };
};

export type VideoNextResponse = { trabajo: VideoJob | null; volver_en: number; motivo?: string };

const protocol = z.union(
  VIDEO_PROTOCOLS.map((p) => z.literal(p)),
  { error: 'El editor de videos está desactualizado: hay que actualizarlo.' },
);
const shortText = (max: number) => z.string().max(max);

export const videoNextSchema = z.object({
  protocolo: protocol,
  version: shortText(40).optional(),
  // La hora de la Mac, en minutos desde la medianoche, y si está enchufada.
  minuto: z.number().int().min(0).max(1439).nullish(),
  enchufada: z.boolean().nullish(),
});

export const videoHeartbeatSchema = z.object({
  protocolo: protocol,
  id: shortText(60),
  turno: z.number().int(),
  // En qué anda: la etapa en palabras y, si se sabe, cuánto lleva de esa etapa.
  avance: z.object({ etapa: shortText(120), porcentaje: z.number().min(0).max(100).nullish() }).nullish(),
});

export type EditProgress = { stage: string; percent: number | null; at: string };

export function parseProgress(raw: unknown): EditProgress | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as { etapa?: unknown; porcentaje?: unknown; at?: unknown };
  if (typeof p.etapa !== 'string' || !p.etapa) return null;
  return { stage: p.etapa, percent: typeof p.porcentaje === 'number' ? Math.round(p.porcentaje) : null, at: typeof p.at === 'string' ? p.at : '' };
}

const usage = z.object({ costo_usd: z.number().optional() }).loose();

export const videoDoneSchema = z.object({
  protocolo: protocol,
  id: shortText(60),
  turno: z.number().int(),
  ok: z.literal(true),
  plan: planSchema,
  medidas: z.record(z.string(), z.unknown()).nullish(),
  propuesta: z
    .object({
      razon: shortText(600),
      // claude, medido, simulado o pedido, cuando el plan lo pidió la persona.
      origen: shortText(20),
      avisos: z.array(shortText(600)).max(20).default([]),
      uso: usage.nullish(),
    })
    .nullish(),
  clip: z.object({ ancho: z.number().int().positive(), alto: z.number().int().positive(), segundos: z.number().positive(), bytes: z.number().int().positive() }),
  // El guión que se dijo y el sonido que se le puso.
  guion: z.array(scriptLineSchema).max(60).nullish(),
  sonido: z.object({ voz: z.boolean(), musica: z.boolean(), subtitulos: z.boolean(), costo_usd: z.number().nullish() }).nullish(),
  avisos: z.array(shortText(600)).max(20).default([]),
  segundos: z.number().int().min(0).max(24 * 3600),
});

export const videoFailedSchema = z.object({
  protocolo: protocol,
  id: shortText(60),
  turno: z.number().int(),
  ok: z.literal(false),
  error: shortText(4000),
  // Un fallo que no se arregla reintentando, como un video que no se puede leer.
  definitivo: z.boolean().nullish(),
});

export const videoResultSchema = z.discriminatedUnion('ok', [videoDoneSchema, videoFailedSchema]);

export type VideoDone = z.infer<typeof videoDoneSchema>;
export type VideoFailed = z.infer<typeof videoFailedSchema>;

// ───────────────────────────── La copia liviana ─────────────────────────────

/** Si el archivo es la copia liviana que graba la cámara DJI al lado de cada video. */
export function isLightCopy(name: string): boolean {
  return /\.lrf$/i.test(name.trim());
}

/** El nombre sin la extensión, en minúsculas: un video y su copia liviana lo comparten. */
export function pairKey(name: string): string {
  return name.trim().replace(/\.[^.]+$/, '').toLowerCase();
}

/** "DJI_0073_D · editado.mp4": el nombre del clip que deja la edición. */
export function clipName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '').trim() || 'video';
  return `${base} · editado.mp4`;
}
