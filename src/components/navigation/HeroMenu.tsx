'use client';

import { Fragment } from 'react';
import type * as React from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// El menú de arriba a la derecha de la ficha, con las tres rayitas: los links
// que no hace falta tener siempre a la vista, en grupos. Los de afuera abren
// otra pestaña. Uno sin link se muestra apagado, por ejemplo una medida sin publicar.

export type HeroMenuItem = { href: string | null; label: React.ReactNode; icon?: React.ReactNode; external?: boolean; note?: React.ReactNode };
export type HeroMenuGroup = { title?: string; items: HeroMenuItem[] };

export function HeroMenu({ label, groups }: { label: string; groups: HeroMenuGroup[] }) {
  const shown = groups.filter((g) => g.items.length > 0);
  if (shown.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} title={label} className="-mr-2 -mt-1.5 shrink-0 md:-mr-3">
          <Menu className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]">
        {shown.map((g, i) => (
          <Fragment key={i}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            {g.title ? <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{g.title}</DropdownMenuLabel> : null}
            {g.items.map((item, j) => {
              const inner = (
                <>
                  {item.icon ? <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4" aria-hidden>{item.icon}</span> : null}
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {item.note ? <span className="ml-3 shrink-0 text-xs text-muted-foreground">{item.note}</span> : null}
                </>
              );
              if (!item.href)
                return (
                  <DropdownMenuItem key={j} disabled>
                    {inner}
                  </DropdownMenuItem>
                );
              return (
                <DropdownMenuItem key={j} asChild>
                  {item.external ? (
                    <a href={item.href} target="_blank" rel="noreferrer">
                      {inner}
                    </a>
                  ) : (
                    <Link href={item.href}>{inner}</Link>
                  )}
                </DropdownMenuItem>
              );
            })}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
