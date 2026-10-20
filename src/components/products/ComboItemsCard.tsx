'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconButton, SectionBody, SectionCard } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { saveComboItemsAction, searchComboProductsAction } from '@/app/a/[cuenta]/productos/combo-actions';
import { MAX_COMBO_QUANTITY } from '@/domain/combos';
import type { ComboProduct } from '@/lib/queries/combos';
import { productDetail, ProductSearch } from './ProductSearch';

type Row = Omit<ComboProduct, 'quantity'> & { quantity: string };

// Los productos individuales que forman un combo, con su cantidad. Se usa en
// la ficha del combo y en el paso Información.
export function ComboItemsCard({ accountSlug, comboId, initial }: { accountSlug: string; comboId: string; initial: ComboProduct[] }) {
  const start = initial.map((i) => ({ ...i, quantity: String(i.quantity) }));
  const [rows, setRows] = useState<Row[]>(start);
  const [saved, setSaved] = useState(JSON.stringify(start));
  const action = useStepAction();
  const dirty = JSON.stringify(rows) !== saved;

  function change(next: Row[]) {
    setRows(next);
    action.clear();
  }

  function save() {
    action.run(
      () => saveComboItemsAction(accountSlug, comboId, rows.map((r) => ({ productId: r.id, quantity: r.quantity }))),
      () => setSaved(JSON.stringify(rows)),
    );
  }

  return (
    <SectionCard
      title="Productos del combo"
      count={rows.length}
      description="Los productos individuales que forman el combo, con la cantidad de cada uno. Lo demás del combo, como marca o compatibilidades, se carga en su ficha."
    >
      <SectionBody>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no tiene productos. Buscalos abajo para sumarlos.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_COMBO_QUANTITY}
                  aria-label={`Cantidad de ${r.name}`}
                  className="w-16 shrink-0 tabular-nums"
                  value={r.quantity}
                  disabled={action.pending}
                  onChange={(e) => change(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                />
                <div className="min-w-0 flex-1">
                  <Link href={`/a/${accountSlug}/productos/${r.id}`} className="block truncate text-sm font-medium hover:underline">
                    {r.name}
                  </Link>
                  {productDetail(r) ? <p className="truncate text-xs text-muted-foreground">{productDetail(r)}</p> : null}
                </div>
                <IconButton label={`Sacar ${r.name}`} disabled={action.pending} onClick={() => change(rows.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        <ProductSearch
          id={`combo-search-${comboId}`}
          label="Sumar un producto individual"
          search={(q) => searchComboProductsAction(accountSlug, comboId, q)}
          pickLabel="Sumar"
          emptyText="No hay productos individuales que coincidan, o ya están en el combo."
          exclude={rows.map((r) => r.id)}
          disabled={action.pending}
          onPick={(p) =>
            change([...rows, { id: p.id, name: p.name, brand: p.brand, partNumber: p.partNumber, productType: p.productType, quantity: '1' }])
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button pending={action.pending} onClick={save} disabled={action.pending || !dirty}>
            {action.pending ? 'Guardando…' : 'Guardar'}
          </Button>
          {dirty ? <span className="text-sm text-muted-foreground">Hay cambios sin guardar.</span> : null}
          <StatusText status={action.status} />
        </div>
      </SectionBody>
    </SectionCard>
  );
}
