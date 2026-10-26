'use client';

import { useState, useTransition } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/pipeline/StatusText';
import { sendTestEmailAction } from '@/app/equipo/actions';

// Manda un mail de prueba a quien lo toca, para ver que los mails salen.
export function TestEmailButton({ email }: { email: string }) {
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        access="view"
        pending={pending}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setStatus(null);
            const r = await sendTestEmailAction();
            setStatus(r.ok ? { kind: 'ok', text: `Listo, mandado a ${email}. Si no llega en unos minutos, mirá en spam.` } : { kind: 'error', text: r.error });
          })
        }
      >
        <Send className="h-4 w-4" />
        Mandarme un mail de prueba
      </Button>
      <StatusText status={status} />
    </div>
  );
}
