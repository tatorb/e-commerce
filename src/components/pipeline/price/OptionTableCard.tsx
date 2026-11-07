'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/ui/brand-loader';
import { Input } from '@/components/ui/input';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { ChannelStatusBadge } from '@/components/stages/StageBadge';
import { flatForMargin, modeRows } from '@/domain/option-table';
import { formatPercent, formatPrice } from '@/domain/money';
import type { MarginLevel } from '@/domain/pricing';
import type { OptionTable, TableGroup, TableOption } from '@/lib/option-table';
import { loadOptionTableAction, type OptionTableResult } from '@/app/a/[cuenta]/pipeline/option-table-actions';
import { cn } from '@/lib/utils/cn';

// La tabla de precios por modo de compra: se parte del precio sin cuotas y
// cada modo lleva el precio que deja la misma ganancia. Por cada medida, qué
// publicación tiene en cada modo, con su estado, lo que tiene hoy en el canal
// y su campaña. Se pide al abrir, porque lee las campañas del canal. Por ahora
// solo muestra: probar otro precio sin cuotas no guarda nada.

const LEVEL_CLASS: Record<MarginLevel, string> = {
  target: 'text-emerald-700 dark:text-emerald-400',
  between: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  below: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

const LEVEL_TITLE: Record<MarginLevel, string> = {
  target: 'En el margen objetivo o más',
  between: 'Entre el margen mínimo y el objetivo',
  below: 'Debajo del margen mínimo',
};

const SOURCE_TEXT: Record<NonNullable<TableGroup['flatSource']>, string> = {
  pedido: 'el precio que probaste',
  ultimo_precio_guardado: 'el último precio guardado',
  margen_objetivo: 'el margen objetivo, porque todavía no se guardó un precio',
};

function Result({ profit, marginPct, level }: { profit: number; marginPct: number | null; level: MarginLevel | null }) {
  return (
    <span className={cn('inline-flex flex-col rounded px-1.5 py-0.5 tabular-nums', level && LEVEL_CLASS[level])} title={level ? LEVEL_TITLE[level] : undefined}>
      <span>{formatPrice(profit)}</span>
      <span className="text-xs">{marginPct === null ? '—' : formatPercent(marginPct)}</span>
    </span>
  );
}

function OptionCell({ o, channelName }: { o: TableOption; channelName: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn('tabular-nums', o.main && 'font-semibold')}>{o.externalId ?? 'Sin publicar'}</span>
        {o.url ? (
          <a href={o.url} target="_blank" rel="noreferrer" aria-label={`Ver ${o.externalId ?? ''} en ${channelName}`} className="text-primary">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
        {o.main ? <span className="text-xs text-primary">principal</span> : null}
        {o.status !== 'ACTIVE' ? <ChannelStatusBadge status={o.status} /> : null}
      </div>
      {o.statusReason ? <p className="max-w-xs text-xs text-muted-foreground">{o.statusReason}</p> : null}
    </div>
  );
}

function GroupTable({ group, params, channelName, multiple }: { group: TableGroup; params: OptionTable['params']; channelName: string; multiple: boolean }) {
  const [text, setText] = useState(group.flatPrice ? String(group.flatPrice) : '');
  const flat = Number(text.replace(/\./g, '').replace(',', '.'));
  const valid = group.cost !== null && Number.isFinite(flat) && flat > 0;
  const rows = valid ? modeRows({ flatPrice: flat, cost: group.cost!, params }) : group.rows;
  const changed = valid && Math.round(flat) !== group.flatPrice;
  const setMargin = (pct: number) => {
    const p = group.cost !== null ? flatForMargin(group.cost, params, pct) : null;
    if (p) setText(String(p));
  };

  return (
    <div className="space-y-3">
      {multiple ? <p className="text-sm font-medium">Costo de reposición sin IVA: {formatPrice(group.cost)} ({group.costNote})</p> : null}
      {group.cost === null ? (
        <p className="text-sm text-amber-700">Falta el costo de reposición sin IVA: cargalo en la pestaña Costo y Stock del producto.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-sm">
            <span className="block font-medium">Precio sin cuotas</span>
            <Input value={text} onChange={(e) => setText(e.target.value)} inputMode="numeric" className="w-40 tabular-nums" />
          </label>
          <Button type="button" variant="outline" size="sm" onClick={() => setMargin(params.targetMarginPct)}>
            Llevar al objetivo ({formatPercent(params.targetMarginPct, 0)})
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setMargin(params.minMarginPct)}>
            Llevar al mínimo ({formatPercent(params.minMarginPct, 0)})
          </Button>
          <p className="basis-full text-xs text-muted-foreground">
            {changed
              ? 'Probando otro precio: todavía no se guarda.'
              : group.flatSource
                ? `Sale de ${SOURCE_TEXT[group.flatSource]}.`
                : null}{' '}
            Cada modo lleva el precio que deja la misma ganancia, con el costo de sus cuotas de Ajustes &gt; Precios.
          </p>
        </div>
      )}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Modo de compra</th>
              <th className="px-3 py-2 font-medium">Publicación</th>
              <th className="px-3 py-2 text-right font-medium">Hoy en {channelName}</th>
              <th className="px-3 py-2 text-right font-medium">Precio calculado</th>
              <th className="px-3 py-2 text-right font-medium">Cuota</th>
              <th className="px-3 py-2 text-right font-medium">Ganancia y margen</th>
              <th className="px-3 py-2 font-medium">Campaña</th>
            </tr>
          </thead>
          {group.measures.map((m) => (
            <tbody key={m.mainId} className="divide-y border-t">
              {group.measures.length > 1 || m.measure ? (
                <tr className="bg-muted/20">
                  <th colSpan={7} className="px-3 py-1.5 text-left text-xs font-semibold">
                    {m.measure ? `Medida ${m.measure}` : 'Medida sin elegir'}
                  </th>
                </tr>
              ) : null}
              {m.modes.map((mode) => {
                const calc = rows.find((r) => r.plan === mode.plan);
                return (
                  <tr key={mode.plan} className="align-top">
                    <td className="px-3 py-2 font-medium">{calc?.label}</td>
                    <td className="px-3 py-2">
                      {mode.options.length === 0 ? (
                        <span className="text-muted-foreground">No existe</span>
                      ) : (
                        <div className="space-y-1.5">
                          {mode.options.map((o) => (
                            <OptionCell key={o.id} o={o} channelName={channelName} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="space-y-1.5">
                        {mode.options.map((o) => (
                          <div key={o.id} className="space-y-0.5">
                            <div className="tabular-nums">
                              {o.priceNow === null ? '—' : formatPrice(o.priceNow)}
                              {o.discountNow ? <span className="text-xs text-muted-foreground"> −{formatPercent(o.discountNow, 0)}</span> : null}
                            </div>
                            {o.now ? <Result {...o.now} /> : null}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {calc?.price === null || !calc ? <span className="text-xs font-normal text-amber-700">{calc?.missing}</span> : formatPrice(calc.price)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{calc?.installmentValue ? formatPrice(calc.installmentValue) : '—'}</td>
                    <td className="px-3 py-2 text-right">{calc && calc.profit !== null ? <Result profit={calc.profit} marginPct={calc.marginPct} level={calc.level} /> : '—'}</td>
                    <td className="px-3 py-2">
                      <div className="space-y-1.5">
                        {mode.options.map((o) =>
                          o.campaign ? (
                            <div key={o.id} className="space-y-0.5">
                              <p className="text-xs">
                                {o.campaign.name} · {o.campaign.state}
                              </p>
                              <p className="tabular-nums">{formatPrice(o.campaign.price)}</p>
                              <Result {...o.campaign.result} />
                            </div>
                          ) : mode.options.length > 1 ? (
                            <p key={o.id} className="text-xs text-muted-foreground">
                              Sin campaña
                            </p>
                          ) : null,
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

export function OptionTableCard({ accountSlug, publicationId }: { accountSlug: string; publicationId: string }) {
  const [result, setResult] = useState<OptionTableResult | null>(null);
  useEffect(() => {
    let alive = true;
    loadOptionTableAction(accountSlug, publicationId)
      .catch((): OptionTableResult => ({ ok: false, error: 'Se cortó la conexión con la app. Probá de nuevo.' }))
      .then((r) => alive && setResult(r));
    return () => {
      alive = false;
    };
  }, [accountSlug, publicationId]);

  return (
    <SectionCard
      title="Precios por modo de compra"
      icon={<Table2 />}
      description="Desde el precio sin cuotas, el de cada modo con la misma ganancia, y lo que tiene hoy cada publicación."
    >
      <SectionBody>
        {!result ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BrandMark className="h-5 w-5" />
            Leyendo las publicaciones y sus campañas…
          </div>
        ) : !result.ok ? (
          <p className="text-sm text-destructive">{result.error}</p>
        ) : (
          <div className="space-y-6">
            {result.table.groups.map((g) => (
              <GroupTable key={g.anchorId} group={g} params={result.table.params} channelName={result.table.channelName} multiple={result.table.groups.length > 1} />
            ))}
            {!result.table.campaignsRead ? <p className="text-xs text-muted-foreground">No se pudieron leer las campañas del canal.</p> : null}
          </div>
        )}
      </SectionBody>
    </SectionCard>
  );
}
