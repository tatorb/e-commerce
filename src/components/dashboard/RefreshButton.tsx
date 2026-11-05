'use client';

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

// Vuelve a traer los datos de la pantalla sin recargar toda la página: lo que
// cambió mientras tanto, por ejemplo lo que hizo Claude por MCP, aparece.
// Dentro de un RefreshScope, además, se vuelve a armar lo que está en
// RefreshArea: las tarjetas que guardan lo que muestran al abrirse toman los
// datos nuevos. Lo escrito sin guardar en esa parte se pierde.

const Scope = createContext<{ round: number; bump: () => void } | null>(null);

export function RefreshScope({ children }: { children: ReactNode }) {
  const [round, setRound] = useState(0);
  return <Scope.Provider value={{ round, bump: () => setRound((r) => r + 1) }}>{children}</Scope.Provider>;
}

/** Lo que se vuelve a armar con los datos nuevos al actualizar. */
export function RefreshArea({ children }: { children: ReactNode }) {
  const scope = useContext(Scope);
  return (
    <div key={scope?.round ?? 0} className="contents">
      {children}
    </div>
  );
}

export function RefreshButton({ label = 'Actualizar', className }: { label?: string; className?: string }) {
  const router = useRouter();
  const scope = useContext(Scope);
  const [pending, start] = useTransition();
  const asked = useRef(false);
  // Cuando terminaron de llegar los datos nuevos, se vuelve a armar el área.
  useEffect(() => {
    if (!pending && asked.current) {
      asked.current = false;
      scope?.bump();
    }
  }, [pending, scope]);
  return (
    <Button
      size="icon"
      variant="outline"
      className={cn('shrink-0', className)}
      onClick={() => {
        asked.current = true;
        start(() => router.refresh());
      }}
      disabled={pending}
      aria-label={label}
      title={label}
    >
      <RefreshCw className={cn('h-4 w-4', pending && 'animate-spin')} aria-hidden />
    </Button>
  );
}
