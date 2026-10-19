import * as React from 'react';
import { cn } from '@/lib/utils/cn';

// Tarjeta de sección con el encabezado gris de app.studiomrb.com
// (src/components/inbound/catalogUi.tsx, CatalogSection): título, cantidad,
// descripción corta y la acción principal a la derecha.

export function SectionCard({
  title,
  count,
  description,
  action,
  className,
  children,
}: {
  title: React.ReactNode;
  count?: number | null;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={cn('overflow-hidden rounded-lg border', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/50 px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-baseline gap-2 text-base font-semibold tracking-tight">
            {title}
            {count ? <span className="text-xs font-normal tabular-nums text-muted-foreground">{count}</span> : null}
          </h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** El cuerpo de una sección con formulario o texto. */
export function SectionBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('space-y-4 px-4 py-4', className)}>{children}</div>;
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
    <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2.5">
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
