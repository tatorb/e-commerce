// Los videos de un producto: qué archivos se aceptan y si un video sirve como
// clip para el canal. Las reglas del clip las pone cada canal
// (src/channels/<canal>/). Sin la base de datos, para poder probarlo solo.

// Los tipos que se pueden subir al Drive desde la app, por extensión. El
// navegador muchas veces no informa el tipo de un .mov, por eso se fija acá.
export const VIDEO_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  avi: 'video/x-msvideo',
  webm: 'video/webm',
};

// Lo más pesado que se sube desde la app. Más grande, se copia a la carpeta
// del Drive desde la Mac.
export const VIDEO_MAX_BYTES = 2 * 1024 ** 3 - 1;

export function videoExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** El tipo del archivo para subirlo, o el motivo por el que no se acepta. */
export function videoUploadType(file: { name: string; size: number; type: string }): { ok: true; type: string } | { ok: false; error: string } {
  const type = VIDEO_TYPES[videoExtension(file.name)] ?? (file.type.startsWith('video/') ? file.type : null);
  if (!type) return { ok: false, error: `${file.name} no es un video. Se aceptan MP4, MOV, MPEG, AVI y WEBM.` };
  if (file.size <= 0) return { ok: false, error: `${file.name} está vacío.` };
  if (file.size > VIDEO_MAX_BYTES) {
    return { ok: false, error: `${file.name} pesa más de 2 GB: copialo a la carpeta del Drive desde la Mac.` };
  }
  return { ok: true, type };
}

// Lo que pide un canal para un video corto vertical.
export type ClipRules = {
  // Cómo lo llama el canal, por ejemplo "clip".
  name: string;
  minSeconds: number;
  maxSeconds: number;
  maxBytes: number;
  // El lado corto y el largo, en píxeles: lo mínimo y lo recomendado.
  minSize: { short: number; long: number };
  idealSize: { short: number; long: number };
  // Ancho sobre alto, por ejemplo 9:16.
  ratio: { width: number; height: number };
  // Los formatos que acepta, por extensión.
  formats: string[];
  // Cómo se sube a mano, paso por paso.
  guide: string[];
  // Si cada medida de la publicación puede tener su clip. Si no, el clip se ve en todas.
  perVariant: boolean;
};

export type VideoMeasure = {
  name: string;
  mimeType: string;
  size: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type ClipCheck = {
  // Sin medidas todavía: el navegador no lo pudo leer y Google lo sigue procesando.
  pending: boolean;
  // Lo que impide usarlo como clip.
  problems: string[];
  // Lo que conviene mejorar, aunque sirve.
  notes: string[];
};

const mb = (bytes: number) => Math.round(bytes / 1024 ** 2);

export function formatSeconds(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

/** Si un video sirve como clip del canal. */
export function checkClip(v: VideoMeasure, rules: ClipRules): ClipCheck {
  const problems: string[] = [];
  const notes: string[] = [];
  const ext = videoExtension(v.name);
  if (ext && !rules.formats.includes(ext)) {
    problems.push(`Es ${ext.toUpperCase()}: el ${rules.name} tiene que ser ${rules.formats.map((f) => f.toUpperCase()).join(', ')}.`);
  }
  if (v.size !== null && v.size > rules.maxBytes) {
    problems.push(`Pesa ${mb(v.size)} MB: el ${rules.name} puede pesar hasta ${mb(rules.maxBytes)} MB.`);
  }
  const measured = v.width !== null && v.height !== null && v.durationMs !== null && v.width > 0 && v.height > 0;
  if (!measured) return { pending: true, problems, notes };

  const { width, height, durationMs } = v as { width: number; height: number; durationMs: number };
  if (height <= width) problems.push(`Es horizontal (${width} × ${height}): el ${rules.name} tiene que ser vertical.`);
  const seconds = durationMs / 1000;
  if (seconds < rules.minSeconds - 0.5) {
    problems.push(`Dura ${formatSeconds(durationMs)}: el ${rules.name} tiene que durar al menos ${rules.minSeconds} segundos.`);
  } else if (seconds > rules.maxSeconds + 0.5) {
    problems.push(`Dura ${formatSeconds(durationMs)}: el ${rules.name} puede durar hasta ${rules.maxSeconds} segundos.`);
  }
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  if (short < rules.minSize.short || long < rules.minSize.long) {
    problems.push(`Es muy chico (${width} × ${height}): el mínimo es ${rules.minSize.short} × ${rules.minSize.long}.`);
  } else if (short < rules.idealSize.short || long < rules.idealSize.long) {
    notes.push(`Se ve mejor desde ${rules.idealSize.short} × ${rules.idealSize.long}.`);
  }
  if (height > width) {
    const target = rules.ratio.width / rules.ratio.height;
    if (Math.abs(width / height - target) / target > 0.04) {
      notes.push(`No es ${rules.ratio.width}:${rules.ratio.height}: el canal puede recortar los bordes.`);
    }
  }
  return { pending: false, problems, notes };
}

// Lo más grande que se manda por pedido al ver un video en la app: entra en lo
// que Vercel deja mandar.
const VIDEO_PIECE = 4 * 1024 * 1024;

/** El pedazo que se le pide a Google: el que pidió el reproductor, recortado al tamaño de un pedazo. */
export function videoPieceRange(header: string | null): string {
  const m = header?.match(/^bytes=(\d+)-(\d*)$/);
  const start = m ? Number(m[1]) : 0;
  const last = start + VIDEO_PIECE - 1;
  const end = m && m[2] ? Math.min(Number(m[2]), last) : last;
  return `bytes=${start}-${end}`;
}
