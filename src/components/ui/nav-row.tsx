import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils/cn';

// Una fila que lleva a otro lado: su ícono, el nombre chico arriba, el valor
// abajo y una flecha. Se toca entera.

export function NavRow({
  href,
  icon,
  label,
  value,
  className,
}: {
  href: string;
  icon?: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn('flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 md:px-5', className)}>
      {icon ? <span className="shrink-0 text-foreground/80 [&_svg]:h-5 [&_svg]:w-5" aria-hidden>{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block truncate font-medium">{value}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
