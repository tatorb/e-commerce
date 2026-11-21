'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Grid3x3, History, RefreshCw, Tags, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/ui/section-card';
import { formatPrice } from '@/domain/money';
import { hasNoEnd, LAYER_LABEL } from '@/domain/promo/plan';
import { COMPETITIONS, COMPETITION_LABEL, LIFECYCLES, LIFECYCLE_LABEL, MODE_LABEL, OBJECTIVE_LABEL, PRIORITIES, PRIORITY_LABEL, type Competition, type Lifecycle, type Mode, type Priority } from '@/domain/promo/tags';
import type { AppliedAction, DueAction } from '@/lib/promo/apply';
import type { ModeConflict } from '@/lib/promo/mode';
import type { ProductGrid } from '@/lib/promo/view';
import { cn } from '@/lib/utils/cn';
import {
  applyAction,
  classifyProductAction,
  clearPlanAction,
  modeConflictsAction,
  generatePlansAction,
  previewApplyAction,
  putBackAction,
  refreshProductAction,
  saveSlotAction,
  setModeAction,
  setTagsAction,
  takeOutAction,
} from '@/app/a/[cuenta]/promociones/actions';
import { dateTime, pct, shortDate } from './format';
import { PromoTimeline, TIMELINE_DAYS, type PillKey } from './PromoTimeline';

// Las promociones de un producto. Arriba, quién arma su almanaque: Manual o
// Automático. Abajo, la línea de tiempo: una fila por publicación y sus
// promociones como pastillas. En Automático se ven además las etiquetas, que
// son las que usan las reglas. En Manual se puede sacar una promoción o
// cambiarle hasta cuándo va.

export type LogRow = { id: string; at: Date; code: string | null; text: string; auto: boolean; kind: string };

const SELECT = 'h-9 rounded-md border border-input bg-card px-2 text-sm shadow-sm';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

export function ProductPromoPanel({ accountSlug, timeZone, grid, log, compact = false }: { accountSlug: string; timeZone: string; grid: ProductGrid; log: LogRow[]; compact?: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);
  // La pastilla que se está mirando en la línea de tiempo.
  const [pick, setPick] = useState<PillKey | null>(null);
  const [until, setUntil] = useState('');
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
      router.refresh();
    });

  // La franja que se mira en la grilla: la elegida, o la primera que está vigente.
  // Lo que deja en pesos: la rentabilidad es sobre el costo.
  const money = (marginPct: number | null, cost: number | null) => (marginPct === null || cost === null ? null : formatPrice(Math.round((cost * marginPct) / 100)));
  // La pastilla elegida, con su promoción, su casillero y su publicación.
  const pickedColumn = pick ? (grid.columns.find((c) => c.slotId === pick.slotId) ?? null) : null;
  const pickedCell = pickedColumn && pick ? (pickedColumn.cells.find((c) => c.publicationId === pick.publicationId) ?? null) : null;
  const pickedMeasure = pick ? (grid.measures.find((m) => m.options.some((o) => o.publicationId === pick.publicationId)) ?? null) : null;
  const pickedOption = pickedMeasure && pick ? (pickedMeasure.options.find((o) => o.publicationId === pick.publicationId) ?? null) : null;
  // Las publicaciones de esa promoción que están adentro o por entrar.
  const pickedActive = (pickedColumn?.cells ?? []).filter((c) => c.itemId && (c.state === 'PLANNED' || c.state === 'ON' || c.state === 'SCHEDULED')).map((c) => c.itemId!);
  // Lo que el canal ofrece y todavía no está en el almanaque.
  const offers = grid.columns.filter((c) => c.source === 'CHANNEL');

  const run = (work: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) =>
    start(async () => {
      setNotice(null);
      const r = await work().catch(() => ({ ok: false as const, error: 'Se cortó la conexión con la app.' }));
      setNotice(r.ok ? { kind: 'ok', text: done } : { kind: 'error', text: r.error });
      if (r.ok) {
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
      router.refresh();
    });

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
        description={
          manual
            ? `Cada fila es una publicación en los próximos ${TIMELINE_DAYS} días, con las promociones en las que está inscripta y las que armaste. Invitaciones del canal leídas ${grid.invitationsAt ? dateTime(grid.invitationsAt, timeZone) : 'todavía no'}.`
            : `Cada fila es una publicación en los próximos ${TIMELINE_DAYS} días, con las promociones que le armaron las reglas. Armado ${grid.plannedAt ? dateTime(grid.plannedAt, timeZone) : 'todavía no'}. Invitaciones del canal leídas ${grid.invitationsAt ? dateTime(grid.invitationsAt, timeZone) : 'todavía no'}.`
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
                  if (!window.confirm('Se borran las promociones que todavía no empezaron. Lo que ya está en el canal queda como está.')) return;
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
            <Button size="sm" access="subir" disabled={busy} title="La app lo hace sola con la lectura de cada hora. Con este botón se manda ahora, con la vista previa antes." onClick={() => askPreview({ productIds: [grid.productId] })}>
              Mandar ahora lo de hoy
            </Button>
          </div>
        }
      >
        {grid.measures.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Este producto no tiene publicaciones activas en {grid.channelName}.</p>
        ) : (
          <PromoTimeline grid={grid} timeZone={timeZone} picked={pick} onPick={setPick} />
        )}
      </SectionCard>

      {preview ? (
        <div className="rounded-2xl border border-foreground/20 bg-card p-4 shadow-card">
          <p className="font-medium">
            Vista previa: {preview.actions.length} {preview.actions.length === 1 ? 'cambio' : 'cambios'} en {grid.channelName}
          </p>
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

      {/* La pastilla elegida: qué es, cuánto paga el comprador y cuánto deja. En Manual, además, lo que se puede hacer con ella. */}
      {pickedColumn && pickedCell && pickedOption ? (
        <SectionCard
          title={pickedColumn.name}
          icon={<Tags />}
          description={`${LAYER_LABEL[pickedColumn.layer]}, ${pickedColumn.finish && hasNoEnd(pickedColumn.finish) ? `desde el ${shortDate(pickedColumn.start, timeZone)}, sin fecha de fin` : `del ${shortDate(pickedColumn.start, timeZone)} al ${shortDate(pickedColumn.finish, timeZone)}`}. ${pickedOption.planLabel}${pickedMeasure?.measure ? `, medida ${pickedMeasure.measure}` : ''}, ${pickedOption.externalId ?? 'sin publicar'}.`}
          action={
            <Button size="sm" variant="ghost" access="view" onClick={() => setPick(null)}>
              Cerrar
            </Button>
          }
        >
          <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Estado</dt>
              <dd className="font-medium">{pickedCell.label}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">El comprador paga</dt>
              <dd className="font-medium">
                {pickedCell.price !== null ? formatPrice(pickedCell.price) : '—'}
                {pickedCell.discountPct !== null ? ` (${pct(pickedCell.discountPct)} de descuento)` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Deja</dt>
              <dd className="font-medium">
                {pct(pickedCell.marginPct)}
                {money(pickedCell.marginPct, pickedOption.cost) ? `, ${money(pickedCell.marginPct, pickedOption.cost)}` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Precio de lista, sin ofertas</dt>
              <dd>
                {pickedOption.listPrice !== null ? formatPrice(pickedOption.listPrice) : 'Sin precio de lista'}
                {pickedOption.marginList !== null ? `, deja ${pct(pickedOption.marginList)}${money(pickedOption.marginList, pickedOption.cost) ? `, ${money(pickedOption.marginList, pickedOption.cost)}` : ''}` : ''}
              </dd>
            </div>
            {pickedCell.text || pickedCell.lastError || pickedColumn.note ? (
              <p className="text-muted-foreground sm:col-span-2 lg:col-span-4">
                {[pickedCell.text, pickedCell.lastError, pickedColumn.note].filter(Boolean).join(' ')}
              </p>
            ) : null}
          </dl>
          {manual && !compact ? (
            <div className="flex flex-wrap items-end gap-2 border-t px-4 py-3 text-sm">
              {pickedCell.state === 'PLANNED' && pickedCell.itemId ? (
                <Button size="sm" access="subir" disabled={busy} onClick={() => askPreview({ itemIds: [pickedCell.itemId!], force: true })}>
                  Prender ahora
                </Button>
              ) : null}
              {pickedCell.itemId && (pickedCell.state === 'PLANNED' || pickedCell.state === 'ON' || pickedCell.state === 'SCHEDULED') ? (
                <Button
                  size="sm"
                  variant="outline"
                  access="subir"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Se saca ${pickedOption.externalId ?? 'esta publicación'} de «${pickedColumn.name}».${pickedCell.state === 'PLANNED' ? ' Todavía no había entrado: no va a entrar.' : ` Sale de ${grid.channelName} ahora.`}`)) return;
                    run(() => takeOutAction(accountSlug, [pickedCell.itemId!], ''), 'Se sacó.');
                  }}
                >
                  Sacar esta publicación
                </Button>
              ) : null}
              {pickedActive.length > 1 ? (
                <Button
                  size="sm"
                  variant="outline"
                  access="subir"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Se sacan las ${pickedActive.length} publicaciones de «${pickedColumn.name}». Las que ya están en ${grid.channelName} salen ahora.`)) return;
                    run(() => takeOutAction(accountSlug, pickedActive, ''), 'Se sacaron.');
                  }}
                >
                  Sacar las {pickedActive.length} de esta promoción
                </Button>
              ) : null}
              {pickedCell.state === 'FAILED' && pickedCell.itemId ? (
                <Button size="sm" variant="outline" access="promociones" disabled={busy} onClick={() => run(() => putBackAction(accountSlug, [pickedCell.itemId!]), 'Se vuelve a intentar.')}>
                  Volver a intentar
                </Button>
              ) : null}
              <label className="ml-auto space-y-1">
                <span className="block text-xs text-muted-foreground">Hasta cuándo va, para todas sus publicaciones</span>
                <span className="flex gap-2">
                  <Input className="w-40" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                  <Button
                    size="sm"
                    variant="outline"
                    access="promociones"
                    disabled={busy || !until}
                    onClick={() => run(() => saveSlotAction(accountSlug, grid.productId, { slotId: pickedColumn.slotId!, finish: until }), 'Se cambió hasta cuándo va. La app la saca sola ese día.')}
                  >
                    Guardar
                  </Button>
                </span>
              </label>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {/* Lo que el canal ofrece y todavía no está en el almanaque. */}
      {offers.length > 0 ? (
        <SectionCard
          title={`Invitaciones de ${grid.channelName} que no están en el almanaque`}
          icon={<Grid3x3 />}
          count={offers.length}
          collapsible
          defaultOpen={manual && !compact}
          description={manual ? 'Campañas a las que el canal invita a alguna publicación de este producto. Al sumarla, entran las publicaciones invitadas que dejan el piso o más.' : 'Campañas a las que el canal invita y que las reglas no incluyeron, por la receta de su ciclo de vida.'}
        >
          <ul className="divide-y text-sm">
            {offers.map((c) => (
              <li key={c.group} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <Badge variant={c.layer === 'BASE' ? 'secondary' : c.layer === 'PEAK' ? 'outline' : 'default'}>{LAYER_LABEL[c.layer]}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {c.campaignKind ?? 'Campaña del canal'} · {shortDate(c.start, timeZone)} a {shortDate(c.finish, timeZone)} · con la rentabilidad saludable entrarían {c.counts.in} de {c.cells.length}
                    {c.counts.capped > 0 ? `, ${c.counts.capped} al tope` : ''}
                  </span>
                </span>
                {manual && !compact ? (
                  <Button access="promociones" size="sm" variant="outline" disabled={busy} onClick={() => run(() => saveSlotAction(accountSlug, grid.productId, { group: c.group }), 'La campaña quedó en el almanaque.')}>
                    Sumar al almanaque
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

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
