import type { PhotoRunStatus, PhotoSource } from '@/generated/prisma/enums';
import type { StepPart } from '@/domain/photo-contract';
import type { PhotoProgress } from '@/domain/photo-steps';

// Lo que necesita la pantalla de cada foto, ya armado en el servidor: solo datos.

export type RunView = {
  id: string;
  step: number;
  status: PhotoRunStatus;
  // Lo que pasó en cada ajuste del paso. Vacío mientras no se hizo.
  parts: StepPart[];
  // Si se rehízo con valores pedidos.
  requested: boolean;
  // La indicación puntual para Claude que se escribió al procesar de cero.
  note: string | null;
  // La foto que entró al paso y la que salió.
  beforeHref: string | null;
  afterHref: string | null;
  maskHref: string | null;
  pngHref: string | null;
  jpgHref: string | null;
  // El paquete para editar en vivo, si la Mac lo subió.
  liveHref: string | null;
  // El color de fondo del JPG con que se hizo.
  background: string;
  costUsd: number | null;
  seconds: number | null;
  error: string | null;
  attempts: number;
  decided: string | null;
};

export type PhotoView = {
  id: string;
  name: string;
  source: PhotoSource;
  // Ya viene editada: se usa el original tal cual, sin pasar por la Mac.
  asIs: boolean;
  // Cómo se ve el original en la pantalla, si el navegador lo puede mostrar.
  originalViewHref: string | null;
  originalType: string;
  originalSize: number;
  size: string | null;
  camera: string | null;
  thumbHref: string | null;
  originalHref: string;
  progress: PhotoProgress;
  progressText: string;
  // Sacada en Registro de productos: la medida y el paso, por ejemplo "Registro: medida 0.50, Frente".
  shot: string | null;
  // El intento vigente de cada paso, o null si todavía no se hizo.
  steps: (RunView | null)[];
  costUsd: number;
};
