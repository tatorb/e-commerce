import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Cuerpo de página bajo <PageHeader>. Copiado de app.studiomrb.com. Las
 * páginas angostas (formularios, ajustes) pasan por ejemplo `max-w-3xl`.
 */
export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex-1 min-h-0">
      <div
        className={cn(
          'mx-auto w-full max-w-7xl flex flex-col gap-4 md:gap-6 px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
