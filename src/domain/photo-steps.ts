import type { PhotoRunStatus } from '@/generated/prisma/enums';

// Los 8 pasos de la línea de imágenes, en el orden del trabajador
// (trabajador-imagenes/mrb_imagenes/pasos/). La app los muestra y guarda lo
// que pasó en cada uno; cómo se corrige la foto es cosa del trabajador.

export type PhotoStep = {
  key: string;
  label: string;
  // Corto, para la línea de pasos.
  short: string;
  // Los que cambian el encuadre no se comparan superpuestos con el deslizador.
  reframes: boolean;
};

export const PHOTO_STEPS: readonly PhotoStep[] = [
  { key: 'lente', label: 'Lente', short: 'Lente', reframes: true },
  { key: 'perspectiva', label: 'Perspectiva y enderezado', short: 'Perspectiva', reframes: true },
  { key: 'blancos', label: 'Balance de blancos y tinte', short: 'Blancos', reframes: false },
  { key: 'luces', label: 'Luces, sombras y claridad', short: 'Luces', reframes: false },
  { key: 'color', label: 'Color', short: 'Color', reframes: false },
  { key: 'fondo', label: 'Quitar fondo', short: 'Fondo', reframes: false },
  { key: 'recorte', label: 'Recorte', short: 'Recorte', reframes: true },
  { key: 'exportar', label: 'Exportar', short: 'Exportar', reframes: false },
];

export const LAST_PHOTO_STEP = PHOTO_STEPS.length - 1;

/** Los estados en que un intento sigue abierto: hay uno solo por foto. */
export const OPEN_RUN_STATUSES: PhotoRunStatus[] = ['QUEUED', 'PROCESSING', 'REVIEW', 'FAILED'];

export const RUN_STATUS_LABEL: Record<PhotoRunStatus, string> = {
  QUEUED: 'en cola',
  PROCESSING: 'procesando',
  REVIEW: 'esperando tu aprobación',
  APPROVED: 'aprobado',
  SKIPPED: 'salteado',
  FAILED: 'falló',
  REPLACED: 'reemplazado',
};

type RunLike = { step: number; status: PhotoRunStatus };

/**
 * El intento vigente de cada paso: el último que no se reemplazó. Los pasos
 * que todavía no se hicieron quedan en null.
 */
export function currentRuns<T extends RunLike & { createdAt: Date }>(runs: T[]): (T | null)[] {
  const out: (T | null)[] = PHOTO_STEPS.map(() => null);
  for (const r of runs) {
    if (r.status === 'REPLACED' || r.step < 0 || r.step > LAST_PHOTO_STEP) continue;
    const prev = out[r.step];
    if (!prev || prev.createdAt < r.createdAt) out[r.step] = r;
  }
  return out;
}

export type PhotoProgress =
  | { kind: 'open'; step: number; status: PhotoRunStatus }
  | { kind: 'done' }
  | { kind: 'empty' };

/** En qué está la foto: el paso abierto, terminada o sin empezar. */
export function photoProgress(runs: RunLike[]): PhotoProgress {
  const open = runs.find((r) => OPEN_RUN_STATUSES.includes(r.status));
  if (open) return { kind: 'open', step: open.step, status: open.status };
  const last = runs.some((r) => r.step === LAST_PHOTO_STEP && (r.status === 'APPROVED' || r.status === 'SKIPPED'));
  return last ? { kind: 'done' } : { kind: 'empty' };
}

/** "Paso 3 de 8 · Balance de blancos y tinte · esperando tu aprobación". */
export function photoProgressText(p: PhotoProgress): string {
  if (p.kind === 'done') return 'Lista';
  if (p.kind === 'empty') return 'Sin empezar';
  return `Paso ${p.step + 1} de ${PHOTO_STEPS.length} · ${PHOTO_STEPS[p.step].label} · ${RUN_STATUS_LABEL[p.status]}`;
}
