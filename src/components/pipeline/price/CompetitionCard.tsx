'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { OpenLinkButton } from '@/components/ui/open-link-button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { daysSince } from '@/domain/competitors';
import { formatPercent, formatPrice } from '@/domain/money';
import { brandKey, brandOptions, competitorAverage, copyablePlan, type ComparedRow, type Comparison } from '@/domain/price-comparison';
import { planLabel, type InstallmentPlan, type PricingParams } from '@/domain/pricing';
import { cn } from '@/lib/utils/cn';

// Mi precio frente al de la competencia que se cargó en el paso Información:
// una fila mía arriba y una por competidor, lo que más importa en números y
// un resumen en palabras. Los botones mueven el simulador. La lista se filtra
// por marca y termina con el promedio de lo que se ve; los números de arriba
// y los botones siguen mirando a toda la competencia.

const MAX_DISCOUNT = 50;

const cuotas = (r: ComparedRow) => planLabel(r.installments);

// Toda la competencia, o una marca: "m:" y su clave, que puede ser vacía (sin marca).
const ALL = 'todas';
const brandValue = (key: string) => `m:${key}`;

// Mi fila, para que se distinga de la competencia.
const MINE_ROW = 'bg-emerald-100 dark:bg-emerald-950/50';

function Diff({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const pricier = value > 0.05;
  const cheaper = value < -0.05;
  if (!pricier && !cheaper) return <span className="text-muted-foreground">Igual</span>;
  return (
    <span className={cn('tabular-nums', pricier && 'text-red-700', cheaper && 'text-emerald-700')}>
      {pricier ? '+' : ''}
      {formatPercent(value)}
    </span>
  );
}

function surveyed(day: string | null, today: string): string {
  if (!day) return 'Sin fecha';
  const days = daysSince(day, today);
  return days <= 0 ? 'Relevado hoy' : days === 1 ? 'Relevado ayer' : `Relevado hace ${days} días`;
}

export function CompetitionCard({
  comparison,
  params,
  plan,
  withoutPrice,
  infoHref,
  today,
  onMatch,
  onCopyPlan,
  disabled,
}: {
  comparison: Comparison | null;
  params: PricingParams;
  plan: InstallmentPlan;
  withoutPrice: number;
  infoHref: string;
  today: string;
  onMatch: (discountPct: number) => void;
  onCopyPlan: (plan: InstallmentPlan) => void;
  disabled?: boolean;
}) {
  const others = comparison?.rows.filter((r) => !r.mine) ?? [];
  const [brand, setBrand] = useState(ALL);
  const missing = withoutPrice > 0 ? `${withoutPrice === 1 ? 'Un competidor no tiene' : `${withoutPrice} competidores no tienen`} precio cargado.` : null;

  if (!comparison || others.length === 0) {
    return (
      <SectionCard title="Comparación con la competencia" description="Con los precios que se cargan en el paso Información.">
        <SectionBody>
          <p className="text-sm text-muted-foreground">
            {withoutPrice > 0 ? `${missing} ` : 'Todavía no hay competencia cargada. '}Cargá el precio de lista, el descuento, las cuotas y el envío de cada
            competidor en el paso Información.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={infoHref}>Ir a Información</Link>
          </Button>
        </SectionBody>
      </SectionCard>
    );
  }

  const { cheapest, match } = comparison;
  const copy = copyablePlan(cheapest, params);
  const tooMuch = match !== null && match.discountPct > MAX_DISCOUNT;
  const brands = brandOptions(comparison.rows);
  // Si la marca elegida ya no está, por ejemplo porque se borró ese competidor, se ven todos.
  const chosen = brand === ALL ? null : (brands.find((b) => brandValue(b.key) === brand) ?? null);
  const rows = chosen ? comparison.rows.filter((r) => r.mine || brandKey(r) === chosen.key) : comparison.rows;
  const average = competitorAverage(rows);
  const averageLabel = average
    ? chosen
      ? `Promedio de ${average.count} ${chosen.key === '' ? 'sin marca' : `de marca ${chosen.label}`}`
      : `Promedio de ${average.count === 1 ? '1 competidor' : `los ${average.count} competidores`}`
    : null;

  return (
    <SectionCard
      title="Comparación con la competencia"
      count={others.length}
      description={`Por precio efectivo: lo que paga el comprador en total. El tuyo va con envío gratis; al de un competidor sin envío gratis se le suman ${formatPrice(params.shipping)}.`}
    >
      <SectionBody className="space-y-4">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border px-3 py-2">
            <dt className="text-xs text-muted-foreground">Tu lugar por precio</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {comparison.rank} de {comparison.total}
            </dd>
          </div>
          <div className="rounded-md border px-3 py-2">
            <dt className="text-xs text-muted-foreground">El más barato</dt>
            <dd className="truncate text-lg font-semibold" title={cheapest?.name}>
              {cheapest ? formatPrice(Math.round(cheapest.effectivePrice)) : '—'}
            </dd>
            <dd className="truncate text-xs text-muted-foreground">{cheapest?.name}</dd>
          </div>
          <div className="rounded-md border px-3 py-2">
            <dt className="text-xs text-muted-foreground">Si lo igualás, te queda</dt>
            <dd
              className={cn(
                'text-lg font-semibold tabular-nums',
                match && match.marginPct !== null && (match.reachesMin ? 'text-emerald-700' : 'text-red-700'),
              )}
            >
              {match ? (match.marginPct === null ? '—' : `${formatPercent(match.marginPct)} de margen`) : 'Ya sos el más barato'}
            </dd>
          </div>
        </dl>

        <ul className="list-disc space-y-1 pl-5 text-sm">
          {comparison.summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {missing ? <li className="text-muted-foreground">{missing}</li> : null}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || !match}
            onClick={() => match && onMatch(Math.min(Math.max(match.discountPct, 0), MAX_DISCOUNT))}
          >
            Igualar al más barato con descuento
          </Button>
          <Button size="sm" variant="outline" disabled={disabled || !copy || !copy.available || copy.plan === plan} onClick={() => copy && onCopyPlan(copy.plan)}>
            Copiar sus cuotas
          </Button>
          {tooMuch ? <span className="text-xs text-muted-foreground">Igualarlo pide más de {MAX_DISCOUNT} % de descuento: queda en {MAX_DISCOUNT} %.</span> : null}
          {copy && !copy.available ? (
            <span className="text-xs text-muted-foreground">Ofrece {copy.plan} cuotas: cargá su costo en Ajustes &gt; Precios para usarlas.</span>
          ) : null}
          {!copy && cheapest ? <span className="text-xs text-muted-foreground">El más barato no ofrece cuotas.</span> : null}
        </div>

        {brands.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Marca</span>
            <Select value={chosen ? brand : ALL} onValueChange={setBrand}>
              <SelectTrigger className="w-auto min-w-48" aria-label="Filtrar la competencia por marca">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas ({others.length})</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.key} value={brandValue(b.key)}>
                    {b.label} ({b.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* En la computadora, una tabla; en el celular, una tarjeta por fila. */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-2 font-normal">Vendedor</th>
                <th className="py-2 pr-2 font-normal">Marca</th>
                <th className="py-2 pr-2 text-right font-normal">Lista</th>
                <th className="py-2 pr-2 text-right font-normal">Desc.</th>
                <th className="py-2 pr-2 font-normal">Cuotas</th>
                <th className="py-2 pr-2 font-normal">Envío</th>
                <th className="py-2 pr-2 text-right font-normal">Precio efectivo</th>
                <th className="py-2 pr-2 text-right font-normal">Cuota</th>
                <th className="py-2 text-right font-normal">Vos vs. ellos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={cn('border-b last:border-0', r.mine && cn(MINE_ROW, 'font-medium'))}>
                  <td className="max-w-48 py-2 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate" title={r.title ?? r.name}>
                        {r.name}
                      </span>
                      {r.url ? <OpenLinkButton url={r.url} label={`Abrir la publicación de ${r.name}`} className="h-6 w-6" /> : null}
                    </div>
                    {!r.mine ? <span className="block text-[11px] font-normal text-muted-foreground">{surveyed(r.surveyedAt, today)}</span> : null}
                  </td>
                  <td className={cn('max-w-32 truncate py-2 pr-2', !r.brand && 'text-xs font-normal text-muted-foreground')} title={r.brand ?? undefined}>
                    {r.brand ?? 'Sin marca'}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{formatPrice(Math.round(r.listPrice))}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{r.discountPct > 0 ? formatPercent(r.discountPct) : '—'}</td>
                  <td className="py-2 pr-2">{cuotas(r)}</td>
                  <td className="py-2 pr-2">{r.freeShipping ? 'Gratis' : 'Con costo'}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{formatPrice(Math.round(r.effectivePrice))}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{r.installmentValue === null ? '—' : formatPrice(Math.round(r.installmentValue))}</td>
                  <td className="py-2 text-right">{r.mine ? <span className="text-muted-foreground">—</span> : <Diff value={r.diffPct} />}</td>
                </tr>
              ))}
            </tbody>
            {average ? (
              <tfoot>
                <tr className="border-t-2 font-medium">
                  <td colSpan={2} className="py-2 pr-2">
                    {averageLabel}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{formatPrice(Math.round(average.listPrice))}</td>
                  <td colSpan={3} />
                  <td className="py-2 pr-2 text-right tabular-nums">{formatPrice(Math.round(average.effectivePrice))}</td>
                  <td />
                  <td className="py-2 text-right">
                    <Diff value={average.diffPct} />
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <ul className="space-y-2 sm:hidden">
          {rows.map((r, i) => (
            <li key={i} className={cn('rounded-md border px-3 py-2 text-sm', r.mine && cn(MINE_ROW, 'border-emerald-300 dark:border-emerald-800'))}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.brand ? `Marca ${r.brand}` : 'Sin marca'}</p>
                  {!r.mine ? <p className="text-[11px] text-muted-foreground">{surveyed(r.surveyedAt, today)}</p> : null}
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatPrice(Math.round(r.effectivePrice))}</p>
                  {!r.mine ? (
                    <p className="text-xs">
                      Vos <Diff value={r.diffPct} />
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>Lista {formatPrice(Math.round(r.listPrice))}</span>
                {r.discountPct > 0 ? <span>{formatPercent(r.discountPct)} off</span> : null}
                <span>
                  {cuotas(r)}
                  {r.installmentValue !== null ? ` de ${formatPrice(Math.round(r.installmentValue))}` : ''}
                </span>
                <span>Envío {r.freeShipping ? 'gratis' : 'con costo'}</span>
              </p>
            </li>
          ))}
          {average ? (
            <li className="flex items-start justify-between gap-2 rounded-md border-2 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{averageLabel}</p>
                <p className="text-xs text-muted-foreground">Lista {formatPrice(Math.round(average.listPrice))}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{formatPrice(Math.round(average.effectivePrice))}</p>
                <p className="text-xs">
                  Vos <Diff value={average.diffPct} />
                </p>
              </div>
            </li>
          ) : null}
        </ul>
      </SectionBody>
    </SectionCard>
  );
}
