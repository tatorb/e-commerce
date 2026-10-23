'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RowList } from '@/components/products/RowList';
import { saveProductAction } from '@/app/a/[cuenta]/productos/actions';
import { PRODUCT_KINDS, PRODUCT_KIND_LABEL } from '@/domain/combos';
import { cn } from '@/lib/utils/cn';

export type ProductFormValues = {
  name: string;
  kind: 'INDIVIDUAL' | 'COMBO';
  brand: string;
  partNumber: string;
  productType: string;
  engineSystem: string;
  line: string;
  origin: string;
  warranty: string;
  kitContents: string;
  notes: string;
  specs: { name: string; value: string }[];
  variants: { measure: string; sku: string }[];
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
  assets: { kind: 'PHOTO' | 'VIDEO'; url: string }[];
};

export const EMPTY_PRODUCT: ProductFormValues = {
  name: '',
  kind: 'INDIVIDUAL',
  brand: '',
  partNumber: '',
  productType: '',
  engineSystem: '',
  line: '',
  origin: '',
  warranty: '',
  kitContents: '',
  notes: '',
  specs: [],
  variants: [],
  compatibilities: [],
  assets: [],
};

type Status = { kind: 'idle' } | { kind: 'success' } | { kind: 'error'; message: string };

/** Las partes de la ficha, para mostrar solo algunas en cada pestaña del producto. */
export type ProductFormSection = 'general' | 'variants' | 'compatibilities' | 'specs' | 'kit' | 'assets' | 'notes';

const GENERAL_FIELDS: { key: keyof ProductFormValues; label: string; placeholder?: string }[] = [
  { key: 'brand', label: 'Marca del repuesto', placeholder: 'Persan, Dexco, Sabó…' },
  { key: 'partNumber', label: 'Número de pieza u OEM' },
  { key: 'productType', label: 'Tipo de producto', placeholder: 'subconjunto, kit de embrague…' },
  { key: 'engineSystem', label: 'Sistema del motor', placeholder: 'tren alternativo, distribución…' },
  { key: 'line', label: 'Línea', placeholder: 'liviano nafta, línea pesada…' },
  { key: 'origin', label: 'Origen', placeholder: 'Argentina, Brasil…' },
];

export function ProductForm({
  accountSlug,
  productId,
  initial,
  sections,
}: {
  accountSlug: string;
  productId: string | null;
  initial: ProductFormValues;
  // Las partes que se ven; sin elegir, todas. Lo que no se ve se guarda igual, como está.
  sections?: ProductFormSection[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>(initial);
  const [saved, setSaved] = useState<ProductFormValues>(initial);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();
  const isNew = productId === null;
  const show = (section: ProductFormSection) => !sections || sections.includes(section);

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (status.kind !== 'idle') setStatus({ kind: 'idle' });
  }

  function handleSave() {
    if (
      saved.kind === 'COMBO' &&
      values.kind === 'INDIVIDUAL' &&
      !window.confirm('Al pasarlo a Individual se borra la lista de productos del combo. ¿Seguir?')
    ) {
      return;
    }
    setStatus({ kind: 'idle' });
    // "Individual o Combo" va solo si se cambió acá: así una ficha abierta hace
    // rato no deshace un combo armado en otra pestaña o desde Claude.
    const { kind, ...rest } = values;
    const input = isNew || kind !== saved.kind ? values : rest;
    startTransition(async () => {
      const result = await saveProductAction(accountSlug, productId, input);
      if (!result.ok) {
        setStatus({ kind: 'error', message: result.error });
        return;
      }
      if (isNew) {
        router.push(`/a/${accountSlug}/productos/${result.id}`);
        return;
      }
      setSaved(values);
      setStatus({ kind: 'success' });
      router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col gap-4 md:gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      {show('general') ? (
        <Card>
          <CardHeader>
            <CardTitle>Datos generales</CardTitle>
            <CardDescription>Lo que identifica al producto, en cualquier canal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={values.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="subconjunto Ford 1.6 8v Zetec Rocam…"
                disabled={pending}
                maxLength={300}
                required
              />
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Tipo</legend>
              <div className="inline-flex rounded-md border p-0.5" role="radiogroup" aria-label="Tipo">
                {PRODUCT_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={values.kind === k}
                    disabled={pending}
                    onClick={() => set('kind', k)}
                    className={cn(
                      'rounded px-3 py-1 text-sm transition-colors',
                      values.kind === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {PRODUCT_KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {values.kind === 'COMBO'
                  ? isNew || saved.kind !== 'COMBO'
                    ? 'Un combo se arma con productos individuales. Los elegís después de guardar, en la tarjeta Productos del combo.'
                    : 'Un combo se arma con productos individuales. Se eligen en la tarjeta Productos del combo.'
                  : 'Se vende tal cual. Puede formar parte de combos.'}
              </p>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              {GENERAL_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Input
                    id={f.key}
                    value={values[f.key] as string}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    disabled={pending}
                    maxLength={200}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {show('variants') ? (
        <Card>
          <CardHeader>
            <CardTitle>Medidas y SKU</CardTitle>
            <CardDescription>
              Una fila por medida, por ejemplo STD, 0.25 o 0.50, cada una con su SKU.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RowList
              idPrefix="variant"
              rows={values.variants}
              onChange={(rows) => set('variants', rows)}
              template={{ measure: '', sku: '' }}
              columns={[
                { key: 'measure', label: 'Medida', placeholder: 'STD, 0.50…' },
                { key: 'sku', label: 'SKU' },
              ]}
              gridClassName="sm:grid-cols-2"
              mobileGridClassName="grid-cols-2"
              addLabel="Agregar medida"
              emptyLabel="Sin medidas cargadas."
              disabled={pending}
            />
          </CardContent>
        </Card>
      ) : null}

      {show('compatibilities') ? (
        <Card>
          <CardHeader>
            <CardTitle>Compatibilidades</CardTitle>
            <CardDescription>
              Con qué vehículos y motores es compatible. Si dejás vacíos la cilindrada o el combustible, se completan con
              lo que diga el motor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RowList
              idPrefix="compat"
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
              mobileGridClassName="grid-cols-2"
              addLabel="Agregar compatibilidad"
              emptyLabel="Sin compatibilidades cargadas."
              disabled={pending}
            />
          </CardContent>
        </Card>
      ) : null}

      {show('specs') ? (
        <Card>
          <CardHeader>
            <CardTitle>Ficha técnica</CardTitle>
            <CardDescription>Datos técnicos como atributo y valor, por ejemplo Diámetro y 79,5 mm.</CardDescription>
          </CardHeader>
          <CardContent>
            <RowList
              idPrefix="spec"
              rows={values.specs}
              onChange={(rows) => set('specs', rows)}
              template={{ name: '', value: '' }}
              columns={[
                { key: 'name', label: 'Atributo' },
                { key: 'value', label: 'Valor' },
              ]}
              gridClassName="sm:grid-cols-2"
              addLabel="Agregar atributo"
              emptyLabel="Sin datos técnicos cargados."
              disabled={pending}
            />
          </CardContent>
        </Card>
      ) : null}

      {show('kit') ? (
        <Card>
          <CardHeader>
            <CardTitle>Contenido del kit y garantía</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="kitContents">Contenido del kit</Label>
              <Textarea
                id="kitContents"
                value={values.kitContents}
                onChange={(e) => set('kitContents', e.target.value)}
                placeholder="qué trae y qué no trae…"
                disabled={pending}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="warranty">Garantía</Label>
              <Input
                id="warranty"
                value={values.warranty}
                onChange={(e) => set('warranty', e.target.value)}
                placeholder="30 días de garantía…"
                disabled={pending}
                maxLength={500}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {show('assets') ? (
        <Card>
          <CardHeader>
            <CardTitle>Fotos y videos por link</CardTitle>
            <CardDescription>
              Fotos y videos del producto que están en otro lado, por su link. Se pueden elegir en Organización de multimedia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RowList
              idPrefix="asset"
              rows={values.assets}
              onChange={(rows) => set('assets', rows as ProductFormValues['assets'])}
              template={{ kind: 'PHOTO', url: '' }}
              columns={[
                {
                  key: 'kind',
                  label: 'Tipo',
                  options: [
                    { value: 'PHOTO', label: 'Foto' },
                    { value: 'VIDEO', label: 'Video' },
                  ],
                },
                { key: 'url', label: 'Link', placeholder: 'https://…', inputMode: 'url' },
              ]}
              gridClassName="sm:grid-cols-[8rem_1fr]"
              addLabel="Agregar foto o video"
              emptyLabel="Sin fotos ni videos cargados."
              disabled={pending}
            />
          </CardContent>
        </Card>
      ) : null}

      {show('notes') ? (
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
            <CardDescription>Para el equipo. No se muestran en ningún canal.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              aria-label="Notas"
              value={values.notes}
              onChange={(e) => set('notes', e.target.value)}
              disabled={pending}
              rows={3}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* En el celular, el botón queda a la vista abajo mientras se completa. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Button type="submit" pending={pending} disabled={pending || !dirty || !values.name.trim()}>
          {isNew ? (pending ? 'Creando…' : 'Crear producto') : pending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        {status.kind === 'success' ? <span className="text-sm text-green-600">Guardado.</span> : null}
        {dirty && status.kind === 'idle' && !isNew ? <span className="text-sm text-muted-foreground">Hay cambios sin guardar.</span> : null}
        {status.kind === 'error' ? (
          <span className="text-sm text-destructive">{status.message}</span>
        ) : null}
      </div>
    </form>
  );
}
