'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RowList } from '@/components/products/RowList';
import { saveProductInfoAction } from '@/app/a/[cuenta]/pipeline/step-actions';
import { useStepAction } from '../useStepAction';
import { StatusText } from '../StatusText';

// Los datos de la ficha que usa el título, para revisarlos y corregirlos sin
// salir del pipeline. Se guardan en la ficha maestra.

export type ProductInfoValues = {
  productType: string;
  brand: string;
  partNumber: string;
  line: string;
  origin: string;
  variants: { id: string; measure: string; sku: string }[];
  compatibilities: {
    vehicleBrand: string;
    model: string;
    engine: string;
    displacement: string;
    fuel: string;
    yearFrom: string;
    yearTo: string;
    note: string;
  }[];
};

const FIELDS: { key: 'productType' | 'brand' | 'partNumber' | 'line' | 'origin'; label: string; placeholder?: string }[] = [
  { key: 'productType', label: 'Tipo de producto', placeholder: 'subconjunto, kit de embrague…' },
  { key: 'brand', label: 'Marca del repuesto', placeholder: 'Persan, Dexco, Sabó…' },
  { key: 'partNumber', label: 'Número de pieza u OEM' },
  { key: 'line', label: 'Línea', placeholder: 'liviano nafta, línea pesada…' },
  { key: 'origin', label: 'Origen', placeholder: 'Argentina, Brasil…' },
];

export function ProductInfoForm({
  accountSlug,
  publicationId,
  initial,
}: {
  accountSlug: string;
  publicationId: string;
  initial: ProductInfoValues;
}) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const action = useStepAction();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);

  function set<K extends keyof ProductInfoValues>(key: K, value: ProductInfoValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    action.clear();
  }

  function save() {
    action.run(
      () =>
        saveProductInfoAction(accountSlug, publicationId, {
          ...values,
          variants: values.variants.map((v) => ({ id: v.id || null, measure: v.measure, sku: v.sku })),
        }),
      () => setSaved(values),
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`info-${f.key}`}>{f.label}</Label>
            <Input
              id={`info-${f.key}`}
              value={values[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              disabled={action.pending}
              maxLength={200}
            />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Medidas y SKU</p>
        <RowList
          idPrefix="info-variant"
          rows={values.variants}
          onChange={(rows) => set('variants', rows)}
          template={{ id: '', measure: '', sku: '' }}
          columns={[
            { key: 'measure', label: 'Medida', placeholder: 'STD, 0.50…' },
            { key: 'sku', label: 'SKU' },
          ]}
          gridClassName="sm:grid-cols-2"
          addLabel="Agregar medida"
          emptyLabel="Sin medidas cargadas."
          disabled={action.pending}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Compatibilidades</p>
        <p className="text-xs text-muted-foreground">
          Si dejás vacíos la cilindrada o el combustible, se completan con lo que diga el motor.
        </p>
        <RowList
          idPrefix="info-compat"
          rows={values.compatibilities}
          onChange={(rows) => set('compatibilities', rows)}
          template={{ vehicleBrand: '', model: '', engine: '', displacement: '', fuel: '', yearFrom: '', yearTo: '', note: '' }}
          columns={[
            { key: 'vehicleBrand', label: 'Marca', placeholder: 'Ford…' },
            { key: 'model', label: 'Modelo', placeholder: 'Fiesta…' },
            { key: 'engine', label: 'Motor', placeholder: '1.6 8v Rocam…' },
            { key: 'displacement', label: 'Cilindrada', placeholder: '1.6' },
            { key: 'fuel', label: 'Combustible', placeholder: 'Nafta…' },
            { key: 'yearFrom', label: 'Desde', placeholder: 'año', inputMode: 'numeric' },
            { key: 'yearTo', label: 'Hasta', placeholder: 'año', inputMode: 'numeric' },
            { key: 'note', label: 'Nota' },
          ]}
          gridClassName="sm:grid-cols-[1fr_1fr_1fr_4.5rem_6rem_4.5rem_4.5rem_1fr]"
          addLabel="Agregar compatibilidad"
          emptyLabel="Sin compatibilidades cargadas."
          disabled={action.pending}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button pending={action.pending} type="submit" disabled={action.pending || !dirty}>
          {action.pending ? 'Guardando…' : 'Guardar en la ficha'}
        </Button>
        {dirty ? <span className="text-sm text-muted-foreground">Hay cambios sin guardar.</span> : null}
        <StatusText status={action.status} />
      </div>
    </form>
  );
}
