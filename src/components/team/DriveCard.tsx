'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CopyButton } from '@/components/apply/CopyButton';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { disconnectDriveAction, saveDriveCredentialsAction, startDriveConnectAction } from '@/app/equipo/actions';

// La conexión del estudio con su Google Drive: los pasos para crear el
// cliente en Google Cloud, sus datos y los botones para conectar. La clave
// secreta nunca vuelve a la pantalla: solo sus últimos 4 caracteres.

export function DriveCard({
  clientId,
  secretHint,
  connected,
  redirectUri,
}: {
  clientId: string | null;
  secretHint: string | null;
  connected: boolean;
  redirectUri: string;
}) {
  const router = useRouter();
  const [id, setId] = useState(clientId ?? '');
  const [secret, setSecret] = useState('');
  const save = useStepAction();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const dirty = id.trim() !== (clientId ?? '') || secret.trim() !== '';

  function connect() {
    setStatus(null);
    startTransition(async () => {
      const r = await startDriveConnectAction();
      if (!r.ok) setStatus({ kind: 'error', text: r.error });
      else window.location.href = r.url;
    });
  }

  function doDisconnect() {
    startTransition(async () => {
      const r = await disconnectDriveAction();
      setConfirming(false);
      if (!r.ok) setStatus({ kind: 'error', text: r.error });
      else {
        setStatus({ kind: 'ok', text: 'Drive desconectado.' });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <details className="group rounded-md border px-3 py-2 text-sm" open={!clientId}>
        <summary className="cursor-pointer font-medium">Cómo crear el cliente de Google</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            Entrá a{' '}
            <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
              console.cloud.google.com
            </a>{' '}
            con martin@studiomrb.com y creá un proyecto, por ejemplo E-commerce Studio MRB.
          </li>
          <li>En APIs y servicios, Biblioteca, buscá Google Drive API y tocá Habilitar.</li>
          <li>
            En Google Auth Platform, la pantalla de permiso, elegí el tipo Interno. Ponele de nombre E-commerce Studio
            MRB y tu mail de contacto.
          </li>
          <li className="space-y-2">
            <p>En Clientes, creá un cliente de tipo Aplicación web. En URI de redireccionamiento autorizados, agregá esta dirección:</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-muted px-2 py-1 text-xs">{redirectUri}</code>
              <CopyButton value={redirectUri} label="la dirección de vuelta" />
            </div>
          </li>
          <li>Google te muestra el ID del cliente y la clave secreta. Pegalos acá abajo y tocá Guardar. No los pegues en el chat.</li>
          <li>Tocá Conectar con Google, entrá con martin@studiomrb.com y aceptá el permiso para los archivos del Drive.</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Si Google no te deja elegir Interno, elegí Externo, sumá martin@studiomrb.com como usuario de prueba y después
          tocá Publicar la app. Si queda en prueba, Google corta el permiso cada 7 días.
        </p>
      </details>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.run(
            async () => {
              const r = await saveDriveCredentialsAction(id, secret || null);
              return r.ok ? { ok: true, message: 'Datos del cliente guardados.' } : r;
            },
            () => setSecret(''),
          );
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="drive-client-id">ID del cliente</Label>
            <Input
              id="drive-client-id"
              autoComplete="off"
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                save.clear();
              }}
              placeholder="123-abc.apps.googleusercontent.com"
              disabled={save.pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="drive-client-secret">Clave secreta del cliente</Label>
            <Input
              id="drive-client-secret"
              type="password"
              autoComplete="new-password"
              value={secret}
              onChange={(e) => {
                setSecret(e.target.value);
                save.clear();
              }}
              placeholder={secretHint ? `Guardada, termina en ${secretHint}` : 'Pegala acá'}
              disabled={save.pending}
            />
            {secretHint ? <p className="text-xs text-muted-foreground">Dejala vacía para conservar la guardada.</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button pending={save.pending} type="submit" variant="outline" disabled={save.pending || !dirty || !id.trim()}>
            {save.pending ? 'Guardando…' : 'Guardar datos del cliente'}
          </Button>
          <StatusText status={save.status} />
        </div>
      </form>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={connect} pending={pending && !confirming} disabled={pending || !clientId}>
            <LogIn className="h-4 w-4" />
            {connected ? 'Volver a conectar' : 'Conectar con Google'}
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
                  La app deja de usar el Drive y borra sus llaves. Los videos quedan en el Drive y el cliente de Google
                  queda guardado, para volver a conectar.
                </p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                    Cancelar
                  </Button>
                  <Button size="sm" variant="destructive" pending={pending} onClick={doDisconnect} disabled={pending}>
                    Desconectar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
        {!clientId ? <p className="text-xs text-muted-foreground">Primero guardá el ID y la clave secreta del cliente.</p> : null}
        <StatusText status={status} className="block break-all" />
      </div>
    </div>
  );
}
