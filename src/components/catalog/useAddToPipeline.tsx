'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addToPipelineAction, type AddOutcome } from '@/app/a/[cuenta]/publicaciones/pipeline-actions';
import { addOutcomeText } from './add-outcome';
import { DuplicatesDialog } from './DuplicatesDialog';

type Pending = Extract<AddOutcome, { duplicates: unknown }>;
export type AddMessage = { kind: 'ok' | 'error'; text: string };

// El ida y vuelta de agregar al pipeline: si hay repetidas, muestra el aviso
// y vuelve a pedirlo con o sin ellas. Lo usan la selección del Catálogo y
// "Agregar por link o código".
export function useAddToPipeline(accountSlug: string, onAdded?: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [duplicates, setDuplicates] = useState<Pending | null>(null);
  const [message, setMessage] = useState<AddMessage | null>(null);

  function run(call: () => Promise<AddOutcome>, carry?: Pick<Pending, 'notFound' | 'invalid'>) {
    setMessage(null);
    startTransition(async () => {
      const r = await call();
      if (r.ok) {
        setDuplicates(null);
        const withCarry = carry ? { ...r, notFound: carry.notFound, invalid: carry.invalid } : r;
        setMessage({ kind: 'ok', text: addOutcomeText(withCarry) });
        onAdded?.();
        router.refresh();
      } else if ('error' in r) {
        setDuplicates(null);
        setMessage({ kind: 'error', text: r.error });
      } else {
        setDuplicates(r);
      }
    });
  }

  const dialog = duplicates ? (
    <DuplicatesDialog
      duplicates={duplicates.duplicates}
      total={duplicates.ids.length}
      pending={pending}
      onCancel={() => setDuplicates(null)}
      onForce={() => run(() => addToPipelineAction(accountSlug, duplicates.ids, true), duplicates)}
      onSkip={() => {
        const skip = new Set(duplicates.duplicates.map((d) => d.id));
        const rest = duplicates.ids.filter((id) => !skip.has(id));
        run(() => addToPipelineAction(accountSlug, rest, false), duplicates);
      }}
    />
  ) : null;

  return { run, pending, message, clearMessage: () => setMessage(null), dialog };
}
