'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Clock, Download, Loader2, RotateCcw, SkipForward, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { PHOTO_ADJUSTMENT_LABEL, PHOTO_STEPS, RUN_STATUS_LABEL } from '@/domain/photo-steps';
import type { StepParam, StepPart, StepRequest } from '@/domain/photo-contract';
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

// La línea de una foto: los 2 pasos arriba y, abajo, el paso elegido con su
// antes y después y cada uno de sus ajustes, con lo que dijo Claude, los
// valores y si se aplica, para aprobar o rehacer.

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
                  {i + 1}. {s.label}
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

// Lo que se edita de cada ajuste: sus valores como texto y si se aplica.
type Edits = Record<string, { values: Record<string, string>; on: boolean }>;

const shownValue = (part: StepPart, p: StepParam) => part.valores[p.clave] ?? p.defecto;

function initialEdits(parts: StepPart[]): Edits {
  return Object.fromEntries(
    parts.map((part) => [
      part.paso,
      { values: Object.fromEntries(part.parametros.map((p) => [p.clave, String(shownValue(part, p))])), on: part.aplicado || part.no_aplica !== null },
    ]),
  );
}

/** Lo que se le pide al trabajador al rehacer. Null si algún valor no es un número. */
function requestFrom(parts: StepPart[], edits: Edits): StepRequest | null {
  const valores: StepRequest['valores'] = {};
  const apagados: string[] = [];
  for (const part of parts) {
    if (part.no_aplica) continue;
    if (!edits[part.paso].on) {
      apagados.push(part.paso);
      continue;
    }
    // Un ajuste que estaba apagado y se vuelve a prender lo propone Claude.
    if (!part.aplicado) continue;
    const out: Record<string, number> = {};
    for (const p of part.parametros) {
      const n = Number(String(edits[part.paso].values[p.clave]).replace(',', '.'));
      if (!Number.isFinite(n)) return null;
      out[p.clave] = n;
    }
    valores[part.paso] = out;
  }
  return { valores, apagados };
}

function RunPanel({ accountSlug, run, photo }: { accountSlug: string; run: RunView; photo: PhotoView }) {
  const step = PHOTO_STEPS[run.step];
  const { run: act, pending, status } = useStepAction();
  const [edits, setEdits] = useState<Edits>(() => initialEdits(run.parts));
  const edited = run.parts.some(
    (part) =>
      (part.no_aplica === null && edits[part.paso].on !== part.aplicado) ||
      (part.aplicado && edits[part.paso].on && part.parametros.some((p) => Number(edits[part.paso].values[p.clave]) !== shownValue(part, p))),
  );
  const ready = run.status === 'REVIEW' || run.status === 'APPROVED' || run.status === 'SKIPPED';
  const working = run.status === 'QUEUED' || run.status === 'PROCESSING';

  function redo() {
    const request = requestFrom(run.parts, edits);
    act(() =>
      request
        ? redoPhotoStepAction(accountSlug, run.id, request)
        : Promise.resolve({ ok: false as const, error: 'Revisá los valores: tienen que ser números.' }),
    );
  }

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
      <p className="text-xs text-muted-foreground">{step.parts.map((k) => PHOTO_ADJUSTMENT_LABEL[k]).join(', ')}.</p>

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
                ? 'El trabajador está haciendo los ajustes en la Mac. La pantalla se actualiza sola.'
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
            {run.step < PHOTO_STEPS.length - 1 ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => skipPhotoStepAction(accountSlug, run.id))}>
                <SkipForward className="h-4 w-4" />
                Saltar paso
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {ready ? (
        <>
          <CompareView before={run.beforeHref} after={run.afterHref} canOverlay={!step.reframes} />
          {run.requested ? <p className="text-xs text-muted-foreground">Rehecho con los valores que pediste.</p> : null}

          <div className="space-y-3">
            {run.parts.map((part) => (
              <PartCard
                key={part.paso}
                part={part}
                edit={edits[part.paso]}
                onChange={(e) => setEdits({ ...edits, [part.paso]: e })}
                disabled={pending}
              />
            ))}
          </div>

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
            <Button size="sm" variant={run.status === 'REVIEW' && !edited ? 'outline' : 'default'} disabled={pending} onClick={redo}>
              <RotateCcw className="h-4 w-4" />
              {run.status === 'REVIEW' ? 'Rehacer con estos valores' : 'Rehacer desde acá con estos valores'}
            </Button>
            <StatusText status={status} />
          </div>
          {edited && run.status === 'REVIEW' ? (
            <p className="text-xs text-muted-foreground">Cambiaste valores: rehacé el paso para ver cómo queda antes de aprobarlo.</p>
          ) : null}
          {run.status !== 'REVIEW' && run.step < PHOTO_STEPS.length - 1 ? (
            <p className="text-xs text-muted-foreground">Rehacer este paso vuelve a hacer también el que viene después.</p>
          ) : null}
        </>
      ) : null}

      {photo.costUsd > 0 && run.step === PHOTO_STEPS.length - 1 && ready ? (
        <p className="text-xs text-muted-foreground">Claude costó {formatUsd(photo.costUsd)} en toda la foto.</p>
      ) : null}
    </div>
  );
}

// Un ajuste del paso: si se aplicó, lo que dijo Claude, el aviso y sus valores.
function PartCard({
  part,
  edit,
  onChange,
  disabled,
}: {
  part: StepPart;
  edit: Edits[string];
  onChange: (e: Edits[string]) => void;
  disabled: boolean;
}) {
  const label = PHOTO_ADJUSTMENT_LABEL[part.paso] ?? part.paso;
  const id = `ajuste-${part.paso}`;
  // Sin Exportar no hay foto final; lo que no aplica no se puede prender.
  const switchable = part.no_aplica === null && part.paso !== 'exportar';
  return (
    <section aria-labelledby={id} className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id={id} className="text-sm font-semibold">
          {label}
        </h4>
        {switchable ? (
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={edit.on}
              onChange={(e) => onChange({ ...edit, on: e.target.checked })}
              disabled={disabled}
            />
            Aplicar
          </label>
        ) : null}
      </div>
      {part.no_aplica ? (
        <p className="text-sm text-muted-foreground">Se salteó solo: {part.no_aplica}</p>
      ) : !edit.on ? (
        <p className="text-sm text-muted-foreground">
          {part.aplicado ? 'Lo apagaste: al rehacer, la foto pasa sin este ajuste.' : 'Apagado: la foto pasa sin este ajuste.'}
        </p>
      ) : (
        <>
          {part.propuesta ? (
            <div className="flex items-start gap-2 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                <span className="font-medium">{ORIGIN_LABEL[part.propuesta.origen] ?? part.propuesta.origen}:</span> {part.propuesta.razon}
                {part.propuesta.aviso ? <span className="block text-amber-700">{part.propuesta.aviso}</span> : null}
              </p>
            </div>
          ) : !part.aplicado ? (
            <p className="text-sm text-muted-foreground">Al rehacer, Claude propone los valores.</p>
          ) : null}
          {part.nota ? <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-sm">{part.nota}</p> : null}
          {part.parametros.length > 0 && part.aplicado ? (
            <ValuesForm
              idPrefix={part.paso}
              params={part.parametros}
              values={edit.values}
              onChange={(values) => onChange({ ...edit, values })}
              disabled={disabled}
            />
          ) : null}
          {Object.keys(part.medidas).length > 0 ? (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Lo que midió el programa</summary>
              <ul className="mt-1 space-y-0.5 pl-4">
                {Object.entries(part.medidas).map(([k, v]) => (
                  <li key={k}>
                    {k.replaceAll('_', ' ')}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

function ValuesForm({
  idPrefix,
  params,
  values,
  onChange,
  disabled,
}: {
  idPrefix: string;
  params: StepParam[];
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Valores</legend>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {params.map((p) => {
          const id = `valor-${idPrefix}-${p.clave}`;
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
