import Link from 'next/link';
import type * as React from 'react';
import { cn } from '@/lib/utils/cn';

// Pestañas con una raya debajo de la elegida. Si no entran a lo ancho, se
// corren de costado. Cada una es un link, así la elegida queda en la dirección.

/** Las clases de una pestaña, para usarlas también en botones. */
export function tabClass(active: boolean): string {
  return cn(
    '-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 pb-2.5 pt-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
  );
}

/** El número al lado del nombre de la pestaña. */
export function TabCount({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className={cn('rounded-full px-1.5 text-[11px] font-semibold tabular-nums', active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}>
      {children}
    </span>
  );
}

/** La fila de pestañas, con la línea de abajo de lado a lado. */
export const TAB_ROW = 'flex w-full gap-5 overflow-x-auto border-b [scrollbar-width:none]';

export function TabLinks({
  label,
  items,
  className,
}: {
  label: string;
  items: { key: string; href: string; label: React.ReactNode; active: boolean; count?: number | null }[];
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn(TAB_ROW, className)}>
      {items.map((t) => (
        <Link key={t.key} href={t.href} role="tab" aria-selected={t.active} className={tabClass(t.active)}>
          {t.label}
          {t.count ? <TabCount active={t.active}>{t.count}</TabCount> : null}
        </Link>
      ))}
    </div>
  );
}
