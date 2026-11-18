'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Hourglass, Loader2, RotateCcw, Scissors, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NOTE_MAX, planSeconds, TARGET_DEFAULT, type VideoPlan } from '@/domain/video-edit';
import { approveVideoEditAction, discardVideoEditAction, redoVideoEditAction, requestVideoEditAction } from '@/app/a/[cuenta]/pipeline/video-actions';
import type { EditRow } from '@/lib/video-edits';
import type { VideoRow } from '@/lib/videos';
import { VideoFacts, VideoPlayer } from './VideoCard';
import { VideoPlanEditor } from './VideoPlanEditor';

// La edición de un video del producto: pedirla, ver cómo va y, cuando la Mac
// deja el clip, mirarlo y aprobarlo o pedirlo de nuevo.

export type EditorInfo = {
  summary: string;
  connected: boolean;
  hasKey: boolean;
  off: boolean;
  // Los pasos de video de los protocolos de la cuenta, el que vale si el video no dice el suyo, y si la cuenta tiene voz en off.
  steps: { id: string; label: string; moments: number }[];
  defaultStepId: string | null;
  hasVoice: boolean;
};

type Ask = { targetSeconds: number; note: string; stepId?: string | null };
type ActionResult = { ok: true } | { ok: false; error: string };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const speed = (v: number) => (Math.abs(v - 1) < 0.01 ? 'velocidad normal' : `${String(Math.round(v * 10) / 10).replace('.', ',')} veces más rápido`);

/** El formulario para pedir una edición: cuánto tiene que durar y una indicación para el editor. */
function AskForm({
  range,
  initial,
  steps,
  submitLabel,
  pending,
  onSubmit,
}: {
  range: { min: number; max: number };
  initial: Ask;
  // Los pasos de video para elegir con cuál se grabó. Null: no se pregunta.
  steps: { id: string; label: string; moments: number }[] | null;
  submitLabel: string;
  pending: boolean;
  onSubmit: (ask: Ask) => void;
}) {
  const [seconds, setSeconds] = useState(String(initial.targetSeconds));
  const [note, setNote] = useState(initial.note);
  const [stepId, setStepId] = useState(initial.stepId ?? '');
  const n = Number(seconds);
  const valid = Number.isFinite(n) && n >= range.min && n <= range.max;
  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Cuánto tiene que durar el clip, en segundos</span>
        <input
          type="number"
          inputMode="numeric"
          min={range.min}
          max={range.max}
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
          className="w-24 rounded-md border bg-background px-2 py-1 text-sm"
        />
        <span className="block text-xs text-muted-foreground">
          De {range.min} a {range.max}.
        </span>
      </label>
      {steps && steps.length > 0 ? (
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Con qué paso del protocolo se grabó</span>
          <select value={stepId} onChange={(e) => setStepId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
            <option value="">Ninguno: el editor marca los momentos por lo que ve</option>
            {steps.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
                {st.moments === 0 ? ' (sin momentos)' : ''}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Indicación para el editor, si hace falta</span>
        <textarea
          value={note}
          maxLength={NOTE_MAX}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Por ejemplo: que se lea bien la etiqueta de la caja."
          className="w-full rounded-md border bg-background px-2 py-1 text-sm"
        />
      </label>
      <div className="flex justify-end">
        <Button size="sm" pending={pending} disabled={pending || !valid} onClick={() => onSubmit({ targetSeconds: Math.round(n), note, ...(steps ? { stepId: stepId || null } : {}) })}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

/** El plan en palabras: cada tramo del original y a qué velocidad va. */
function PlanSummary({ plan }: { plan: VideoPlan }) {
  return (
    <ol className="space-y-0.5 text-xs text-muted-foreground">
      {plan.tramos.map((t, i) => (
        <li key={`${t.inicio}-${i}`}>
          {clock(t.inicio)} a {clock(t.fin)}
          {t.nombre && t.nombre !== 'Todo' ? `, ${t.nombre}` : ''}: {speed(t.velocidad)}
        </li>
      ))}
      {plan.cierre > 0 ? <li>Al final, {String(plan.cierre).replace('.', ',')} segundos con la imagen quieta.</li> : null}
    </ol>
  );
}

export function VideoEditPanel({
  accountSlug,
  video,
  edit,
  clip,
  editor,
  range,
}: {
  accountSlug: string;
  video: VideoRow;
  // La última edición del video, si tiene.
  edit: EditRow | null;
  // El clip que dejó esa edición, si sigue en la carpeta.
  clip: VideoRow | null;
  editor: EditorInfo;
  // Cuánto puede durar el clip, en segundos.
  range: { min: number; max: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<'ask' | 'redo' | 'discard' | null>(null);
  const [watching, setWatching] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiting = edit?.status === 'QUEUED' || edit?.status === 'PROCESSING';

  // Mientras la Mac trabaja, la pantalla se pone al día sola.
  useEffect(() => {
    if (!waiting) return;
    // Mientras lo edita, más seguido, para ver el avance.
    const timer = setInterval(() => router.refresh(), edit?.status === 'PROCESSING' ? 6_000 : 20_000);
    return () => clearInterval(timer);
  }, [waiting, router, edit?.status]);

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const r = await action().catch(() => ({ ok: false as const, error: 'Se cortó la conexión con la app. Probá de nuevo.' }));
      if (!r.ok) setError(r.error);
      setOpen(null);
      router.refresh();
    });
  }

  const initial: Ask = {
    targetSeconds: edit?.targetSeconds ?? Math.min(Math.max(TARGET_DEFAULT, range.min), range.max),
    note: '',
    stepId: video.stepId ?? editor.defaultStepId,
  };
  // Lo que falta para que la Mac lo tome, dicho antes de pedirlo.
  const macNote = !editor.hasKey
    ? 'El trabajador de la Mac todavía no tiene llave: se crea en Equipo.'
    : editor.off
      ? 'La edición de videos está apagada: se prende en Equipo. El video queda en la cola hasta entonces.'
      : !editor.connected
        ? 'La Mac no está conectada ahora: el video queda en la cola hasta que se conecte.'
        : null;

  const askButton = (label: string, key: 'ask' | 'redo', submit: (ask: Ask) => Promise<ActionResult>, variant: 'outline' | 'ghost' = 'outline') => (
    <Popover open={open === key} onOpenChange={(o) => setOpen(o ? key : null)}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={variant} disabled={pending}>
          {key === 'ask' ? <Scissors /> : <RotateCcw />}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 max-w-[calc(100vw-2rem)] space-y-3 p-4">
        <p className="text-sm">
          La Mac del estudio gira el video a vertical, corrige la luz y el color, lo acelera para que dure lo pedido y le saca el sonido. El original no se toca.
        </p>
        {macNote ? <p className="text-xs text-muted-foreground">{macNote}</p> : null}
        <AskForm range={range} initial={initial} steps={key === 'ask' ? editor.steps : null} submitLabel={label} pending={pending} onSubmit={(ask) => run(() => submit(ask))} />
      </PopoverContent>
    </Popover>
  );

  const discardButton = (label: string, text: string) =>
    edit ? (
      <Popover open={open === 'discard'} onOpenChange={(o) => setOpen(o ? 'discard' : null)}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" disabled={pending}>
            <X />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4">
          <p className="text-sm">{text}</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(null)} disabled={pending}>
              Volver
            </Button>
            <Button size="sm" variant="destructive" pending={pending} disabled={pending} onClick={() => run(() => discardVideoEditAction(accountSlug, edit.id))}>
              {label}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    ) : null;

  const errorLine = error ? (
    <p role="status" className="text-sm text-destructive">
      {error}
    </p>
  ) : null;

  // Lo que dice la voz y cómo se editó: se ve mientras el clip espera la aprobación y también después.
  const scriptAndPlan = edit ? (
    <>
      {edit.sound ? (
        <p className="text-xs text-muted-foreground">
          {[edit.sound.voz ? 'Con voz en off' : null, edit.sound.musica ? 'con música' : null, edit.sound.subtitulos ? 'con subtítulos' : null].filter(Boolean).join(', ') || 'Sin sonido'}.
        </p>
      ) : null}
      {edit.script.length > 0 ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Lo que dice la voz</summary>
          <ol className="space-y-0.5 pt-1 text-muted-foreground">
            {edit.script.map((line) => (
              <li key={line.inicio}>
                {clock(line.inicio)}: {line.texto}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {edit.plan ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Cómo se editó, {Math.round(planSeconds(edit.plan))} segundos</summary>
          <div className="pt-1">
            <PlanSummary plan={edit.plan} />
          </div>
        </details>
      ) : null}
    </>
  ) : null;

  if (!edit || edit.status === 'APPROVED') {
    return (
      <div className="space-y-2">
        {edit ? (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <p className="flex items-center gap-1 text-sm">
              <Check className="h-4 w-4" aria-hidden />
              Ya tiene un clip editado y aprobado{clip ? `: ${clip.name}` : ''}. Se sube al canal desde Por subir, cuando quieras.
            </p>
            {scriptAndPlan}
            {adjusting && edit.plan ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Al rehacerlo sale un clip nuevo para revisar. El aprobado queda en la lista hasta que lo mandes a la papelera.
                </p>
                <VideoPlanEditor
                  plan={edit.plan}
                  range={range}
                  pending={pending}
                  onSubmit={(ask) => run(() => requestVideoEditAction(accountSlug, video.id, { targetSeconds: edit.targetSeconds, plan: ask.plan }))}
                />
              </>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {edit?.plan ? (
            <Button access="view" size="sm" variant="outline" onClick={() => setAdjusting((a) => !a)} disabled={pending}>
              <SlidersHorizontal />
              {adjusting ? 'Cerrar los cortes' : 'Ajustar los cortes'}
            </Button>
          ) : null}
          {askButton(edit ? 'Editar de nuevo' : 'Editar para clip', 'ask', (ask) => requestVideoEditAction(accountSlug, video.id, ask), edit ? 'ghost' : 'outline')}
        </div>
        {errorLine}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      {edit.status === 'QUEUED' ? (
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Hourglass className="h-4 w-4" aria-hidden />
            En la cola del editor
          </p>
          <p className="text-xs text-muted-foreground">{macNote ?? editor.summary}</p>
          {edit.error ? <p className="text-xs text-muted-foreground">El intento anterior no terminó: {edit.error}</p> : null}
        </div>
      ) : null}

      {edit.status === 'PROCESSING' ? (
        <div className="space-y-1.5 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            La Mac lo está editando
          </p>
          {edit.progress ? (
            <>
              <p className="text-xs text-muted-foreground">
                {edit.progress.stage}
                {edit.progress.percent !== null ? `, ${edit.progress.percent} %` : ''}
              </p>
              {edit.progress.percent !== null ? (
                <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={edit.progress.percent} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${edit.progress.percent}%` }} />
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Recién lo tomó.</p>
          )}
        </div>
      ) : null}

      {edit.status === 'FAILED' ? (
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            No se pudo editar
          </p>
          {edit.error ? <p className="text-xs text-muted-foreground">{edit.error}</p> : null}
        </div>
      ) : null}

      {edit.status === 'REVIEW' ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium">El clip está listo para revisar</p>
          {clip ? <VideoFacts video={clip} /> : <p className="text-xs text-destructive">El clip ya no está en la carpeta del Drive: pedilo de nuevo.</p>}
          {edit.reason ? (
            <p className="text-xs text-muted-foreground">
              {edit.origin === 'claude' ? 'Claude: ' : ''}
              {edit.reason}
            </p>
          ) : null}
          {scriptAndPlan}
          {edit.warnings.length > 0 ? (
            <ul className="space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
              {edit.warnings.map((w) => (
                <li key={w} className="flex items-start gap-1">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          ) : null}
          {watching && clip ? <VideoPlayer accountSlug={accountSlug} video={clip} /> : null}
          {adjusting && edit.plan ? (
            <VideoPlanEditor
              plan={edit.plan}
              range={range}
              pending={pending}
              onSubmit={(ask) => run(() => redoVideoEditAction(accountSlug, edit.id, { targetSeconds: edit.targetSeconds, plan: ask.plan }))}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {edit.status === 'REVIEW' && clip ? (
          <>
            <Button access="view" size="sm" variant="outline" onClick={() => setWatching((w) => !w)}>
              {watching ? 'Cerrar el clip' : 'Ver el clip'}
            </Button>
            <Button size="sm" pending={pending && open === null} disabled={pending} onClick={() => run(() => approveVideoEditAction(accountSlug, edit.id))}>
              <Check />
              Aprobar
            </Button>
          </>
        ) : null}
        {edit.status === 'REVIEW' && edit.plan ? (
          <Button access="view" size="sm" variant="outline" onClick={() => setAdjusting((a) => !a)} disabled={pending}>
            <SlidersHorizontal />
            {adjusting ? 'Cerrar los cortes' : 'Ajustar los cortes'}
          </Button>
        ) : null}
        {edit.status === 'REVIEW' || edit.status === 'FAILED'
          ? askButton('Pedir de nuevo', 'redo', (ask) => redoVideoEditAction(accountSlug, edit.id, { targetSeconds: ask.targetSeconds, note: ask.note }))
          : null}
        {edit.status === 'REVIEW'
          ? discardButton('Descartar el clip', 'El clip va a la papelera del Drive. El video original queda como está.')
          : discardButton(edit.status === 'FAILED' ? 'Descartar' : 'Sacar de la cola', edit.status === 'PROCESSING' ? 'La Mac deja de editarlo. El video original queda como está.' : 'El video sale de la cola del editor. El original queda como está.')}
      </div>
      {errorLine}
    </div>
  );
}
