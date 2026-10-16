// Fechas con el formato de app.studiomrb.com: locale es-AR y la zona
// horaria de la cuenta.

export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

function dayKey(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(d);
}

/** "hoy", "ayer", "hace 3d" y, de 30 días para atrás, la fecha corta. */
export function formatRelativeDate(date: Date | null, timeZone = DEFAULT_TIMEZONE): string {
  if (!date) return '—';
  const now = new Date();
  if (dayKey(date, timeZone) === dayKey(now, timeZone)) return 'hoy';
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (dayKey(date, timeZone) === dayKey(yesterday, timeZone)) return 'ayer';
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 30) return `hace ${Math.max(days, 2)}d`;
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone }).format(date);
}

/** Fecha y hora corta: "16/10/26 14:05". */
export function formatDateTime(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(',', '');
}

/** Duración entre dos momentos: "3 d 4 h", "5 h 10 min", "12 min". */
export function formatDuration(from: Date, to: Date): string {
  const minutes = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}

/** Plural armado a mano, como en la app: "1 producto" / "3 productos". */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

const USD = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Dólares con la costumbre argentina, por ejemplo US$ 0,08. */
export function formatUsd(amount: number): string {
  return USD.format(amount);
}
