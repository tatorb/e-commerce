'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Clock, Download, RotateCcw, SkipForward, SlidersHorizontal, Sparkles, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { claudeMissed, LIVE_PARTS, PHOTO_ADJUSTMENT_LABEL, PHOTO_STEPS, RUN_STATUS_LABEL } from '@/domain/photo-steps';
import { quarterTurns, type LiveEdits, type LivePartKey } from '@/domain/photo-live';
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
import { LivePreview } from './LivePreview';
import { FromScratchButton } from './PhotoListActions';
import { TURN_TEXT, TurnButtons } from './TurnButtons';
import type { PhotoView, RunView } from './types';
import { BrandMark } from '@/components/ui/brand-loader';

// La línea de una foto: el antes y el después y cada uno de sus ajustes, con
// lo que dijo Claude, los valores y si se aplica, para aprobar o cambiar los
// valores que haga falta y rehacer todo junto. Con más de un paso, los pasos
// van arriba. Con varias fotos abiertas (compact), los ajustes arrancan
// plegados para ver más fotos de una vez. Si la Mac subió el paquete, los
// ajustes de lente a color y la sombra se pueden mover en vivo y después
// aplicar en la Mac.

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
      return <BrandMark className={cls} />;
    case 'QUEUED':
      return <Clock className={cn(cls, 'text-muted-foreground')} />;
    case 'FAILED':
      return <AlertTriangle className={cn(cls, 'text-destructive')} />;
    default:
      return null;
  }
}

export function PhotoLine({ accountSlug, photo, compact = false }: { accountSlug: string; photo: PhotoView; compact?: boolean }) {
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
      {PHOTO_STEPS.length > 1 ? (
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
      ) : null}
      {/* Con el estado en la clave: cuando el paso llega para revisar, los valores arrancan de lo que hizo el trabajador. */}
      {run ? <RunPanel key={`${run.id}:${run.status}`} accountSlug={accountSlug} run={run} photo={photo} compact={compact} /> : null}
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

const isLive = (paso: string) => LIVE_PARTS.includes(paso);

const numberOf = (text: string | undefined) => Number(String(text ?? '').replace(',', '.'));

/** Los valores de la pantalla para la vista en vivo, dentro de su rango. */
function liveEditsFrom(parts: StepPart[], edits: Edits): LiveEdits {
  const out: LiveEdits = {};
  for (const part of parts) {
    if (!isLive(part.paso)) continue;
    const values: Record<string, number> = {};
    for (const p of part.parametros) {
      const n = numberOf(edits[part.paso].values[p.clave]);
      const v = Number.isFinite(n) ? (p.tipo === 'cuartos' ? quarterTurns(n) : Math.min(Math.max(n, p.minimo), p.maximo)) : shownValue(part, p);
      values[p.clave] = p.tipo === 'si_no' ? (v >= 0.5 ? 1 : 0) : v;
    }
    out[part.paso as LivePartKey] = { on: edits[part.paso].on && part.no_aplica === null, values };
  }
  return out;
}

/**
 * Lo que se le pide al trabajador al rehacer. Null si algún valor no es un
 * número. En vivo, un ajuste que se vuelve a prender va con los valores que se
 * vieron en la pantalla.
 */
function requestFrom(parts: StepPart[], edits: Edits, live: boolean): StepRequest | null {
  const valores: StepRequest['valores'] = {};
  const apagados: string[] = [];
  for (const part of parts) {
    if (part.no_aplica) continue;
    if (!edits[part.paso].on) {
      apagados.push(part.paso);
      continue;
    }
    // Un ajuste que estaba apagado y se vuelve a prender lo propone Claude.
    if (!part.aplicado && !(live && isLive(part.paso))) continue;
    const out: Record<string, number> = {};
    for (const p of part.parametros) {
      const n = numberOf(edits[part.paso].values[p.clave]);
      if (!Number.isFinite(n)) return null;
      out[p.clave] = n;
    }
    valores[part.paso] = out;
  }
  return { valores, apagados };
}

function RunPanel({ accountSlug, run, photo, compact }: { accountSlug: string; run: RunView; photo: PhotoView; compact: boolean }) {
  const step = PHOTO_STEPS[run.step];
  const { run: act, pending, running, status } = useStepAction();
  const [edits, setEdits] = useState<Edits>(() => initialEdits(run.parts));
  const [live, setLive] = useState(false);
  const liveEdits = useMemo(() => liveEditsFrom(run.parts, edits), [run.parts, edits]);
  const [showParts, setShowParts] = useState(!compact);
  // Al abrir o cerrar otras fotos, los ajustes se pliegan o se despliegan, sin perder lo que se cambió.
  const [wasCompact, setWasCompact] = useState(compact);
  if (compact !== wasCompact) {
    setWasCompact(compact);
    setShowParts(!compact);
  }
  const edited = run.parts.some(
    (part) =>
      (part.no_aplica === null && edits[part.paso].on !== part.aplicado) ||
      (part.aplicado && edits[part.paso].on && part.parametros.some((p) => Number(edits[part.paso].values[p.clave]) !== shownValue(part, p))),
  );
  const ready = run.status === 'REVIEW' || run.status === 'APPROVED' || run.status === 'SKIPPED';
  const working = run.status === 'QUEUED' || run.status === 'PROCESSING';
  // Claude no respondió en algún ajuste: rehacer usa los mismos valores, procesar de cero hace que la mire.
  const missed = claudeMissed(run.parts);
  const liveOn = live && run.liveHref !== null;
  // Girar de a 90° va en Perspectiva, si la Mac que la hizo sabe hacerlo.
  const persp = run.parts.find((p) => p.paso === 'perspectiva' && p.no_aplica === null);
  const canTurn = persp?.parametros.some((p) => p.tipo === 'cuartos') ?? false;
  const quarters = canTurn ? quarterTurns(numberOf(edits.perspectiva.values.cuartos) || 0) : 0;
  // Girar prende Perspectiva si estaba apagada.
  const turn = (by: 1 | -1) =>
    setEdits({ ...edits, perspectiva: { on: true, values: { ...edits.perspectiva.values, cuartos: String(quarterTurns(quarters + by)) } } });

  function redo() {
    const request = requestFrom(run.parts, edits, liveOn);
    act(
      () =>
        request
          ? redoPhotoStepAction(accountSlug, run.id, request)
          : Promise.resolve({ ok: false as const, error: 'Revisá los valores: tienen que ser números.' }),
      undefined,
      'redo',
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">
          {PHOTO_STEPS.length > 1 ? `Paso ${run.step + 1} de ${PHOTO_STEPS.length} · ` : ''}
          {step.label}
        </h3>
        <span className="text-sm text-muted-foreground">
          {run.decided ?? RUN_STATUS_LABEL[run.status]}
          {run.seconds !== null && ready ? ` · ${run.seconds.toFixed(0)} s` : ''}
          {run.costUsd ? ` · Claude ${formatUsd(run.costUsd)}` : ''}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{step.parts.map((k) => PHOTO_ADJUSTMENT_LABEL[k]).join(', ')}.</p>
      {run.note ? (
        <p className="whitespace-pre-line rounded-md bg-muted/60 px-3 py-2 text-sm">
          <span className="font-medium">Indicación para Claude en esta corrida: </span>
          {run.note}
        </p>
      ) : null}

      {working ? (
        <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4 text-sm">
          {run.status === 'PROCESSING' ? (
            <BrandMark className="mt-0.5 h-5 w-5" />
          ) : (
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="space-y-1">
            <p>
              {run.status === 'PROCESSING'
                ? 'El trabajador está haciendo los ajustes en la Mac. Tarda un par de minutos y la pantalla se actualiza sola.'
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
            <Button size="sm" pending={running('retry')} disabled={pending} onClick={() => act(() => retryPhotoStepAction(accountSlug, run.id), undefined, 'retry')}>
              <RotateCcw className="h-4 w-4" />
              Reintentar
            </Button>
            <FromScratchButton accountSlug={accountSlug} editId={photo.id} missed={missed} />
            {run.step < PHOTO_STEPS.length - 1 ? (
              <Button
                size="sm"
                variant="outline"
                pending={running('skip')}
                disabled={pending}
                onClick={() => act(() => skipPhotoStepAction(accountSlug, run.id), undefined, 'skip')}
              >
                <SkipForward className="h-4 w-4" />
                Saltar paso
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {ready ? (
        <>
          {liveOn && run.liveHref ? (
            // Arriba de todo mientras se mueven los valores de abajo.
            <div className="sticky top-0 z-20 -mx-4 border-b bg-card px-4 py-2">
              <LivePreview
                href={run.liveHref}
                macHref={run.afterHref}
                parts={run.parts}
                background={run.background}
                edits={liveEdits}
                turn={canTurn ? { quarters, onTurn: turn, disabled: pending } : null}
                turnHint={persp && !canTurn ? 'Para girar 90°, actualizá el trabajador de la Mac y rehacé la foto.' : null}
              />
            </div>
          ) : (
            <CompareView
              before={run.beforeHref}
              after={run.afterHref}
              canOverlay={!step.reframes}
              beforeZoom={run.step === 0 ? photo.originalViewHref : null}
              afterZoom={run.jpgHref}
            />
          )}
          {run.requested ? <p className="text-xs text-muted-foreground">Rehecho con los valores que pediste.</p> : null}
          {run.liveHref && step.parts.some(isLive) ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={liveOn ? 'secondary' : 'outline'}
                aria-pressed={liveOn}
                onClick={() => {
                  setLive(!liveOn);
                  if (!liveOn) setShowParts(true);
                }}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {liveOn ? 'Dejar de editar en vivo' : 'Editar en vivo'}
              </Button>
              {!liveOn ? (
                <span className="text-xs text-muted-foreground">Mové lente, perspectiva, blancos, luces, color y sombra, y mirá el cambio al instante.</span>
              ) : null}
            </div>
          ) : run.status === 'REVIEW' && step.parts.some(isLive) ? (
            <p className="text-xs text-muted-foreground">Para editar en vivo, actualizá el trabajador de la Mac y rehacé la foto.</p>
          ) : null}

          {compact ? (
            <Button access="view" type="button" size="sm" variant="ghost" aria-expanded={showParts} onClick={() => setShowParts(!showParts)}>
              <ChevronDown className={cn('h-4 w-4 transition-transform', showParts && 'rotate-180')} />
              {showParts ? 'Ocultar los ajustes' : `Ver los ${run.parts.length} ajustes y sus valores`}
            </Button>
          ) : null}
          {showParts ? (
            // En vivo, lo que toma el foco queda a la vista, debajo de la foto y arriba de los botones.
            <div className={cn('space-y-3', liveOn && '[&_input]:scroll-mt-[44vh] [&_input]:scroll-mb-32 sm:[&_input]:scroll-mt-[60vh]')}>
              {run.parts.map((part) => (
                <PartCard
                  key={part.paso}
                  part={part}
                  edit={edits[part.paso]}
                  onChange={(e) => setEdits({ ...edits, [part.paso]: e })}
                  disabled={pending}
                  live={liveOn}
                />
              ))}
            </div>
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

          {/* Los ajustes ocupan mucho: los botones quedan siempre a la vista abajo de la pantalla. */}
          <div className="sticky bottom-0 z-10 -mx-4 space-y-1 border-t bg-card px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {run.status === 'REVIEW' ? (
                <Button
                  size="sm"
                  pending={running('approve')}
                  disabled={pending || edited}
                  onClick={() => act(() => approvePhotoStepAction(accountSlug, run.id), undefined, 'approve')}
                >
                  <Check className="h-4 w-4" />
                  Aprobar
                </Button>
              ) : null}
              <Button
                size="sm"
                variant={run.status === 'REVIEW' && !edited ? 'outline' : 'default'}
                pending={running('redo')}
                disabled={pending}
                onClick={redo}
              >
                <RotateCcw className="h-4 w-4" />
                {liveOn && edited
                  ? 'Aplicar en la Mac'
                  : run.status === 'REVIEW' || run.step === PHOTO_STEPS.length - 1
                    ? 'Rehacer con estos valores'
                    : 'Rehacer desde acá con estos valores'}
              </Button>
              {edited ? (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEdits(initialEdits(run.parts))}>
                  <Undo2 className="h-4 w-4" />
                  Volver a lo de la Mac
                </Button>
              ) : null}
              <StatusText status={status} />
              <FromScratchButton accountSlug={accountSlug} editId={photo.id} missed={missed} />
            </div>
            {missed ? (
              <p className="text-xs text-amber-700">
                Claude no respondió en algunos ajustes y se usaron los valores que midió el programa. Rehacer usa esos mismos valores: para que Claude la mire, procesala de cero.
              </p>
            ) : null}
            {edited && liveOn ? (
              <p className="text-xs text-muted-foreground">Así se vería. Aplicá en la Mac para que haga la foto final con estos valores.</p>
            ) : edited && run.status === 'REVIEW' ? (
              <p className="text-xs text-muted-foreground">Cambiaste valores: rehacé para ver cómo queda antes de aprobar.</p>
            ) : null}
            {run.status !== 'REVIEW' && run.step < PHOTO_STEPS.length - 1 ? (
              <p className="text-xs text-muted-foreground">Rehacer este paso vuelve a hacer también el que viene después.</p>
            ) : null}
          </div>
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
  live,
}: {
  part: StepPart;
  edit: Edits[string];
  onChange: (e: Edits[string]) => void;
  disabled: boolean;
  live: boolean;
}) {
  const label = PHOTO_ADJUSTMENT_LABEL[part.paso] ?? part.paso;
  const id = `ajuste-${part.paso}`;
  const liveHere = live && isLive(part.paso);
  // Sin Exportar no hay foto final; lo que no aplica no se puede prender.
  const switchable = part.no_aplica === null && part.paso !== 'exportar';
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2">
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
      <div className="space-y-2 p-3">
        {live && !isLive(part.paso) ? <p className="text-xs text-muted-foreground">No se ve en vivo: cambia cuando se aplica en la Mac.</p> : null}
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
                  <span className="font-medium">{ORIGIN_LABEL[part.propuesta.origen] ?? part.propuesta.origen}:</span>{' '}
                  {/* Cuando Claude no respondió, el aviso es la razón: va una vez, como aviso. */}
                  <span className={part.propuesta.aviso === part.propuesta.razon ? 'text-amber-700' : undefined}>{part.propuesta.razon}</span>
                  {part.propuesta.aviso && part.propuesta.aviso !== part.propuesta.razon ? <span className="block text-amber-700">{part.propuesta.aviso}</span> : null}
                </p>
              </div>
            ) : !part.aplicado && !liveHere ? (
              <p className="text-sm text-muted-foreground">Al rehacer, Claude propone los valores.</p>
            ) : null}
            {part.nota ? <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-sm">{part.nota}</p> : null}
            {part.parametros.length > 0 && (part.aplicado || liveHere) ? (
              <ValuesForm
                idPrefix={part.paso}
                params={part.parametros}
                values={edit.values}
                onChange={(values) => onChange({ ...edit, values })}
                disabled={disabled}
                slider={liveHere}
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
      </div>
    </section>
  );
}

function ValuesForm({
  idPrefix,
  params,
  values,
  onChange,
  disabled,
  slider,
}: {
  idPrefix: string;
  params: StepParam[];
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  disabled: boolean;
  // En vivo, cada número va con una barra para moverlo.
  slider: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Valores</legend>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {params.map((p) => {
          const id = `valor-${idPrefix}-${p.clave}`;
          if (p.tipo === 'cuartos') {
            const q = quarterTurns(numberOf(values[p.clave]) || 0);
            return (
              <div key={p.clave} className="flex items-center justify-between gap-3 sm:col-span-2">
                <div>
                  <p className="text-sm font-medium">{p.etiqueta}</p>
                  <p className="text-xs text-muted-foreground">{TURN_TEXT[q]}. Antes del giro fino.</p>
                </div>
                <TurnButtons onTurn={(by) => onChange({ ...values, [p.clave]: String(quarterTurns(q + by)) })} disabled={disabled} />
              </div>
            );
          }
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
              {slider ? (
                <input
                  type="range"
                  aria-label={p.etiqueta}
                  min={p.minimo}
                  max={p.maximo}
                  step={p.paso || 'any'}
                  value={Number.isFinite(numberOf(values[p.clave])) ? numberOf(values[p.clave]) : p.defecto}
                  onChange={(e) => onChange({ ...values, [p.clave]: e.target.value })}
                  disabled={disabled}
                  className="col-span-2 h-6 w-full cursor-pointer accent-primary"
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
