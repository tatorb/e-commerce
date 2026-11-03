// "Mostrar más de 5": con el stock real de una medida en 5 o menos, los
// canales muestran 6, así la publicación nunca se pausa por falta de stock,
// venga de donde venga el cambio: una venta en el canal o en otro, un ajuste
// a mano o una carga de stock. Para no vender lo que no hay sin saberlo, cada
// medida tiene alarmas: cuando queda 1, cuando llega a 0 o menos, y otro aviso
// al día sin reponer. La pausa la decide una persona, nunca la app. Este
// módulo no sabe nada de canales ni de la base de datos, para poder probarlo
// solo.

/** Lo que muestran los canales con stock de 5 o menos: más de 5. */
export const SHOWN_WHEN_SHORT = 6;
/** Sin reponer, otro aviso al día. */
export const REMIND_AFTER_MS = 24 * 3600_000;

/**
 * Cómo está la alarma de una medida. lowAt: desde cuándo quedó 1; outSince:
 * desde cuándo quedó en 0 o menos. Cargar stock las borra.
 */
export type CushionState = { lowAt?: Date | null; outSince: Date | null };

/**
 * Lo que tiene que mostrar el canal de una medida con stock real `real`. Sin
 * la opción, el real. Con la opción, 6 siempre que haya 5 o menos, también
 * en 0 o con ventas sin tener: el canal nunca recibe una cantidad que pause
 * la publicación.
 */
export function cushionShown(real: number, on: boolean): number {
  if (!on || real >= SHOWN_WHEN_SHORT) return Math.max(real, 0);
  return SHOWN_WHEN_SHORT;
}

/** Cómo está una medida con la opción prendida: bien, queda 1 o sin stock. */
export type AlarmLevel = 'ok' | 'low' | 'out';

export function alarmLevel(real: number, state: CushionState): AlarmLevel {
  if (state.outSince || real <= 0) return 'out';
  if (real === 1) return 'low';
  return 'ok';
}

/** Lo que disparó un cambio en el stock de una medida con la opción prendida. */
export type SaleAlarm =
  // Quedó 1: el aviso temprano.
  | 'low'
  // Llegó a 0.
  | 'out'
  // Se vendió una sin tenerla: se sigue mostrando 6.
  | 'short';

/** La alarma que dispara una venta que dejó `after` de `before`. Null si no dispara ninguna. */
export function saleAlarm(before: number, after: number): SaleAlarm | null {
  if (after >= before) return null;
  if (after < 0) return 'short';
  if (after === 0) return 'out';
  if (after === 1) return 'low';
  return null;
}

/**
 * La alarma de un cambio que no es una venta: un ajuste a mano, una carga de
 * stock o una venta cancelada. Avisa solo al entrar en 1 o en 0, no cada vez
 * que se vuelve a guardar lo mismo. Null si no dispara ninguna.
 */
export function changeAlarm(after: number, state: CushionState): 'low' | 'out' | null {
  if (after <= 0) return state.outSince ? null : 'out';
  if (after === 1) return state.lowAt && !state.outSince ? null : 'low';
  return null;
}

/** Cuándo sale el aviso del primer día sin reponer, desde que se quedó sin stock. */
export function remindAt(outSince: Date): Date {
  return new Date(outSince.getTime() + REMIND_AFTER_MS);
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
