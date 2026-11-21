// Una fecha y hora como la escribe la persona en un campo del navegador
// ("2026-11-18T00:00"), en la hora de la cuenta.

const parts = (date: Date, timeZone: string) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

/** La fecha para el campo, en la hora de la cuenta. */
export const toZonedInput = (date: Date, timeZone: string): string => parts(date, timeZone);

/** La fecha que escribió la persona, tomada en la hora de la cuenta. Null si no vale. */
export function fromZonedInput(value: string, timeZone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const asUtc = new Date(`${value}:00.000Z`);
  if (Number.isNaN(asUtc.getTime())) return null;
  // Lo que marca el reloj de la cuenta en ese instante dice cuánto hay que correrlo.
  const shown = new Date(`${parts(asUtc, timeZone)}:00.000Z`);
  return new Date(asUtc.getTime() - (shown.getTime() - asUtc.getTime()));
}
