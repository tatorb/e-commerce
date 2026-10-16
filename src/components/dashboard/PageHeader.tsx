import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Encabezado de página. Copiado de app.studiomrb.com. Se pega arriba del
 * área que scrollea, pinta su borde inferior de lado a lado y centra el
 * contenido con el mismo `max-w-7xl` y padding que <PageBody>.
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
      className={cn(
        'w-full bg-background border-b',
        staticOnMobile ? 'md:sticky md:top-0 md:z-20' : 'sticky top-0 z-20',
      )}
    >
      <div
        className={cn(
          'mx-auto w-full max-w-7xl flex flex-col gap-3 md:gap-5 px-4 md:px-6 lg:px-8 py-4 md:py-5',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
