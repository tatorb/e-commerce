'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Clock, Download, Loader2, RotateCcw, SkipForward, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { PHOTO_STEPS, RUN_STATUS_LABEL } from '@/domain/photo-steps';
import type { StepParam } from '@/domain/photo-contract';
import { formatUsd } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import {
  approvePhotoStepAction,
  redoPhotoStepAction,
  retryPhotoStepAction,
  skipPhotoStepAction,
} from '@/app/a/[cuenta]/pipeline/image-actions';
import { CompareView } from './CompareView';
import type { PhotoView, RunView } from './types';

// La línea de una foto: los 8 pasos arriba y, abajo, el paso elegido con su
// antes y después, lo que dijo Claude y los valores, para aprobar, rehacer o
// saltear.

const ORIGIN_LABEL: Record<string, string> = {
  claude: 'Claude',
  medido: 'Medido por el programa',
  simulado: 'Prueba sin Claude',
};

function StepIcon({ run }: { run: RunView | null }) {
  const cls = 'h-3.5 w-3.5';
  if (!run) return <span className={cn(cls, 'rounded-full border border-muted-foreground/40')} />;
  switch (run.status) {
    case 'APPROVED':
      return <Check className={cn(cls, 'text-emerald-600')} />;
    case 'SKIPPED':
      return <SkipForward className={cn(cls, 'text-muted-foreground')} />;
    case 'REVIEW':
      return <span className={cn(cls, 'rounded-full bg-amber-500')} />;
    case 'PROCESSING':
      return <Loader2 className={cn(cls, 'animate-spin text-primary')} />;
    case 'QUEUED':
      return <Clock className={cn(cls, 'text-muted-foreground')} />;
    case 'FAILED':
      return <AlertTriangle className={cn(cls, 'text-destructive')} />;
    default:
      return null;
  }
}

export function PhotoLine({ accountSlug, photo }: { accountSlug: string; photo: PhotoView }) {
  const open = photo.progress.kind === 'open' ? photo.progress.step : null;
  const lastDone = photo.steps.reduce((acc, r, i) => (r ? i : acc), 0);
  const [selected, setSelected] = useState<number>(open ?? lastDone);
  // Si la foto avanzó de paso, se sigue al paso abierto.
  const [followed, setFollowed] = useState(open);
  if (open !== followed) {
    setFollowed(open);
    if (open !== null) setSelected(open);
  }
  const run = photo.steps[selected] ?? null;

  return (
    <div className="space-y-4">
      <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Pasos de la foto">
        {PHOTO_STEPS.map((s, i) => {
          const r = photo.steps[i];
          return (
            <li key={s.key} className="shrink-0">
              <button
                type="button"
                onClick={() => setSelected(i)}
                disabled={!r}
                aria-current={selected === i ? 'step' : undefined}
                title={r ? `${s.label}: ${RUN_STATUS_LABEL[r.status]}` : s.label}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                  selected === i ? 'border-foreground bg-muted font-medium' : 'hover:bg-muted/60',
                  !r && 'cursor-default opacity-50 hover:bg-transparent',
                )}
              >
                <StepIcon run={r} />
                <span>
                  {i + 1}. {s.short}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {/* Con el estado en la clave: cuando el paso llega para revisar, los valores arrancan de lo que hizo el trabajador. */}
      {run ? <RunPanel key={`${run.id}:${run.status}`} accountSlug={accountSlug} run={run} photo={photo} /> : null}
    </div>
  );
}

function RunPanel({ accountSlug, run, photo }: { accountSlug: string; run: RunView; photo: PhotoView }) {
  const step = PHOTO_STEPS[run.step];
  const { run: act, pending, status } = useStepAction();
  const shown = run.values ?? run.requested ?? run.proposal?.valores ?? {};
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(run.params.map((p) => [p.clave, String(shown[p.clave] ?? p.defecto)])),
  );
  const edited = run.params.some((p) => Number(values[p.clave]) !== (shown[p.clave] ?? p.defecto));
  const ready = run.status === 'REVIEW' || run.status === 'APPROVED' || run.status === 'SKIPPED';

  function numbers(): Record<string, number> | null {
    const out: Record<string, number> = {};
    for (const p of run.params) {
      const n = Number(String(values[p.clave]).replace(',', '.'));
      if (!Number.isFinite(n)) return null;
      out[p.clave] = n;
    }
    return out;
  }

  const working = run.status === 'QUEUED' || run.status === 'PROCESSING';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">
          Paso {run.step + 1} de {PHOTO_STEPS.length} · {step.label}
        </h3>
        <span className="text-sm text-muted-foreground">
          {run.decided ?? RUN_STATUS_LABEL[run.status]}
          {run.seconds !== null && ready ? ` · ${run.seconds.toFixed(0)} s` : ''}
          {run.costUsd ? ` · Claude ${formatUsd(run.costUsd)}` : ''}
        </span>
      </div>

      {working ? (
        <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4 text-sm">
          {run.status === 'PROCESSING' ? (
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="space-y-1">
            <p>
              {run.status === 'PROCESSING'
                ? 'El trabajador lo está procesando en la Mac. La pantalla se actualiza sola.'
                : 'En cola: el trabajador lo toma en cuanto se desocupe. Si está apagado, lo toma cuando se prenda.'}
            </p>
            {run.requested ? <p className="text-muted-foreground">Con los valores que pediste.</p> : null}
            {run.error ? (
              <p className="text-amber-700">
                El intento anterior falló: {run.error} Va el intento {run.attempts + (run.status === 'QUEUED' ? 1 : 0)} de 3.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {run.status === 'FAILED' ? (
        <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>Este paso falló 3 veces. {run.error}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => act(() => retryPhotoStepAction(accountSlug, run.id))}>
              <RotateCcw className="h-4 w-4" />
              Reintentar
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => skipPhotoStepAction(accountSlug, run.id))}>
              <SkipForward className="h-4 w-4" />
              Saltar paso
            </Button>
          </div>
        </div>
      ) : null}

      {ready ? (
        <>
          {run.notApplicable ? (
            <p className="rounded-md border bg-muted/40 p-3 text-sm">Se salteó solo: {run.notApplicable}</p>
          ) : (
            <CompareView before={run.beforeHref} after={run.afterHref} canOverlay={!step.reframes} />
          )}

          {run.proposal ? (
            <div className="flex items-start gap-2 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                <span className="font-medium">{ORIGIN_LABEL[run.proposal.origen] ?? run.proposal.origen}:</span> {run.proposal.razon}
                {run.proposal.aviso ? <span className="block text-amber-700">{run.proposal.aviso}</span> : null}
              </p>
            </div>
          ) : null}
          {run.requested ? <p className="text-xs text-muted-foreground">Rehecho con los valores que pediste.</p> : null}
          {run.note ? <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">{run.note}</p> : null}

          {run.params.length > 0 && !run.notApplicable ? (
            <ValuesForm params={run.params} values={values} onChange={setValues} disabled={pending} />
          ) : null}

          {run.pngHref || run.jpgHref || run.maskHref ? (
            <div className="flex flex-wrap gap-2">
              {run.jpgHref ? (
                <Button asChild size="sm" variant="outline">
                  <a href={run.jpgHref}>
                    <Download className="h-4 w-4" />
                    JPG con fondo
                  </a>
                </Button>
              ) : null}
              {run.pngHref ? (
                <Button asChild size="sm" variant="outline">
                  <a href={run.pngHref}>
                    <Download className="h-4 w-4" />
                    PNG transparente
                  </a>
                </Button>
              ) : null}
              {run.maskHref ? (
                <Button asChild size="sm" variant="ghost">
                  <a href={run.maskHref}>
                    <Download className="h-4 w-4" />
                    Silueta
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {run.status === 'REVIEW' ? (
              <Button size="sm" disabled={pending || edited} onClick={() => act(() => approvePhotoStepAction(accountSlug, run.id))}>
                <Check className="h-4 w-4" />
                Aprobar
              </Button>
            ) : null}
            {run.params.length > 0 && !run.notApplicable ? (
              <Button
                size="sm"
                variant={run.status === 'REVIEW' && !edited ? 'outline' : 'default'}
                disabled={pending}
                onClick={() => {
                  const v = numbers();
                  act(() => (v ? redoPhotoStepAction(accountSlug, run.id, v) : Promise.resolve({ ok: false as const, error: 'Revisá los valores: tienen que ser números.' })));
                }}
              >
                <RotateCcw className="h-4 w-4" />
                {run.status === 'REVIEW' ? 'Rehacer con estos valores' : 'Rehacer desde acá con estos valores'}
              </Button>
            ) : null}
            {run.status === 'REVIEW' ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => skipPhotoStepAction(accountSlug, run.id))}>
                <SkipForward className="h-4 w-4" />
                Saltar paso
              </Button>
            ) : null}
            {run.status !== 'REVIEW' && (run.notApplicable || run.params.length === 0) ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => redoPhotoStepAction(accountSlug, run.id, null))}>
                <RotateCcw className="h-4 w-4" />
                Rehacer desde acá
              </Button>
            ) : null}
            <StatusText status={status} />
          </div>
          {edited && run.status === 'REVIEW' ? (
            <p className="text-xs text-muted-foreground">Cambiaste valores: rehacé el paso para ver cómo queda antes de aprobarlo.</p>
          ) : null}
          {run.status !== 'REVIEW' ? (
            <p className="text-xs text-muted-foreground">Rehacer este paso vuelve a hacer también los que vienen después.</p>
          ) : null}

          {run.measures && Object.keys(run.measures).length > 0 ? (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Lo que midió el programa</summary>
              <ul className="mt-1 space-y-0.5 pl-4">
                {Object.entries(run.measures).map(([k, v]) => (
                  <li key={k}>
                    {k.replaceAll('_', ' ')}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}

      {photo.costUsd > 0 && run.step === PHOTO_STEPS.length - 1 && ready ? (
        <p className="text-xs text-muted-foreground">Claude costó {formatUsd(photo.costUsd)} en toda la foto.</p>
      ) : null}
    </div>
  );
}

function ValuesForm({
  params,
  values,
  onChange,
  disabled,
}: {
  params: StepParam[];
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Valores</legend>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {params.map((p) => {
          const id = `valor-${p.clave}`;
          if (p.tipo === 'si_no') {
            return (
              <label key={p.clave} htmlFor={id} className="flex items-start gap-2 text-sm">
                <input
                  id={id}
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={Number(values[p.clave]) >= 0.5}
                  onChange={(e) => onChange({ ...values, [p.clave]: e.target.checked ? '1' : '0' })}
                  disabled={disabled}
                />
                <span>
                  <span className="font-medium">{p.etiqueta}</span>
                  <span className="block text-xs text-muted-foreground">{p.ayuda}</span>
                </span>
              </label>
            );
          }
          return (
            <div key={p.clave} className="grid grid-cols-[1fr_6.5rem] items-start gap-2">
              <div>
                <Label htmlFor={id}>{p.etiqueta}</Label>
                <p className="text-xs text-muted-foreground">
                  {p.ayuda} De {p.minimo} a {p.maximo}
                  {p.unidad}.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min={p.minimo}
                  max={p.maximo}
                  step={p.paso || 'any'}
                  value={values[p.clave] ?? ''}
                  onChange={(e) => onChange({ ...values, [p.clave]: e.target.value })}
                  disabled={disabled}
                />
                {p.unidad.trim() ? <span className="text-xs text-muted-foreground">{p.unidad.trim()}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
