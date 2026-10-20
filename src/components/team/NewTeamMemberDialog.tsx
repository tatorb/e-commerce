'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addTeamMember } from '@/lib/auth/actions';

// Botón "Agregar persona" y su diálogo, con el mismo patrón que "Nueva
// empresa" en app.studiomrb.com.
export function NewTeamMemberDialog({ passwordMin }: { passwordMin: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName('');
    setEmail('');
    setPassword('');
    setError(null);
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await addTeamMember({ name, email, password });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Agregar persona
      </Button>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar persona</DialogTitle>
          <DialogDescription>
            Le creás el usuario con una contraseña temporal. Pasásela por un canal privado y pedile
            que la cambie desde Equipo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tm-name">Nombre</Label>
            <Input
              id="tm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={pending}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tm-email">Email</Label>
            <Input
              id="tm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@studiomrb.com"
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tm-password">Contraseña temporal</Label>
            <Input
              id="tm-password"
              type="text"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Mínimo ${passwordMin} caracteres`}
              disabled={pending}
            />
          </div>
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button pending={pending} type="submit" disabled={pending || !name.trim() || !email.trim() || !password}>
              {pending ? 'Creando…' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
