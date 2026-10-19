'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AddOutcome } from '@/app/a/[cuenta]/publicaciones/pipeline-actions';
import { addOutcomeText } from './add-outcome';

export type AddMessage = { kind: 'ok' | 'error'; text: string };

// El ida y vuelta de agregar al pipeline, con el mensaje de cómo salió. Lo
// usan la selección del Catálogo, "Agregar por link o código" y el botón de
// la ficha y del paso.
export function useAddToPipeline(onAdded?: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<AddMessage | null>(null);

  function run(call: () => Promise<AddOutcome>) {
    setMessage(null);
    startTransition(async () => {
      const r = await call();
      if (!r.ok) {
        setMessage({ kind: 'error', text: r.error });
        return;
      }
      setMessage({ kind: 'ok', text: addOutcomeText(r) });
      onAdded?.();
      router.refresh();
    });
  }

  return { run, pending, message, clearMessage: () => setMessage(null) };
}
