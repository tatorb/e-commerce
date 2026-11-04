'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addOptionAction, removeOptionAction, renameOptionAction } from '@/app/a/[cuenta]/tipos-y-marcas/actions';
import { OPTION_LABEL, type OptionKind } from '@/domain/product-options';
import { plural } from '@/lib/format';

// Una lista fija (tipos de producto o marcas): agregar, renombrar y borrar.
// Al renombrar cambia en todos los productos que la usan.

export function OptionListEditor({
  accountSlug,
  kind,
  items,
  canWrite,
}: {
  accountSlug: string;
  kind: OptionKind;
  items: { name: string; products: number }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const label = OPTION_LABEL[kind];

  const go = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setStatus(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <div className="space-y-3">
      {canWrite ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go(() => addOptionAction(accountSlug, kind, adding), () => setAdding(''));
          }}
        >
          <Input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            placeholder={kind === 'TYPE' ? 'Nuevo tipo de producto' : 'Nueva marca'}
            aria-label={kind === 'TYPE' ? 'Nuevo tipo de producto' : 'Nueva marca'}
            maxLength={200}
            disabled={pending}
          />
          <Button type="submit" disabled={pending || !adding.trim()}>
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </form>
      ) : null}
      {status ? (
        <p role="status" className={status.ok ? 'text-sm text-emerald-700' : 'text-sm text-destructive'}>
          {status.text}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay ninguno en la lista.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {items.map((item) => (
            <li key={item.name} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              {editing === item.name ? (
                <form
                  className="flex min-w-0 flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    go(() => renameOptionAction(accountSlug, kind, item.name, draft), () => setEditing(null));
                  }}
                >
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`Nuevo nombre de ${item.name}`} maxLength={200} disabled={pending} autoFocus />
                  <Button type="submit" size="sm" disabled={pending || !draft.trim()} aria-label="Guardar el nombre">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={pending} aria-label="Cancelar">
                    <X className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 font-medium">{item.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{plural(item.products, 'producto', 'productos')}</span>
                  {canWrite ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          setEditing(item.name);
                          setDraft(item.name);
                          setStatus(null);
                        }}
                        aria-label={`Renombrar ${item.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          const warn =
                            item.products > 0
                              ? `¿Borrar «${item.name}»? ${plural(item.products, 'producto queda', 'productos quedan')} sin ${label.one}.`
                              : `¿Borrar «${item.name}»?`;
                          if (window.confirm(warn)) go(() => removeOptionAction(accountSlug, kind, item.name));
                        }}
                        aria-label={`Borrar ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
