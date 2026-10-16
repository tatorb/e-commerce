'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { FilterDropdown, type FilterOption } from '@/components/filters/FilterDropdown';

// Copiado de app.studiomrb.com. El mismo desplegable, pero guardando el
// filtro en la dirección (separado por comas), así se puede compartir.
export function UrlFilterDropdown({
  label,
  paramKey,
  options,
  selected,
  align = 'left',
  resetPage = true,
}: {
  label: string;
  paramKey: string;
  options: FilterOption[];
  selected: string[];
  align?: 'left' | 'right';
  resetPage?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function writeParam(next: string[]) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next.length > 0) sp.set(paramKey, next.join(','));
    else sp.delete(paramKey);
    if (resetPage) sp.delete('page');
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  }

  function toggle(value: string) {
    const current = (searchParams.get(paramKey)?.split(',') ?? []).filter(Boolean);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    writeParam(next);
  }

  return (
    <FilterDropdown
      label={label}
      options={options}
      selected={selected}
      onToggle={toggle}
      onSetAll={writeParam}
      disabled={pending}
      align={align}
    />
  );
}
