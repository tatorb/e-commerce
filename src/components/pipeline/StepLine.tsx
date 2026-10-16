import { Check } from 'lucide-react';
import { PIPELINE_STEPS, PIPELINE_STEP_LABEL } from '@/domain/pipeline';
import type { PipelineStep } from '@/generated/prisma/enums';
import { cn } from '@/lib/utils/cn';

// La línea de los siete pasos, con el actual marcado. "active" es falso si la
// publicación no está en el pipeline: el paso guardado se ve apagado.
export function StepLine({ current, active, done }: { current: PipelineStep | null; active: boolean; done?: boolean }) {
  const at = current ? PIPELINE_STEPS.indexOf(current) : done ? PIPELINE_STEPS.length : -1;
  return (
    <ol
      className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:gap-y-2 md:overflow-visible md:px-0"
      aria-label="Pasos del pipeline"
    >
      {PIPELINE_STEPS.map((step, i) => {
        const isCurrent = i === at;
        const isDone = i < at;
        return (
          <li key={step} className="flex shrink-0 items-center gap-2" aria-current={isCurrent && active ? 'step' : undefined}>
            {i > 0 ? <span aria-hidden className={cn('h-px w-4', isDone || isCurrent ? 'bg-primary/50' : 'bg-border')} /> : null}
            <span
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
                isCurrent && active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isCurrent
                    ? 'border-primary/50 text-primary'
                    : isDone
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground',
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                'text-sm whitespace-nowrap',
                isCurrent ? 'font-semibold text-foreground' : isDone ? 'text-foreground/80' : 'text-muted-foreground',
              )}
            >
              {PIPELINE_STEP_LABEL[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
