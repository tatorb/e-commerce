import { cn } from '@/lib/utils/cn';
import { scoreBand, type ScoreBand } from '@/domain/standard';

// Pill neutro con punto de color, como la clasificación en app.studiomrb.com.
// Los colores del punto salen de ahí: verde, amarillo, rosa y gris.
const DOT: Record<ScoreBand, string> = {
  high: 'bg-[hsl(145_26%_70%)]',
  mid: 'bg-[#e6cf95]',
  low: 'bg-[hsl(6_38%_73%)]',
  none: 'bg-[hsl(0_0%_82%)]',
};

export function ScoreDot({ band, className }: { band: ScoreBand; className?: string }) {
  return <span aria-hidden className={cn('inline-block h-2.5 w-2.5 rounded-full shrink-0', DOT[band], className)} />;
}

export function ScoreBadge({ score, className }: { score: number | null; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground tabular-nums',
        className,
      )}
      title={score === null ? 'Sin reglas que apliquen' : `Puntaje ${score} de 100`}
    >
      <ScoreDot band={scoreBand(score)} />
      {score === null ? '—' : score}
    </span>
  );
}
