import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Encabezado de página. Copiado de app.studiomrb.com. Se pega arriba del
 * área que scrollea, pinta su borde inferior de lado a lado y usa todo el
 * ancho, con los mismos márgenes que <PageBody>.
 *
 * Convención: título (h1 + subtítulo) primero y la fila de acciones después.
 */
export function PageHeader({
  children,
  className,
  staticOnMobile = false,
}: {
  children: React.ReactNode;
  className?: string;
  staticOnMobile?: boolean;
}) {
  return (
    <div
      // Para lo que queda fijo debajo de él, como los títulos de una tabla.
      data-page-header=""
      className={cn(
        'w-full bg-background border-b',
        staticOnMobile ? 'md:sticky md:top-0 md:z-20' : 'sticky top-0 z-20',
      )}
    >
      <div
        className={cn(
          'w-full flex flex-col gap-3 md:gap-5 px-4 md:px-6 lg:px-8 2xl:px-10 py-4 md:py-5',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
