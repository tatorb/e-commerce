'use client';

import { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { Eye } from 'lucide-react';
import { can, sectionFromPath, SECTIONS, type Permissions, type Section } from '@/domain/access';

// Lo que puede la persona, para la pantalla: en una sección que solo puede
// ver, los botones que guardan quedan apagados y arriba se avisa. Lo que
// manda es el servidor: esto es para que no toque botones que no van a andar.

type AccessValue = { isAdmin: boolean; permissions: Permissions };

const AccessContext = createContext<AccessValue | null>(null);

// El aviso en cada botón apagado.
export const READ_ONLY_HINT = 'Tu usuario solo puede ver esta sección.';

/**
 * Si un botón queda apagado. "view" es un botón que solo mira, como buscar o
 * ver un video. Sin decir nada, pide poder cambiar en la sección de la pantalla.
 */
export function useReadOnly(need?: 'view' | Section): boolean {
  const access = useContext(AccessContext);
  const pathname = usePathname();
  if (!access || need === 'view') return false;
  const section = need ?? sectionFromPath(pathname);
  return section ? !can(access, section, 'write') : false;
}

function ReadOnlyBanner() {
  const access = useContext(AccessContext);
  const pathname = usePathname();
  const section = sectionFromPath(pathname);
  if (!access || !section || can(access, section, 'write')) return null;
  return (
    <p role="note" className="flex items-center gap-2 border-b bg-muted px-4 py-2 text-xs text-muted-foreground md:px-8">
      <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Solo podés ver {SECTIONS[section].label}: los botones que guardan están apagados.
    </p>
  );
}

export function AccessProvider({ access, children }: { access: AccessValue; children: React.ReactNode }) {
  return (
    <AccessContext.Provider value={access}>
      <ReadOnlyBanner />
      {children}
    </AccessContext.Provider>
  );
}
