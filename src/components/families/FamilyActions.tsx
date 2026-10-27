'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useReadOnly } from '@/components/access/AccessProvider';
import { applyFamiliesAction, setMeasureAction } from '@/app/a/[cuenta]/importar/familias/actions';
import type { ApplyFamiliesResult } from '@/lib/family-apply';
import { plural } from '@/lib/format';

// Lo que se toca en la pantalla Familias: elegir la medida que no se sabe por
// el SKU, y aplicar en la tienda lo que muestra la vista previa.

function appliedText(r: ApplyFamiliesResult): string {
  const parts = [
    r.families > 0 ? `${plural(r.families, 'familia armada o completada', 'familias armadas o completadas')}, con ${plural(r.joined, 'publicación', 'publicaciones')}` : null,
    r.split > 0 ? `${plural(r.split, 'familia separada', 'familias separadas')}, con ${plural(r.created, 'publicación nueva', 'publicaciones nuevas')}` : null,
  ].filter(Boolean);
  const done = parts.length > 0 ? `Listo: ${parts.join(' y ')}.` : 'No había nada para aplicar.';
  return r.skipped.length > 0 ? `${done} No se pudieron ${plural(r.skipped.length, 'familia', 'familias')}: ${r.skipped.map((s) => `${s.code ?? 'sin código'}, ${s.reason.toLowerCase()}`).join(' ')}` : done;
}

/** Elige qué medida vende una publicación. */
export function MeasureSelect({
  accountSlug,
  publicationId,
  options,
}: {
  accountSlug: string;
  publicationId: string;
  options: { key: string; label: string }[];
}) {
  const router = useRouter();
  const readOnly = useReadOnly('importar');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <select
        aria-label="Medida que vende"
        defaultValue=""
        disabled={pending || readOnly}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        onChange={(e) => {
          const key = e.target.value;
          if (!key) return;
          setError(null);
          startTransition(async () => {
            const r = await setMeasureAction(accountSlug, publicationId, key);
            if (!r.ok) setError(r.error);
            else router.refresh();
          });
        }}
      >
        <option value="">Elegí la medida</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}

/** Aplica lo que muestra la vista previa en la tienda, después de confirmarlo. */
export function ApplyFamiliesButton({ accountSlug, storeId, changes }: { accountSlug: string; storeId: string; changes: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await applyFamiliesAction(accountSlug, storeId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      setMessage(appliedText(r.result));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" access="importar" disabled={changes === 0}>
            <Layers />
            Aplicar
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Juntar las medidas en familias</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Se arman las familias de esta tienda tal como las ves acá, y las que creó la app se separan en una publicación por medida. Las que
              tienen una medida para elegir o son de productos distintos quedan para después. Nada se sube solo a Mercado Libre: si cambia el
              título o la descripción de una medida, el cambio queda en Por subir.
            </p>
          </div>
          <div className="space-y-3 p-3">
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" access="view" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button size="sm" access="importar" onClick={submit} disabled={pending}>
                {pending ? 'Aplicando…' : 'Aplicar'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {message ? (
        <p role="status" className="max-w-md text-right text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
