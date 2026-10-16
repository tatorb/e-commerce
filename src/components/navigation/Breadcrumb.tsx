import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

// Dónde estás: "Insur › Productos › Nuevo producto". El último tramo es texto.
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Ubicación" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      {items.map((it, i) => (
        <span key={`${it.label}-${i}`} className="inline-flex items-center gap-1 min-w-0">
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
