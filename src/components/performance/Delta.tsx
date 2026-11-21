import { ArrowDown, ArrowUp } from 'lucide-react';
import type { Change } from '@/domain/performance';
import { cn } from '@/lib/utils/cn';

/**
 * Debajo de un número: cómo cambió contra el período anterior, con flecha.
 * Verde si subió y rojo si bajó; con neutral, sin color, para lo que no es
 * bueno ni malo por sí solo, como una comisión.
 */
export function Delta({ change, previous, neutral, className }: { change: Change | null; previous: string; neutral?: boolean; className?: string }) {
  if (!change) {
    return (
      <p className={cn('mt-0.5 text-[11px] leading-tight text-muted-foreground', className)} title="No hay datos del período anterior para comparar.">
        sin dato
      </p>
    );
  }
  const up = change.dir === 'up';
  const down = change.dir === 'down';
  return (
    <p
      className={cn(
        'mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium leading-tight',
        !neutral && up && 'text-emerald-600 dark:text-emerald-400',
        !neutral && down && 'text-red-600 dark:text-red-400',
        (neutral || (!up && !down)) && 'text-muted-foreground',
        className,
      )}
      title={`Período anterior: ${previous}`}
    >
      {up ? <ArrowUp className="h-3 w-3" aria-label="subió" /> : down ? <ArrowDown className="h-3 w-3" aria-label="bajó" /> : null}
      {change.text}
    </p>
  );
}
