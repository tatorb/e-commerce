'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { saveCatalogAction, setCatalogCategoryAction } from '@/app/a/[cuenta]/pipeline/catalog-actions';
import { BOOLEAN_OPTIONS, splitNumberUnit, type CatalogField } from '@/domain/catalog-data';
import type { CatalogData } from '@/lib/catalog-data';
import { cn } from '@/lib/utils/cn';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const unitLabel = (u: string) => (u === '"' ? '" (pulgadas)' : u);

type Draft = { values: Record<string, string>; units: Record<string, string> };

function toDraft(fields: CatalogField[], saved: Record<string, string>): Draft {
  const draft: Draft = { values: {}, units: {} };
  for (const f of fields) {
    const v = saved[f.id] ?? '';
    if (f.type === 'number_unit') {
      const { number, unit } = splitNumberUnit(v);
      draft.values[f.id] = v ? number : '';
      draft.units[f.id] = unit && f.units?.includes(unit) ? unit : (f.defaultUnit ?? f.units?.[0] ?? '');
    } else {
      draft.values[f.id] = v;
    }
  }
  return draft;
}

function fromDraft(fields: CatalogField[], draft: Draft): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = (draft.values[f.id] ?? '').trim();
    out[f.id] = f.type === 'number_unit' && v ? `${v} ${draft.units[f.id]}` : v;
  }
  return out;
}

// Los campos del formulario del canal para la categoría de la publicación,
// con sus opciones. Lo que ya está en la ficha se muestra y no se carga dos
// veces. Es de la publicación.
export function CatalogCard({
  accountSlug,
  publicationId,
  data,
  bare = false,
}: {
  accountSlug: string;
  publicationId: string;
  data: CatalogData;
  // Sin la tarjeta alrededor, para usarlo dentro de otra.
  bare?: boolean;
}) {
  const action = useStepAction();
  const [dirty, setDirty] = useState(false);
  const { category, familyCategory, family } = data;
  const filled = data.fields.filter((f) => data.values[f.id]).length;

  function changeCategory(id: string) {
    if (dirty && !window.confirm('Hay cambios sin guardar en los campos. ¿Cambiar la categoría igual?')) return;
    action.run(() => setCatalogCategoryAction(accountSlug, publicationId, id || null), () => setDirty(false));
  }

  const others = data.categories
    .filter((c) => c.id !== familyCategory?.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const body = (
    <SectionBody className={bare ? 'px-0 py-0' : undefined}>
      <div className="space-y-2">
        <Label htmlFor="catalog-category">Categoría</Label>
        <select
          id="catalog-category"
          className={cn(SELECT_CLASS, 'md:max-w-md')}
          value={data.source === 'manual' && category ? category.id : ''}
          disabled={action.pending}
          onChange={(e) => changeCategory(e.target.value)}
        >
          {familyCategory ? (
            <option value="">{familyCategory.name}, por la familia</option>
          ) : (
            <option value="" disabled>
              Elegí una categoría
            </option>
          )}
          {others.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {data.source === 'family'
            ? `Sale de la familia «${family}».`
            : data.source === 'manual'
              ? familyCategory
                ? `Elegida a mano. A la familia «${family}» le toca ${familyCategory.name}.`
                : 'Elegida a mano.'
              : family
                ? `La familia «${family}» no tiene una categoría asignada: elegila acá.`
                : 'El producto no tiene familia en la ficha: elegí la categoría acá.'}
        </p>
      </div>

      {category ? (
        <>
          {data.fromProduct.length > 0 ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2.5">
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
                {data.fromProduct.map(({ field, value }) => (
                  <div key={field.id} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{field.label}</dt>
                    <dd className={cn('truncate text-sm', !value && 'text-muted-foreground')}>{value ?? 'Falta en la ficha'}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">Salen de la ficha: se cambian en los datos del producto.</p>
            </div>
          ) : null}

          <CatalogFields
            // Se vuelve a armar al cambiar la categoría o al guardar, con los valores limpios.
            key={`${category.id}:${JSON.stringify(data.values)}`}
            fields={data.fields}
            saved={data.values}
            fromStore={data.fromStore}
            pending={action.pending}
            onDirty={(d) => {
              setDirty(d);
              if (d) action.clear();
            }}
            onSave={(values) =>
              action.run(
                () => saveCatalogAction(accountSlug, publicationId, category.id, values),
                () => setDirty(false),
              )
            }
          />
          <StatusText status={action.status} className="block" />
        </>
      ) : null}
    </SectionBody>
  );
  if (bare) return body;
  return (
    <SectionCard
      title={`Datos de catálogo en ${data.channelName}`}
      count={filled}
      description={`Los campos del formulario de ${data.channelName} para la categoría, con las mismas opciones. Marca, número de pieza y origen salen de la ficha.`}
    >
      {body}
    </SectionCard>
  );
}

function CatalogFields({
  fields,
  saved,
  fromStore,
  pending,
  onDirty,
  onSave,
}: {
  fields: CatalogField[];
  saved: Record<string, string>;
  fromStore: CatalogData['fromStore'];
  pending: boolean;
  onDirty: (dirty: boolean) => void;
  onSave: (values: Record<string, string>) => void;
}) {
  const initial = useMemo(() => toDraft(fields, saved), [fields, saved]);
  const [draft, setDraft] = useState(initial);
  const dirty = JSON.stringify(fromDraft(fields, draft)) !== JSON.stringify(fromDraft(fields, initial));
  const filled = fields.filter((f) => (draft.values[f.id] ?? '').trim() !== '').length;

  function set(kind: keyof Draft, id: string, value: string) {
    const next = { ...draft, [kind]: { ...draft[kind], [id]: value } };
    setDraft(next);
    onDirty(JSON.stringify(fromDraft(fields, next)) !== JSON.stringify(fromDraft(fields, initial)));
  }

  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">Esta categoría no tiene otros campos para cargar.</p>;
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(fromDraft(fields, draft));
      }}
    >
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        {fields.map((f) => (
          <FieldInput
            key={f.id}
            field={f}
            value={draft.values[f.id] ?? ''}
            unit={draft.units[f.id] ?? ''}
            fallback={fromStore[f.id] ?? null}
            disabled={pending}
            onChange={(v) => set('values', f.id, v)}
            onUnit={(u) => set('units', f.id, u)}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button pending={pending} type="submit" disabled={pending || !dirty}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
        <span className="text-sm text-muted-foreground">
          {filled} de {fields.length} campos completos.
        </span>
      </div>
    </form>
  );
}

function FieldInput({
  field,
  value,
  unit,
  fallback,
  disabled,
  onChange,
  onUnit,
}: {
  field: CatalogField;
  value: string;
  unit: string;
  // Lo que va si queda vacío: lo que tiene la mayoría de las publicaciones de la tienda.
  fallback: CatalogData['fromStore'][string] | null;
  disabled: boolean;
  onChange: (value: string) => void;
  onUnit: (unit: string) => void;
}) {
  const id = `catalog-${field.id}`;
  const label = (
    <Label htmlFor={id}>
      {field.label}
      {field.required ? <span className="ml-1 text-xs font-normal text-muted-foreground">obligatorio</span> : null}
    </Label>
  );

  const hint =
    fallback && !value.trim() ? (
      <p className="text-xs text-muted-foreground">
        Si queda vacío, va «{fallback.value}», como en {fallback.count === fallback.total ? 'todas las' : `${fallback.count} de ${fallback.total}`}{' '}
        publicaciones de la tienda.
      </p>
    ) : null;

  if (field.type === 'list' || field.type === 'boolean') {
    const options: readonly string[] = field.type === 'boolean' ? BOOLEAN_OPTIONS : (field.options ?? []);
    return (
      <div className="space-y-2">
        {label}
        <select id={id} className={SELECT_CLASS} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="">Sin elegir</option>
          {/* Un valor viejo que ya no es opción se muestra igual, para no perderlo sin aviso. */}
          {value && !options.includes(value) ? <option value={value}>{value}</option> : null}
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {hint}
      </div>
    );
  }

  if (field.type === 'number_unit') {
    const units = field.units ?? [];
    return (
      <div className="space-y-2">
        {label}
        <div className="flex gap-2">
          <Input id={id} inputMode="decimal" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
          {units.length > 1 ? (
            <select
              aria-label={`Unidad de ${field.label.toLowerCase()}`}
              className={cn(SELECT_CLASS, 'w-auto shrink-0')}
              value={unit}
              disabled={disabled}
              onChange={(e) => onUnit(e.target.value)}
            >
              {units.map((u) => (
                <option key={u} value={u}>
                  {unitLabel(u)}
                </option>
              ))}
            </select>
          ) : (
            <span className="flex shrink-0 items-center px-1 text-sm text-muted-foreground">{unitLabel(units[0] ?? '')}</span>
          )}
        </div>
      </div>
    );
  }

  const listId = field.options?.length ? `${id}-options` : undefined;
  return (
    <div className="space-y-2">
      {label}
      <Input
        id={id}
        inputMode={field.type === 'number' ? 'decimal' : undefined}
        list={listId}
        value={value}
        disabled={disabled}
        placeholder={field.multiple ? 'Si son varios, separalos con coma' : field.options?.length ? 'Elegí o escribí' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {listId ? (
        <datalist id={listId}>
          {field.options!.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}
