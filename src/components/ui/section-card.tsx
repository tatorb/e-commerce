import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { BAND } from './band';
import { CollapsibleCard } from './collapsible-card';

// Tarjeta de sección: blanca, redondeada y con una sombra suave. Arriba, en
// una franja gris, el título con su ícono, la cantidad, una descripción corta
// y la acción principal a la derecha. La franja va en todas las tarjetas de
// la app, para ver dónde empieza cada una; banded={false} la saca. Con
// collapsible, la tarjeta se pliega desde el título, con su flecha a la
// derecha: para historiales y registros que se consultan de vez en cuando.
// Cerrada al empezar, salvo con defaultOpen.

export function SectionCard({
  title,
  icon,
  count,
  description,
  action,
  id,
  banded = true,
  collapsible,
  defaultOpen,
  className,
  children,
}: {
  title: React.ReactNode;
  // Para llevar a esta tarjeta desde un link con #.
  id?: string;
  // Un ícono de lucide-react, por ejemplo <Tag />.
  icon?: React.ReactNode;
  count?: number | null;
  description?: React.ReactNode;
  action?: React.ReactNode;
  banded?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  if (collapsible) {
    return (
      <CollapsibleCard id={id} title={title} icon={icon} count={count} description={description} aside={action} banded={banded} defaultOpen={defaultOpen} className={className}>
        {children}
      </CollapsibleCard>
    );
  }
  return (
    <section id={id} className={cn('scroll-mt-20 overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-card', className)}>
      <header className={cn('flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3.5 md:px-5', banded && BAND)}>
        <div className="flex min-w-0 items-start gap-2.5">
          {icon ? <span className="mt-0.5 shrink-0 text-foreground/80 [&_svg]:h-5 [&_svg]:w-5" aria-hidden>{icon}</span> : null}
          <div className="min-w-0">
            <h2 className="flex items-baseline gap-2 text-base font-semibold tracking-tight">
              {title}
              {count ? <span className="text-xs font-normal tabular-nums text-muted-foreground">{count}</span> : null}
            </h2>
            {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export { BAND };

/** El cuerpo de una sección con formulario o texto. */
export function SectionBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('space-y-4 px-4 py-4 md:px-5', className)}>{children}</div>;
}

/** Encabezado chico para una lista dentro de una sección. */
export function SubHeader({
  title,
  count,
  action,
}: {
  title: React.ReactNode;
  count?: number | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
      <h3 className="flex items-baseline gap-2 text-sm font-semibold tracking-tight">
        {title}
        {count ? <span className="text-xs font-normal tabular-nums text-muted-foreground">{count}</span> : null}
      </h3>
      {action}
    </div>
  );
}

/** Botón de ícono chico para las filas: subir, bajar, editar. */
export const IconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  ({ label, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = 'IconButton';
