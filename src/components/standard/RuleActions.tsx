'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { deleteRuleAction, loadSuggestedRulesAction } from '@/app/a/[cuenta]/estandar/actions';

// Borrar una regla, con el mismo popover de confirmación que el resto de la app.
export function DeleteRuleButton({ accountSlug, ruleId, name }: { accountSlug: string; ruleId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 />
          Borrar
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Borrar regla
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Vas a borrar <strong>{name}</strong>. Si solo querés que no cuente por un tiempo, mejor apagala desde
            Editar.
          </p>
        </div>
        <div className="p-3 space-y-3">
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              pending={pending}
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteRuleAction(accountSlug, ruleId);
                  if (!r.ok) return setError(r.error);
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              {pending ? 'Borrando…' : 'Borrar regla'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function LoadSuggestedButton({ accountSlug, channelId }: { accountSlug: string; channelId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        pending={pending}
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await loadSuggestedRulesAction(accountSlug, channelId);
            if (!r.ok) return setError(r.error);
            router.refresh();
          })
        }
      >
        {pending ? 'Cargando…' : 'Cargar reglas sugeridas'}
      </Button>
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </div>
  );
}
