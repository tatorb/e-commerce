'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/pipeline/StatusText';
import { readSalesNowAction } from '@/app/a/[cuenta]/conexion/actions';

// Lee ahora las ventas de la tienda: sirve para ver si ya tiene el permiso.
export function ReadSalesButton({ accountSlug, storeId }: { accountSlug: string; storeId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        pending={pending}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setStatus(null);
            const r = await readSalesNowAction(accountSlug, storeId);
            setStatus(r.ok ? { kind: 'ok', text: r.message } : { kind: 'error', text: r.error });
            router.refresh();
          })
        }
      >
        <ShoppingCart className="h-4 w-4" />
        {pending ? 'Leyendo…' : 'Leer las ventas ahora'}
      </Button>
      <StatusText status={status} />
    </span>
  );
}
