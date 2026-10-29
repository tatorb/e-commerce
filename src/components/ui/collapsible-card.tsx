import { ChevronDown } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { BAND } from './section-card';

// Una tarjeta que se pliega: el título con su ícono y una flecha. Sirve para
// lo largo que no hace falta ver siempre, como la descripción o los datos de
// catálogo. Funciona sin JavaScript. Con aside, un resumen a la derecha del
// título, para ver lo principal sin abrirla; con banded, el título va en la
// franja gris, como en <SectionCard>.

export function CollapsibleCard({
  title,
  icon,
  description,
  defaultOpen = false,
  aside,
  banded,
  id,
  className,
  children,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  defaultOpen?: boolean;
  aside?: React.ReactNode;
  banded?: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen} className={cn('group overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-card', className)}>
      <summary
        className={cn(
          'flex cursor-pointer list-none flex-wrap items-start gap-2.5 px-4 py-3.5 transition-colors md:px-5 [&::-webkit-details-marker]:hidden',
          banded ? cn(BAND, 'hover:bg-border') : 'hover:bg-muted/40',
        )}
      >
        {icon ? <span className="mt-0.5 shrink-0 text-foreground/80 [&_svg]:h-5 [&_svg]:w-5" aria-hidden>{icon}</span> : null}
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold tracking-tight">{title}</span>
          {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
        </span>
        {aside ? <span className="order-last w-full text-sm sm:order-none sm:w-auto sm:pt-0.5">{aside}</span> : null}
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t">{children}</div>
    </details>
  );
}
