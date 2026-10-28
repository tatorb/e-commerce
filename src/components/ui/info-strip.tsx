import Link from 'next/link';
import { ChevronRight, Info } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils/cn';

// Un aviso corto en una franja celeste, con su ícono. Con link, lleva una
// flecha y se toca entera.

export function InfoStrip({
  children,
  href,
  icon,
  className,
}: {
  children: React.ReactNode;
  href?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      <span className="shrink-0 text-sky-700 [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
        {icon ?? <Info />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      {href ? <ChevronRight className="h-4 w-4 shrink-0 text-sky-700" aria-hidden /> : null}
    </>
  );
  const cls = cn('flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-sm text-sky-950', className);
  return href ? (
    <Link href={href} className={cn(cls, 'transition-colors hover:bg-sky-100')}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
