'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { IconButton } from '@/components/ui/section-card';

// Lista de textos cortos que se agregan, se editan en el lugar, se ordenan con
// flechas y se borran. Copia las filas de app.studiomrb.com
// (src/components/inbound/catalogUi.tsx, CatalogRowView y CatalogEditor).

type Result = { ok: true } | { ok: false; error: string };

export type EditableItem = { id: string; text: string };

export function EditableList({
  items,
  adding,
  onAddClosed,
  emptyText,
  placeholder,
  onAdd,
  onSave,
  onDelete,
  onMove,
}: {
  items: EditableItem[];
  // El botón Agregar está en el encabezado: el padre abre el editor.
  adding: boolean;
  onAddClosed: () => void;
  emptyText: string;
  placeholder: string;
  onAdd: (text: string) => Promise<Result>;
  onSave: (id: string, text: string) => Promise<Result>;
  onDelete: (id: string) => Promise<Result>;
  onMove: (id: string, direction: 'up' | 'down') => Promise<Result>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  function run(action: () => Promise<Result>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  return (
    <div>
      {items.length === 0 && !adding ? <p className="px-4 py-5 text-sm text-muted-foreground">{emptyText}</p> : null}
      <ul className="divide-y">
        {items.map((item, i) =>
          editing === item.id ? (
            <li key={item.id}>
              <Editor
                initial={item.text}
                placeholder={placeholder}
                pending={pending}
                onSave={(text) => run(() => onSave(item.id, text), () => setEditing(null))}
                onCancel={() => setEditing(null)}
                onDelete={() => run(() => onDelete(item.id), () => setEditing(null))}
              />
            </li>
          ) : (
            <li key={item.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/20">
              <button
                type="button"
                onClick={() => setEditing(item.id)}
                className="min-w-0 flex-1 rounded text-left text-sm font-medium leading-snug decoration-dotted decoration-1 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {item.text}
              </button>
              <span className="flex shrink-0 items-center gap-0.5">
                <IconButton label="Subir" disabled={pending || i === 0} onClick={() => run(() => onMove(item.id, 'up'))}>
                  <ChevronUp className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label="Bajar"
                  disabled={pending || i === items.length - 1}
                  onClick={() => run(() => onMove(item.id, 'down'))}
                >
                  <ChevronDown className="h-4 w-4" />
                </IconButton>
                <IconButton label="Editar" disabled={pending} onClick={() => setEditing(item.id)}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
              </span>
            </li>
          ),
        )}
        {adding ? (
          <li>
            <Editor
              initial=""
              placeholder={placeholder}
              pending={pending}
              onSave={(text) => run(() => onAdd(text), onAddClosed)}
              onCancel={onAddClosed}
            />
          </li>
        ) : null}
      </ul>
      {error ? (
        <p role="status" className="px-4 pb-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Editor({
  initial,
  placeholder,
  pending,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: string;
  placeholder: string;
  pending: boolean;
  onSave: (text: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <div className="space-y-2.5 bg-muted/30 px-4 py-3">
      <Textarea
        autoFocus
        rows={2}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (text.trim()) onSave(text);
          } else if (e.key === 'Escape') onCancel();
        }}
        className="bg-background"
      />
      <div className="flex items-center gap-2">
        <Button pending={pending} size="sm" disabled={pending || !text.trim()} onClick={() => onSave(text)}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
        {onDelete ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={onDelete} className="ml-auto text-muted-foreground">
            Borrar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
