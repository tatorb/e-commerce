'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

// Copiado de app.studiomrb.com. Contexto para que el botón de contraer
// (SidebarToggle) viva en el renglón del logo.
interface SidebarCtx {
  collapsed: boolean;
  toggle: () => void;
}
const Ctx = createContext<SidebarCtx | null>(null);
export function useSidebarToggle(): SidebarCtx | null {
  return useContext(Ctx);
}

// Shell del sidebar de escritorio: contraer y expandir (se recuerda en una
// cookie, leída en el servidor para que no parpadee) y el "peek" al pasar el
// mouse. El contraído es solo de escritorio (md+): en el celular el sidebar
// vive en el cajón y siempre se ve completo.
const COOKIE = 'sidebar_collapsed';

export function SidebarShell({
  initialCollapsed,
  className,
  children,
}: {
  initialCollapsed: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [peek, setPeek] = useState(false);
  const narrow = collapsed && !peek;

  function toggle() {
    setPeek(false);
    setCollapsed((c) => {
      const next = !c;
      try {
        document.cookie = `${COOKIE}=${next ? '1' : '0'};path=/;max-age=31536000;samesite=lax`;
      } catch {
        /* noop */
      }
      return next;
    });
  }

  return (
    <div
      className={cn(
        'relative h-full w-full shrink-0 transition-[width] duration-200',
        collapsed ? 'md:w-16' : 'md:w-64',
      )}
      onMouseEnter={() => {
        if (collapsed) setPeek(true);
      }}
      onMouseLeave={() => setPeek(false)}
    >
      <aside
        data-collapsed={narrow ? 'true' : 'false'}
        className={cn(
          // overflow-hidden y no auto: scrollean las regiones de adentro, no
          // la tira entera. En el cajón del celular sí scrollea la tira.
          'group flex h-full w-full flex-col overflow-y-auto md:overflow-hidden border-r bg-background py-6 px-3',
          'md:absolute md:inset-y-0 md:left-0 transition-[width] duration-200',
          narrow ? 'md:w-16 md:px-2' : 'md:w-64 md:px-3',
          collapsed && peek ? 'md:z-40 md:shadow-2xl' : '',
          className,
        )}
      >
        <Ctx.Provider value={{ collapsed, toggle }}>{children}</Ctx.Provider>
      </aside>
    </div>
  );
}
