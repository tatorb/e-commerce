'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/apply/CopyButton';

// Si falta la clave para cifrar, la genera en el navegador para cargarla en
// Vercel. Nunca pasa por el servidor ni por el chat.
export function KeySetup() {
  const [key, setKey] = useState<string | null>(null);

  function generate() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    setKey(btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c] ?? ''));
  }

  return (
    <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
      <p>
        Falta la clave con la que la app guarda cifradas las conexiones. Se carga una sola vez y sirve para todos los
        clientes.
      </p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Tocá Generar clave y copiala.</li>
        <li>En Vercel, entrá al proyecto, Settings, Environment Variables.</li>
        <li>Agregá una variable con nombre CHANNEL_TOKEN_KEY y pegá la clave como valor, para Production.</li>
        <li>Guardá y volvé a publicar la app desde Deployments, con Redeploy.</li>
      </ol>
      <p className="text-muted-foreground">
        No la pegues en el chat ni en otro lado. Si algún día cambia, hay que volver a cargar los datos de la aplicación
        y volver a conectar.
      </p>
      {key ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="break-all rounded bg-muted px-2 py-1 text-xs">{key}</code>
          <CopyButton value={key} label="la clave" />
        </div>
      ) : (
        <Button variant="outline" onClick={generate}>
          <KeyRound className="h-4 w-4" />
          Generar clave
        </Button>
      )}
    </div>
  );
}
