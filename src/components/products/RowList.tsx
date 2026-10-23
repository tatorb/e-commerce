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
import { OpenLinkButton } from '@/components/ui/open-link-button';
import { cn } from '@/lib/utils/cn';

export type RowColumn<T> = {
  key: keyof T & string;
  label: string;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'url';
  options?: { value: string; label: string }[];
  /** Suma al lado un botón para abrir el link en una pestaña nueva. */
  openLink?: boolean;
};

/**
 * Lista editable de filas (medidas, compatibilidades, ficha técnica, fotos).
 * En escritorio las columnas van en línea con su rótulo arriba; en el
 * celular cada fila es una tarjeta y cada casillero lleva su rótulo encima.
 */
export function RowList<T extends Record<string, string>>({
  rows,
  onChange,
  columns,
  template,
  gridClassName,
  mobileGridClassName = 'grid-cols-1',
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
  // Las columnas en el celular, por ejemplo dos para los datos cortos.
  mobileGridClassName?: string;
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
              <div className={cn('grid flex-1 gap-2', mobileGridClassName, gridClassName)}>
                {columns.map((c) => {
                  const id = `${idPrefix}-${index}-${c.key}`;
                  return (
                    <div key={c.key} className="min-w-0 space-y-1 sm:space-y-0">
                      <label htmlFor={id} className="block text-[11px] text-muted-foreground sm:hidden">
                        {c.label}
                      </label>
                      {c.options ? (
                        <Select value={row[c.key]} onValueChange={(v) => update(index, c.key, v)} disabled={disabled}>
                          <SelectTrigger aria-label={c.label} id={id}>
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
                      ) : c.openLink ? (
                        <div className="flex min-w-0 items-center gap-2">
                          <Input
                            id={id}
                            aria-label={c.label}
                            value={row[c.key]}
                            placeholder={c.placeholder ?? c.label.toLowerCase()}
                            type={c.inputMode === 'url' ? 'url' : 'text'}
                            onChange={(e) => update(index, c.key, e.target.value)}
                            disabled={disabled}
                          />
                          <OpenLinkButton url={row[c.key]} label={`Abrir ${c.label.toLowerCase()} en una pestaña nueva`} />
                        </div>
                      ) : (
                        <Input
                          id={id}
                          aria-label={c.label}
                          value={row[c.key]}
                          placeholder={c.placeholder ?? c.label.toLowerCase()}
                          inputMode={c.inputMode === 'numeric' ? 'numeric' : undefined}
                          type={c.inputMode === 'url' ? 'url' : 'text'}
                          onChange={(e) => update(index, c.key, e.target.value)}
                          disabled={disabled}
                        />
                      )}
                    </div>
                  );
                })}
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
