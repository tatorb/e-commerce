'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MeasureRow } from '@/domain/shoot';
import { addShootMeasuresAction, createShootProductAction } from '@/app/a/[cuenta]/registro-productos/actions';

// Desde el registro: crear un producto que entra por primera vez, con lo
// básico, o sumarle medidas a uno que ya está, para seguir con las fotos sin
// ir a Productos. El resto de la ficha se completa después en Productos.

const EMPTY_ROW: MeasureRow = { measure: '', sku: '' };
const failed = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** Las medidas, una por línea: el nombre y, si tiene, el SKU. */
function MeasureRows({ rows, onChange, idPrefix }: { rows: MeasureRow[]; onChange: (rows: MeasureRow[]) => void; idPrefix: string }) {
  const set = (i: number, patch: Partial<MeasureRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            id={i === 0 ? `${idPrefix}-medida` : undefined}
            aria-label={`Medida ${i + 1}`}
            value={r.measure}
            onChange={(e) => set(i, { measure: e.target.value })}
            placeholder="Por ejemplo STD o 0.50"
            className="h-11 min-w-0 flex-1 text-base"
          />
          <Input
            aria-label={`SKU de la medida ${i + 1}`}
            value={r.sku}
            onChange={(e) => set(i, { sku: e.target.value })}
            placeholder="SKU, si tiene"
            className="h-11 min-w-0 flex-1 text-base"
            autoCapitalize="characters"
          />
          {rows.length > 1 ? (
            <Button type="button" variant="ghost" size="icon" aria-label={`Sacar la medida ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))} access="view">
              <X />
            </Button>
          ) : null}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, EMPTY_ROW])} className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
        <Plus className="h-4 w-4" />
        Otra medida
      </button>
    </div>
  );
}

/** Crear un producto nuevo con lo básico y empezar a registrarlo. */
export function NewProductForm({ accountSlug, base, search, startOpen }: { accountSlug: string; base: string; search: string; startOpen: boolean }) {
  const router = useRouter();
  // Lo que se buscó: con números parece un código; si no, el nombre.
  const looksLikeCode = /\d/.test(search);
  const [open, setOpen] = useState(startOpen);
  const [name, setName] = useState(looksLikeCode ? '' : search);
  const [partNumber, setPartNumber] = useState(looksLikeCode ? search : '');
  const [brand, setBrand] = useState('');
  const [productType, setProductType] = useState('');
  const [measures, setMeasures] = useState<MeasureRow[]>([EMPTY_ROW]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="lg" className="w-full px-4" onClick={() => setOpen(true)}>
        <Plus />
        Crear producto nuevo
      </Button>
    );
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const r = await createShootProductAction(accountSlug, { name, partNumber, brand, productType, measures });
      if (!r.ok) throw new Error(r.error);
      router.push(`${base}?producto=${r.id}`);
    } catch (e) {
      setPending(false);
      setError(failed(e, 'No se pudo crear. Revisá la conexión y probá de nuevo.'));
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold">Crear producto nuevo</h3>
        <p className="text-xs text-muted-foreground">Lo básico para empezar con las fotos. El resto de la ficha se completa después en Productos.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nuevo-nombre">Nombre</Label>
        <Input id="nuevo-nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Por ejemplo: Bujía de encendido" className="h-11 text-base" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nuevo-codigo">Código o número de pieza</Label>
          <Input id="nuevo-codigo" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} className="h-11 text-base" autoCapitalize="characters" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nuevo-marca">Marca</Label>
          <Input id="nuevo-marca" value={brand} onChange={(e) => setBrand(e.target.value)} className="h-11 text-base" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nuevo-tipo">Tipo de producto</Label>
        <Input id="nuevo-tipo" value={productType} onChange={(e) => setProductType(e.target.value)} placeholder="Por ejemplo: Bujía" className="h-11 text-base" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nuevo-medida">Medidas, si tiene</Label>
        <MeasureRows rows={measures} onChange={setMeasures} idPrefix="nuevo" />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="lg" className="px-4" onClick={save} pending={pending} disabled={pending}>
          Crear y seguir
        </Button>
        <Button type="button" size="lg" variant="outline" className="px-4" onClick={() => setOpen(false)} disabled={pending} access="view">
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/** Sumarle medidas a un producto que ya está. */
export function AddMeasuresForm({ accountSlug, productId, label, hint }: { accountSlug: string; productId: string; label: string; hint?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<MeasureRow[]>([EMPTY_ROW]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const r = await addShootMeasuresAction(accountSlug, productId, rows);
      if (!r.ok) throw new Error(r.error);
      setSaved(r.added === 1 ? 'Se agregó la medida.' : `Se agregaron ${r.added} medidas.`);
      setRows([EMPTY_ROW]);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(failed(e, 'No se pudo guardar. Revisá la conexión y probá de nuevo.'));
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="space-y-1">
        {saved ? (
          <p className="text-sm text-muted-foreground" role="status">
            {saved}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSaved(null);
          }}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <Plus className="h-4 w-4" />
          {label}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold">{label}</h3>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <MeasureRows rows={rows} onChange={setRows} idPrefix="agregar" />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="lg" className="px-4" onClick={save} pending={pending} disabled={pending}>
          Guardar
        </Button>
        <Button type="button" size="lg" variant="outline" className="px-4" onClick={() => setOpen(false)} disabled={pending} access="view">
          Cancelar
        </Button>
      </div>
    </div>
  );
}
