'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import { resetUserPasswordAction, setUserDisabledAction } from '@/lib/auth/actions';

// Dar de baja, volver a dar de alta y darle una contraseña nueva a un usuario.

export function UserStatusCard({
  userId,
  disabled,
  isSelf,
  passwordMin,
}: {
  userId: string;
  disabled: boolean;
  isSelf: boolean;
  passwordMin: number;
}) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function setDisabled(next: boolean) {
    setStatus(null);
    startTransition(async () => {
      const r = await setUserDisabledAction(userId, next);
      setConfirming(false);
      if (!r.ok) return setStatus({ kind: 'error', text: r.error });
      setStatus({ kind: 'ok', text: next ? 'Quedó dado de baja. Se cerraron sus sesiones y sus conexiones con Claude.' : 'Puede volver a entrar.' });
      router.refresh();
    });
  }

  function resetPassword() {
    setStatus(null);
    startTransition(async () => {
      const r = await resetUserPasswordAction(userId, password);
      if (!r.ok) return setStatus({ kind: 'error', text: r.error });
      setPassword('');
      setStatus({ kind: 'ok', text: 'Listo. Pasale la contraseña: la primera vez que entre la va a tener que cambiar.' });
      router.refresh();
    });
  }

  return (
    <SectionCard title="Acceso" description={disabled ? 'Está dado de baja: no puede entrar a la app.' : 'Puede entrar a la app.'}>
      <SectionBody>
        {!isSelf ? (
          <div className="space-y-2">
            {disabled ? (
              <Button variant="outline" onClick={() => setDisabled(false)} pending={pending} disabled={pending}>
                Volver a dar de alta
              </Button>
            ) : confirming ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>¿Lo das de baja? No va a poder entrar, pero lo que hizo sigue en la actividad.</span>
                <Button variant="destructive" size="sm" onClick={() => setDisabled(true)} pending={pending} disabled={pending}>
                  Sí, dar de baja
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setConfirming(true)} disabled={pending}>
                Dar de baja
              </Button>
            )}
          </div>
        ) : null}
        {!disabled ? (
          <div className="space-y-1.5">
            <Label htmlFor="u-reset">Darle una contraseña nueva</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="u-reset"
                type="text"
                autoComplete="off"
                placeholder={`Mínimo ${passwordMin} caracteres`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
                className="w-full sm:w-72"
              />
              <Button variant="outline" onClick={resetPassword} pending={pending} disabled={pending || password.length < passwordMin}>
                Cambiarla
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Sirve si se la olvidó. Se cierran sus sesiones y la tiene que cambiar al entrar.</p>
          </div>
        ) : null}
        <StatusText status={status} />
      </SectionBody>
    </SectionCard>
  );
}
