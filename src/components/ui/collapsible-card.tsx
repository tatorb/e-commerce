import { ChevronDown } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils/cn';

// Una tarjeta que se pliega: el título con su ícono y una flecha. Sirve para
// lo largo que no hace falta ver siempre, como la descripción o los datos de
// catálogo. Funciona sin JavaScript.

export function CollapsibleCard({
  title,
  icon,
  description,
  defaultOpen = false,
  id,
  className,
  children,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  defaultOpen?: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen} className={cn('group overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-card', className)}>
      <summary className="flex cursor-pointer list-none items-start gap-2.5 px-4 py-3.5 transition-colors hover:bg-muted/40 md:px-5 [&::-webkit-details-marker]:hidden">
        {icon ? <span className="mt-0.5 shrink-0 text-foreground/80 [&_svg]:h-5 [&_svg]:w-5" aria-hidden>{icon}</span> : null}
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold tracking-tight">{title}</span>
          {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
        </span>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t">{children}</div>
    </details>
  );
}
