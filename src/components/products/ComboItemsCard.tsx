'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconButton, SectionBody, SectionCard } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { saveComboItemsAction, searchComboProductsAction } from '@/app/a/[cuenta]/productos/combo-actions';
import { MAX_COMBO_QUANTITY } from '@/domain/combos';
import type { ComboProduct } from '@/lib/queries/combos';

type Candidate = Omit<ComboProduct, 'quantity'>;
type Row = Candidate & { quantity: string };

const detail = (p: Candidate) => [p.brand, p.partNumber, p.productType].filter(Boolean).join(' · ');

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
                  {detail(r) ? <p className="truncate text-xs text-muted-foreground">{detail(r)}</p> : null}
                </div>
                <IconButton label={`Sacar ${r.name}`} disabled={action.pending} onClick={() => change(rows.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        <ProductSearch
          accountSlug={accountSlug}
          comboId={comboId}
          exclude={rows.map((r) => r.id)}
          disabled={action.pending}
          onPick={(p) => change([...rows, { ...p, quantity: '1' }])}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={action.pending || !dirty}>
            {action.pending ? 'Guardando…' : 'Guardar'}
          </Button>
          {dirty ? <span className="text-sm text-muted-foreground">Hay cambios sin guardar.</span> : null}
          <StatusText status={action.status} />
        </div>
      </SectionBody>
    </SectionCard>
  );
}

function ProductSearch({
  accountSlug,
  comboId,
  exclude,
  disabled,
  onPick,
}: {
  accountSlug: string;
  comboId: string;
  exclude: string[];
  disabled: boolean;
  onPick: (p: Candidate) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const id = ++last.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      const found = await searchComboProductsAction(accountSlug, comboId, term);
      // Solo vale la respuesta de la última búsqueda.
      if (id === last.current) {
        setResults(found);
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q, accountSlug, comboId]);

  const term = q.trim();
  const visible = term.length < 2 ? [] : results.filter((r) => !exclude.includes(r.id));
  return (
    <div className="space-y-2">
      <Label htmlFor={`combo-search-${comboId}`}>Sumar un producto individual</Label>
      <Input
        id={`combo-search-${comboId}`}
        value={q}
        disabled={disabled}
        placeholder="Nombre, marca, número de pieza o SKU"
        onChange={(e) => setQ(e.target.value)}
      />
      {term.length >= 2 ? (
        visible.length > 0 ? (
          <ul className="divide-y rounded-md border" aria-label="Productos encontrados">
            {visible.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{p.name}</p>
                  {detail(p) ? <p className="truncate text-xs text-muted-foreground">{detail(p)}</p> : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  aria-label={`Sumar ${p.name}`}
                  onClick={() => {
                    onPick(p);
                    setQ('');
                    setResults([]);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Sumar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {searching ? 'Buscando…' : 'No hay productos individuales que coincidan, o ya están en el combo.'}
          </p>
        )
      ) : null}
    </div>
  );
}
