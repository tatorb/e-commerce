'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { loadOptionTableAction, saveFlatPriceAction, type OptionTableResult } from '@/app/a/[cuenta]/pipeline/option-table-actions';
import { pushPriceAction } from '@/app/a/[cuenta]/simulador-precio/actions';
import { cn } from '@/lib/utils/cn';

// La tabla de precios por modo de compra: se parte del precio sin cuotas y
// cada modo lleva el precio que deja la misma ganancia. Por cada medida, qué
// publicación tiene en cada modo, con su estado, lo que tiene hoy en el canal
// y su campaña. Se pide al abrir, porque lee las campañas del canal. Guardar
// deja cada publicación con el precio de su modo en Por subir; Subir lo manda
// al canal, publicación por publicación.

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
      {o.pending && o.savedPrice !== null ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Por subir: {formatPrice(o.savedPrice)}
          {o.savedDiscount ? ` −${formatPercent(o.savedDiscount, 0)}` : ''}
        </p>
      ) : null}
    </div>
  );
}

type Line = { text: string; bad: boolean };

// Las que se pueden subir: publicadas, con algo por subir y que el canal no frenó ni está revisando.
const pushable = (o: TableOption) => o.externalId !== null && o.pending && !o.blocked && !['CLOSED', 'DELETED', 'UNDER_REVIEW'].includes(o.status);

function GroupTable({
  group,
  params,
  channelName,
  multiple,
  accountSlug,
  onSaved,
}: {
  group: TableGroup;
  params: OptionTable['params'];
  channelName: string;
  multiple: boolean;
  accountSlug: string;
  onSaved: () => Promise<void>;
}) {
  const router = useRouter();
  const [text, setText] = useState(group.flatPrice ? String(group.flatPrice) : '');
  const [busy, setBusy] = useState<'save' | 'push' | null>(null);
  const [confirmBelow, setConfirmBelow] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  // El sin cuotas recién guardado: si la principal tiene cuotas o descuento, al volver a leer puede salir unos pesos distinto.
  const [savedFlat, setSavedFlat] = useState<number | null>(null);
  const flat = Number(text.replace(/\./g, '').replace(',', '.'));
  const valid = group.cost !== null && Number.isFinite(flat) && flat > 0;
  const rows = valid ? modeRows({ flatPrice: flat, cost: group.cost!, params }) : group.rows;
  const changed = valid && Math.round(flat) !== (savedFlat ?? group.flatPrice);
  const setMargin = (pct: number) => {
    const p = group.cost !== null ? flatForMargin(group.cost, params, pct) : null;
    if (p) setText(String(p));
  };
  const below = valid && rows.find((r) => r.plan === 0)?.level === 'below';
  const all = group.measures.flatMap((m) => [...m.modes.flatMap((x) => x.options), ...m.unknownPlan]);
  const toPush = all.filter(pushable);

  async function save() {
    setBusy('save');
    const r = await saveFlatPriceAction(accountSlug, group.anchorId, flat, confirmBelow).catch(() => null);
    if (!r || !r.ok) {
      setLines([{ text: r ? r.error : 'Se cortó la conexión con la app. Probá de nuevo.', bad: true }]);
    } else {
      setLines([
        { text: 'Guardado. Queda en Por subir, todavía no se mandó nada.', bad: false },
        ...r.lines.map((l) => ({
          text: `${l.code} (${l.plan.toLowerCase()}): ${l.price !== null ? formatPrice(l.price) : 'sin precio'}${l.text ? `. ${l.text}` : ''}`,
          bad: l.price === null,
        })),
      ]);
      setConfirmBelow(false);
      setSavedFlat(Math.round(flat));
      await onSaved();
      router.refresh();
    }
    setBusy(null);
  }

  async function push() {
    setBusy('push');
    const r = await pushPriceAction(accountSlug, toPush.map((o) => o.id)).catch(() => null);
    if (!r || !r.ok) {
      setLines([{ text: `No se subió a ${channelName}: ${r ? r.error : 'se cortó la conexión con la app. Probá de nuevo.'}`, bad: true }]);
    } else {
      setLines(
        r.results.flatMap((x): Line[] => {
          if (x.error) return [{ text: `${x.code}: no se subió. ${x.error}`, bad: true }];
          const out: Line[] = [];
          if (x.sent.length > 0) out.push({ text: `${x.code}: subido, ${x.sent.join(', ')}.${x.confirmed ? '' : ' Todavía no se pudo volver a leer para confirmarlo.'}`, bad: false });
          else if (x.rejected.length === 0) out.push({ text: `${x.code}: no había nada del precio por subir.`, bad: false });
          if (x.rejected.length > 0) out.push({ text: `${x.code}: ${channelName} no aceptó ${x.rejected.join(' ')}`, bad: true });
          return out;
        }),
      );
      await onSaved();
      router.refresh();
    }
    setBusy(null);
  }

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
            Cada modo lleva el precio que deja la misma ganancia, con el costo de sus cuotas de Ajustes &gt; Precios. Una publicación con descuento propio
            lo conserva: su precio publicado sube lo que se lleva el descuento.
          </p>
          {below ? (
            <label className="flex basis-full items-center gap-2 text-sm text-red-700 dark:text-red-400">
              <input type="checkbox" checked={confirmBelow} onChange={(e) => setConfirmBelow(e.target.checked)} />
              El margen queda debajo del mínimo: guardarlo igual.
            </label>
          ) : null}
          <div className="flex basis-full flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!valid || busy !== null || (below && !confirmBelow)} onClick={save}>
              {busy === 'save' ? 'Guardando…' : 'Guardar precios'}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={toPush.length === 0 || changed || busy !== null} onClick={push}>
              {busy === 'push'
                ? 'Subiendo…'
                : toPush.length === 0
                  ? `Nada por subir a ${channelName}`
                  : `Subir ${toPush.length === 1 ? '1 publicación' : `${toPush.length} publicaciones`} a ${channelName}`}
            </Button>
          </div>
          {changed && toPush.length > 0 ? <p className="basis-full text-xs text-muted-foreground">Guardá el precio nuevo antes de subir.</p> : null}
          {lines.length > 0 ? (
            <ul className="basis-full space-y-0.5 text-sm" aria-live="polite">
              {lines.map((l, i) => (
                <li key={i} className={l.bad ? 'text-destructive' : undefined}>
                  {l.text}
                </li>
              ))}
            </ul>
          ) : null}
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
  const load = useCallback(
    () => loadOptionTableAction(accountSlug, publicationId).catch((): OptionTableResult => ({ ok: false, error: 'Se cortó la conexión con la app. Probá de nuevo.' })),
    [accountSlug, publicationId],
  );
  useEffect(() => {
    let alive = true;
    load().then((r) => alive && setResult(r));
    return () => {
      alive = false;
    };
  }, [load]);
  // Después de guardar o subir: la tabla vuelve a leerse, sin perder lo que se ve mientras tanto.
  const reload = useCallback(async () => {
    const r = await load();
    if (r.ok) setResult(r);
  }, [load]);

  return (
    <SectionCard
      title="Precios por modo de compra"
      icon={<Table2 />}
      description="Desde el precio sin cuotas, el de cada modo con la misma ganancia, y lo que tiene hoy cada publicación. Guardar no manda nada al canal."
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
              <GroupTable
                key={g.anchorId}
                group={g}
                params={result.table.params}
                channelName={result.table.channelName}
                multiple={result.table.groups.length > 1}
                accountSlug={accountSlug}
                onSaved={reload}
              />
            ))}
            {!result.table.campaignsRead ? <p className="text-xs text-muted-foreground">No se pudieron leer las campañas del canal.</p> : null}
          </div>
        )}
      </SectionBody>
    </SectionCard>
  );
}
