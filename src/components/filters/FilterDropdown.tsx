'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface FilterOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

// Copiado de app.studiomrb.com. Desplegable compacto con casillas para
// filtros de selección múltiple. El botón muestra el rótulo y la cantidad
// elegida; el panel lista las opciones. Se cierra con un clic afuera o Escape.
export function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  onSetAll,
  disabled,
  align = 'left',
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onSetAll?: (values: string[]) => void;
  disabled?: boolean;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const count = selected.length;

  const allValues = options.map((o) => o.value);
  const allSelected = allValues.length > 0 && allValues.every((v) => selected.includes(v));

  function toggleAll() {
    const next = allSelected ? [] : allValues;
    if (onSetAll) {
      onSetAll(next);
      return;
    }
    for (const v of allValues) {
      const isSel = selected.includes(v);
      if (allSelected ? isSel : !isSel) onToggle(v);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50',
          count > 0
            ? 'border-foreground bg-foreground/5 text-foreground'
            : 'border-border bg-background text-foreground hover:bg-muted',
        )}
      >
        {label}
        {count > 0 ? (
          <span className="rounded-full bg-foreground px-1.5 text-[10px] tabular-nums text-background">{count}</span>
        ) : null}
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div
          className={cn(
            'absolute z-20 mt-1 max-h-[320px] min-w-[210px] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {options.length > 0 ? (
            <>
              <button
                type="button"
                onClick={toggleAll}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium hover:bg-muted"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    allSelected ? 'border-foreground bg-foreground text-background' : 'border-border',
                  )}
                >
                  {allSelected ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="flex-1 truncate">{allSelected ? 'Desmarcar todas' : 'Marcar todas'}</span>
              </button>
              <div className="my-1 h-px bg-border/70" />
            </>
          ) : null}
          {options.map((o) => {
            const active = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onToggle(o.value)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    active ? 'border-foreground bg-foreground text-background' : 'border-border',
                  )}
                >
                  {active ? <Check className="h-3 w-3" /> : null}
                </span>
                {o.icon}
                <span className="flex-1 truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
