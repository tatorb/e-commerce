import type { PhotoRunStatus, PhotoSource } from '@/generated/prisma/enums';
import type { StepParam, StepProposal } from '@/domain/photo-contract';
import type { PhotoProgress } from '@/domain/photo-steps';

// Lo que necesita la pantalla de cada foto, ya armado en el servidor: solo datos.

export type RunView = {
  id: string;
  step: number;
  status: PhotoRunStatus;
  proposal: StepProposal | null;
  values: Record<string, number> | null;
  requested: Record<string, number> | null;
  params: StepParam[];
  measures: Record<string, unknown> | null;
  note: string | null;
  notApplicable: string | null;
  // La foto que entró al paso y la que salió.
  beforeHref: string | null;
  afterHref: string | null;
  maskHref: string | null;
  pngHref: string | null;
  jpgHref: string | null;
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
  size: string | null;
  camera: string | null;
  thumbHref: string | null;
  originalHref: string;
  progress: PhotoProgress;
  progressText: string;
  // El intento vigente de cada paso, o null si todavía no se hizo.
  steps: (RunView | null)[];
  costUsd: number;
};
