import type { ItemState } from '@/lib/promo/plan';

// Cómo se muestran las fechas, los % y los estados en las pantallas de Promociones.

export const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })} %`);

export function shortDate(d: Date | string | null, timeZone: string): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('es-AR', { timeZone, day: 'numeric', month: 'short' }).format(new Date(d));
}

export function dateTime(d: Date | string | null, timeZone: string): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('es-AR', { timeZone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(d));
}

/** El día para un campo de fecha: 2026-12-01, en la hora de la cuenta. */
export function inputDay(d: Date | string | null, timeZone: string): string {
  if (!d) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
}

/** El color de un casillero según su estado. */
export function stateClass(state: ItemState, capped: boolean): string {
  if (state === 'ON' || state === 'SCHEDULED') return 'border-primary/40 bg-primary/10';
  if (state === 'PLANNED') return capped ? 'border-foreground/30 bg-secondary' : 'border-foreground/20 bg-secondary/60';
  if (state === 'FAILED') return 'border-alert/50 bg-alert/10';
  if (state === 'ENDED') return 'border-border bg-muted/40 text-muted-foreground';
  return 'border-dashed border-border bg-background text-muted-foreground';
}

/** El último día de una promoción, para mostrarlo: termina en el primer momento del día siguiente. */
export function lastDay(finish: Date | string | null, timeZone: string): string {
  return finish ? shortDate(new Date(new Date(finish).getTime() - 1), timeZone) : '—';
}
