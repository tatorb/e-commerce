'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Result = { ok: true; message?: string } | { ok: false; error: string };

// Corre una acción de un paso, muestra su resultado y recarga los datos de la página.
export function useStepAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  function run(action: () => Promise<Result>, onOk?: () => void) {
    setStatus(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        setStatus({ kind: 'error', text: r.error });
        return;
      }
      if (r.message) setStatus({ kind: 'ok', text: r.message });
      onOk?.();
      router.refresh();
    });
  }

  return { run, pending, status, clear: () => setStatus(null) };
}
