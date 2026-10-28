import { cn } from '@/lib/utils/cn';
import { scoreBand, type ScoreBand } from '@/domain/standard';

// Pill con punto de color, como la clasificación en app.studiomrb.com. Los
// colores del punto salen de ahí: verde, amarillo, rosa y gris. El fondo lleva
// un tono suave del mismo color, así el puntaje bajo se ve de lejos.
const DOT: Record<ScoreBand, string> = {
  high: 'bg-[hsl(145_26%_70%)]',
  mid: 'bg-[#e6cf95]',
  low: 'bg-[hsl(6_38%_73%)]',
  none: 'bg-[hsl(0_0%_82%)]',
};

export function ScoreDot({ band, className }: { band: ScoreBand; className?: string }) {
  return <span aria-hidden className={cn('inline-block h-2.5 w-2.5 rounded-full shrink-0', DOT[band], className)} />;
}

const TONE: Record<ScoreBand, string> = {
  high: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  mid: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-rose-200 bg-rose-50 text-rose-700',
  none: 'border-border bg-muted text-muted-foreground',
};

export function ScoreBadge({ score, className }: { score: number | null; className?: string }) {
  const band = scoreBand(score);
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums', TONE[band], className)}
      title={score === null ? 'Sin reglas que apliquen' : `Puntaje ${score} de 100`}
    >
      <ScoreDot band={band} />
      {score === null ? '—' : score}
    </span>
  );
}
