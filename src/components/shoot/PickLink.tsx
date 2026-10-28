import Link from 'next/link';
import type * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/** Una opción para elegir antes de empezar el registro: la medida o el protocolo. */
export function PickLink({
  href,
  title,
  description,
  note,
  icon,
  onClick,
  busy,
}: {
  href: string;
  title: string;
  description?: string | null;
  note?: string;
  icon?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  // Mientras se prepara lo que pasa al elegirla.
  busy?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-busy={busy || undefined}
      className={cn('flex min-h-14 items-center gap-3 rounded-lg border bg-background px-4 py-3 hover:bg-muted', busy && 'pointer-events-none opacity-60')}
    >
      {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {description ? <span className="block text-sm text-muted-foreground">{description}</span> : null}
        {note ? <span className="block text-xs text-muted-foreground">{note}</span> : null}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
