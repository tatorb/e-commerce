import type { Compat } from '@/domain/content';

// Formatos de texto que comparten las guías para aplicar de los canales.

export function compatText(c: Compat): string {
  const years =
    c.yearFrom && c.yearTo
      ? c.yearFrom === c.yearTo
        ? `${c.yearFrom}`
        : `${c.yearFrom} a ${c.yearTo}`
      : c.yearFrom
        ? `desde ${c.yearFrom}`
        : c.yearTo
          ? `hasta ${c.yearTo}`
          : '';
  const vehicle = [c.vehicleBrand, c.model, c.engine].filter(Boolean).join(' ');
  return [vehicle, years, c.note].filter(Boolean).join(' · ');
}
