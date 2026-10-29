import type { PhotoRunStatus } from '@/generated/prisma/enums';

// La línea de imágenes tiene 9 ajustes, en el orden del trabajador
// (trabajador-imagenes/mrb_imagenes/pasos/). La Mac los hace de corrido, en un
// solo paso, y frena para que una persona apruebe; si algo no convence, se
// cambian los valores de los ajustes que haga falta y se rehace todo junto.
// La app muestra y guarda lo que pasó; cómo se corrige la foto es cosa del
// trabajador. Los pasos son una lista por si algún día conviene frenar más
// de una vez.

export const PHOTO_ADJUSTMENT_LABEL: Record<string, string> = {
  lente: 'Lente',
  perspectiva: 'Perspectiva y enderezado',
  blancos: 'Balance de blancos y tinte',
  luces: 'Luces, sombras y claridad',
  color: 'Color',
  fondo: 'Quitar fondo',
  recorte: 'Recorte',
  sombra: 'Sombra',
  exportar: 'Exportar',
};

// Los ajustes que se pueden probar en vivo en la pantalla, sin esperar a la
// Mac. Quitar fondo y recorte no: dependen del modelo que corre en la Mac.
export const LIVE_PARTS: readonly string[] = ['lente', 'perspectiva', 'blancos', 'luces', 'color', 'sombra'];

export type PhotoStep = {
  key: string;
  label: string;
  // Los ajustes del paso, en orden.
  parts: string[];
  // Los que cambian el encuadre no se comparan superpuestos con el deslizador.
  reframes: boolean;
};

export const PHOTO_STEPS: readonly PhotoStep[] = [
  {
    key: 'corregir',
    label: 'Corrección de la foto',
    parts: ['lente', 'perspectiva', 'blancos', 'luces', 'color', 'fondo', 'recorte', 'sombra', 'exportar'],
    reframes: true,
  },
];

export const LAST_PHOTO_STEP = PHOTO_STEPS.length - 1;

/** Lo más largo que puede ser la indicación puntual para Claude al procesar una foto de cero. */
export const PHOTO_NOTE_MAX = 1000;

/** La indicación puntual como se guarda: sin espacios de más; vacía no hay. Null si es muy larga. */
export function cleanPhotoNote(raw: unknown): { ok: true; note: string | null } | { ok: false; error: string } {
  const note = typeof raw === 'string' ? raw.trim() : '';
  if (note.length > PHOTO_NOTE_MAX) return { ok: false, error: `La indicación es muy larga: hasta ${PHOTO_NOTE_MAX} letras.` };
  return { ok: true, note: note || null };
}

/**
 * Si en algún ajuste del intento Claude no respondió y quedaron los valores
 * que midió el programa (origen «medido»). Al rehacer con valores, Claude no
 * vuelve a mirar: sigue así hasta procesarla de cero.
 */
export function claudeMissed(parts: unknown): boolean {
  return Array.isArray(parts) && parts.some((p) => (p as { propuesta?: { origen?: unknown } | null } | null)?.propuesta?.origen === 'medido');
}

/**
 * Si conviene procesar la foto de cero para que Claude la mire: no respondió
 * en algún ajuste y la Mac no la está procesando ahora.
 */
export function missedByClaude(edit: { asIs: boolean; runs: (RunLike & { createdAt: Date; parts: unknown })[] }): boolean {
  if (edit.asIs) return false;
  const runs = currentRuns(edit.runs).filter((r) => r !== null);
  return !runs.some((r) => r.status === 'QUEUED' || r.status === 'PROCESSING') && runs.some((r) => claudeMissed(r.parts));
}

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

/**
 * El color de la foto en la lista: aprobada (o lista para usar tal cual), falta
 * verificar lo que hizo la Mac, o todavía sin procesar, incluida la que falló.
 */
export type PhotoTone = 'approved' | 'review' | 'pending';

export function photoTone(p: PhotoProgress): PhotoTone {
  if (p.kind === 'done') return 'approved';
  if (p.kind === 'open' && p.status === 'REVIEW') return 'review';
  return 'pending';
}

/** "Esperando tu aprobación", o con varios pasos "Paso 1 de 2 · Corrección de la foto · esperando tu aprobación". */
export function photoProgressText(p: PhotoProgress): string {
  if (p.kind === 'done') return 'Lista';
  if (p.kind === 'empty') return 'Sin empezar';
  const status = RUN_STATUS_LABEL[p.status];
  if (PHOTO_STEPS.length === 1) return status.charAt(0).toUpperCase() + status.slice(1);
  return `Paso ${p.step + 1} de ${PHOTO_STEPS.length} · ${PHOTO_STEPS[p.step].label} · ${status}`;
}
