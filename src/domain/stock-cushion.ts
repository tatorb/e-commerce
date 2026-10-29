// "Mostrar más de 5": con el stock de una medida entre 1 y 5, los canales
// muestran 6, así la publicación no se pausa cada vez que se vende la última.
// Para no vender lo que no hay sin saberlo, cada medida tiene alarmas: un
// aviso cuando una venta deja 1, una alarma cuando deja 0 o menos, otro aviso
// al día sin reponer y, a los dos días, la publicación se pausa. Se pueden
// vender hasta dos sin tenerlas; la segunda la pausa. Este módulo no sabe nada
// de canales ni de la base de datos, para poder probarlo solo.

/** Lo que muestran los canales con stock de 1 a 5: más de 5. */
export const SHOWN_WHEN_SHORT = 6;
/** Cuántas se pueden vender sin tenerlas: al llegar a esta, se sube 0 y la publicación se pausa. */
export const SELL_WITHOUT_STOCK = 2;
/** Sin reponer, otro aviso al día. */
export const REMIND_AFTER_MS = 24 * 3600_000;
/** Sin reponer, a los dos días la publicación se pausa. */
export const CUT_AFTER_MS = 48 * 3600_000;

/**
 * Cómo está la alarma de una medida. outSince: desde cuándo una venta la dejó
 * en 0 o menos; cutAt: cuándo se pausó por no reponer. Cargar stock las borra.
 */
export type CushionState = { outSince: Date | null; cutAt: Date | null };

/**
 * Lo que tiene que mostrar el canal de una medida con stock real `real`. Sin
 * la opción, el real. Con la opción: 6 si hay de 1 a 5, y también si una venta
 * la dejó en 0 o se vendió una sin tenerla, mientras no se pausó por no
 * reponer. Cargar 0 a mano dice que no hay: se muestra 0.
 */
export function cushionShown(real: number, on: boolean, state: CushionState | null): number {
  const plain = Math.max(real, 0);
  if (!on || real >= SHOWN_WHEN_SHORT) return plain;
  if (real >= 1) return SHOWN_WHEN_SHORT;
  if (state?.outSince && !state.cutAt && real > -SELL_WITHOUT_STOCK) return SHOWN_WHEN_SHORT;
  return plain;
}

/** Cómo está una medida con la opción prendida: bien, queda 1, sin stock o pausada por no reponer. */
export type AlarmLevel = 'ok' | 'low' | 'out' | 'cut';

export function alarmLevel(real: number, state: CushionState & { lowAt?: Date | null }): AlarmLevel {
  if (state.cutAt) return 'cut';
  if (state.outSince || real <= 0) return 'out';
  if (real === 1) return 'low';
  return 'ok';
}

/** Lo que hizo una venta (o su cancelación) en el stock de una medida con la opción prendida. */
export type SaleAlarm =
  // Quedó 1: el aviso temprano.
  | 'low'
  // Se vendió la última: quedó en 0.
  | 'out'
  // Se vendió una sin tenerla, y todavía se muestra 6.
  | 'short'
  // Se vendió la última que se podía vender sin tener: se sube 0.
  | 'limit';

/** La alarma que dispara una venta que dejó `after` de `before`. Null si no dispara ninguna. */
export function saleAlarm(before: number, after: number): SaleAlarm | null {
  if (after >= before) return null;
  if (after <= -SELL_WITHOUT_STOCK) return 'limit';
  if (after < 0) return 'short';
  if (after === 0) return 'out';
  if (after === 1) return 'low';
  return null;
}

/** Cuándo sale el aviso del primer día y cuándo se pausa, desde que se quedó sin stock. */
export function cushionDeadlines(outSince: Date): { remindAt: Date; cutAt: Date } {
  return { remindAt: new Date(outSince.getTime() + REMIND_AFTER_MS), cutAt: new Date(outSince.getTime() + CUT_AFTER_MS) };
}

/** Lo que dice una medida en las pantallas: "Hay 2 · Se ve 6". Lo vendido sin tener se dice aparte. */
export function cushionText(real: number, shown: number): string {
  const has = Math.max(real, 0);
  return shown === has ? `Hay ${has}` : `Hay ${has} · Se ve ${shown}`;
}

/** Cuántas faltan para entregar: las que se vendieron sin tenerlas. */
export const owed = (real: number) => Math.max(0, -real);

/** "Falta 1 para entregar", "Faltan 2 para entregar". */
export const owedText = (n: number) => `${n === 1 ? 'Falta 1' : `Faltan ${n}`} para entregar`;
