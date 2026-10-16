'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';

// Ítem del menú, copiado de app.studiomrb.com. El activo usa bg-card text-primary.
export function NavLink({
  href,
  label,
  badge,
  exact,
  matches,
  disabled,
  children,
}: {
  href: string;
  label: string;
  badge?: number;
  exact?: boolean;
  matches?: string[];
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active =
    (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)) ||
    (matches ?? []).some((m) => pathname === m || pathname.startsWith(`${m}/`));

  const content = (
    <>
      <span className="flex items-center gap-2">
        {children}
        {/* El texto se oculta cuando el menú está contraído (md+). */}
        <span className="md:group-data-[collapsed=true]:hidden">{label}</span>
      </span>
      {badge && badge > 0 ? (
        <>
          <Badge
            variant="alert"
            className="h-5 px-2 md:group-data-[collapsed=true]:hidden"
          >
            {badge}
          </Badge>
          <span className="hidden md:group-data-[collapsed=true]:block absolute top-1 right-2 h-2 w-2 rounded-full bg-alert" />
        </>
      ) : null}
    </>
  );

  const collapseLayout =
    'relative md:group-data-[collapsed=true]:justify-center md:group-data-[collapsed=true]:px-2';

  if (disabled) {
    return (
      <span
        aria-disabled
        className={cn(
          'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/50 cursor-not-allowed select-none',
          collapseLayout,
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        collapseLayout,
        active
          ? 'bg-card text-primary'
          : 'text-foreground/70 hover:bg-accent/50 hover:text-foreground',
      )}
    >
      {content}
    </Link>
  );
}
