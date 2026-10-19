'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProductKind } from '@/generated/prisma/enums';
import { KindBadge } from './KindBadge';

export type ProductCandidate = {
  id: string;
  name: string;
  brand: string | null;
  partNumber: string | null;
  productType: string | null;
  kind?: ProductKind;
};

export const productDetail = (p: ProductCandidate) => [p.brand, p.partNumber, p.productType].filter(Boolean).join(' · ');

// Buscador de productos con el mismo criterio de Productos: nombre, marca,
// número de pieza o SKU. Lo usan la tarjeta del combo y la publicación nueva.
export function ProductSearch({
  id,
  label,
  search,
  onPick,
  pickLabel,
  emptyText,
  exclude = [],
  disabled = false,
}: {
  id: string;
  label: string;
  search: (q: string) => Promise<ProductCandidate[]>;
  onPick: (p: ProductCandidate) => void;
  pickLabel: string;
  emptyText: string;
  exclude?: string[];
  disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProductCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const last = useRef(0);
  // La búsqueda puede cambiar en cada render: se usa la última sin volver a buscar.
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  });

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const n = ++last.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      const found = await searchRef.current(term);
      // Solo vale la respuesta de la última búsqueda.
      if (n === last.current) {
        setResults(found);
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const term = q.trim();
  const visible = term.length < 2 ? [] : results.filter((r) => !exclude.includes(r.id));
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={q} disabled={disabled} placeholder="Nombre, marca, número de pieza o SKU" onChange={(e) => setQ(e.target.value)} />
      {term.length >= 2 ? (
        visible.length > 0 ? (
          <ul className="max-h-72 divide-y overflow-y-auto rounded-md border" aria-label="Productos encontrados">
            {visible.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1.5 text-sm">
                    <span className="min-w-0 truncate">{p.name}</span>
                    {p.kind ? <KindBadge kind={p.kind} /> : null}
                  </p>
                  {productDetail(p) ? <p className="truncate text-xs text-muted-foreground">{productDetail(p)}</p> : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  aria-label={`${pickLabel} ${p.name}`}
                  onClick={() => {
                    onPick(p);
                    setQ('');
                    setResults([]);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {pickLabel}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{searching ? 'Buscando…' : emptyText}</p>
        )
      ) : null}
    </div>
  );
}
