// Las notificaciones: los tipos, en qué grupo va cada uno, qué recibe cada
// persona por defecto y el horario de silencio. Sin la base de datos, para
// poder probarlo solo.

export type NotificationGroup = 'urgente' | 'diario' | 'resumen';

type KindSpec = {
  label: string;
  hint: string;
  group: NotificationGroup;
  // Lo que viene prendido si la persona no eligió nada.
  push: boolean;
  mail: boolean;
};

export const NOTIFICATION_KINDS = {
  reclamo: {
    label: 'Reclamos',
    hint: 'Un comprador abrió un reclamo o una mediación.',
    group: 'urgente',
    push: true,
    mail: false,
  },
  venta: { label: 'Ventas nuevas', hint: 'Entró una venta en el canal.', group: 'urgente', push: true, mail: false },
  despachar: {
    label: 'Envíos por despachar',
    hint: 'Una venta hay que despacharla en menos de un día.',
    group: 'urgente',
    push: true,
    mail: false,
  },
  pregunta: {
    label: 'Preguntas sin responder',
    hint: 'Una pregunta de un comprador que el bot no respondió solo.',
    group: 'urgente',
    push: true,
    mail: false,
  },
  conexion: {
    label: 'Conexión cortada',
    hint: 'El canal no aceptó la conexión de una tienda y hay que volver a conectarla.',
    group: 'urgente',
    push: true,
    mail: true,
  },
  tarea: { label: 'Tareas asignadas', hint: 'Te asignaron una tarea.', group: 'diario', push: true, mail: true },
  tarea_aviso: { label: 'Aviso de tareas', hint: 'Una tarea tuya llegó a su fecha de aviso.', group: 'diario', push: true, mail: true },
  tarea_vencida: { label: 'Tareas vencidas', hint: 'Una tarea tuya venció sin terminar.', group: 'diario', push: true, mail: true },
  nota: { label: 'Menciones en notas', hint: 'Alguien te mencionó en una nota.', group: 'diario', push: true, mail: true },
  fotos: {
    label: 'Fotos corregidas',
    hint: 'La Mac terminó de corregir las fotos de un producto.',
    group: 'diario',
    push: true,
    mail: false,
  },
  resumen: {
    label: 'Resumen del día',
    hint: 'A las 9: sin stock, publicaciones pausadas, lo que espera en Por subir y para elegir en Sincronización.',
    group: 'resumen',
    push: true,
    mail: true,
  },
} as const satisfies Record<string, KindSpec>;

export type NotificationKind = keyof typeof NOTIFICATION_KINDS;

export const NOTIFICATION_KIND_KEYS = Object.keys(NOTIFICATION_KINDS) as NotificationKind[];

export const GROUP_LABEL: Record<NotificationGroup, { label: string; hint: string }> = {
  urgente: { label: 'Urgente', hint: 'Lo que cuesta plata si se espera.' },
  diario: { label: 'Trabajo diario', hint: 'Lo tuyo en la app.' },
  resumen: { label: 'Resumen', hint: 'Una vez por día.' },
};

export function isNotificationKind(k: string): k is NotificationKind {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_KINDS, k);
}

export type Channels = { push: boolean; mail: boolean };
export type NotificationPrefs = Record<NotificationKind, Channels>;

/** Lo que eligió la persona, con lo que falta por defecto. Ignora lo que no entiende. */
export function parsePrefs(raw: unknown): NotificationPrefs {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = {} as NotificationPrefs;
  for (const k of NOTIFICATION_KIND_KEYS) {
    const spec = NOTIFICATION_KINDS[k];
    const v = src[k] && typeof src[k] === 'object' ? (src[k] as Record<string, unknown>) : {};
    out[k] = {
      push: typeof v.push === 'boolean' ? v.push : spec.push,
      mail: typeof v.mail === 'boolean' ? v.mail : spec.mail,
    };
  }
  return out;
}

// ───────────────────────────── Horario de silencio ─────────────────────────────

export type Quiet = { from: number | null; to: number | null; urgent: boolean; timeZone: string };

/** Los minutos desde la medianoche en esa zona horaria. */
export function minutesIn(now: Date, timeZone: string): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  }
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return (h % 24) * 60 + m;
}

/** Si ahora es horario de silencio. Puede cruzar la medianoche, por ejemplo de 22 a 8. */
export function inQuietHours(q: Quiet, now: Date): boolean {
  if (q.from === null || q.to === null || q.from === q.to) return false;
  const m = minutesIn(now, q.timeZone);
  return q.from < q.to ? m >= q.from && m < q.to : m >= q.from || m < q.to;
}

/** Si la notificación sale al celular y al navegador ahora. La campanita la muestra siempre. */
export function pushAllowed(kind: NotificationKind, prefs: NotificationPrefs, q: Quiet, now: Date): boolean {
  if (!prefs[kind].push) return false;
  if (!inQuietHours(q, now)) return true;
  return NOTIFICATION_KINDS[kind].group === 'urgente' && !q.urgent;
}

/** "22:00" para 1320. */
export function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** 1320 para "22:00". Null si no es una hora. */
export function parseHhmm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Un texto corto para la notificación del celular, que corta lo largo. */
export function shortText(s: string, max = 160): string {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
}
