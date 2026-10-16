'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Orden de una lista, guardado en la dirección como los filtros.
export function SortSelect({ options, value }: { options: { value: string; label: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={value}
      disabled={pending}
      onValueChange={(next) => {
        const sp = new URLSearchParams(searchParams.toString());
        sp.set('orden', next);
        startTransition(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
      }}
    >
      <SelectTrigger className="h-8 w-auto gap-2 rounded-full px-3 text-xs" aria-label="Ordenar">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
