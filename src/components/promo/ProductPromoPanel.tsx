'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Grid3x3, History, RefreshCw, Tags, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/ui/section-card';
import { CHANNEL_STATUS_LABEL } from '@/domain/channel-status';
import { formatPrice } from '@/domain/money';
import { INSTALLMENT_PLANS, planLabel } from '@/domain/pricing';
import { hasNoEnd, LAYER_LABEL } from '@/domain/promo/plan';
import { COMPETITIONS, COMPETITION_LABEL, LIFECYCLES, LIFECYCLE_LABEL, MODE_LABEL, OBJECTIVE_LABEL, PRIORITIES, PRIORITY_LABEL, type Competition, type Lifecycle, type Mode, type Priority } from '@/domain/promo/tags';
import type { AppliedAction, DueAction } from '@/lib/promo/apply';
import type { ModeConflict } from '@/lib/promo/mode';
import type { GridCell, GridColumn, ProductGrid } from '@/lib/promo/view';
import { cn } from '@/lib/utils/cn';
import {
  applyAction,
  cancelSlotAction,
  classifyProductAction,
  clearPlanAction,
  modeConflictsAction,
  excludeAction,
  generatePlansAction,
  previewApplyAction,
  putBackAction,
  refreshProductAction,
  saveSlotAction,
  setModeAction,
  setTagsAction,
  takeOutAction,
} from '@/app/a/[cuenta]/promociones/actions';
import { dateTime, inputDay, pct, shortDate, stateClass } from './format';

// Las promociones de un producto: sus etiquetas, las franjas de su almanaque
// y la grilla de medidas por formas de cobro, donde cada casillero dice si la
// forma de cobro está adentro, al tope o afuera y por qué. Desde acá se
// corrigen las etiquetas, se decide a mano qué va y qué no, y se prende o se
// saca en el canal, siempre con la vista previa antes.

export type LogRow = { id: string; at: Date; code: string | null; text: string; auto: boolean; kind: string };

const SELECT = 'h-9 rounded-md border border-input bg-card px-2 text-sm shadow-sm';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

export function ProductPromoPanel({ accountSlug, timeZone, grid, log, compact = false }: { accountSlug: string; timeZone: string; grid: ProductGrid; log: LogRow[]; compact?: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ actions: DueAction[]; scope: { productIds?: string[]; itemIds?: string[]; force?: boolean } } | null>(null);
  const [results, setResults] = useState<AppliedAction[] | null>(null);
  // El cambio de modo que se está confirmando: a Automático, con lo que hay que decidir; a Manual, con si se borra lo planeado.
  const [modeAsk, setModeAsk] = useState<{ to: 'AUTO'; conflicts: ModeConflict[]; takeOut: Set<string> } | { to: 'MANUAL'; clear: boolean } | null>(null);
  const manual = grid.mode === 'MANUAL';

  const askMode = (to: Mode) => {
    if (to === grid.mode) return;
    setNotice(null);
    if (to === 'MANUAL') return setModeAsk({ to, clear: false });
    start(async () => {
      const r = await modeConflictsAction(accountSlug, grid.productId).catch(() => null);
      if (!r || !r.ok) return setNotice({ kind: 'error', text: r ? r.error : 'Se cortó la conexión con la app.' });
      setModeAsk({ to: 'AUTO', conflicts: r.conflicts, takeOut: new Set() });
    });
  };

  const confirmMode = () =>
    start(async () => {
      if (!modeAsk) return;
      const r = await setModeAction(accountSlug, grid.productId, modeAsk.to, modeAsk.to === 'AUTO' ? { takeOut: [...modeAsk.takeOut] } : { clear: modeAsk.clear }).catch(() => null);
      setModeAsk(null);
      if (!r || !r.ok) return setNotice({ kind: 'error', text: r ? r.error : 'Se cortó la conexión con la app.' });
      setNotice({
        kind: r.failed.length > 0 ? 'error' : 'ok',
        text: `Quedó en ${MODE_LABEL[modeAsk.to]}.${r.takenOut > 0 ? ` Se sacaron ${r.takenOut} del canal.` : ''}${r.failed.length > 0 ? ` No se pudieron sacar: ${r.failed.join(' ')}` : ''}`,
      });
      setSelected(new Set());
      router.refresh();
    });

  // La franja que se mira en la grilla: la elegida, o la primera que está vigente.
  const columns = grid.columns;
  const columnKey = (c: GridColumn) => c.slotId ?? `canal:${c.group}`;
  const current = columns.find((c) => columnKey(c) === picked) ?? columns.find((c) => !c.cancelled) ?? columns[0] ?? null;
  const severalTitles = new Set(grid.measures.map((m) => m.title ?? '')).size > 1;
  // Lo que deja en pesos: la rentabilidad es sobre el costo.
  const money = (marginPct: number | null, cost: number | null) => (marginPct === null || cost === null ? null : formatPrice(Math.round((cost * marginPct) / 100)));
  const cellOf = useMemo(() => new Map((current?.cells ?? []).map((c) => [c.publicationId, c])), [current]);
  // Una columna por forma de cobro, y una más si alguna publicación tiene una que la app no conoce.
  const plans: (number | null)[] = [...INSTALLMENT_PLANS, ...(grid.measures.some((m) => m.options.some((o) => o.plan === null)) ? [null] : [])];

  const run = (work: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) =>
    start(async () => {
      setNotice(null);
      const r = await work().catch(() => ({ ok: false as const, error: 'Se cortó la conexión con la app.' }));
      setNotice(r.ok ? { kind: 'ok', text: done } : { kind: 'error', text: r.error });
      if (r.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });

  const runWith: RunWith = (work, done) =>
    start(async () => {
      setNotice(null);
      const r = await work().catch(() => ({ ok: false as const, error: 'Se cortó la conexión con la app.' }));
      setNotice(r.ok ? { kind: 'ok', text: done(r) } : { kind: 'error', text: r.error });
      if (r.ok) router.refresh();
    });

  const askPreview = (scope: { productIds?: string[]; itemIds?: string[]; force?: boolean }) =>
    start(async () => {
      setNotice(null);
      setResults(null);
      const r = await previewApplyAction(accountSlug, scope).catch(() => null);
      if (!r || !r.ok) return setNotice({ kind: 'error', text: r ? r.error : 'Se cortó la conexión con la app.' });
      if (r.actions.length === 0) return setNotice({ kind: 'ok', text: 'No hay nada para prender ni apagar ahora.' });
      setPreview({ actions: r.actions, scope });
    });

  const confirmApply = () =>
    start(async () => {
      if (!preview) return;
      const r = await applyAction(accountSlug, preview.scope).catch(() => null);
      setPreview(null);
      if (!r || !r.ok) return setNotice({ kind: 'error', text: r ? r.error : 'Se cortó la conexión con la app.' });
      setResults(r.done);
      const failed = r.done.filter((d) => !d.ok).length;
      setNotice({
        kind: failed > 0 ? 'error' : 'ok',
        text: `${r.done.length - failed} hechos${failed > 0 ? `, ${failed} no se pudieron` : ''}${r.skipped.length > 0 ? `, ${r.skipped.length} no entraron: ${r.skipped.map((s) => `${s.externalId ?? ''} ${s.why}`).join(' ')}` : ''}${r.pending > 0 ? `. Faltan ${r.pending}: volvé a aplicar.` : '.'}`,
      });
      setSelected(new Set());
      router.refresh();
    });

  const selectedItems = [...selected].map((id) => cellOf.get(id)).filter((c): c is GridCell => !!c && c.itemId !== null);
  const toEnter = selectedItems.filter((c) => c.state === 'PLANNED');
  const inside = selectedItems.filter((c) => c.state === 'ON' || c.state === 'SCHEDULED' || c.state === 'PLANNED');
  const undoable = selectedItems.filter((c) => c.state === 'FAILED' || (c.state === 'OUT' && (c.reason === 'MANUAL' || c.reason === 'REJECTED')));

  return (
    <div className="space-y-4">
      {notice ? (
        <p role="status" className={cn('rounded-lg border px-3 py-2 text-sm', notice.kind === 'error' ? 'border-alert/40 bg-alert/10 text-foreground' : 'border-primary/30 bg-primary/5')}>
          {notice.text}
        </p>
      ) : null}

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="group" aria-label="Quién arma el almanaque" className="inline-flex rounded-lg border p-0.5">
            {(['MANUAL', 'AUTO'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={grid.mode === m}
                disabled={busy}
                onClick={() => askMode(m)}
                className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', grid.mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {manual
              ? 'El almanaque lo armás vos. Nace con las promociones en las que ya está inscripto. La app lo ejecuta sola en cada fecha.'
              : 'El almanaque lo arman las reglas con las etiquetas de este producto, y la app lo ejecuta sola. Para tocarlo a mano, pasalo a Manual.'}
          </p>
        </div>
        {grid.paused ? (
          <p className="mt-3 rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-sm">
            <strong>Freno de emergencia puesto.</strong> La app no prende ni apaga nada en {grid.channelName} hasta que se suelte, en Promociones, pestaña Reglas. No se borra nada.
          </p>
        ) : null}
        {modeAsk ? (
          <div className="mt-3 rounded-lg border border-foreground/20 p-3 text-sm">
            {modeAsk.to === 'AUTO' ? (
              <>
                <p className="font-medium">Pasar a Automático</p>
                <p className="text-muted-foreground">La regla le pone las etiquetas ahora, y las franjas que armaste y todavía no empezaron se reemplazan por las de las reglas.</p>
                {modeAsk.conflicts.length > 0 ? (
                  <>
                    <p className="mt-2">Esto ya está en {grid.channelName} y las reglas no lo incluirían. Lo que no marques sigue hasta que termine:</p>
                    <ul className="mt-1 space-y-1">
                      {modeAsk.conflicts.map((c) => (
                        <li key={c.slotId}>
                          <label className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                              checked={modeAsk.takeOut.has(c.slotId)}
                              onChange={(e) => {
                                const next = new Set(modeAsk.takeOut);
                                if (e.target.checked) next.add(c.slotId);
                                else next.delete(c.slotId);
                                setModeAsk({ ...modeAsk, takeOut: next });
                              }}
                            />
                            <span>
                              Sacar ahora <strong>{c.name}</strong>, {c.finish ? `que va hasta el ${shortDate(c.finish, timeZone)}` : 'que no tiene fecha de fin'}, de {c.publications.length}{' '}
                              {c.publications.length === 1 ? 'publicación' : 'publicaciones'}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <p className="font-medium">Pasar a Manual</p>
                <p className="text-muted-foreground">Las franjas que armaron las reglas quedan para que las edites. Lo que ya está en {grid.channelName} no cambia.</p>
                <label className="mt-2 flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" checked={modeAsk.clear} onChange={(e) => setModeAsk({ ...modeAsk, clear: e.target.checked })} />
                  <span>Borrar las franjas que todavía no empezaron y arrancar solo con lo que ya está inscripto</span>
                </label>
              </>
            )}
            <div className="mt-3 flex gap-2">
              <Button size="sm" access={modeAsk.to === 'AUTO' && modeAsk.takeOut.size > 0 ? 'subir' : 'promociones'} disabled={busy} pending={busy} onClick={confirmMode}>
                Pasar a {MODE_LABEL[modeAsk.to]}
              </Button>
              <Button size="sm" variant="ghost" access="view" disabled={busy} onClick={() => setModeAsk(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Las etiquetas son del modo Automático. Con la clave, al cambiarlas la tarjeta toma las nuevas. */}
      {manual ? null : <TagsCard key={JSON.stringify([grid.tags, grid.manual])} accountSlug={accountSlug} grid={grid} busy={busy} run={run} runWith={runWith} />}

      <SectionCard
        title="Almanaque"
        icon={<CalendarDays />}
        count={columns.length}
        description={
          manual
            ? `Las promociones en las que está inscripto y las que armaste, de hoy en adelante. Invitaciones del canal leídas ${grid.invitationsAt ? dateTime(grid.invitationsAt, timeZone) : 'todavía no'}.`
            : `Las franjas que armaron las reglas, de hoy en adelante. Armado ${grid.plannedAt ? dateTime(grid.plannedAt, timeZone) : 'todavía no'}. Invitaciones del canal leídas ${grid.invitationsAt ? dateTime(grid.invitationsAt, timeZone) : 'todavía no'}.`
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" access="view" disabled={busy} onClick={() => run(() => refreshProductAction(accountSlug, grid.productId), 'Se leyeron las invitaciones del canal.')}>
              <RefreshCw />
              Leer invitaciones
            </Button>
            {manual ? (
              <Button
                access="promociones"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm('Se borran las franjas que todavía no empezaron. Lo que ya está en el canal queda como está.')) return;
                  run(() => clearPlanAction(accountSlug, grid.productId), 'Se borró lo que todavía no había empezado.');
                }}
              >
                Borrar lo planeado
              </Button>
            ) : (
              <Button access="promociones" size="sm" variant="outline" disabled={busy || grid.tags.lifecycle === null} onClick={() => run(() => generatePlansAction(accountSlug, [grid.productId]), 'Se rearmó el almanaque.')}>
                <Wand2 />
                Rearmar
              </Button>
            )}
            <Button size="sm" access="subir" disabled={busy} onClick={() => askPreview({ productIds: [grid.productId] })}>
              Ver qué toca hoy
            </Button>
          </div>
        }
      >
        {columns.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No tiene franjas ni invitaciones del canal. Las publicaciones nuevas o recreadas no reciben invitaciones a los eventos: si esperabas alguna, hay que decidirlo a mano.
          </p>
        ) : (
          <ul className="divide-y">
            {columns.map((c) => (
              <SlotRow key={columnKey(c)} accountSlug={accountSlug} timeZone={timeZone} productId={grid.productId} column={c} editable={manual} active={current !== null && columnKey(c) === columnKey(current)} busy={busy} floor={grid.thresholds.floorMarginPct} onPick={() => { setPicked(columnKey(c)); setSelected(new Set()); }} run={run} />
            ))}
          </ul>
        )}
      </SectionCard>

      {preview ? (
        <div className="rounded-2xl border border-foreground/20 bg-card p-4 shadow-card">
          <p className="font-medium">Vista previa: {preview.actions.length} {preview.actions.length === 1 ? 'cambio' : 'cambios'} en {grid.channelName}</p>
          <ActionList actions={preview.actions} />
          <div className="mt-3 flex gap-2">
            <Button size="sm" access="subir" pending={busy} disabled={busy} onClick={confirmApply}>
              Confirmar y mandar al canal
            </Button>
            <Button size="sm" variant="ghost" access="view" disabled={busy} onClick={() => setPreview(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
      {results && results.length > 0 ? (
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="font-medium">Lo que se mandó</p>
          <ActionList actions={results} />
        </div>
      ) : null}

      <SectionCard
        title={current ? `Medidas por formas de cobro en «${current.name}»` : 'Medidas por formas de cobro'}
        icon={<Grid3x3 />}
        description={
          current
            ? `${LAYER_LABEL[current.layer]}, ${current.finish && hasNoEnd(current.finish) ? `desde el ${shortDate(current.start, timeZone)}, sin fecha de fin` : `del ${shortDate(current.start, timeZone)} al ${shortDate(current.finish, timeZone)}`}. ${manual ? '' : `Busca ${pct(current.targetMarginPct)} de rentabilidad. `}El piso es ${pct(grid.thresholds.floorMarginPct)}. Cada casillero es una publicación con su código: arriba, lo que pasa en esta oferta; abajo, lo que tiene hoy.`
            : 'Cada forma de cobro de cada medida, con su precio y lo que deja hoy.'
        }
        action={
          columns.length > 1 && current ? (
            // La oferta que muestra la grilla: la misma que se elige tocando una franja de arriba.
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Ver</span>
              <select
                className={cn(SELECT, 'max-w-[18rem]')}
                value={columnKey(current)}
                onChange={(e) => {
                  setPicked(e.target.value);
                  setSelected(new Set());
                }}
              >
                {columns.map((c) => (
                  <option key={columnKey(c)} value={columnKey(c)}>
                    {c.name}, {c.finish && hasNoEnd(c.finish) ? 'sin fin' : `${shortDate(c.start, timeZone)} a ${shortDate(c.finish, timeZone)}`}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined
        }
      >
        <div className="overflow-x-auto">
          {/* Todas las columnas del mismo ancho y todos los casilleros del mismo alto. */}
          <table className="w-full min-w-[1080px] table-fixed border-separate border-spacing-1.5 p-2 text-xs">
            <colgroup>
              <col className="w-36" />
              {plans.map((plan) => (
                <col key={String(plan)} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="px-1 text-left font-medium text-muted-foreground">Medida</th>
                {plans.map((plan) => (
                  <th key={String(plan)} className="px-1 text-left font-medium text-muted-foreground">
                    {plan === null ? 'Otra forma de cobro' : planLabel(plan)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.measures.map((m) => (
                <tr key={m.mainId}>
                  <td className="px-1 align-top">
                    {/* Sin medida: la única del producto, o una publicación de la que la app no sabe qué medida vende. */}
                    <p className="font-medium">{m.measure ?? (grid.measures.length > 1 ? 'Medida sin identificar' : 'Única')}</p>
                    {/* Con más de una publicación distinta del mismo producto, el título dice cuál es cada fila. */}
                    {severalTitles && m.title ? <p className="mt-0.5 leading-snug text-muted-foreground">{m.title}</p> : null}
                    {m.measure === null && grid.measures.length > 1 ? <p className="mt-0.5 leading-snug text-muted-foreground">La app no sabe qué medida vende: sin eso tampoco sabe su stock.</p> : null}
                    {m.stock !== null ? <p className="text-muted-foreground">Stock {m.stock}</p> : null}
                  </td>
                  {plans.map((plan) => (
                    <td key={String(plan)} className="space-y-1.5 align-top">
                      {m.options.every((o) => o.plan !== plan) ? <div className="flex h-[208px] items-center justify-center rounded-lg border border-dashed text-[11px] text-muted-foreground">Sin publicación</div> : null}
                      {m.options.filter((o) => o.plan === plan).map((o) => {
                    const cell = cellOf.get(o.publicationId) ?? null;
                    const canPick = cell?.itemId != null;
                    return (
                        <label key={o.publicationId} className={cn('flex h-[208px] flex-col overflow-hidden rounded-lg border p-2', cell ? stateClass(cell.state, cell.capped) : 'border-border bg-background', canPick && 'cursor-pointer', o.status !== 'ACTIVE' && 'opacity-50')} title={[cell?.text, cell?.lastError].filter(Boolean).join(' ') || undefined}>
                          <span className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[11px]">{o.externalId ?? 'Sin publicar'}</span>
                            {canPick ? (
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                                aria-label={`Elegir ${o.externalId ?? o.planLabel}`}
                                checked={selected.has(o.publicationId)}
                                onChange={(e) =>
                                  setSelected((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(o.publicationId);
                                    else next.delete(o.publicationId);
                                    return next;
                                  })
                                }
                              />
                            ) : null}
                          </span>
                          {o.status !== 'ACTIVE' ? <span className="mt-0.5 block text-[11px] font-medium">{CHANNEL_STATUS_LABEL[o.status as keyof typeof CHANNEL_STATUS_LABEL] ?? o.status} en {grid.channelName}</span> : null}
                          {cell ? (
                            <>
                              <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground">En esta oferta</span>
                              <span className="block font-semibold">{cell.label}</span>
                              {cell.price !== null && cell.state !== 'OUT' ? (
                                <span className="block">
                                  El comprador paga {formatPrice(cell.price)}
                                  {cell.discountPct !== null ? ` (${pct(cell.discountPct)} de descuento)` : ''}
                                </span>
                              ) : null}
                              {cell.marginPct !== null ? (
                                <span className="block">
                                  Deja {pct(cell.marginPct)}
                                  {money(cell.marginPct, o.cost) ? `, ${money(cell.marginPct, o.cost)}` : ''}
                                </span>
                              ) : null}
                              {/* El motivo, en dos renglones como mucho: entero se lee dejando el cursor encima. */}
                              {cell.text ? <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{cell.text}</span> : null}
                              {cell.lastError && cell.state !== 'FAILED' ? <span className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-destructive">{cell.lastError}</span> : null}
                            </>
                          ) : null}
                          <span className="mt-auto block border-t border-foreground/10 pt-1 text-[11px] text-muted-foreground">
                            <span className="block text-[10px] uppercase tracking-wide">Sin la oferta, hoy</span>
                            {o.listPrice !== null ? `Precio de lista ${formatPrice(o.listPrice)}` : 'Sin precio de lista'}
                            {o.discountNow ? `, con ${pct(o.discountNow)} de descuento propio` : ''}
                            <span className="block">{o.marginNow !== null ? `Deja ${pct(o.marginNow)}${money(o.marginNow, o.cost) ? `, ${money(o.marginNow, o.cost)}` : ''}` : o.cost === null ? 'Sin costo cargado' : ''}</span>
                          </span>
                          {o.excluded ? <span className="block truncate text-[11px] font-medium">Prohibida{o.excludedWhy ? `: ${o.excludedWhy}` : ''}</span> : null}
                        </label>
                    );
                  })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {current && !compact && manual ? (
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {selected.size > 0
                ? `${selected.size} elegidas`
                : current.source === 'CHANNEL'
                  ? 'Esta campaña todavía no está en el almanaque: para elegir casilleros, primero tocá «Sumar al almanaque» en su franja.'
                  : 'Elegí casilleros para prenderlos o sacarlos a mano.'}
            </span>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button size="sm" access="subir" disabled={busy || toEnter.length === 0} onClick={() => askPreview({ itemIds: toEnter.map((c) => c.itemId!), force: true })}>
                Prender ahora{toEnter.length > 0 ? ` (${toEnter.length})` : ''}
              </Button>
              <Button
                size="sm"
                variant="outline"
                access="subir"
                disabled={busy || inside.length === 0}
                onClick={() => {
                  const why = window.prompt(`Se sacan ${inside.length} de «${current.name}». Las que ya están en ${grid.channelName} salen de ahí y el almanaque no las vuelve a meter. ¿Por qué? (opcional)`);
                  if (why === null) return;
                  run(() => takeOutAction(accountSlug, inside.map((c) => c.itemId!), why), 'Se sacaron a mano.');
                }}
              >
                Sacar a mano{inside.length > 0 ? ` (${inside.length})` : ''}
              </Button>
              <Button access="promociones" size="sm" variant="outline" disabled={busy || undoable.length === 0} onClick={() => run(() => putBackAction(accountSlug, undoable.map((c) => c.itemId!)), 'Se volvieron a decidir con las reglas.')}>
                Volver a decidir{undoable.length > 0 ? ` (${undoable.length})` : ''}
              </Button>
              <Button access="promociones"
                size="sm"
                variant="ghost"
                disabled={busy || selected.size === 0}
                onClick={() => {
                  const ids = [...selected];
                  const all = grid.measures.flatMap((m) => m.options);
                  const lift = ids.every((id) => all.find((o) => o.publicationId === id)?.excluded);
                  const why = lift ? '' : window.prompt('Estas formas de cobro no van a entrar a ninguna oferta. No salen de las que ya están. ¿Por qué? (opcional)');
                  if (why === null) return;
                  run(() => excludeAction(accountSlug, grid.productId, ids, !lift, why), lift ? 'Se levantó la prohibición.' : 'Quedaron prohibidas en todas las ofertas.');
                }}
              >
                Prohibir o permitir en todas
              </Button>
            </div>
          </div>
        ) : null}
      </SectionCard>

      {log.length > 0 ? (
        <SectionCard title="Bitácora" icon={<History />} count={log.length} collapsible defaultOpen={!compact} description="Cada vez que se prendió o se apagó una oferta, lo que no se pudo y el antes y el después.">
          <ul className="divide-y text-sm">
            {log.map((l) => (
              <li key={l.id} className="flex flex-wrap gap-x-3 gap-y-0.5 px-4 py-2">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">{dateTime(l.at, timeZone)}</span>
                <span className="w-28 shrink-0 font-mono text-xs">{l.code ?? ''}</span>
                <span className="min-w-0 flex-1">
                  {l.text}
                  {l.auto ? <span className="ml-1 text-xs text-muted-foreground">Lo hizo la app, por el almanaque.</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}

function ActionList({ actions }: { actions: (DueAction | AppliedAction)[] }) {
  return (
    <ul className="mt-2 max-h-72 divide-y overflow-y-auto rounded-lg border text-sm">
      {actions.map((a) => (
        <li key={`${a.itemId}:${a.action}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5">
          <Badge variant={a.action === 'ON' ? 'success' : 'secondary'}>{a.action === 'ON' ? 'Prender' : 'Apagar'}</Badge>
          <span className="font-mono text-xs">{a.externalId ?? ''}</span>
          <span className="min-w-0 flex-1">
            {a.kind === 'OWN_DISCOUNT' ? `Descuento propio${a.action === 'ON' ? ` de ${pct(a.discountPct)}` : ''}` : a.name}
            {a.action === 'ON' && a.price !== null ? `, el comprador paga ${formatPrice(a.price)}` : ''}
            {a.action === 'ON' && a.marginPct !== null ? `, deja ${pct(a.marginPct)}` : ''}
            {a.action === 'ON' && a.capped ? ', al tope del canal' : ''}
            {a.stock ? `, reserva ${a.stock} unidades` : ''}
          </span>
          {'ok' in a ? <span className={cn('text-xs', a.ok ? 'text-muted-foreground' : 'text-destructive')}>{a.ok ? 'Hecho' : a.message}</span> : null}
        </li>
      ))}
    </ul>
  );
}

type Run = (work: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) => void;
// Como Run, con el aviso armado con lo que devolvió la acción.
type RunWith = <T extends object>(work: () => Promise<({ ok: true } & T) | { ok: false; error: string }>, done: (r: T) => string) => void;

function TagsCard({ accountSlug, grid, busy, run, runWith }: { accountSlug: string; grid: ProductGrid; busy: boolean; run: Run; runWith: RunWith }) {
  const [lifecycle, setLifecycle] = useState<Lifecycle | ''>(grid.tags.lifecycle ?? '');
  const [competition, setCompetition] = useState<Competition | ''>(grid.tags.competition ?? '');
  const [priority, setPriority] = useState<Priority | ''>(grid.tags.priority ?? '');
  const [stockControl, setStockControl] = useState(grid.tags.stockControl);
  const changed =
    lifecycle !== (grid.tags.lifecycle ?? '') || competition !== (grid.tags.competition ?? '') || priority !== (grid.tags.priority ?? '') || stockControl !== grid.tags.stockControl;
  const origin = (group: 'lifecycle' | 'competition') =>
    grid.manual.includes(group) ? 'Puesta a mano: la regla no la cambia.' : grid.why[group] ? `La propuso la regla. ${grid.why[group]}` : 'Sin etiqueta.';
  const ruleNow = () => runWith(() => classifyProductAction(accountSlug, grid.productId), (r) => `Etiquetas puestas según la regla. ${r.lines.join(' ')}`);
  const save = () =>
    run(
      () =>
        setTagsAction(accountSlug, [grid.productId], {
          ...(lifecycle !== (grid.tags.lifecycle ?? '') ? { lifecycle: lifecycle || null } : {}),
          ...(competition !== (grid.tags.competition ?? '') ? { competition: competition || null } : {}),
          ...(priority !== (grid.tags.priority ?? '') ? { priority: priority || null } : {}),
          ...(stockControl !== grid.tags.stockControl ? { stockControl } : {}),
        }),
      'Se guardaron las etiquetas y se rearmó el almanaque.',
    );
  return (
    <SectionCard
      title="Etiquetas"
      icon={<Tags />}
      description={`Valen para todas las medidas y formas de cobro del producto. Objetivo: ${grid.objective ? OBJECTIVE_LABEL[grid.objective] : 'sin definir, falta el ciclo de vida'}.`}
      action={
        <div className="flex gap-2">
          <Button
            access="promociones"
            size="sm"
            variant="outline"
            disabled={busy}
            title="La regla mira las ventas, la antigüedad y la competencia de este producto y le pone el ciclo de vida y la competencia. Lo que estaba puesto a mano en esas dos pasa a cargo de la regla. Control de stock y prioridad no cambian."
            onClick={() => ruleNow()}
          >
            <Wand2 />
            Poner según la regla
          </Button>
          <Button access="promociones" size="sm" disabled={busy || !changed} pending={busy} onClick={save}>
            Guardar
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Ciclo de vida</span>
          <select className={cn(SELECT, 'w-full')} value={lifecycle} onChange={(e) => setLifecycle(e.target.value as Lifecycle | '')}>
            <option value="">Sin etiqueta</option>
            {LIFECYCLES.map((l) => (
              <option key={l} value={l}>
                {LIFECYCLE_LABEL[l]}
              </option>
            ))}
          </select>
          <span className="block text-xs text-muted-foreground">{origin('lifecycle')}</span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Competencia</span>
          <select className={cn(SELECT, 'w-full')} value={competition} onChange={(e) => setCompetition(e.target.value as Competition | '')}>
            <option value="">Sin etiqueta</option>
            {COMPETITIONS.map((c) => (
              <option key={c} value={c}>
                {COMPETITION_LABEL[c]}
              </option>
            ))}
          </select>
          <span className="block text-xs text-muted-foreground">
            {origin('competition')}
            {grid.competitor ? ` El competidor más barato cobra ${formatPrice(grid.competitor.price)}${grid.competitor.seller ? `, ${grid.competitor.seller}` : ''}.` : ' No hay competidores cargados.'}
          </span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Prioridad comercial</span>
          <select className={cn(SELECT, 'w-full')} value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}>
            <option value="">Sin prioridad</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <span className="block text-xs text-muted-foreground">
            Solo a mano. Estacional: se anota siempre a las campañas que propone el canal para cada fecha, como Hot Sale, Black Friday o Navidad. Empujar: además entra a las ofertas relámpago y del día
            cada vez que aparecen, y en esas va más a fondo. Sin prioridad, sigue la receta de su ciclo de vida.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" checked={stockControl} onChange={(e) => setStockControl(e.target.checked)} />
          <span>
            <span className="font-medium">Control de stock</span>
            <span className="block text-xs text-muted-foreground">Solo a mano. La medida que tiene poco stock no entra a ofertas nuevas. No sale de las que ya está.</span>
          </span>
        </label>
      </div>
    </SectionCard>
  );
}

function SlotRow({
  accountSlug,
  timeZone,
  productId,
  column: c,
  editable,
  active,
  busy,
  floor,
  onPick,
  run,
}: {
  accountSlug: string;
  timeZone: string;
  productId: string;
  column: GridColumn;
  // En Manual se puede sumar, cambiar o sacar una franja; en Automático el almanaque es de las reglas.
  editable: boolean;
  active: boolean;
  busy: boolean;
  floor: number;
  onPick: () => void;
  run: Run;
}) {
  const [editing, setEditing] = useState(false);
  const [margin, setMargin] = useState(String(c.targetMarginPct));
  const [finish, setFinish] = useState(inputDay(c.finish, timeZone));
  const source = c.source === 'CHANNEL' ? 'Del canal, sin franja' : c.source === 'MANUAL' ? 'A mano' : 'Almanaque';
  const parsed = Number(margin.replace(',', '.'));
  return (
    <li className={cn('px-4 py-2.5', active && 'bg-secondary/60', c.cancelled && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button type="button" onClick={onPick} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left text-sm" aria-pressed={active}>
          <Badge variant={c.layer === 'BASE' ? 'secondary' : c.layer === 'PEAK' ? 'outline' : 'default'}>{LAYER_LABEL[c.layer]}</Badge>
          <span className="font-medium">{c.name}</span>
          <span className="text-muted-foreground">
            {c.finish && hasNoEnd(c.finish) ? `desde el ${shortDate(c.start, timeZone)}, sin fin` : `${shortDate(c.start, timeZone)} a ${shortDate(c.finish, timeZone)}`}{c.kind === 'OWN_DISCOUNT' && c.source === 'MANUAL' ? '' : ` · busca ${pct(c.targetMarginPct)}`} · {source}
            {c.cancelled ? ' · no va' : ''}
          </span>
        </button>
        <span className="text-xs text-muted-foreground">
          {c.counts.in} adentro o por entrar{c.counts.capped > 0 ? `, ${c.counts.capped} al tope` : ''} · {c.counts.out} afuera{c.counts.failed > 0 ? ` · ${c.counts.failed} no se pudo` : ''}
        </span>
        <div className={cn('flex gap-1.5', !editable && 'hidden')}>
          {c.source === 'CHANNEL' ? (
            <Button access="promociones" size="sm" variant="outline" disabled={busy} onClick={() => run(() => saveSlotAction(accountSlug, productId, { group: c.group }), 'La campaña quedó en el almanaque, a mano.')}>
              Sumar al almanaque
            </Button>
          ) : (
            <>
              <Button access="promociones" size="sm" variant="ghost" disabled={busy} onClick={() => setEditing((v) => !v)}>
                Cambiar
              </Button>
              {c.cancelled ? (
                <Button access="promociones" size="sm" variant="outline" disabled={busy} onClick={() => run(() => cancelSlotAction(accountSlug, c.slotId!, false, false, ''), 'La franja vuelve al almanaque.')}>
                  Vuelve
                </Button>
              ) : (
                <Button access="promociones"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    const why = window.prompt(`«${c.name}» no va: el almanaque no la vuelve a armar. Lo que ya esté prendido en el canal sigue hasta que lo saques a mano. ¿Por qué? (opcional)`);
                    if (why === null) return;
                    run(() => cancelSlotAction(accountSlug, c.slotId!, true, false, why), 'La franja no va.');
                  }}
                >
                  No va
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {c.note ? <p className="mt-1 text-xs text-muted-foreground">{c.note}</p> : null}
      {editing && c.slotId ? (
        <div className="mt-2 flex flex-wrap items-end gap-3 text-sm">
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">Rentabilidad buscada, en %</span>
            <Input className="w-28" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">Hasta</span>
            <Input className="w-40" type="date" value={finish} onChange={(e) => setFinish(e.target.value)} />
          </label>
          <Button access="promociones"
            size="sm"
            disabled={busy || !(parsed >= floor)}
            onClick={() => {
              setEditing(false);
              run(() => saveSlotAction(accountSlug, productId, { slotId: c.slotId!, targetMarginPct: parsed, finish: finish || undefined }), 'La franja quedó a mano con el cambio.');
            }}
          >
            Guardar
          </Button>
          {!(parsed >= floor) ? <span className="text-xs text-destructive">No puede ser menor que el piso de {pct(floor)}.</span> : null}
        </div>
      ) : null}
    </li>
  );
}
