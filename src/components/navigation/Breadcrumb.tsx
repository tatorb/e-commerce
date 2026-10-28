import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Dónde estás: "Insur › Productos › Nuevo producto". El último tramo es texto.
// Va en una sola línea: los tramos largos se cortan con puntos suspensivos.
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Ubicación" className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-xs text-muted-foreground">
      {items.map((it, i) => (
        // Los tramos cortos, como la cuenta o la sección, no se cortan.
        <span key={`${it.label}-${i}`} title={it.label} className={cn('inline-flex min-w-0 items-center gap-1', it.label.length <= 20 && 'shrink-0')}>
          {i > 0 ? <ChevronRight className="h-3 w-3 shrink-0" aria-hidden /> : null}
          {it.href ? (
            <Link href={it.href} className="truncate hover:text-foreground">
              {it.label}
            </Link>
          ) : (
            <span className="truncate text-foreground/80">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
