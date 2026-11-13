// Rendimiento de publicaciones: el semáforo de cada una según sus visitas y
// sus ventas del período. Los números de las reglas están acá, en un solo
// lugar. No sabe nada de la base de datos ni de los canales.

/** Los números del semáforo. Cambiarlos acá cambia toda la pantalla. */
export const LIGHT_RULES = {
  // Menos de esto, rojo: casi nadie la ve.
  fewVisits: 10,
  // Desde esto y sin ventas, naranja: la ven y no la compran.
  manyVisits: 50,
  // Conversión desde la que es verde, en %.
  goodConversionPct: 1,
};

export const PERIODS = [7, 15, 30, 60, 90] as const;
export type Period = (typeof PERIODS)[number];

export type Light = 'red' | 'orange' | 'yellow' | 'green' | 'gray';

export const LIGHT_ORDER: Light[] = ['red', 'orange', 'yellow', 'gray', 'green'];

export const LIGHT_LABEL: Record<Light, string> = {
  red: 'Rojo',
  orange: 'Naranja',
  yellow: 'Amarillo',
  green: 'Verde',
  gray: 'Gris',
};

/** Qué significa cada color y qué revisar, para el cartel al pasar el mouse. */
export function lightHelp(light: Light, r = LIGHT_RULES): string {
  switch (light) {
    case 'red':
      return `Menos de ${r.fewVisits} visitas y sin ventas: casi nadie la ve. Revisar el título y la ficha.`;
    case 'orange':
      return `${r.manyVisits} visitas o más y ninguna venta: la ven pero no la compran. Revisar las fotos y la descripción.`;
    case 'yellow':
      return `Vende, pero convierte menos de ${r.goodConversionPct} %. Revisar precio, fotos y descripción.`;
    case 'green':
      return `Convierte ${r.goodConversionPct} % o más: está funcionando.`;
    case 'gray':
      return `Entre ${r.fewVisits} y ${r.manyVisits - 1} visitas y sin ventas: pocos datos todavía.`;
  }
}

/** La conversión en %, con un decimal. Null sin visitas. */
export function conversionPct(visits: number | null, sales: number): number | null {
  if (!visits || visits <= 0) return null;
  return Math.round((sales / visits) * 1000) / 10;
}

/**
 * El color de una publicación. Si vendió, manda la conversión: verde desde el
 * mínimo, amarillo por debajo. Sin ventas, mandan las visitas.
 */
export function lightOf(visits: number | null, sales: number, r = LIGHT_RULES): Light {
  if (sales > 0) {
    const pct = visits && visits > 0 ? (sales / visits) * 100 : Infinity;
    return pct >= r.goodConversionPct ? 'green' : 'yellow';
  }
  const v = visits ?? 0;
  if (v < r.fewVisits) return 'red';
  if (v >= r.manyVisits) return 'orange';
  return 'gray';
}

/** Lo que se cambió el día de la última corrección, en palabras. */
export const CORRECTION_FIELD_LABEL: Record<string, string> = {
  title: 'título',
  description: 'descripción',
  photos: 'fotos',
  attributes: 'datos de catálogo',
  price: 'precio',
  installments: 'cuotas',
  discount: 'descuento',
  campaign: 'campaña',
  publication: 'publicación creada',
};

/** Los datos que cuentan como corrección. La cantidad, el estado y lo que llega solo del canal no. */
export const CORRECTION_FIELDS = Object.keys(CORRECTION_FIELD_LABEL);

/** "título, fotos y precio". */
export function correctionText(fields: string[]): string {
  const words = CORRECTION_FIELDS.filter((f) => fields.includes(f)).map((f) => CORRECTION_FIELD_LABEL[f]);
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} y ${words.at(-1)}`;
}

// ───────────────────────────── Contra el período anterior ─────────────────────────────

/** Cómo cambió un número contra el período anterior: para dónde y cuánto, en palabras cortas. */
export type Change = { dir: 'up' | 'down' | 'same'; text: string };

const fmt1 = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

/** El cambio de visitas o ventas, en %. Null si falta alguno de los dos. */
export function countChange(current: number | null, previous: number | null): Change | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return current === 0 ? { dir: 'same', text: 'igual' } : { dir: 'up', text: 'desde 0' };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { dir: 'same', text: 'igual' };
  return { dir: pct > 0 ? 'up' : 'down', text: `${Math.abs(pct).toLocaleString('es-AR')} %` };
}

/** El cambio de la conversión, en puntos: de 2,1 % a 2,9 % son 0,8 puntos. Null si falta alguna. */
export function pointsChange(current: number | null, previous: number | null): Change | null {
  if (current === null || previous === null) return null;
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return { dir: 'same', text: 'igual' };
  return { dir: diff > 0 ? 'up' : 'down', text: `${fmt1(Math.abs(diff))} ${Math.abs(diff) === 1 ? 'punto' : 'puntos'}` };
}

/** Las semanas del gráfico de visitas. */
export const TREND_WEEKS = 8;

/**
 * Las visitas por semana de las últimas semanas, de la más vieja a la actual,
 * cada una de 7 días terminando hoy. Las semanas sin ningún día leído quedan en null.
 */
export function weeklyVisits(days: { day: string; visits: number }[], now: Date, weeks = TREND_WEEKS): { from: string; visits: number | null }[] {
  const DAY_MS = 24 * 3600_000;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const out: { from: string; visits: number | null }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = iso(new Date(now.getTime() - (i * 7 + 6) * DAY_MS));
    const to = iso(new Date(now.getTime() - i * 7 * DAY_MS));
    const inWeek = days.filter((d) => d.day >= from && d.day <= to);
    out.push({ from, visits: inWeek.length > 0 ? inWeek.reduce((s, d) => s + d.visits, 0) : null });
  }
  return out;
}
