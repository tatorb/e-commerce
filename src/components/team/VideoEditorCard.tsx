'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/pipeline/StatusText';
import { clockOf, EDITOR_MODE_LABEL, EDITOR_MODES, editorSummary, minuteOf, type EditorMode, type EditorSettings } from '@/domain/video-edit';
import { saveVideoEditorAction } from '@/app/equipo/actions';

// Cuándo puede editar videos la Mac del estudio: apagado, prendido o con
// horario. La Mac también se usa para trabajar, y editar video la exige.

const HELP: Record<EditorMode, string> = {
  OFF: 'La Mac no edita videos. Si estaba editando uno, lo deja y vuelve a la cola.',
  ON: 'La Mac edita apenas hay un video en la cola.',
  SCHEDULE: 'La Mac edita solo entre esas dos horas, con la hora de la Mac. Lo que empezó dentro del horario, lo termina.',
};

type QueueItem = { id: string; working: boolean; account: string; product: string; video: string; stage: string | null; percent: number | null };

export function VideoEditorCard({ settings, waiting, queue }: { settings: EditorSettings; waiting: number; queue: QueueItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<EditorMode>(settings.mode);
  const [from, setFrom] = useState(clockOf(settings.fromMinute));
  const [to, setTo] = useState(clockOf(settings.toMinute));
  const [pluggedOnly, setPluggedOnly] = useState(settings.pluggedOnly);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Mientras haya videos en la cola, la lista se pone al día sola.
  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setInterval(() => router.refresh(), 8_000);
    return () => clearInterval(timer);
  }, [queue.length, router]);

  const fromMinute = minuteOf(from);
  const toMinute = minuteOf(to);
  const valid = fromMinute !== null && toMinute !== null && (mode !== 'SCHEDULE' || fromMinute !== toMinute);
  const changed = mode !== settings.mode || fromMinute !== settings.fromMinute || toMinute !== settings.toMinute || pluggedOnly !== settings.pluggedOnly;

  function save() {
    if (fromMinute === null || toMinute === null) return;
    setStatus(null);
    const values = { mode, fromMinute, toMinute, pluggedOnly };
    startTransition(async () => {
      const r = await saveVideoEditorAction(values).catch(() => ({ ok: false as const, error: 'Se cortó la conexión con la app. Probá de nuevo.' }));
      setStatus(r.ok ? { kind: 'ok', text: `Guardado. ${editorSummary(values)}` } : { kind: 'error', text: r.error });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm">
        {editorSummary(settings)}{' '}
        <span className="text-muted-foreground">{waiting === 0 ? 'No hay videos en la cola.' : waiting === 1 ? 'Hay 1 video en la cola.' : `Hay ${waiting} videos en la cola.`}</span>
      </p>
      {queue.length > 0 ? (
        <ol className="divide-y rounded-md border text-sm">
          {queue.map((q, i) => (
            <li key={q.id} className="space-y-1 px-3 py-2">
              <p>
                <span className="text-muted-foreground">{i + 1}.</span> <span className="font-medium">{q.product}</span>{' '}
                <span className="text-muted-foreground">
                  · {q.account} · {q.video}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {q.working ? `Editando${q.stage ? `: ${q.stage}` : ''}${q.percent !== null ? `, ${q.percent} %` : ''}` : 'En cola'}
              </p>
              {q.working && q.percent !== null ? (
                <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-foreground" style={{ width: `${q.percent}%` }} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      <fieldset className="space-y-2">
        <legend className="sr-only">Cuándo edita la Mac</legend>
        {EDITOR_MODES.map((m) => (
          <label key={m} className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="radio" name="modo-editor" className="mt-1" checked={mode === m} onChange={() => setMode(m)} disabled={pending} />
            <span>
              <span className="font-medium">{EDITOR_MODE_LABEL[m]}</span>
              <span className="block text-xs text-muted-foreground">{HELP[m]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {mode === 'SCHEDULE' ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            Desde las
            <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} disabled={pending} className="rounded-md border bg-background px-2 py-1" />
          </label>
          <label className="flex items-center gap-2">
            hasta las
            <input type="time" value={to} onChange={(e) => setTo(e.target.value)} disabled={pending} className="rounded-md border bg-background px-2 py-1" />
          </label>
        </div>
      ) : null}
      {mode !== 'OFF' ? (
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={pluggedOnly} onChange={(e) => setPluggedOnly(e.target.checked)} disabled={pending} />
          <span>
            Solo con la Mac enchufada
            <span className="block text-xs text-muted-foreground">Editar video gasta mucha batería.</span>
          </span>
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={save} pending={pending} disabled={pending || !valid || !changed}>
          Guardar
        </Button>
        <StatusText status={status} />
      </div>
    </div>
  );
}
