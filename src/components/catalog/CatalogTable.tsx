'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KanbanSquare, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChannelStatusBadge, PipelineBadge } from '@/components/stages/StageBadge';
import { ScoreBadge } from '@/components/stages/ScoreBadge';
import { codeOrUnpublished } from '@/domain/channel-status';
import type { PipelineState } from '@/domain/pipeline';
import { titleLockText, type TitleLock } from '@/domain/title-lock';
import type { ChannelStatus, ProductKind } from '@/generated/prisma/enums';
import { KindBadge } from '@/components/products/KindBadge';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { addToPipelineAction } from '@/app/a/[cuenta]/publicaciones/pipeline-actions';
import { useAddToPipeline } from './useAddToPipeline';

// La lista del Catálogo, con casillas para elegir publicaciones y agregarlas
// al pipeline. Entran también las que todavía no están publicadas.

export type CatalogRow = PipelineState & {
  id: string;
  productId: string;
  title: string;
  kind: ProductKind;
  externalId: string | null;
  skus: string[];
  score: number | null;
  channelStatus: ChannelStatus;
  visits: number | null;
  sales: number | null;
  titleLock: TitleLock;
  missing: string[];
};

function MissingList({ missing }: { missing: string[] }) {
  if (missing.length === 0) return <span className="text-muted-foreground">—</span>;
  const names = missing.slice(0, 2);
  const rest = missing.length - names.length;
  return (
    <span className="text-muted-foreground">
      {names.join(', ')}
      {rest > 0 ? ` y ${rest} más` : ''}
    </span>
  );
}

function LockIcon({ lock }: { lock: TitleLock }) {
  if (!lock.locked) return null;
  const text = titleLockText(lock);
  return (
    <span title={text} aria-label={text} className="inline-flex shrink-0 text-amber-700">
      <Lock className="h-3.5 w-3.5" />
    </span>
  );
}

function Count({ value }: { value: number | null }) {
  return value === null ? <span className="text-muted-foreground">—</span> : <>{value}</>;
}

const canEnter = (r: CatalogRow) => r.pipelineStatus !== 'IN_PIPELINE';

function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  indeterminate,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  indeterminate?: boolean;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-4 w-4 accent-[hsl(var(--primary))] disabled:opacity-30"
      checked={checked}
      disabled={disabled}
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate);
      }}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

/** La etiqueta del pipeline; si está en el pipeline, lleva a su paso. */
function PipelineCell({ accountSlug, row }: { accountSlug: string; row: CatalogRow }) {
  if (row.pipelineStatus !== 'IN_PIPELINE') return <PipelineBadge state={row} />;
  return (
    <Link href={`/a/${accountSlug}/pipeline/${row.id}`} className="rounded-full hover:opacity-80" title="Abrir su paso">
      <PipelineBadge state={row} />
    </Link>
  );
}

function rowHint(r: CatalogRow): string {
  if (r.pipelineStatus === 'IN_PIPELINE') return 'Ya está en el pipeline.';
  return `Elegir ${r.title}`;
}

export function CatalogTable({ accountSlug, rows }: { accountSlug: string; rows: CatalogRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const add = useAddToPipeline(() => setSelected(new Set()));
  const base = `/a/${accountSlug}/productos`;

  // Solo cuentan las que se ven ahora: si un filtro esconde una elegida, no se agrega.
  const eligible = rows.filter(canEnter);
  const chosen = eligible.filter((r) => selected.has(r.id));
  const allChosen = eligible.length > 0 && chosen.length === eligible.length;

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    add.clearMessage();
  }

  function toggleAll(on: boolean) {
    setSelected(on ? new Set(eligible.map((r) => r.id)) : new Set());
    add.clearMessage();
  }

  const submit = () => add.run(() => addToPipelineAction(accountSlug, chosen.map((r) => r.id)));

  return (
    <>
      {chosen.length > 0 || add.message ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {chosen.length > 0 ? (
            <>
              <span className="font-medium">{plural(chosen.length, 'elegida', 'elegidas')}</span>
              <Button size="sm" onClick={submit} disabled={add.pending}>
                <KanbanSquare className="h-4 w-4" />
                {add.pending ? 'Agregando…' : 'Agregar al pipeline'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toggleAll(false)} disabled={add.pending}>
                <X className="h-4 w-4" />
                Quitar selección
              </Button>
            </>
          ) : null}
          {add.message ? (
            <p className={cn('basis-full', add.message.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
              {add.message.text}
            </p>
          ) : null}
        </div>
      ) : null}

      <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="md:hidden divide-y overflow-y-auto flex-1 min-h-0">
          {eligible.length > 0 ? (
            <label className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Checkbox
                checked={allChosen}
                indeterminate={chosen.length > 0 && !allChosen}
                onChange={toggleAll}
                label="Elegir todas las que se ven"
              />
              Elegir todas las que se ven
            </label>
          ) : null}
          {rows.map((p) => (
            <div key={p.id} className="flex gap-3 px-3 py-3">
              <div className="pt-0.5">
                <Checkbox
                  checked={selected.has(p.id) && canEnter(p)}
                  disabled={!canEnter(p)}
                  onChange={(on) => toggle(p.id, on)}
                  label={rowHint(p)}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-1.5">
                    <Link href={`${base}/${p.productId}`} className="font-medium hover:underline min-w-0">
                      {p.title}
                    </Link>
                    <span className="pt-1">
                      <LockIcon lock={p.titleLock} />
                    </span>
                    <KindBadge kind={p.kind} className="mt-0.5" />
                  </div>
                  <ScoreBadge score={p.score} className="shrink-0" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <PipelineCell accountSlug={accountSlug} row={p} />
                  <ChannelStatusBadge status={p.channelStatus} />
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {[codeOrUnpublished(p.externalId), p.skus.join(' / ')].filter(Boolean).join(' · ')}
                  {p.visits !== null ? ` · ${plural(p.visits, 'visita')}` : ''}
                  {p.sales !== null ? ` · ${plural(p.sales, 'venta')}` : ''}
                </div>
                <div className="text-xs">
                  <MissingList missing={p.missing} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:flex md:flex-1 md:min-h-0 md:flex-col">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allChosen}
                    indeterminate={chosen.length > 0 && !allChosen}
                    disabled={eligible.length === 0}
                    onChange={toggleAll}
                    label="Elegir todas las que se ven"
                  />
                </TableHead>
                <TableHead>Puntaje</TableHead>
                <TableHead>Publicación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead className="text-right">Visitas 90 días</TableHead>
                <TableHead className="text-right">Ventas 90 días</TableHead>
                <TableHead>Le falta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id} data-state={selected.has(p.id) && canEnter(p) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(p.id) && canEnter(p)}
                      disabled={!canEnter(p)}
                      onChange={(on) => toggle(p.id, on)}
                      label={rowHint(p)}
                    />
                  </TableCell>
                  <TableCell>
                    <ScoreBadge score={p.score} />
                  </TableCell>
                  <TableCell className="max-w-[22rem]">
                    <div className="flex items-start gap-1.5">
                      <Link href={`${base}/${p.productId}`} className="font-medium hover:underline line-clamp-2">
                        {p.title}
                      </Link>
                      <span className="pt-1">
                        <LockIcon lock={p.titleLock} />
                      </span>
                      <KindBadge kind={p.kind} className="mt-0.5" />
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[codeOrUnpublished(p.externalId), p.skus.join(' / ')].filter(Boolean).join(' · ')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ChannelStatusBadge status={p.channelStatus} />
                  </TableCell>
                  <TableCell>
                    <PipelineCell accountSlug={accountSlug} row={p} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Count value={p.visits} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Count value={p.sales} />
                  </TableCell>
                  <TableCell className="max-w-[16rem] text-sm">
                    <MissingList missing={p.missing} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}
