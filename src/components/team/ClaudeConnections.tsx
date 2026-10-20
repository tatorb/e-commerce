'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusText } from '@/components/pipeline/StatusText';
import { disconnectAllClaudeAction, disconnectClaudeAction } from '@/app/equipo/actions';

export type ClaudeConnectionRow = { id: string; clientName: string; detail: string };

// Las conexiones activas de la persona, con Desconectar y Desconectar todas.
export function ClaudeConnections({ rows }: { rows: ClaudeConnectionRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setStatus(null);
    startTransition(async () => {
      const r = await action();
      setConfirmingAll(false);
      setStatus(r.ok ? { kind: 'ok', text: done } : { kind: 'error', text: r.error });
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">No tenés conexiones activas.</p>
        <StatusText status={status} className="block" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-md border">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium">{r.clientName}</p>
              <p className="text-xs text-muted-foreground">{r.detail}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => run(() => disconnectClaudeAction(r.id), 'Desconectada.')}
            >
              <Unplug className="h-4 w-4" />
              Desconectar
            </Button>
          </li>
        ))}
      </ul>
      {rows.length > 1 ? (
        <Popover open={confirmingAll} onOpenChange={setConfirmingAll}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={pending}>
              <Unplug className="h-4 w-4" />
              Desconectar todas
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4">
            <p className="text-sm">
              Claude deja de poder usar la app con tu usuario. Para volver a usarla, hay que conectar el conector de
              nuevo.
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirmingAll(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                pending={pending}
                disabled={pending}
                onClick={() => run(disconnectAllClaudeAction, 'Se desconectaron todas.')}
              >
                Desconectar todas
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
      <StatusText status={status} className="block" />
    </div>
  );
}
