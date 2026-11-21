'use client';

import { Fragment } from 'react';
import { CHANNEL_STATUS_LABEL } from '@/domain/channel-status';
import { formatPrice } from '@/domain/money';
import { hasNoEnd, LAYER_LABEL, type Layer } from '@/domain/promo/plan';
import type { GridCell, GridColumn, GridOption, ProductGrid } from '@/lib/promo/view';
import { cn } from '@/lib/utils/cn';
import { pct, shortDate } from './format';

// La línea de tiempo de un producto: una fila por publicación, agrupadas por
// medida, y los próximos 90 días a lo ancho. Cada promoción en la que la
// publicación está o va a estar es una pastilla, del día en que empieza al
// día en que termina. Solo dibuja: lo que se hace con una pastilla lo decide
// quien la usa.

const DAY = 86_400_000;
export const TIMELINE_DAYS = 90;
// El alto de cada renglón de pastillas dentro de una fila.
const LANE = 26;

export type Pill = { column: GridColumn; cell: GridCell; left: number; width: number; lane: number; open: boolean };
export type PillKey = { slotId: string; publicationId: string };

const LAYER_ORDER: Record<Layer, number> = { BASE: 0, EVENT: 1, PEAK: 2 };

const LAYER_CLASS: Record<Layer, string> = {
  BASE: 'border-foreground/25 bg-secondary text-foreground',
  EVENT: 'border-primary bg-primary text-primary-foreground',
  PEAK: 'border-foreground bg-foreground text-background',
};

/** Las pastillas de una publicación, cada una en su renglón para que no se tapen. */
export function pillsOf(grid: ProductGrid, publicationId: string): { pills: Pill[]; lanes: number } {
  const t0 = new Date(grid.now).getTime();
  const span = TIMELINE_DAYS * DAY;
  const found: Omit<Pill, 'lane'>[] = [];
  for (const column of grid.columns) {
    // Lo que el canal ofrece y todavía no está en el almanaque no es una pastilla.
    if (!column.slotId || column.cancelled || !column.start || !column.finish) continue;
    const cell = column.cells.find((c) => c.publicationId === publicationId);
    if (!cell || cell.state === 'ENDED') continue;
    // Las que quedan afuera se muestran solo en eventos y picos, donde importa saber por qué.
    if (cell.state === 'OUT' && (column.layer === 'BASE' || cell.reason === 'MANUAL')) continue;
    const start = new Date(column.start).getTime();
    const finish = new Date(column.finish).getTime();
    if (finish <= t0 || start >= t0 + span) continue;
    const left = Math.max(0, (start - t0) / span) * 100;
    const right = Math.min(1, (finish - t0) / span) * 100;
    found.push({ column, cell, left, width: Math.max(right - left, 0.8), open: hasNoEnd(column.finish) || finish > t0 + span });
  }
  found.sort((a, b) => LAYER_ORDER[a.column.layer] - LAYER_ORDER[b.column.layer] || a.left - b.left);
  const ends: number[] = [];
  const pills = found.map((p): Pill => {
    let lane = ends.findIndex((end) => end <= p.left + 0.01);
    if (lane < 0) lane = ends.length;
    ends[lane] = p.left + p.width;
    return { ...p, lane };
  });
  return { pills, lanes: Math.max(1, ends.length) };
}

export function PromoTimeline({
  grid,
  timeZone,
  picked,
  onPick,
  selectable = false,
  selected,
  onSelect,
}: {
  grid: ProductGrid;
  timeZone: string;
  // La pastilla que se está mirando.
  picked: PillKey | null;
  onPick: (key: PillKey) => void;
  // En Manual se eligen filas para inscribirlas a una promoción.
  selectable?: boolean;
  selected?: Set<string>;
  onSelect?: (publicationIds: string[], on: boolean) => void;
}) {
  const t0 = new Date(grid.now).getTime();
  // Una marca por semana.
  const ticks = Array.from({ length: Math.floor(TIMELINE_DAYS / 7) + 1 }, (_, i) => ({ left: ((i * 7) / TIMELINE_DAYS) * 100, date: new Date(t0 + i * 7 * DAY) }));
  const severalTitles = new Set(grid.measures.map((m) => m.title ?? '')).size > 1;
  const all = grid.measures.flatMap((m) => m.options.map((o) => o.publicationId));
  const isOn = (ids: string[]) => ids.length > 0 && ids.every((id) => selected?.has(id));

  const label = (o: GridOption) => (
    <div className="min-w-0">
      <p className="truncate text-xs font-medium">{o.planLabel}</p>
      <p className="truncate font-mono text-[11px] text-muted-foreground">{o.externalId ?? 'Sin publicar'}</p>
      <p className="truncate text-[11px] text-muted-foreground">
        {o.status !== 'ACTIVE' ? `${CHANNEL_STATUS_LABEL[o.status as keyof typeof CHANNEL_STATUS_LABEL] ?? o.status} · ` : ''}
        {o.listPrice !== null ? formatPrice(o.listPrice) : 'Sin precio'}
        {o.marginNow !== null ? ` · hoy deja ${pct(o.marginNow)}` : ''}
      </p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[1180px] grid-cols-[240px_1fr] text-xs">
        {/* Los días, arriba. */}
        <div className="sticky left-0 z-10 flex items-end gap-2 border-b bg-card px-3 pb-1.5 pt-2 text-muted-foreground">
          {selectable ? <input type="checkbox" aria-label="Elegir todas las publicaciones" className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" checked={isOn(all)} onChange={(e) => onSelect?.(all, e.target.checked)} /> : null}
          Publicación
        </div>
        <div className="relative h-9 border-b">
          {ticks.map((t) => (
            <span key={t.left} className="absolute bottom-1.5 -translate-x-px border-l border-border pl-1 text-[11px] text-muted-foreground" style={{ left: `${t.left}%` }}>
              {t.left === 0 ? 'Hoy' : shortDate(t.date, timeZone)}
            </span>
          ))}
        </div>

        {grid.measures.map((m) => {
          const ids = m.options.map((o) => o.publicationId);
          return (
            <Fragment key={m.mainId}>
              {/* El nombre de la medida, a lo ancho. */}
              <div className="sticky left-0 z-10 flex items-center gap-2 border-b bg-muted/50 px-3 py-1.5 font-medium">
                {selectable ? <input type="checkbox" aria-label={`Elegir la medida ${m.measure ?? ''}`} className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" checked={isOn(ids)} onChange={(e) => onSelect?.(ids, e.target.checked)} /> : null}
                <span className="truncate">{m.measure ?? (grid.measures.length > 1 ? 'Medida sin identificar' : 'Medida única')}</span>
              </div>
              <div className="truncate border-b bg-muted/50 px-3 py-1.5 text-muted-foreground">
                {severalTitles && m.title ? `${m.title} · ` : ''}
                {m.stock !== null ? `Stock ${m.stock}` : m.measure === null && grid.measures.length > 1 ? 'La app no sabe qué medida vende, ni su stock' : ''}
              </div>

              {m.options.map((o) => {
                const { pills, lanes } = pillsOf(grid, o.publicationId);
                const off = o.status !== 'ACTIVE';
                return (
                  <Fragment key={o.publicationId}>
                    <div className={cn('sticky left-0 z-10 flex items-center gap-2 border-b bg-card px-3 py-1.5', off && 'opacity-50')}>
                      {selectable ? (
                        <input
                          type="checkbox"
                          aria-label={`Elegir ${o.externalId ?? o.planLabel}`}
                          className="h-3.5 w-3.5 shrink-0 accent-[hsl(var(--primary))]"
                          checked={selected?.has(o.publicationId) ?? false}
                          onChange={(e) => onSelect?.([o.publicationId], e.target.checked)}
                        />
                      ) : null}
                      {label(o)}
                    </div>
                    <div className={cn('relative border-b', off && 'opacity-50')} style={{ height: Math.max(52, lanes * LANE + 12) }}>
                      {/* Las rayas de cada semana. */}
                      {ticks.map((t) => (
                        <span key={t.left} className="absolute inset-y-0 border-l border-border/60" style={{ left: `${t.left}%` }} />
                      ))}
                      {pills.map((p) => {
                        const { column: c, cell } = p;
                        const isPicked = picked?.slotId === c.slotId && picked.publicationId === o.publicationId;
                        const text = `${c.name}${cell.price !== null && cell.state !== 'OUT' ? ` · ${formatPrice(cell.price)}` : ''}${cell.marginPct !== null ? ` · deja ${pct(cell.marginPct)}` : ''}`;
                        const when = hasNoEnd(c.finish!) ? `desde el ${shortDate(c.start, timeZone)}, sin fin` : `${shortDate(c.start, timeZone)} a ${shortDate(c.finish, timeZone)}`;
                        return (
                          <button
                            key={c.slotId}
                            type="button"
                            title={`${c.name}, ${when}. ${cell.label}.${cell.text ? ` ${cell.text}` : ''}`}
                            onClick={() => onPick({ slotId: c.slotId!, publicationId: o.publicationId })}
                            className={cn(
                              'absolute flex items-center overflow-hidden whitespace-nowrap rounded-full border px-2 text-left text-[11px] font-medium',
                              cell.state === 'OUT' ? 'border-dashed border-border bg-background text-muted-foreground' : LAYER_CLASS[c.layer],
                              // Por entrar: todavía no está en el canal.
                              cell.state === 'PLANNED' && 'border-dashed opacity-70',
                              cell.state === 'FAILED' && 'border-alert bg-alert/15 text-foreground',
                              p.open && 'rounded-r-none border-r-0',
                              isPicked && 'ring-2 ring-foreground ring-offset-1',
                            )}
                            style={{ left: `${p.left}%`, width: `${p.width}%`, top: 6 + p.lane * LANE, height: LANE - 6 }}
                          >
                            <span className="truncate">{cell.state === 'OUT' ? `${c.name} · ${cell.label}` : text}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-[11px] text-muted-foreground">
        {(['BASE', 'EVENT', 'PEAK'] as const).map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className={cn('inline-block h-3 w-6 rounded-full border', LAYER_CLASS[l])} />
            {LAYER_LABEL[l]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded-full border border-dashed border-foreground/40 bg-secondary opacity-70" />
          Por entrar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded-full border border-dashed border-border" />
          Afuera, con el motivo
        </span>
        <span>Tocá una pastilla para ver el precio y lo que deja.</span>
      </p>
    </div>
  );
}
