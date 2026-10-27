'use client';

import { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { can, sectionFromPath, type Permissions, type Section } from '@/domain/access';

// Lo que puede la persona, para la pantalla: en una sección que solo puede
// ver, los botones que guardan quedan apagados, sin más aviso. Lo que manda
// es el servidor: esto es para que no toque botones que no van a andar.

type AccessValue = { isAdmin: boolean; permissions: Permissions };

const AccessContext = createContext<AccessValue | null>(null);

// El aviso en cada botón apagado.
export const READ_ONLY_HINT = 'Tu usuario solo puede ver esta sección.';

/**
 * Si un botón queda apagado. "view" es un botón que solo mira, como buscar o
 * ver un video. Sin decir nada, pide poder cambiar en la sección de la
 * pantalla; con varias secciones, alcanza con una.
 */
export function useReadOnly(need?: 'view' | Section | readonly Section[]): boolean {
  const access = useContext(AccessContext);
  const pathname = usePathname();
  if (!access || need === 'view') return false;
  const section = need ?? sectionFromPath(pathname);
  return section ? !can(access, section, 'write') : false;
}

export function AccessProvider({ access, children }: { access: AccessValue; children: React.ReactNode }) {
  return (
    <AccessContext.Provider value={access}>
      {children}
    </AccessContext.Provider>
  );
}
