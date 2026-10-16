'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Copia un texto al portapapeles y avisa por dos segundos.
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 2000);
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={copy}
      disabled={value === ''}
      aria-label={`Copiar ${label}`}
      title={state === 'error' ? 'No se pudo copiar: seleccioná el texto y copialo a mano.' : undefined}
    >
      {state === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {state === 'copied' ? 'Copiado' : state === 'error' ? 'No se pudo' : 'Copiar'}
    </Button>
  );
}
