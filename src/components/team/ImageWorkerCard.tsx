'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusText } from '@/components/pipeline/StatusText';
import { CopyButton } from '@/components/apply/CopyButton';
import { createWorkerKeyAction, revokeWorkerKeyAction } from '@/app/equipo/actions';

// La llave del trabajador de imágenes: crearla, verla una sola vez y cortarla.

export function ImageWorkerCard({ hasKey, keyHint }: { hasKey: boolean; keyHint: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirming, setConfirming] = useState<'new' | 'revoke' | null>(null);

  function create() {
    setStatus(null);
    startTransition(async () => {
      const r = await createWorkerKeyAction();
      setConfirming(null);
      if (r.ok) setKey(r.key);
      else setStatus({ kind: 'error', text: r.error });
      router.refresh();
    });
  }

  function revoke() {
    setStatus(null);
    startTransition(async () => {
      const r = await revokeWorkerKeyAction();
      setConfirming(null);
      setKey(null);
      setStatus(r.ok ? { kind: 'ok', text: 'Llave cortada. El trabajador ya no puede entrar.' } : { kind: 'error', text: r.error });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {key ? (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <p className="font-medium">Esta es la llave. Copiala ahora: no se vuelve a mostrar.</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-background px-2 py-1 text-xs">{key}</code>
            <CopyButton value={key} label="la llave del trabajador" />
          </div>
          <p className="text-xs text-muted-foreground">
            En la Mac, abrí la Terminal en la carpeta del trabajador, corré <code>bash configurar.sh</code> y pegala cuando la pida.
          </p>
        </div>
      ) : hasKey ? (
        <p className="text-sm text-muted-foreground">Hay una llave activa, terminada en «{keyHint}».</p>
      ) : (
        <p className="text-sm text-muted-foreground">Todavía no hay llave. Sin llave, el trabajador no puede tomar fotos.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {hasKey ? (
          <Popover open={confirming === 'new'} onOpenChange={(o) => setConfirming(o ? 'new' : null)}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" disabled={pending}>
                <KeyRound className="h-4 w-4" />
                Crear llave nueva
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4">
              <p className="text-sm">La llave actual deja de valer. El trabajador vuelve a conectarse cuando cargues la nueva en la Mac.</p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={pending}>
                  Cancelar
                </Button>
                <Button size="sm" pending={pending} onClick={create} disabled={pending}>
                  Crear llave nueva
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Button size="sm" pending={pending} onClick={create} disabled={pending}>
            <KeyRound className="h-4 w-4" />
            Crear llave
          </Button>
        )}
        {hasKey ? (
          <Popover open={confirming === 'revoke'} onOpenChange={(o) => setConfirming(o ? 'revoke' : null)}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" disabled={pending}>
                <Unplug className="h-4 w-4" />
                Cortar llave
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4">
              <p className="text-sm">
                El trabajador deja de poder tomar fotos. Lo que estaba procesando vuelve a la cola cuando haya una llave nueva.
              </p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={pending}>
                  Cancelar
                </Button>
                <Button size="sm" variant="destructive" pending={pending} onClick={revoke} disabled={pending}>
                  Cortar llave
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
      <StatusText status={status} className="block" />
    </div>
  );
}
