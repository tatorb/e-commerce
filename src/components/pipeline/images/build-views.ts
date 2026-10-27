import type { PhotoStepRun } from '@/generated/prisma/client';
import { currentRuns, photoProgress, photoProgressText } from '@/domain/photo-steps';
import { parsePhotoSettings } from '@/domain/photo-settings';
import { formatDateTime } from '@/lib/format';
import { photoFileHref } from '@/lib/photo-rules';
import { partsOf } from '@/lib/photo-queue';
import type { loadPhotoLine } from '@/lib/photos';
import type { PhotoView, RunView } from './types';
import { shotText } from '@/domain/shoot';

// Arma lo que muestra la pantalla a partir de lo guardado. Corre en el servidor.

type Edit = Awaited<ReturnType<typeof loadPhotoLine>>[number];

// Los originales que el navegador puede mostrar sin que la Mac arme una vista.
const BROWSER_TYPES = ['image/jpeg', 'image/png'];

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

function cameraText(camera: unknown): string | null {
  const c = obj(camera);
  if (!c) return null;
  const parts = [c.marca, c.modelo].filter((p): p is string => typeof p === 'string' && p !== '');
  if (typeof c.lente === 'string' && c.lente) parts.push(`lente ${c.lente}`);
  return parts.join(' · ') || null;
}

export function buildPhotoView(edit: Edit, timeZone: string): PhotoView {
  const runs = currentRuns(edit.runs);
  const progress = photoProgress(edit.runs);
  const original = photoFileHref('antes', { foto: edit.id });
  const steps: (RunView | null)[] = [];
  // La foto que entra a cada paso: la que salió del último paso aprobado.
  let before: string | null = edit.previewUrl ? original : null;
  for (const run of runs) {
    if (!run) {
      steps.push(null);
      continue;
    }
    const view = runView(run as Edit['runs'][number], before, timeZone);
    steps.push(view);
    if (run.status === 'APPROVED' && view.afterHref) before = view.afterHref;
  }
  const last = [...steps].reverse().find((s) => s?.afterHref);
  // El original se ve como está si el navegador lo muestra; si no, la vista que armó la Mac.
  const shown = BROWSER_TYPES.includes(edit.originalType) ? photoFileHref('original', { foto: edit.id }) : edit.previewUrl ? original : null;
  return {
    id: edit.id,
    name: edit.originalName,
    source: edit.source,
    asIs: edit.asIs,
    originalViewHref: shown,
    originalType: edit.originalType,
    originalSize: edit.originalSize,
    size: edit.width && edit.height ? `${edit.width} × ${edit.height} px` : null,
    camera: cameraText(edit.camera),
    thumbHref: edit.asIs ? (edit.previewUrl ? original : shown) : (last?.afterHref ?? (edit.previewUrl ? original : null)),
    originalHref: photoFileHref('original', { foto: edit.id }, true),
    // La que se usa tal cual ya está lista.
    progress: edit.asIs ? { kind: 'done' } : progress,
    progressText: edit.asIs ? 'Original, sin editar' : photoProgressText(progress),
    shot: edit.shot ? shotText(edit.variantLabel, edit.shootStep?.title ?? null) : null,
    steps,
    costUsd: edit.runs.reduce((sum, r) => sum + (typeof obj(r.aiUsage)?.costo_usd === 'number' ? (obj(r.aiUsage)!.costo_usd as number) : 0), 0),
  };
}

function runView(run: PhotoStepRun & { decidedBy: { name: string } | null }, before: string | null, timeZone: string): RunView {
  const usage = obj(run.aiUsage);
  return {
    id: run.id,
    step: run.step,
    status: run.status,
    parts: partsOf(run.parts),
    requested: run.requested !== null,
    beforeHref: before,
    afterHref: run.previewUrl ? photoFileHref('vista', { paso: run.id }) : null,
    maskHref: run.maskUrl ? photoFileHref('mascara', { paso: run.id }, true) : null,
    pngHref: run.pngUrl ? photoFileHref('png', { paso: run.id }, true) : null,
    jpgHref: run.jpgUrl ? photoFileHref('jpg', { paso: run.id }, true) : null,
    liveHref: run.liveUrl ? photoFileHref('vivo', { paso: run.id }) : null,
    background: parsePhotoSettings(run.settings).fondo,
    costUsd: typeof usage?.costo_usd === 'number' ? usage.costo_usd : null,
    seconds: run.seconds,
    error: run.error,
    attempts: run.attempts,
    decided:
      run.decidedAt && (run.status === 'APPROVED' || run.status === 'SKIPPED')
        ? `${run.status === 'APPROVED' ? 'Aprobado' : 'Salteado'}${run.decidedBy ? ` por ${run.decidedBy.name}` : ' solo'} el ${formatDateTime(run.decidedAt, timeZone)}`
        : null,
  };
}
