'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OpenLinkButton } from '@/components/ui/open-link-button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { daysSince } from '@/domain/competitors';
import { formatPercent, formatPrice } from '@/domain/money';
import { brandKey, brandOptions, competitorAverage, copyablePlan, type ComparedRow, type Comparison, type Estimate } from '@/domain/price-comparison';
import { planLabel, type InstallmentPlan, type PricingParams } from '@/domain/pricing';
import { cn } from '@/lib/utils/cn';

// Mi precio frente al de la competencia que se cargó en el paso Información:
// una fila mía arriba y una por competidor, lo que más importa en números y
// un resumen en palabras. Los botones mueven el simulador. La lista se filtra
// por marca y termina con el promedio de lo que se ve; los números de arriba
// y los botones siguen mirando a toda la competencia. Cada fila dice cuánto
// sumarían tus costos y qué margen te quedaría vendiendo a su precio y en sus
// condiciones: verde si ganás, rojo si perdés. En la computadora, los títulos
// de la tabla quedan fijos debajo del encabezado de la página.

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
    <span className={cn('whitespace-nowrap tabular-nums', pricier && 'text-red-700', cheaper && 'text-emerald-700')}>
      {pricier ? '+' : ''}
      {formatPercent(value)}
    </span>
  );
}

const ESTIMATE_HELP = 'El margen sobre el costo que te quedaría vendiendo a su precio y en sus condiciones, con tu costo y tus costos. Supone que les cuesta lo mismo que a vos.';
const COSTS_HELP =
  'Lo que te costaría vender a su precio y en sus condiciones: tu costo de reposición, IVA, cargo del canal, impuestos, el costo de sus cuotas, publicidad, devoluciones, embalaje y el envío si lo ofrece gratis.';

/** La rentabilidad estimada de una fila: verde si se gana, rojo si se pierde. */
function EstimateCell({ value }: { value: Estimate | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  if (value.marginPct === null) {
    return (
      <span className="text-xs font-normal text-muted-foreground" title={value.why === 'plan' ? 'Ese plan de cuotas no tiene su costo cargado en Ajustes > Precios.' : undefined}>
        {value.why === 'cost' ? 'Falta el costo' : 'Sin costo del plan'}
      </span>
    );
  }
  return (
    <span className={cn('whitespace-nowrap tabular-nums', value.marginPct > 0.005 ? 'text-emerald-700' : value.marginPct < -0.005 ? 'text-red-700' : 'text-muted-foreground')}>
      {formatPercent(value.marginPct)}
    </span>
  );
}

/** Los costos totales de una fila, en pesos. Sin estimación, una raya. */
function CostsCell({ value }: { value: Estimate | null }) {
  if (!value || value.marginPct === null) return <span className="text-muted-foreground">—</span>;
  return <span className="whitespace-nowrap tabular-nums">{formatPrice(Math.round(value.costs))}</span>;
}

/** Un título de la tabla con su ayuda al pasar el mouse. */
function HelpLabel({ label, help }: { label: string; help: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={help}>
      {label}
      <Info className="h-3 w-3 shrink-0" aria-label={help} />
    </span>
  );
}

/**
 * Cuánto ocupa arriba el encabezado de la página cuando queda fijo, para que
 * los títulos de la tabla queden justo debajo. Cero si no queda fijo.
 */
function usePageHeaderHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('[data-page-header]');
    if (!header) return;
    const update = () => setHeight(getComputedStyle(header).position === 'sticky' ? header.offsetHeight : 0);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);
  return height;
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
  const headerTop = usePageHeaderHeight();
  const missing = withoutPrice > 0 ? `${withoutPrice === 1 ? 'Un competidor no tiene' : `${withoutPrice} competidores no tienen`} precio cargado.` : null;

  if (!comparison || others.length === 0) {
    return (
      <SectionCard banded title="Comparación con la competencia" description="Con los precios que se cargan en el paso Información.">
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
      banded
      title="Comparación con la competencia"
      count={others.length}
      description={`Por precio efectivo: lo que paga el comprador en total. El tuyo va con envío gratis; al de un competidor sin envío gratis se le suman ${formatPrice(params.shipping)}. La rentabilidad estimada supone que les cuesta lo mismo que a vos.`}
      // Recorta sin volverse una caja con scroll propio, así los títulos de la tabla quedan fijos al bajar.
      className="overflow-clip"
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

        {/* En la computadora, una tabla con los títulos fijos; en pantallas angostas, una tarjeta por fila. Hasta xl, la marca va debajo del vendedor. */}
        <div className="hidden lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                {(
                  [
                    ['Vendedor', ''],
                    ['Marca', 'hidden xl:table-cell'],
                    ['Lista', 'text-right'],
                    ['Cuotas', ''],
                    ['Envío', ''],
                    ['Precio efectivo', 'text-right'],
                    ['Costos totales', 'text-right'],
                    ['Rentabilidad estimada', 'text-right'],
                    ['Vos vs. ellos', 'text-right'],
                  ] as const
                ).map(([label, cls]) => (
                  <th
                    key={label}
                    style={{ top: headerTop }}
                    className={cn('sticky z-10 bg-card py-2 pr-2 align-bottom font-normal shadow-[inset_0_-1px_0_hsl(var(--border))] last:pr-0', cls)}
                  >
                    {label === 'Rentabilidad estimada' ? (
                      <HelpLabel label={label} help={ESTIMATE_HELP} />
                    ) : label === 'Costos totales' ? (
                      <HelpLabel label={label} help={COSTS_HELP} />
                    ) : (
                      label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={cn('border-b last:border-0', r.mine && cn(MINE_ROW, 'font-medium'))}>
                  <td className="max-w-36 py-2 pr-2 xl:max-w-44">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate" title={r.title ?? r.name}>
                        {r.name}
                      </span>
                      {r.url ? <OpenLinkButton url={r.url} label={`Abrir la publicación de ${r.name}`} className="h-6 w-6" /> : null}
                    </div>
                    <span className="block truncate text-[11px] font-normal text-muted-foreground xl:hidden">{r.brand ? `Marca ${r.brand}` : 'Sin marca'}</span>
                    {!r.mine ? <span className="block text-[11px] font-normal text-muted-foreground">{surveyed(r.surveyedAt, today)}</span> : null}
                  </td>
                  <td className={cn('hidden max-w-28 truncate py-2 pr-2 xl:table-cell', !r.brand && 'text-xs font-normal text-muted-foreground')} title={r.brand ?? undefined}>
                    {r.brand ?? 'Sin marca'}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-2 text-right tabular-nums">
                    {formatPrice(Math.round(r.listPrice))}
                    {r.discountPct > 0 ? <span className="block text-[11px] font-normal text-muted-foreground">{formatPercent(r.discountPct)} off</span> : null}
                  </td>
                  <td className="py-2 pr-2">
                    {cuotas(r)}
                    {r.installmentValue !== null ? (
                      <span className="block whitespace-nowrap text-[11px] font-normal tabular-nums text-muted-foreground">de {formatPrice(Math.round(r.installmentValue))}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2">{r.freeShipping ? 'Gratis' : 'Con costo'}</td>
                  <td className="whitespace-nowrap py-2 pr-2 text-right tabular-nums">{formatPrice(Math.round(r.effectivePrice))}</td>
                  <td className="py-2 pr-2 text-right">
                    <CostsCell value={r.estimate} />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <EstimateCell value={r.estimate} />
                  </td>
                  <td className="py-2 text-right">{r.mine ? <span className="text-muted-foreground">—</span> : <Diff value={r.diffPct} />}</td>
                </tr>
              ))}
            </tbody>
            {average ? (
              <tfoot>
                <tr className="border-t-2 font-medium">
                  <td className="py-2 pr-2">{averageLabel}</td>
                  <td className="hidden xl:table-cell" />
                  <td className="whitespace-nowrap py-2 pr-2 text-right tabular-nums">{formatPrice(Math.round(average.listPrice))}</td>
                  <td colSpan={2} />
                  <td className="whitespace-nowrap py-2 pr-2 text-right tabular-nums">{formatPrice(Math.round(average.effectivePrice))}</td>
                  <td className="py-2 pr-2 text-right">
                    <CostsCell value={average.estimate} />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <EstimateCell value={average.estimate} />
                  </td>
                  <td className="py-2 text-right">
                    <Diff value={average.diffPct} />
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <ul className="space-y-2 lg:hidden">
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
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
                <span>
                  <span className="text-muted-foreground">{r.mine ? 'Tu margen ' : 'Rentabilidad estimada '}</span>
                  <EstimateCell value={r.estimate} />
                </span>
                <span>
                  <span className="text-muted-foreground">Costos totales </span>
                  <CostsCell value={r.estimate} />
                </span>
              </p>
            </li>
          ))}
          {average ? (
            <li className="flex items-start justify-between gap-2 rounded-md border-2 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{averageLabel}</p>
                <p className="text-xs text-muted-foreground">Lista {formatPrice(Math.round(average.listPrice))}</p>
                <p className="text-xs">
                  <span className="text-muted-foreground">Rentabilidad estimada </span>
                  <EstimateCell value={average.estimate} />
                </p>
                <p className="text-xs">
                  <span className="text-muted-foreground">Costos totales </span>
                  <CostsCell value={average.estimate} />
                </p>
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
