import type { ReactNode } from 'react';

// Área principal de scroll. En app.studiomrb.com además reserva lugar para
// los paneles de Iris y del chat; esta app no los tiene.
export function MainArea({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
      {children}
    </main>
  );
}
