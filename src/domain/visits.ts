// Las visitas de una publicación día por día: por semana, los últimos 30 días
// contra los 30 anteriores, y antes y después de corregirla. No sabe nada de
// canales ni de la base de datos, para poder probarlo solo.

export type VisitDay = { day: string; visits: number };

const DAY = 24 * 60 * 60 * 1000;
/** Cuántos días se muestran en la publicación. */
export const VISIT_HISTORY_DAYS = 90;
/** Cuántos días se guardan: un año y algo, para comparar cualquier período de Rendimiento con el anterior. */
export const VISIT_KEEP_DAYS = 400;
/** Cuántos días se piden la primera vez: lo más que da el canal hacia atrás. */
export const VISIT_FIRST_READ_DAYS = 150;
/** Cuántos días se comparan antes y después de corregirla. */
export const COMPARE_DAYS = 30;

const dayOf = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => dayOf(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY));

/** Las visitas entre dos días, incluidos, y cuántos de esos días tienen dato. */
function between(days: VisitDay[], from: string, to: string): { visits: number; days: number } {
  let visits = 0;
  let n = 0;
  for (const d of days) {
    if (d.day < from || d.day > to) continue;
    visits += d.visits;
    n++;
  }
  return { visits, days: n };
}

export type VisitsSummary = {
  // De la más vieja a la actual: la semana empieza el día de "from".
  weeks: { from: string; visits: number }[];
  last30: number;
  previous30: number | null;
  // Por día, en promedio, hasta 30 días antes y después de corregirla. Null si no se corrigió en el período.
  correction: { on: string; beforePerDay: number | null; afterPerDay: number | null; afterDays: number } | null;
};

const perDay = (r: { visits: number; days: number }) => (r.days > 0 ? Math.round((r.visits / r.days) * 10) / 10 : null);

/** El resumen de las visitas, con el día de hoy y el día en que se corrigió, si se sabe. */
export function visitsSummary(days: VisitDay[], now: Date, correctedAt: Date | null): VisitsSummary | null {
  if (days.length === 0) return null;
  const today = dayOf(now);
  const first = days[0].day;
  // 13 semanas hacia atrás, terminando hoy.
  const weeks: { from: string; visits: number }[] = [];
  for (let i = Math.ceil(VISIT_HISTORY_DAYS / 7) - 1; i >= 0; i--) {
    const from = addDays(today, -(i * 7 + 6));
    const to = addDays(today, -i * 7);
    if (to < first) continue;
    weeks.push({ from, visits: between(days, from, to).visits });
  }
  const last = between(days, addDays(today, -(COMPARE_DAYS - 1)), today);
  const prevFrom = addDays(today, -(2 * COMPARE_DAYS - 1));
  const prev = between(days, prevFrom, addDays(today, -COMPARE_DAYS));
  let correction: VisitsSummary['correction'] = null;
  if (correctedAt) {
    const on = dayOf(correctedAt);
    if (on >= first) {
      const before = between(days, addDays(on, -COMPARE_DAYS), addDays(on, -1));
      const after = between(days, addDays(on, 1), addDays(on, COMPARE_DAYS));
      correction = { on, beforePerDay: perDay(before), afterPerDay: perDay(after), afterDays: after.days };
    }
  }
  return {
    weeks,
    last30: last.visits,
    // Solo si hay datos desde el principio de esos 30 días.
    previous30: first <= prevFrom ? prev.visits : null,
    correction,
  };
}

/** "+25 %", "−10 %" o "igual", de antes a después. Null si no se puede comparar. */
export function changeText(before: number | null, after: number | null): string | null {
  if (before === null || after === null) return null;
  if (before === 0) return after === 0 ? 'igual' : null;
  const pct = Math.round(((after - before) / before) * 100);
  if (pct === 0) return 'igual';
  return pct > 0 ? `+${pct} %` : `−${Math.abs(pct)} %`;
}

/** Lo que ve Claude de las visitas. Null si todavía no se leyeron. */
export function visitsForClaude(v: VisitsSummary | null) {
  if (!v) return null;
  return {
    ultimos_30_dias: v.last30,
    los_30_anteriores: v.previous30,
    por_semana: v.weeks.map((w) => ({ desde: w.from, visitas: w.visits })),
    ...(v.correction
      ? {
          al_corregirla: {
            dia: v.correction.on,
            por_dia_antes: v.correction.beforePerDay,
            por_dia_despues: v.correction.afterPerDay,
            dias_despues_con_dato: v.correction.afterDays,
          },
        }
      : {}),
  };
}
