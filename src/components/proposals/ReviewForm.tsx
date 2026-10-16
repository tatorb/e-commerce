'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Loader2, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RowList } from '@/components/products/RowList';
import { CONTENT_FIELD_KIND, CONTENT_FIELD_LABEL, type ContentField } from '@/domain/content';
import {
  findPlaceholders,
  REVIEWABLE_FIELDS,
  toEditorValue,
  validateReview,
  type CompatRow,
  type EditorValue,
  type MeasureRow,
  type ReviewField,
  type ReviewProblem,
  type SpecRow,
} from '@/domain/review';
import { cn } from '@/lib/utils/cn';
import { approveProposalAction, saveReviewDraftAction } from '@/app/a/[cuenta]/publicaciones/review-actions';
import { RejectDialog } from './RejectDialog';
import { ToConfirm, Value } from './ProposalView';

export type AiFieldInfo = { value: unknown; reason: string; toConfirm: string[] };

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** La pantalla de revisión: Hoy a la izquierda, lo que queda a la derecha, campo por campo. */
export function ReviewForm({
  accountSlug,
  proposalId,
  productUrl,
  reviewBase,
  titleMaxLength,
  canEdit,
  initialFields,
  current,
  ai,
  drift,
  savedText,
}: {
  accountSlug: string;
  proposalId: string;
  productUrl: string;
  // Para armar el link de la próxima: `${reviewBase}/${id}/revision`.
  reviewBase: string;
  titleMaxLength: number | null;
  canEdit: boolean;
  initialFields: ReviewField[];
  current: Record<ContentField, unknown>;
  ai: Partial<Record<ContentField, AiFieldInfo>>;
  drift: ContentField[];
  savedText: string | null;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<ReviewField[]>(initialFields);
  const [message, setMessage] = useState<string | null>(savedText);
  const [error, setError] = useState<string | null>(null);
  const [serverProblems, setServerProblems] = useState<ReviewProblem[]>([]);
  const [pending, startTransition] = useTransition();
  const disabled = !canEdit || pending;

  const check = useMemo(() => validateReview(fields, { titleMaxLength }), [fields, titleMaxLength]);
  const problems = serverProblems.length > 0 ? serverProblems : check.problems;
  const addable = REVIEWABLE_FIELDS.filter((f) => !fields.some((x) => x.field === f));

  function update(field: ContentField, patch: Partial<ReviewField>) {
    setServerProblems([]);
    setMessage(null);
    setFields((list) => list.map((f) => (f.field === field ? { ...f, ...patch } : f)));
  }

  function add(field: ContentField) {
    setFields((list) => [...list, { field, value: toEditorValue(field, current[field]), included: true, fromAi: false }]);
  }

  function remove(field: ContentField) {
    setFields((list) => list.filter((f) => f.field !== field));
  }

  function saveDraft() {
    setError(null);
    startTransition(async () => {
      const r = await saveReviewDraftAction(accountSlug, proposalId, fields);
      if (r.ok) setMessage('Borrador guardado.');
      else setError(r.error);
    });
  }

  function approve(next: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await approveProposalAction(accountSlug, proposalId, fields, { next });
      if (!r.ok) {
        setError(r.error);
        setServerProblems(r.problems ?? []);
        return;
      }
      router.push(r.nextPublicationId ? `${reviewBase}/${r.nextPublicationId}/revision` : productUrl);
    });
  }

  return (
    <div className="space-y-4">
      {fields.map((f) => {
        const info = ai[f.field];
        const aiValue = info ? toEditorValue(f.field, info.value) : null;
        const edited = aiValue !== null && JSON.stringify(aiValue) !== JSON.stringify(f.value);
        const marks = findPlaceholders(f.value);
        const own = problems.filter((p) => p.field === f.field);
        // Las listas anchas van una debajo de la otra: no entran en media pantalla.
        const wide = CONTENT_FIELD_KIND[f.field] === 'compatibilities' || CONTENT_FIELD_KIND[f.field] === 'specs';
        return (
          <div key={f.field} className={cn('rounded-md border bg-background', !f.included && 'opacity-60')}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                  checked={f.included}
                  onChange={(e) => update(f.field, { included: e.target.checked })}
                  disabled={disabled}
                  aria-label={`Usar este cambio en ${CONTENT_FIELD_LABEL[f.field]}`}
                />
                {CONTENT_FIELD_LABEL[f.field]}
              </label>
              <span className="text-xs text-muted-foreground">{f.included ? 'Usar este cambio' : 'Queda como está'}</span>
              {!f.fromAi ? <span className="text-xs text-muted-foreground">· sumado en la revisión</span> : null}
              {edited ? <span className="text-xs text-muted-foreground">· editado</span> : null}
              <div className="ml-auto flex items-center gap-1">
                {f.fromAi && edited ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => update(f.field, { value: aiValue! })}
                    disabled={disabled}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Volver a lo propuesto
                  </Button>
                ) : null}
                {!f.fromAi ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => remove(f.field)} disabled={disabled}>
                    <X className="h-4 w-4" />
                    Quitar
                  </Button>
                ) : null}
              </div>
            </div>
            {info?.reason || drift.includes(f.field) ? (
              <div className="space-y-1 border-b px-4 py-2 text-sm">
                {info?.reason ? <p className="text-muted-foreground">{info.reason}</p> : null}
                {drift.includes(f.field) ? (
                  <p className="flex items-start gap-2 text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Este campo cambió en la app después de generar la propuesta. Mirá cómo está hoy antes de aprobar.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className={cn('grid', !wide && 'md:grid-cols-2 md:divide-x')}>
              <div className="space-y-1 px-4 py-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Hoy</p>
                <div className="text-muted-foreground">
                  <Value field={f.field} value={current[f.field]} />
                </div>
              </div>
              <div className={cn('space-y-2 border-t px-4 py-3 text-sm', !wide && 'md:border-t-0')}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Queda</p>
                <FieldEditor
                  field={f.field}
                  value={f.value}
                  onChange={(value) => update(f.field, { value })}
                  disabled={disabled}
                  titleMaxLength={titleMaxLength}
                />
              </div>
            </div>
            {(info?.toConfirm.length ?? 0) > 0 || marks.length > 0 || (f.included && own.length > 0) ? (
              <div className="space-y-1 border-t px-4 py-2.5">
                <ToConfirm
                  items={[...(info?.toConfirm ?? []), ...marks.map((m) => `completar «${m}» en el texto`)]}
                />
                {f.included
                  ? own
                      .filter((p) => !p.message.includes('falta completar'))
                      .map((p, i) => (
                        <p key={i} className="text-sm text-destructive">
                          {p.message}
                        </p>
                      ))
                  : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {canEdit && addable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <Select value="" onValueChange={(v) => add(v as ContentField)} disabled={disabled}>
            <SelectTrigger className="w-full sm:w-72" aria-label="Sumar un campo">
              <SelectValue placeholder="Sumar un campo a la revisión…" />
            </SelectTrigger>
            <SelectContent>
              {addable.map((f) => (
                <SelectItem key={f} value={f}>
                  {CONTENT_FIELD_LABEL[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Por ejemplo, para completar algo que la IA dejó a confirmar.
          </span>
        </div>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 space-y-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        {canEdit && problems.length > 0 ? (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Para aprobar falta:</p>
            <ul className="space-y-0.5 text-muted-foreground">
              {problems.map((p, i) => (
                <li key={i}>· {p.field ? lowerFirst(p.message) : p.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => approve(false)} disabled={disabled || problems.length > 0}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aprobar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => approve(true)}
            disabled={disabled || problems.length > 0}
          >
            Aprobar y seguir con la próxima
          </Button>
          <Button type="button" variant="outline" onClick={saveDraft} disabled={disabled}>
            Guardar borrador
          </Button>
          <RejectDialog accountSlug={accountSlug} proposalId={proposalId} productUrl={productUrl} disabled={pending} />
          {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
          {error ? <span className="text-sm text-destructive">{error}</span> : null}
        </div>
      </div>
    </div>
  );
}

function FieldEditor({
  field,
  value,
  onChange,
  disabled,
  titleMaxLength,
}: {
  field: ContentField;
  value: EditorValue;
  onChange: (value: EditorValue) => void;
  disabled: boolean;
  titleMaxLength: number | null;
}) {
  const id = `review-${field}`;
  switch (CONTENT_FIELD_KIND[field]) {
    case 'short': {
      const text = value as string;
      const over = field === 'title' && titleMaxLength !== null && text.trim().length > titleMaxLength;
      return (
        <div className="space-y-1">
          <Input
            id={id}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-label={CONTENT_FIELD_LABEL[field]}
          />
          {field === 'title' && titleMaxLength ? (
            <p className={cn('text-right text-xs tabular-nums', over ? 'text-destructive' : 'text-muted-foreground')}>
              {text.trim().length}/{titleMaxLength}
            </p>
          ) : null}
        </div>
      );
    }
    case 'long':
      return (
        <Textarea
          id={id}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={field === 'description' ? 12 : 4}
          aria-label={CONTENT_FIELD_LABEL[field]}
        />
      );
    case 'specs':
      return (
        <RowList<SpecRow>
          idPrefix={id}
          rows={value as SpecRow[]}
          onChange={onChange}
          template={{ name: '', value: '' }}
          columns={[
            { key: 'name', label: 'Dato' },
            { key: 'value', label: 'Valor' },
          ]}
          gridClassName="sm:grid-cols-2"
          addLabel="Agregar dato"
          emptyLabel="Sin datos."
          disabled={disabled}
        />
      );
    case 'compatibilities':
      return (
        <RowList<CompatRow>
          idPrefix={id}
          rows={value as CompatRow[]}
          onChange={onChange}
          template={{ vehicleBrand: '', model: '', engine: '', yearFrom: '', yearTo: '', note: '' }}
          columns={[
            { key: 'vehicleBrand', label: 'Marca' },
            { key: 'model', label: 'Modelo' },
            { key: 'engine', label: 'Motor' },
            { key: 'yearFrom', label: 'Desde', placeholder: 'año', inputMode: 'numeric' },
            { key: 'yearTo', label: 'Hasta', placeholder: 'año', inputMode: 'numeric' },
            { key: 'note', label: 'Nota' },
          ]}
          gridClassName="sm:grid-cols-[1fr_1fr_1fr_5rem_5rem_1fr]"
          addLabel="Agregar compatibilidad"
          emptyLabel="Sin compatibilidades."
          disabled={disabled}
        />
      );
    case 'measures': {
      const rows = value as MeasureRow[];
      if (rows.length === 0) return <p className="text-muted-foreground">El producto no tiene SKU cargados.</p>;
      return (
        <div className="space-y-2">
          {rows.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-muted-foreground" title={m.sku}>
                {m.sku || 'Sin SKU'}
              </span>
              <Input
                value={m.measure}
                onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, measure: e.target.value } : r)))}
                disabled={disabled}
                placeholder="STD, 0,50 mm…"
                aria-label={`Medida de ${m.sku || 'la variante'}`}
              />
            </div>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}
