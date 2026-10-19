import { cn } from '@/lib/utils/cn';
import { formatDuration } from '@/lib/format';
import type { WorkerState } from '@/lib/image-worker';

// El estado del trabajador de imágenes en una línea: un punto de color y qué pasa.

export function workerStatusText(state: WorkerState, now: Date): { tone: 'ok' | 'warn' | 'off'; text: string } {
  if (state.kind === 'none') return { tone: 'off', text: 'Sin configurar: falta crear su llave en Equipo.' };
  if (state.kind === 'never') return { tone: 'warn', text: 'Tiene llave, pero todavía no se conectó desde la Mac.' };
  if (state.kind === 'connected') return { tone: 'ok', text: 'Conectado.' };
  return { tone: 'warn', text: `Desconectado desde hace ${formatDuration(state.lastSeenAt!, now)}.` };
}

export function WorkerStatusLine({ state, now, className }: { state: WorkerState; now: Date; className?: string }) {
  const { tone, text } = workerStatusText(state, now);
  const aviso = state.kind !== 'none' ? state.info.aviso : null;
  return (
    <div className={cn('space-y-0.5 text-sm', className)}>
      <p className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'inline-block h-2 w-2 shrink-0 rounded-full',
            tone === 'ok' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-muted-foreground/40',
          )}
        />
        <span>
          <span className="font-medium">Trabajador de imágenes:</span> {text}
        </span>
      </p>
      {aviso ? <p className="pl-4 text-xs text-amber-700">{aviso}</p> : null}
    </div>
  );
}
