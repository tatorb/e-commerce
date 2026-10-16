// Cilindrada y combustible a partir del texto del motor, por ejemplo
// "1.9 Diesel XUD9" da 1.9 y Diesel. Es la misma regla que usó la migración
// que los cargó por primera vez.

const DISPLACEMENT = /(?:^|[^0-9.,])([0-9])[.,]([0-9])(?:$|[^0-9.,])/;
const DIESEL = /\b(diesel|td|tdi|tdci|hdi|jtd|jtdm|dci|crdi|cdi|d4d|tddi)\b/i;
const GNC = /\bgnc\b/i;
const NAFTA = /\bnafta\b/i;
const VALVES = /^\d+v$/i;

export function parseEngine(engine: string | null | undefined): { displacement: string | null; fuel: string | null } {
  const text = engine ?? '';
  const d = text.match(DISPLACEMENT);
  const fuel = DIESEL.test(text) ? 'Diesel' : GNC.test(text) ? 'GNC' : NAFTA.test(text) ? 'Nafta' : null;
  return { displacement: d ? `${d[1]}.${d[2]}` : null, fuel };
}

/** Los códigos del motor, sin la cilindrada, las válvulas ni el combustible: "1.9 Diesel XUD9" da ["xud9"]. */
export function engineCodes(engine: string | null | undefined): string[] {
  return (engine ?? '')
    .toLowerCase()
    .split(/[\s/,;()+-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && /[a-z]/.test(t) && !VALVES.test(t) && !DIESEL.test(t) && !GNC.test(t) && !NAFTA.test(t));
}

type CompatLike = { engine: string | null; displacement?: string | null; fuel?: string | null };

/** Completa cilindrada y combustible con el motor cuando no vienen. */
export function withEngineData<T extends CompatLike>(c: T): T & { displacement: string | null; fuel: string | null } {
  const parsed = parseEngine(c.engine);
  return {
    ...c,
    displacement: c.displacement === undefined ? parsed.displacement : c.displacement,
    fuel: c.fuel === undefined ? parsed.fuel : c.fuel,
  };
}
