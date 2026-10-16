'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changeOwnPassword } from '@/lib/auth/actions';

type Status = { kind: 'idle' } | { kind: 'success' } | { kind: 'error'; message: string };

export function ChangePasswordForm({ passwordMin }: { passwordMin: number }) {
  const [current, setCurrent] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setStatus({ kind: 'idle' });
    if (p1 !== p2) {
      setStatus({ kind: 'error', message: 'Las contraseñas nuevas no coinciden.' });
      return;
    }
    startTransition(async () => {
      const result = await changeOwnPassword({ currentPassword: current, newPassword: p1 });
      if (result.ok) {
        setStatus({ kind: 'success' });
        setCurrent('');
        setP1('');
        setP2('');
      } else {
        setStatus({ kind: 'error', message: result.error });
      }
    });
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="pw-current">Contraseña actual</Label>
          <Input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-new">Nueva contraseña</Label>
          <Input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            placeholder={`Mínimo ${passwordMin} caracteres`}
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-repeat">Repetir nueva</Label>
          <Input
            id="pw-repeat"
            type="password"
            autoComplete="new-password"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !current || !p1 || !p2}>
          {pending ? 'Guardando…' : 'Cambiar contraseña'}
        </Button>
        {status.kind === 'success' ? (
          <span className="text-sm text-green-600">Contraseña cambiada.</span>
        ) : null}
        {status.kind === 'error' ? (
          <span className="text-sm text-destructive">{status.message}</span>
        ) : null}
      </div>
    </form>
  );
}
