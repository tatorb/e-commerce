'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createFirstUser } from '@/lib/auth/actions';

export function FirstUserForm({ passwordMin }: { passwordMin: number }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardContent className="p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (p1 !== p2) {
              setError('Las contraseñas no coinciden.');
              return;
            }
            startTransition(async () => {
              const res = await createFirstUser({ name, email, password: p1 });
              if (res && !res.ok) setError(res.error);
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              autoComplete="name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p1">Contraseña</Label>
            <Input
              id="p1"
              type="password"
              autoComplete="new-password"
              placeholder={`Mínimo ${passwordMin} caracteres`}
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              disabled={pending}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p2">Repetir contraseña</Label>
            <Input
              id="p2"
              type="password"
              autoComplete="new-password"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              disabled={pending}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Creando…' : 'Crear usuario y entrar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
