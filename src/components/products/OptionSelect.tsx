'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

// El tipo de producto o la marca: se elige de la lista fija de la cuenta. Si
// el producto tenía algo que ya no está en la lista, se muestra igual para no
// perderlo de vista, marcado.

export function OptionSelect({
  id,
  value,
  options,
  onChange,
  disabled,
  empty,
  accountSlug,
  className,
}: {
  id?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  // Lo que dice la opción vacía, por ejemplo "Sin tipo".
  empty: string;
  // Con la cuenta, abajo va el link para agregar a la lista.
  accountSlug?: string;
  className?: string;
}) {
  const outside = value.trim() !== '' && !options.includes(value);
  return (
    <div className="space-y-1">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <option value="">{empty}</option>
        {outside ? <option value={value}>{value} (no está en la lista)</option> : null}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {accountSlug ? (
        <p className="text-[11px] text-muted-foreground">
          ¿Falta uno?{' '}
          <Link href={`/a/${accountSlug}/tipos-y-marcas`} className="underline underline-offset-2 hover:text-foreground" target="_blank">
            Agregalo en Tipos y marcas
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
