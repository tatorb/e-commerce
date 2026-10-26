import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Cuerpo de página bajo <PageHeader>. Copiado de app.studiomrb.com. Usa todo
 * el ancho, con márgenes a los costados.
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
          'w-full flex flex-col gap-4 md:gap-6 px-4 md:px-6 lg:px-8 2xl:px-10 pt-4 md:pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
