'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { undoAppliedAction } from '@/app/a/[cuenta]/publicaciones/apply-actions';

// Para corregir un "Marcar como aplicada" por error. Mismo patrón que
// "Deshacer importación".
export function UndoAppliedButton({ accountSlug, publicationId }: { accountSlug: string; publicationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await undoAppliedAction(accountSlug, publicationId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Undo2 className="h-4 w-4" />
          Volver a Aprobado
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Volver a Aprobado
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Se borra el registro de la aplicación y la publicación vuelve a Aprobado, como si no se hubiera marcado. La
            ficha no cambia.
          </p>
        </div>
        <div className="space-y-3 p-3">
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button pending={pending} variant="destructive" size="sm" onClick={submit} disabled={pending}>
              {pending ? 'Volviendo…' : 'Volver a Aprobado'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
