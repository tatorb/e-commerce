'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PlugZap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { runProbeAction } from '@/app/a/[cuenta]/conexion/actions';

export function ProbeButton({ accountSlug, storeId, label }: { accountSlug: string; storeId: string; label: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        pending={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await runProbeAction(accountSlug, storeId);
            if (!r.ok) setError(r.error);
            else router.refresh();
          });
        }}
        disabled={pending}
      >
        <PlugZap className="h-4 w-4" />
        {pending ? 'Probando… puede tardar unos segundos' : label}
      </Button>
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </span>
  );
}
