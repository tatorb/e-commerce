import { AlertTriangle } from 'lucide-react';
import { CONTENT_FIELD_LABEL, type Compat, type VariantMeasure } from '@/domain/content';
import type { NameValue } from '@/domain/name-value';
import type { ProposalField } from '@/domain/proposals';

// Propuesta de la IA en dos columnas, Hoy y Propuesta, campo por campo. Solo
// para mirar: no cambia nada.

const PLACEHOLDER = /(\[\s*A CONFIRMAR\s*:?[^\]]*\])/gi;

/** Texto con las marcas [A CONFIRMAR: …] resaltadas. */
export function Highlighted({ text }: { text: string }) {
  const parts = text.split(PLACEHOLDER);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-amber-500/15 px-1 text-amber-800">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function compatText(c: Compat): string {
  const years =
    c.yearFrom && c.yearTo
      ? c.yearFrom === c.yearTo
        ? `${c.yearFrom}`
        : `${c.yearFrom} a ${c.yearTo}`
      : c.yearFrom
        ? `desde ${c.yearFrom}`
        : c.yearTo
          ? `hasta ${c.yearTo}`
          : '';
  const vehicle = [c.vehicleBrand, c.model, c.engine].filter(Boolean).join(' ');
  return [vehicle, years, c.note].filter(Boolean).join(' · ');
}

function Empty() {
  return <span className="text-muted-foreground">—</span>;
}

function Lines({ lines }: { lines: string[] }) {
  if (lines.length === 0) return <Empty />;
  return (
    <ul className="space-y-0.5">
      {lines.map((line, i) => (
        <li key={i}>
          <Highlighted text={line} />
        </li>
      ))}
    </ul>
  );
}

export function Value({ field, value }: { field: ProposalField['field']; value: unknown }) {
  if (value === null || value === undefined) return <Empty />;
  switch (field) {
    case 'specs':
      return <Lines lines={(value as NameValue[]).map((s) => `${s.name}: ${s.value}`)} />;
    case 'compatibilities':
      return <Lines lines={(value as Compat[]).map(compatText)} />;
    case 'measures':
      return <Lines lines={(value as VariantMeasure[]).map((m) => `${m.sku ?? 'Sin SKU'}: ${m.measure ?? 'sin medida'}`)} />;
    case 'photos':
    case 'videos':
      return <Lines lines={value as string[]} />;
    default:
      return typeof value === 'string' && value !== '' ? (
        <p className="whitespace-pre-wrap break-words">
          <Highlighted text={value} />
        </p>
      ) : (
        <Empty />
      );
  }
}

export function ToConfirm({ items, prefix = true }: { items: string[]; prefix?: boolean }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1">
      {items.map((t, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{prefix ? `A confirmar: ${t}` : t}</span>
        </li>
      ))}
    </ul>
  );
}

export function ProposalView({
  summary,
  fields,
  notes,
  meta,
}: {
  summary: string;
  fields: ProposalField[];
  notes: string[];
  meta: string;
}) {
  const pending = fields.reduce((n, f) => n + f.toConfirm.length + f.placeholders.length, 0) + notes.length;
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm">{summary || 'La IA no dejó un resumen.'}</p>
        <p className="text-xs text-muted-foreground">
          {meta} · Todavía no cambió nada en la ficha ni en el canal.
          {pending > 0 ? ` Hay ${pending === 1 ? '1 cosa' : `${pending} cosas`} a confirmar.` : ''}
        </p>
      </div>

      {notes.length > 0 ? <ToConfirm items={notes} prefix={false} /> : null}

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">La IA no encontró nada para cambiar.</p>
      ) : (
        <ul className="space-y-3">
          {fields.map((f) => (
            <li key={f.field} className="rounded-md border">
              <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
                <span className="text-sm font-medium">{CONTENT_FIELD_LABEL[f.field]}</span>
                {f.reason ? <span className="text-sm text-muted-foreground">· {f.reason}</span> : null}
              </div>
              <div className="grid md:grid-cols-2 md:divide-x">
                <div className="space-y-1 px-4 py-3 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Hoy</p>
                  <div className="text-muted-foreground">
                    <Value field={f.field} value={f.before} />
                  </div>
                </div>
                <div className="space-y-1 border-t px-4 py-3 text-sm md:border-t-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Propuesta</p>
                  <Value field={f.field} value={f.after} />
                </div>
              </div>
              {f.toConfirm.length > 0 || f.placeholders.length > 0 ? (
                <div className="border-t px-4 py-2.5">
                  <ToConfirm
                    items={[...f.toConfirm, ...f.placeholders.map((p) => `completar «${p}» en el texto`)]}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
