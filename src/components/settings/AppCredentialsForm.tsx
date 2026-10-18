'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveAppCredentialsAction } from '@/app/a/[cuenta]/conexion/actions';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { StatusText } from '@/components/pipeline/StatusText';

// El App ID y la clave secreta de la aplicación del cliente. La clave nunca
// vuelve a la pantalla: solo sus últimos 4 caracteres.
export function AppCredentialsForm({
  accountSlug,
  storeId,
  appId,
  secretHint,
}: {
  accountSlug: string;
  storeId: string;
  appId: string | null;
  secretHint: string | null;
}) {
  const [id, setId] = useState(appId ?? '');
  const [secret, setSecret] = useState('');
  const action = useStepAction();
  const dirty = id.trim() !== (appId ?? '') || secret.trim() !== '';

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        action.run(
          async () => {
            const r = await saveAppCredentialsAction(accountSlug, storeId, id, secret || null);
            return r.ok ? { ok: true, message: 'Datos de la aplicación guardados.' } : r;
          },
          () => setSecret(''),
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`app-id-${storeId}`}>App ID</Label>
          <Input
            id={`app-id-${storeId}`}
            inputMode="numeric"
            autoComplete="off"
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              action.clear();
            }}
            placeholder="1234567890123456"
            disabled={action.pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`app-secret-${storeId}`}>Clave secreta</Label>
          <Input
            id={`app-secret-${storeId}`}
            type="password"
            autoComplete="new-password"
            value={secret}
            onChange={(e) => {
              setSecret(e.target.value);
              action.clear();
            }}
            placeholder={secretHint ? `Guardada, termina en ${secretHint}` : 'Pegala acá'}
            disabled={action.pending}
          />
          {secretHint ? <p className="text-xs text-muted-foreground">Dejala vacía para conservar la guardada.</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={action.pending || !dirty || !id.trim()}>
          {action.pending ? 'Guardando…' : 'Guardar datos de la aplicación'}
        </Button>
        <StatusText status={action.status} />
      </div>
    </form>
  );
}
