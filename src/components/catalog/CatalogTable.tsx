'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KanbanSquare, Lock, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChannelStatusBadge, PipelineBadge } from '@/components/stages/StageBadge';
import { ScoreBadge } from '@/components/stages/ScoreBadge';
import { codeOrUnpublished, STATUS_ACTIONS, statusActions, statusConfirm, type StatusAction } from '@/domain/channel-status';
import type { PipelineState } from '@/domain/pipeline';
import { titleLockText, type TitleLock } from '@/domain/title-lock';
import type { ChannelStatus, ProductKind } from '@/generated/prisma/enums';
import { KindBadge } from '@/components/products/KindBadge';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { addToPipelineAction } from '@/app/a/[cuenta]/publicaciones/pipeline-actions';
import { changeStatusAction, pushDraftsAction, saveQuantitiesAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';
import { Input } from '@/components/ui/input';
import { useAddToPipeline } from './useAddToPipeline';
import { titleOrUntitled } from '@/domain/publication-title';
import type { SyncState } from '@/lib/queries/catalog-filters';

// La lista de Publicaciones, con casillas para elegir publicaciones y agregarlas
// al pipeline. Entran también las que todavía no están publicadas.

export type CatalogRow = PipelineState & {
  id: string;
  productId: string;
  title: string | null;
  kind: ProductKind;
  externalId: string | null;
  skus: string[];
  score: number | null;
  channelStatus: ChannelStatus;
  visits: number | null;
  sales: number | null;
  titleLock: TitleLock;
  missing: string[];
  sync: SyncState;
  // La cantidad: la del canal, la que falta subir, en cuántas medidas y si la maneja el canal.
  quantity: { channel: number | null; draft: number | null; measures: number; inChannel: boolean };
};

/** Si tiene cambios de la app sin subir, o datos distintos en los dos lados para elegir. */
function SyncBadges({ sync }: { sync: SyncState }) {
  return (
    <>
      {sync.draft ? (
        <Badge variant="secondary" title="Tiene cambios de la app que todavía no están en el canal">
          Borrador
        </Badge>
      ) : null}
      {sync.choose ? (
        <Badge variant="destructive" title="Un dato es distinto en la app y en el canal: hay que elegir en Sincronización">
          Para elegir
        </Badge>
      ) : null}
      {sync.rejected ? (
        <Badge variant="destructive" title="El canal no aceptó un cambio que se subió: el motivo está en la publicación">
          Rechazada
        </Badge>
      ) : null}
    </>
  );
}

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

/** La cantidad disponible: la del canal y, si se cambió en la app, la que falta subir. */
function QuantityCell({ q }: { q: CatalogRow['quantity'] }) {
  if (q.channel === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex flex-col items-end">
      <span className={cn(q.channel === 0 && 'text-destructive')}>
        {q.channel}
        {q.draft !== null && q.draft !== q.channel ? (
          <span className="text-amber-700" title="Cambiada en la app: falta subirla">
            {' '}
            → {q.draft}
          </span>
        ) : null}
      </span>
      {q.inChannel ? (
        <span className="text-[11px] text-muted-foreground">Full</span>
      ) : q.measures > 1 ? (
        <span className="whitespace-nowrap text-[11px] text-muted-foreground">en {q.measures} medidas</span>
      ) : null}
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
  return `Elegir ${titleOrUntitled(r.title)}`;
}

// Las que tienen cambios de la app para subir al canal.
const canPush = (r: CatalogRow) => r.sync.draft && Boolean(r.externalId);

type PushOutcome = { title: string; kind: 'ok' | 'error'; text: string };

/** Sube los cambios de varias publicaciones, de a una, contando el avance. */
function useBulkPush(accountSlug: string, onDone: () => void) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcomes, setOutcomes] = useState<PushOutcome[]>([]);
  async function run(rows: CatalogRow[]) {
    setOutcomes([]);
    setProgress({ done: 0, total: rows.length });
    const out: PushOutcome[] = [];
    for (let i = 0; i < rows.length; i++) {
      const title = titleOrUntitled(rows[i].title);
      const r = await pushDraftsAction(accountSlug, rows[i].id).catch(() => null);
      out.push(
        !r
          ? { title, kind: 'error', text: 'Se cortó la conexión con la app.' }
          : !r.ok
            ? { title, kind: 'error', text: r.error }
            : r.rejected.length > 0
              ? { title, kind: 'error', text: r.rejected.map((x) => x.message).join(' ') }
              : { title, kind: 'ok', text: 'Subida.' },
      );
      setProgress({ done: i + 1, total: rows.length });
    }
    setOutcomes(out);
    setProgress(null);
    onDone();
    router.refresh();
  }
  return { run, progress, outcomes, clear: () => setOutcomes([]) };
}

/** Pone la misma cantidad a varias publicaciones; con medidas, a cada medida. Queda para subir. */
function useBulkQuantity(accountSlug: string, onDone: () => void) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<{ saved: number; skipped: PushOutcome[]; error?: string } | null>(null);
  async function run(rows: CatalogRow[], quantity: number) {
    setPending(true);
    setOutcome(null);
    const r = await saveQuantitiesAction(
      accountSlug,
      rows.map((x) => x.id),
      { all: quantity },
    ).catch(() => null);
    setPending(false);
    if (!r) return setOutcome({ saved: 0, skipped: [], error: 'Se cortó la conexión con la app.' });
    if (!r.ok) return setOutcome({ saved: 0, skipped: [], error: r.error });
    setOutcome({ saved: r.saved.length, skipped: r.skipped.map((x) => ({ title: x.title, kind: 'error', text: x.reason })) });
    onDone();
    router.refresh();
  }
  return { run, pending, outcome, clear: () => setOutcome(null) };
}

type BulkStatus = Exclude<StatusAction, 'relist'>;
const BULK_STATUS: BulkStatus[] = ['pause', 'activate', 'close', 'delete'];

/** Las elegidas a las que se les puede hacer esa acción: publicadas y en un estado que la permite. */
const canChange = (r: CatalogRow, action: BulkStatus) => Boolean(r.externalId) && statusActions(r.channelStatus).includes(action);

/** Cambia el estado de varias publicaciones, de a una, contando el avance. */
function useBulkStatus(accountSlug: string, onDone: () => void) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ action: BulkStatus; done: number; total: number } | null>(null);
  const [outcomes, setOutcomes] = useState<{ action: BulkStatus; list: PushOutcome[] } | null>(null);
  async function run(action: BulkStatus, rows: CatalogRow[]) {
    setOutcomes(null);
    setProgress({ action, done: 0, total: rows.length });
    const out: PushOutcome[] = [];
    for (let i = 0; i < rows.length; i++) {
      const title = titleOrUntitled(rows[i].title);
      const r = await changeStatusAction(accountSlug, [rows[i].id], action).catch(() => null);
      out.push(
        !r
          ? { title, kind: 'error', text: 'Se cortó la conexión con la app.' }
          : !r.ok
            ? { title, kind: 'error', text: r.error }
            : r.failed.length > 0
              ? { title, kind: 'error', text: r.failed[0].message }
              : { title, kind: 'ok', text: STATUS_ACTIONS[action].done },
      );
      setProgress({ action, done: i + 1, total: rows.length });
    }
    setOutcomes({ action, list: out });
    setProgress(null);
    onDone();
    router.refresh();
  }
  return { run, progress, outcomes, clear: () => setOutcomes(null) };
}

export function CatalogTable({ accountSlug, rows, channelName }: { accountSlug: string; rows: CatalogRow[]; channelName: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const add = useAddToPipeline(() => setSelected(new Set()));
  const push = useBulkPush(accountSlug, () => setSelected(new Set()));
  const status = useBulkStatus(accountSlug, () => setSelected(new Set()));
  const quantity = useBulkQuantity(accountSlug, () => setSelected(new Set()));
  const [quantityText, setQuantityText] = useState('');

  // Solo cuentan las que se ven ahora: si un filtro esconde una elegida, no se toca.
  const eligible = rows;
  const chosen = eligible.filter((r) => selected.has(r.id));
  const allChosen = eligible.length > 0 && chosen.length === eligible.length;
  const toPipeline = chosen.filter(canEnter);
  const toPush = chosen.filter(canPush);
  const busy = add.pending || push.progress !== null || status.progress !== null || quantity.pending;
  const toQuantity = chosen.filter((r) => Boolean(r.externalId) && !r.quantity.inChannel && r.quantity.channel !== null);

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    add.clearMessage();
    push.clear();
    status.clear();
    quantity.clear();
  }

  function toggleAll(on: boolean) {
    setSelected(on ? new Set(eligible.map((r) => r.id)) : new Set());
    add.clearMessage();
    push.clear();
    status.clear();
    quantity.clear();
  }

  function setQuantity() {
    const raw = quantityText.trim();
    if (!/^\d+$/.test(raw) || toQuantity.length === 0) return;
    quantity.run(toQuantity, Number(raw));
    setQuantityText('');
  }

  function changeStatus(action: BulkStatus) {
    const list = chosen.filter((r) => canChange(r, action));
    if (list.length === 0) return;
    const confirm = statusConfirm(action, channelName, list.length);
    if (confirm && !window.confirm(confirm)) return;
    status.run(action, list);
  }
  const statusDone = status.outcomes?.list.filter((o) => o.kind === 'ok').length ?? 0;
  const statusFailed = status.outcomes?.list.filter((o) => o.kind === 'error') ?? [];

  const submit = () => add.run(() => addToPipelineAction(accountSlug, toPipeline.map((r) => r.id)));
  const pushed = push.outcomes.filter((o) => o.kind === 'ok').length;
  const failed = push.outcomes.filter((o) => o.kind === 'error');

  return (
    <>
      {chosen.length > 0 || add.message || push.progress || push.outcomes.length > 0 || status.progress || status.outcomes || quantity.outcome ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {chosen.length > 0 ? (
            <>
              <span className="font-medium">{plural(chosen.length, 'elegida', 'elegidas')}</span>
              <Button pending={add.pending} size="sm" onClick={submit} disabled={busy || toPipeline.length === 0}>
                <KanbanSquare className="h-4 w-4" />
                {add.pending ? 'Agregando…' : `Agregar al pipeline${toPipeline.length !== chosen.length ? ` (${toPipeline.length})` : ''}`}
              </Button>
              <Button access="subir"
                size="sm"
                variant="outline"
                pending={push.progress !== null}
                onClick={() => push.run(toPush)}
                disabled={busy || toPush.length === 0}
                title={toPush.length === 0 ? 'Ninguna de las elegidas tiene cambios para subir.' : undefined}
              >
                <Upload className="h-4 w-4" />
                Subir los cambios{toPush.length > 0 ? ` (${toPush.length})` : ''}
              </Button>
              <select
                aria-label="Cambiar el estado"
                className="h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm disabled:opacity-50"
                value=""
                disabled={busy || chosen.every((r) => !BULK_STATUS.some((a) => canChange(r, a)))}
                onChange={(e) => changeStatus(e.target.value as BulkStatus)}
              >
                <option value="">Cambiar el estado…</option>
                {BULK_STATUS.map((a) => {
                  const n = chosen.filter((r) => canChange(r, a)).length;
                  return (
                    <option key={a} value={a} disabled={n === 0}>
                      {STATUS_ACTIONS[a].label} ({n})
                    </option>
                  );
                })}
              </select>
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  setQuantity();
                }}
              >
                <Input
                  aria-label="Cantidad disponible para las elegidas"
                  inputMode="numeric"
                  placeholder="Cantidad"
                  value={quantityText}
                  onChange={(e) => setQuantityText(e.target.value)}
                  className="h-8 w-24 tabular-nums"
                  disabled={busy || toQuantity.length === 0}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  pending={quantity.pending}
                  disabled={busy || toQuantity.length === 0 || !/^\d+$/.test(quantityText.trim())}
                  title={toQuantity.length === 0 ? 'Ninguna de las elegidas tiene la cantidad leída del canal, o el canal la maneja solo.' : 'Con medidas, cada medida queda con esa cantidad.'}
                >
                  Poner cantidad{toQuantity.length > 0 && toQuantity.length !== chosen.length ? ` (${toQuantity.length})` : ''}
                </Button>
              </form>
              <Button access="view" size="sm" variant="ghost" onClick={() => toggleAll(false)} disabled={busy}>
                <X className="h-4 w-4" />
                Quitar selección
              </Button>
            </>
          ) : null}
          {push.progress ? (
            <span className="tabular-nums text-muted-foreground" aria-live="polite">
              Subiendo {push.progress.done} de {push.progress.total}
            </span>
          ) : null}
          {status.progress ? (
            <span className="tabular-nums text-muted-foreground" aria-live="polite">
              {STATUS_ACTIONS[status.progress.action].label} {status.progress.done} de {status.progress.total}
            </span>
          ) : null}
          {status.outcomes ? (
            <div className="basis-full space-y-1" role="status">
              <p>
                {statusDone > 0
                  ? `Listo, ${plural(statusDone, 'publicación', 'publicaciones')} ${statusDone === 1 ? 'quedó' : 'quedaron'} ${STATUS_ACTIONS[status.outcomes.action].done}${statusDone === 1 ? '' : 's'} en ${channelName}.`
                  : 'No cambió ninguna.'}
                {statusFailed.length > 0 ? ` ${plural(statusFailed.length, 'no se pudo', 'no se pudieron')}:` : ''}
              </p>
              {statusFailed.length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-5 text-destructive">
                  {statusFailed.slice(0, 10).map((o, i) => (
                    <li key={i}>
                      <span className="font-medium">{o.title}:</span> {o.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {quantity.outcome ? (
            <div className="basis-full space-y-1" role="status">
              <p className={quantity.outcome.error ? 'text-destructive' : undefined}>
                {quantity.outcome.error ??
                  (quantity.outcome.saved > 0
                    ? `Listo: la cantidad quedó en ${plural(quantity.outcome.saved, 'publicación', 'publicaciones')}, para subir. Elegilas y tocá Subir los cambios, o subilas desde Por subir.`
                    : 'No cambió ninguna.')}
                {quantity.outcome.skipped.length > 0 ? ` ${plural(quantity.outcome.skipped.length, 'no se cambió', 'no se cambiaron')}:` : ''}
              </p>
              {quantity.outcome.skipped.length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-5 text-destructive">
                  {quantity.outcome.skipped.slice(0, 10).map((o, i) => (
                    <li key={i}>
                      <span className="font-medium">{o.title}:</span> {o.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {add.message ? (
            <p className={cn('basis-full', add.message.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
              {add.message.text}
            </p>
          ) : null}
          {push.outcomes.length > 0 ? (
            <div className="basis-full space-y-1" role="status">
              <p>
                {pushed > 0 ? `Listo: se subieron los cambios de ${plural(pushed, 'publicación', 'publicaciones')}.` : 'No se subió nada.'}
                {failed.length > 0 ? ` ${plural(failed.length, 'quedó', 'quedaron')} con algo sin subir:` : ''}
              </p>
              {failed.length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-5 text-destructive">
                  {failed.slice(0, 10).map((o, i) => (
                    <li key={i}>
                      <span className="font-medium">{o.title}:</span> {o.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
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
                  checked={selected.has(p.id)}
                  disabled={busy}
                  onChange={(on) => toggle(p.id, on)}
                  label={rowHint(p)}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-1.5">
                    <Link href={`/a/${accountSlug}/publicaciones/${p.id}`} className="font-medium hover:underline min-w-0">
                      {titleOrUntitled(p.title)}
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
                  <SyncBadges sync={p.sync} />
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {[codeOrUnpublished(p.externalId), p.skus.join(' / ')].filter(Boolean).join(' · ')}
                  {p.visits !== null ? ` · ${plural(p.visits, 'visita')}` : ''}
                  {p.sales !== null ? ` · ${plural(p.sales, 'venta')}` : ''}
                  {p.quantity.channel !== null ? ` · ${plural(p.quantity.channel, 'disponible', 'disponibles')}` : ''}
                  {p.quantity.draft !== null && p.quantity.draft !== p.quantity.channel ? ` → ${p.quantity.draft} por subir` : ''}
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
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id} data-state={selected.has(p.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(p.id)}
                      disabled={busy}
                      onChange={(on) => toggle(p.id, on)}
                      label={rowHint(p)}
                    />
                  </TableCell>
                  <TableCell>
                    <ScoreBadge score={p.score} />
                  </TableCell>
                  <TableCell className="max-w-[16rem] min-[1400px]:max-w-[22rem]">
                    <div className="flex items-start gap-1.5">
                      <Link href={`/a/${accountSlug}/publicaciones/${p.id}`} className="font-medium hover:underline line-clamp-2">
                        {titleOrUntitled(p.title)}
                      </Link>
                      <span className="pt-1">
                        <LockIcon lock={p.titleLock} />
                      </span>
                      <KindBadge kind={p.kind} className="mt-0.5" />
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[codeOrUnpublished(p.externalId), p.skus.join(' / ')].filter(Boolean).join(' · ')}
                    </div>
                    {p.missing.length > 0 ? (
                      <div className="text-xs truncate">
                        <span className="text-muted-foreground">Le falta: </span>
                        <MissingList missing={p.missing} />
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <ChannelStatusBadge status={p.channelStatus} />
                      <SyncBadges sync={p.sync} />
                    </div>
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
                  <TableCell className="text-right tabular-nums">
                    <QuantityCell q={p.quantity} />
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
