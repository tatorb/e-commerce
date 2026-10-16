'use client';

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';

export type RowColumn<T> = {
  key: keyof T & string;
  label: string;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'url';
  options?: { value: string; label: string }[];
};

/**
 * Lista editable de filas (medidas, compatibilidades, ficha técnica, fotos).
 * En escritorio las columnas van en línea con su rótulo arriba; en el
 * celular cada fila se apila y el rótulo queda como texto de ayuda.
 */
export function RowList<T extends Record<string, string>>({
  rows,
  onChange,
  columns,
  template,
  gridClassName,
  addLabel,
  emptyLabel,
  disabled,
  idPrefix,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  columns: RowColumn<T>[];
  template: T;
  gridClassName: string;
  addLabel: string;
  emptyLabel: string;
  disabled?: boolean;
  idPrefix: string;
}) {
  function update(index: number, key: keyof T, value: string) {
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <>
          <div className={cn('hidden sm:grid gap-2 pr-11', gridClassName)}>
            {columns.map((c) => (
              <span key={c.key} className="text-xs uppercase tracking-wide text-muted-foreground">
                {c.label}
              </span>
            ))}
          </div>
          {rows.map((row, index) => (
            <div key={index} className="flex items-start gap-2 rounded-md border p-2 sm:border-0 sm:p-0">
              <div className={cn('grid flex-1 gap-2', gridClassName)}>
                {columns.map((c) =>
                  c.options ? (
                    <Select
                      key={c.key}
                      value={row[c.key]}
                      onValueChange={(v) => update(index, c.key, v)}
                      disabled={disabled}
                    >
                      <SelectTrigger aria-label={c.label} id={`${idPrefix}-${index}-${c.key}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {c.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      key={c.key}
                      id={`${idPrefix}-${index}-${c.key}`}
                      aria-label={c.label}
                      value={row[c.key]}
                      placeholder={c.placeholder ?? c.label.toLowerCase()}
                      inputMode={c.inputMode === 'numeric' ? 'numeric' : undefined}
                      type={c.inputMode === 'url' ? 'url' : 'text'}
                      onChange={(e) => update(index, c.key, e.target.value)}
                      disabled={disabled}
                    />
                  ),
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar fila"
                title="Quitar fila"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, { ...template }])}
        disabled={disabled}
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}
