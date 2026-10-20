import * as React from 'react';
import { MobileTopBar } from '@/components/dashboard/MobileTopBar';
import { MainArea } from '@/components/dashboard/MainArea';
import { NavigationProgress } from '@/components/dashboard/NavigationProgress';

interface AppShellProps {
  sidebar: React.ReactNode;
  homeHref: string;
  children: React.ReactNode;
}

// Estructura de pantalla de app.studiomrb.com: barra lateral, área central
// que scrollea y, en el celular, barra superior con el menú en un cajón.
// La columna central no tiene padding ni ancho máximo: de eso se ocupan
// <PageHeader> y <PageBody>.
export function AppShell({ sidebar, homeHref, children }: AppShellProps) {
  return (
    <div className="h-[100dvh] md:h-screen flex flex-col md:flex-row bg-background overflow-hidden">
      <React.Suspense fallback={null}>
        <NavigationProgress />
      </React.Suspense>
      <div className="hidden md:flex">{sidebar}</div>
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        <MobileTopBar sidebar={sidebar} homeHref={homeHref} />
        {/* overflow-x-hidden: la página nunca scrollea en horizontal. Las
            tablas anchas scrollean dentro de su propio contenedor. */}
        <MainArea>{children}</MainArea>
      </div>
    </div>
  );
}
