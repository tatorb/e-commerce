'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { deleteProductAction } from '@/app/a/[cuenta]/productos/actions';

// Mismo patrón que "Eliminar secuencia" en app.studiomrb.com: un popover que
// explica qué se borra y pide confirmar.
export function DeleteProductButton({
  accountSlug,
  productId,
  productName,
  publicationCount,
}: {
  accountSlug: string;
  productId: string;
  productName: string;
  publicationCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await deleteProductAction(accountSlug, productId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/a/${accountSlug}/productos`);
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
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
        >
          <Trash2 />
          Eliminar producto
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Eliminar producto
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Vas a borrar <strong>{productName}</strong> con sus medidas, compatibilidades, fotos
            {publicationCount > 0
              ? ` y ${publicationCount === 1 ? 'su publicación' : `sus ${publicationCount} publicaciones`} con el historial de etapas`
              : ''}
            . En el canal no cambia nada. Esto no se puede deshacer.
          </p>
        </div>
        <div className="p-3 space-y-3">
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={submit} disabled={pending}>
              {pending ? 'Eliminando…' : 'Eliminar definitivamente'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
