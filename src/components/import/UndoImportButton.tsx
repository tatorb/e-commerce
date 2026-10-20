'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { plural } from '@/lib/format';
import { undoImportAction } from '@/app/a/[cuenta]/importar/actions';

// Mismo patrón que "Eliminar producto": un popover que explica qué se borra.
export function UndoImportButton({
  accountSlug,
  runId,
  productsCreated,
  publicationsCreated,
  fieldsChanged,
}: {
  accountSlug: string;
  runId: string;
  productsCreated: number;
  publicationsCreated: number;
  fieldsChanged: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await undoImportAction(accountSlug, runId);
      if (!res.ok) {
        setError(res.error);
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
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <Undo2 />
          Deshacer
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Deshacer importación
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {productsCreated > 0 || publicationsCreated > 0 || fieldsChanged === 0
              ? `Vas a borrar ${plural(productsCreated, 'producto')} y ${plural(publicationsCreated, 'publicación', 'publicaciones')} que creó esta importación, con su historial de etapas, sus mediciones y lo que les hayas cargado después. Los productos que tengan publicaciones cargadas después o estén en un combo quedan. `
              : ''}
            {fieldsChanged > 0
              ? fieldsChanged === 1
                ? 'El campo que completó en lo que ya estaba vuelve a como estaba antes, salvo que lo hayas cambiado a mano después. '
                : `Los ${fieldsChanged} campos que completó en lo que ya estaba vuelven a como estaban antes, salvo los que hayas cambiado a mano después. `
              : 'Lo que ya estaba antes no se toca. '}
            Esto no se puede deshacer.
          </p>
        </div>
        <div className="p-3 space-y-3">
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button pending={pending} variant="destructive" size="sm" onClick={submit} disabled={pending}>
              {pending ? 'Deshaciendo…' : 'Deshacer importación'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
