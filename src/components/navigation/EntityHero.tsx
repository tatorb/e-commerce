import type * as React from 'react';
import { Thumb } from '@/components/ui/thumb';
import { cn } from '@/lib/utils/cn';

// La ficha de arriba de un producto o de una publicación: la foto chica, la
// seña de qué es, el título, los datos que lo identifican, una fila de cifras
// y las acciones. En el celular las acciones van a lo ancho.

export function EntityHero({
  photo,
  label,
  title,
  meta,
  facts,
  stats,
  actions,
  className,
  children,
}: {
  photo: { src: string | null; alt: string };
  label: React.ReactNode;
  title: React.ReactNode;
  // Lo que lo identifica, en gris: marca, tipo y código, o tienda y código.
  meta?: React.ReactNode;
  // Etiquetas debajo de la foto y el título, a lo ancho.
  facts?: React.ReactNode;
  // Cifras separadas por una línea fina, por ejemplo publicaciones y puntaje.
  stats?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  // Avisos debajo de la ficha, antes de las acciones, como la medida que vende.
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-2xl border bg-card p-4 shadow-card md:p-5', className)}>
      <div className="flex items-start gap-3 md:gap-4">
        <Thumb src={photo.src} alt={photo.alt} size="lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          {label}
          <h1 className="break-words text-xl font-bold leading-tight tracking-tight md:text-2xl">{title}</h1>
          {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : null}
        </div>
      </div>
      {facts ? <div className="mt-3">{facts}</div> : null}
      {stats ? <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3 text-sm">{stats}</div> : null}
      {children ? <div className="mt-3 space-y-2">{children}</div> : null}
      {/* En el celular, cada acción a lo ancho. */}
      {actions ? <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap [&_button]:w-full sm:[&_button]:w-auto [&>a]:w-full sm:[&>a]:w-auto">{actions}</div> : null}
    </div>
  );
}

/** Una cifra de la fila de la ficha: su ícono, el número y lo que es. */
export function HeroStat({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-foreground">
      {icon ? <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4" aria-hidden>{icon}</span> : null}
      {children}
    </span>
  );
}
