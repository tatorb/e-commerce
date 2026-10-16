'use client';

// Encabezado de la cuenta arriba del sidebar, como en app.studiomrb.com:
//
//   CUENTA
//   Nombre de la cuenta        ▼
//
// Dos destinos distintos: el nombre lleva a los productos de la cuenta y la
// flechita abre el menú para saltar a otra cuenta.

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/cn';

export interface AccountOption {
  slug: string;
  name: string;
}

// Cambiar de cuenta conserva la sección (Productos de una → Productos de
// otra). Las páginas de detalle no existen en la otra cuenta, así que se
// vuelve a la lista.
function accountSwitchHref(pathname: string, slug: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const section = parts[0] === 'a' && parts[2] ? parts[2] : 'productos';
  return `/a/${slug}/${section}`;
}

export function SidebarAccountHeader({
  current,
  accounts,
}: {
  current: AccountOption;
  accounts: AccountOption[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const nameHref = `/a/${current.slug}/productos`;

  return (
    <>
      <div className="pt-2 pb-1 ml-[0.3rem] text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        Cuenta
      </div>
      <div className="flex items-center ml-[0.3rem] -mr-1 pr-1">
        <Link
          href={nameHref}
          className={cn(
            'flex-1 min-w-0 truncate rounded-md py-0.5 pr-2',
            'text-left text-base font-semibold transition-colors',
            'hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          {current.name}
        </Link>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Cambiar de cuenta"
              className={cn(
                'rounded-md p-1 transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-foreground/5',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
            >
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform duration-150', open && 'rotate-180')}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={4}
            className="w-60 max-h-[60vh] overflow-y-auto"
          >
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Cambiar de cuenta
            </DropdownMenuLabel>
            {accounts.map((a) => (
              <DropdownMenuItem key={a.slug} asChild>
                <Link
                  href={accountSwitchHref(pathname, a.slug)}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="truncate">{a.name}</span>
                  {current.slug === a.slug ? <Check className="h-4 w-4" /> : null}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
