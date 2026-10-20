import type { PhotoRunStatus } from '@/generated/prisma/enums';

// La línea de imágenes tiene 8 ajustes, en el orden del trabajador
// (trabajador-imagenes/mrb_imagenes/pasos/), agrupados en 2 pasos: la Mac
// hace los ajustes de un paso de corrido y frena para que una persona apruebe.
// La app muestra y guarda lo que pasó; cómo se corrige la foto es cosa del
// trabajador.

export const PHOTO_ADJUSTMENT_LABEL: Record<string, string> = {
  lente: 'Lente',
  perspectiva: 'Perspectiva y enderezado',
  blancos: 'Balance de blancos y tinte',
  luces: 'Luces, sombras y claridad',
  color: 'Color',
  fondo: 'Quitar fondo',
  recorte: 'Recorte',
  exportar: 'Exportar',
};

export type PhotoStep = {
  key: string;
  label: string;
  // Los ajustes del paso, en orden.
  parts: string[];
  // Los que cambian el encuadre no se comparan superpuestos con el deslizador.
  // Corregir endereza y recorta apenas: el deslizador igual sirve para ver
  // colores y luz.
  reframes: boolean;
};

export const PHOTO_STEPS: readonly PhotoStep[] = [
  { key: 'corregir', label: 'Corregir la foto', parts: ['lente', 'perspectiva', 'blancos', 'luces', 'color'], reframes: false },
  { key: 'terminar', label: 'Recortar y exportar', parts: ['fondo', 'recorte', 'exportar'], reframes: true },
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
