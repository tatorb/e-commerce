'use client';

import { useStepAction } from '@/components/pipeline/useStepAction';
import { StatusText } from '@/components/pipeline/StatusText';
import { setVideoMeasureAction } from '@/app/a/[cuenta]/pipeline/video-actions';

// De qué medida del producto es el video. Sale sola del nombre del archivo o
// de cómo se grabó, y acá se cambia. El clip editado queda con la misma.

const ALL = '';

export function VideoMeasureSelect({
  accountSlug,
  videoId,
  measures,
  value,
  source,
}: {
  accountSlug: string;
  videoId: string;
  measures: { key: string; label: string }[];
  value: string | null;
  // De dónde salió: del nombre del archivo, la eligió una persona, o del registro.
  source: 'archivo' | 'persona' | 'registro' | null;
}) {
  const action = useStepAction();
  const hint = value === null ? (source === 'persona' ? null : 'No se encontró la medida en el nombre del archivo.') : source === 'archivo' ? 'Salió del nombre del archivo.' : source === 'registro' ? 'Se grabó con esta medida.' : null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor={`medida-${videoId}`} className="text-muted-foreground">
        Medida
      </label>
      <select
        id={`medida-${videoId}`}
        className="h-8 rounded-md border bg-background px-2 text-sm"
        value={value ?? ALL}
        disabled={action.pending}
        onChange={(e) => action.run(() => setVideoMeasureAction(accountSlug, videoId, e.target.value === ALL ? null : e.target.value))}
      >
        <option value={ALL}>Todas las medidas</option>
        {measures.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      <StatusText status={action.status} />
    </div>
  );
}
