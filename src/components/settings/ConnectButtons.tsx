'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, LogIn, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { disconnectAction, startConnectAction } from '@/app/a/[cuenta]/conexion/actions';
import { StatusText } from '@/components/pipeline/StatusText';

// Conectar ahora, copiar el link para el cliente o desconectar.
export function ConnectButtons({
  accountSlug,
  storeId,
  channelName,
  connected,
  ready,
}: {
  accountSlug: string;
  storeId: string;
  channelName: string;
  connected: boolean;
  // Ya están los datos de la aplicación.
  ready: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  function connect() {
    setStatus(null);
    startTransition(async () => {
      const r = await startConnectAction(accountSlug, storeId, false);
      if (!r.ok) setStatus({ kind: 'error', text: r.error });
      else window.location.href = r.url;
    });
  }

  function copyLink() {
    setStatus(null);
    startTransition(async () => {
      const r = await startConnectAction(accountSlug, storeId, true);
      if (!r.ok) {
        setStatus({ kind: 'error', text: r.error });
        return;
      }
      try {
        await navigator.clipboard.writeText(r.url);
        setStatus({ kind: 'ok', text: 'Link copiado. Vale 24 horas y sirve una sola vez.' });
      } catch {
        setStatus({ kind: 'ok', text: `Copiá este link, vale 24 horas: ${r.url}` });
      }
    });
  }

  function doDisconnect() {
    startTransition(async () => {
      const r = await disconnectAction(accountSlug, storeId);
      setConfirming(false);
      if (!r.ok) setStatus({ kind: 'error', text: r.error });
      else {
        setStatus({ kind: 'ok', text: 'Desconectada.' });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={connect} disabled={pending || !ready}>
          <LogIn className="h-4 w-4" />
          {connected ? 'Volver a conectar' : `Conectar con ${channelName}`}
        </Button>
        <Button variant="outline" onClick={copyLink} disabled={pending || !ready}>
          <Link2 className="h-4 w-4" />
          Copiar link para el cliente
        </Button>
        {connected ? (
          <Popover open={confirming} onOpenChange={setConfirming}>
            <PopoverTrigger asChild>
              <Button variant="ghost" disabled={pending}>
                <Unplug className="h-4 w-4" />
                Desconectar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4">
              <p className="text-sm">
                La app deja de usar la cuenta de {channelName} y borra sus llaves. Los datos de la aplicación quedan,
                para volver a conectar.
              </p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                  Cancelar
                </Button>
                <Button size="sm" variant="destructive" onClick={doDisconnect} disabled={pending}>
                  Desconectar
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
      {!ready ? <p className="text-xs text-muted-foreground">Primero guardá el App ID y la clave secreta.</p> : null}
      <StatusText status={status} className="block break-all" />
    </div>
  );
}
