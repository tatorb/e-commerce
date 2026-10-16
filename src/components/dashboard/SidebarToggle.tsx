'use client';

import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useSidebarToggle } from './SidebarShell';
import { cn } from '@/lib/utils/cn';

// Botón de contraer o expandir el menú. Solo escritorio.
export function SidebarToggle({ className }: { className?: string }) {
  const ctx = useSidebarToggle();
  if (!ctx) return null;
  return (
    <button
      type="button"
      onClick={ctx.toggle}
      title={ctx.collapsed ? 'Expandir menú' : 'Contraer menú'}
      aria-label={ctx.collapsed ? 'Expandir menú' : 'Contraer menú'}
      className={cn(
        'hidden md:inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {ctx.collapsed ? (
        <ChevronsRight className="h-4 w-4" />
      ) : (
        <ChevronsLeft className="h-4 w-4" />
      )}
    </button>
  );
}
