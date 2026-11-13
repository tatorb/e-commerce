import Link from 'next/link';
import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card } from '@/components/ui/card';
import { FilterSelect } from '@/components/performance/FilterSelect';
import { ReadVisitsButton } from '@/components/performance/ReadVisitsButton';
import { CHANNEL_STATUS_LABEL } from '@/domain/channel-status';
import { correctionText, countChange, lightHelp, LIGHT_LABEL, LIGHT_ORDER, PERIODS, pointsChange, TREND_WEEKS, type Change, type Light } from '@/domain/performance';
import { titleOrUntitled } from '@/domain/publication-title';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { plural } from '@/lib/format';
import { ALL, loadPerformance, parsePerformanceSearch, type PerformanceSearch, type Sort } from '@/lib/queries/performance';
import { cn } from '@/lib/utils/cn';

// Rendimiento de publicaciones: si las correcciones funcionan. Por
// publicación, las visitas y las ventas del período, la conversión, un
// semáforo y la última corrección.

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Rendimiento de publicaciones · ${account.name}` : 'Rendimiento de publicaciones' };
}

const LIGHT_CLASS: Record<Light, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-400',
  green: 'bg-emerald-500',
  gray: 'bg-gray-400',
};

const num = (n: number) => n.toLocaleString('es-AR');
const pct = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`);

/** "03/11/2026 14:05", en la zona de la cuenta. */
function fullDateTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(d)
    .replace(',', '');
}

function shortDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone, day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);
}

/** El encabezado de una columna: tocarlo ordena por ella, y otra vez da vuelta el orden. */
function Header({ href, active, dir, children, className }: { href: string; active: boolean; dir: 'asc' | 'desc'; children: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn('px-3 py-2 font-medium', className)} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <Link href={href} className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')}>
        {children}
        {active ? dir === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden /> : null}
      </Link>
    </th>
  );
}

/** Debajo de un número: cómo cambió contra el período anterior, con flecha verde o roja. */
function Delta({ change, previous }: { change: Change | null; previous: string }) {
  if (!change) return <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground" title="No hay datos del período anterior para comparar.">sin dato</p>;
  const up = change.dir === 'up';
  const down = change.dir === 'down';
  return (
    <p
      className={cn('mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium leading-tight', up && 'text-emerald-600 dark:text-emerald-400', down && 'text-red-600 dark:text-red-400', !up && !down && 'text-muted-foreground')}
      title={`Período anterior: ${previous}`}
    >
      {up ? <ArrowUp className="h-3 w-3" aria-label="subió" /> : down ? <ArrowDown className="h-3 w-3" aria-label="bajó" /> : null}
      {change.text}
    </p>
  );
}

/** Las visitas de las últimas semanas, en una línea chica. */
function Sparkline({ weeks }: { weeks: { from: string; visits: number | null }[] | null }) {
  const known = (weeks ?? []).filter((w) => w.visits !== null);
  if (!weeks || known.length < 2) return <span className="text-xs text-muted-foreground">Sin datos</span>;
  const W = 96;
  const H = 28;
  const pad = 3;
  const max = Math.max(...known.map((w) => w.visits ?? 0), 1);
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (weeks.length - 1);
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const points = weeks.flatMap((w, i) => (w.visits === null ? [] : [[x(i), y(w.visits)] as const]));
  const last = points[points.length - 1];
  // El color: las últimas 4 semanas contra las 4 anteriores, la tendencia y no una semana suelta.
  const half = Math.floor(weeks.length / 2);
  const sum = (list: typeof weeks) => list.reduce((t, w) => t + (w.visits ?? 0), 0);
  const before = sum(weeks.slice(0, half));
  const after = sum(weeks.slice(half));
  const tone = after > before ? 'text-emerald-600 dark:text-emerald-400' : after < before ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground';
  const day = (iso: string) => new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(new Date(`${iso}T00:00:00Z`));
  const label = weeks.map((w) => `Semana del ${day(w.from)}: ${w.visits === null ? 'sin dato' : `${num(w.visits)} visitas`}`).join('\n');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={cn('overflow-visible', tone)} role="img" aria-label={`Visitas de las últimas ${TREND_WEEKS} semanas. ${label}`}>
      <title>{label}</title>
      <polyline points={points.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.25} fill="currentColor" />
    </svg>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-card px-4 py-3">
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default async function PerformancePage({ params, searchParams }: { params: Promise<{ cuenta: string }>; searchParams: Promise<PerformanceSearch> }) {
  const [{ cuenta }, search] = await Promise.all([params, searchParams]);
  const { account } = await requireAccount(cuenta, 'publicaciones');
  const tz = account.timezone;
  const f = parsePerformanceSearch(search);
  const data = await loadPerformance(prisma, account.id, f);

  // Los filtros como están, para armar los links de orden.
  const keep: Record<string, string> = {
    periodo: String(f.period),
    marca: f.brand,
    tipo: f.type,
    estado: f.status,
    luz: f.light,
    correccion: f.correction,
  };
  const sortHref = (sort: Sort) => {
    const dir = f.sort === sort ? (f.dir === 'desc' ? 'asc' : 'desc') : sort === 'publicacion' ? 'asc' : 'desc';
    return `?${new URLSearchParams({ ...keep, orden: sort, dir }).toString()}`;
  };
  const head = (sort: Sort) => ({ href: sortHref(sort), active: f.sort === sort, dir: f.dir });

  return (
    <>
      <PageHeader className="md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Rendimiento de publicaciones</h1>
          <p className="text-sm text-muted-foreground">
            {data.updatedAt ? `Datos actualizados al ${fullDateTime(data.updatedAt, tz)}` : 'Todavía no se leyeron las visitas ni las ventas.'}
          </p>
        </div>
        <ReadVisitsButton accountSlug={cuenta} />
      </PageHeader>
      <PageBody>
        <Card className="p-4">
          <form className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" action="" method="get">
            <FilterSelect name="periodo" label="Período" value={String(f.period)} options={PERIODS.map((p) => ({ value: String(p), label: `Últimos ${p} días` }))} />
            <FilterSelect name="marca" label="Marca" value={f.brand} options={[{ value: ALL, label: 'Todas' }, ...data.options.brands.map((b) => ({ value: b, label: b }))]} />
            <FilterSelect name="tipo" label="Tipo de producto" value={f.type} options={[{ value: ALL, label: 'Todos' }, ...data.options.types.map((t) => ({ value: t, label: t }))]} />
            <FilterSelect
              name="estado"
              label="Estado"
              value={f.status}
              options={[
                { value: 'activas', label: 'Solo activas' },
                { value: 'todas', label: 'Todas' },
              ]}
            />
            <FilterSelect name="luz" label="Semáforo" value={f.light} options={[{ value: 'todas', label: 'Todos' }, ...LIGHT_ORDER.map((l) => ({ value: l, label: LIGHT_LABEL[l] }))]} />
            <FilterSelect
              name="correccion"
              label="Última corrección"
              value={f.correction}
              options={[
                { value: 'todas', label: 'Todas' },
                { value: '30d', label: 'En los últimos 30 días' },
                { value: 'sin', label: 'Sin corrección' },
              ]}
            />
            <input type="hidden" name="orden" value={f.sort} />
            <input type="hidden" name="dir" value={f.dir} />
            <noscript>
              <button type="submit" className="h-9 rounded-md border px-3 text-sm">
                Aplicar
              </button>
            </noscript>
          </form>
        </Card>

        <Card className="overflow-hidden">
          {/* Las líneas entre las cifras son el fondo que asoma entre ellas. */}
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            <Figure label={data.totals.count === 1 ? 'publicación' : 'publicaciones'} value={num(data.totals.count)} />
            <Figure label={`visitas en ${f.period} días`} value={num(data.totals.visits)} />
            <Figure label={`unidades vendidas en ${f.period} días`} value={num(data.totals.sales)} />
            <Figure label="conversión del grupo" value={pct(data.totals.conversion)} />
          </div>
        </Card>

        {data.withoutVisits > 0 ? (
          <p className="text-xs text-muted-foreground">
            {plural(data.withoutVisits, 'publicación todavía no tiene', 'publicaciones todavía no tienen')} las visitas por día leídas. Se leen solas una vez por día, o ahora con el botón de actualizar de arriba.
          </p>
        ) : null}

        <Card className="overflow-x-auto">
          {data.rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No hay publicaciones con estos filtros.</p>
          ) : (
            <table className="w-full min-w-[960px] table-fixed text-sm">
              {/* Publicación, ancha; las demás, del mismo ancho. */}
              <colgroup>
                <col className="w-12" />
                <col />
                {Array.from({ length: 5 }, (_, i) => (
                  <col key={i} className="w-[12%]" />
                ))}
              </colgroup>
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <Header {...head('luz')} className="w-12">
                    <span className="sr-only">Semáforo</span>●
                  </Header>
                  <Header {...head('publicacion')}>Publicación</Header>
                  <Header {...head('visitas')} className="text-right">
                    Visitas
                  </Header>
                  <Header {...head('ventas')} className="text-right">
                    Ventas
                  </Header>
                  <Header {...head('conversion')} className="text-right">
                    Conversión
                  </Header>
                  <Header {...head('correccion')}>Última corrección</Header>
                  <th scope="col" className="px-3 py-2 font-medium" title={`Las visitas de cada semana, las últimas ${TREND_WEEKS} hasta ayer, sea cual sea el período elegido. Verde si las últimas 4 semanas suman más que las 4 anteriores; rojo si suman menos.`}>
                    Visitas, {TREND_WEEKS} semanas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2.5">
                      <span
                        className={cn('mt-1 inline-block h-3.5 w-3.5 rounded-full', LIGHT_CLASS[r.light])}
                        title={`${LIGHT_LABEL[r.light]}: ${lightHelp(r.light)}${r.visits === null ? ' Todavía sin las visitas del período.' : ''}`}
                      >
                        <span className="sr-only">
                          {LIGHT_LABEL[r.light]}: {lightHelp(r.light)}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/a/${account.slug}/publicaciones/${r.id}`} className="font-medium leading-snug underline-offset-4 hover:underline" title="Ver la publicación en la app">
                        {titleOrUntitled(r.title)}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline-offset-4 hover:underline" title="Ver la publicación en el canal">
                            {r.externalId}
                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                          </a>
                        ) : (
                          <span>{r.externalId}</span>
                        )}
                        <span aria-hidden>·</span>
                        <Link href={`/a/${account.slug}/productos/${r.productId}`} className="underline-offset-4 hover:underline" title="Ver el producto en la app">
                          {r.sku ?? 'Producto'}
                        </Link>
                        {r.channelStatus !== 'ACTIVE' ? <span className="font-medium text-amber-700">· {CHANNEL_STATUS_LABEL[r.channelStatus]}</span> : null}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <p>{r.visits === null ? '—' : num(r.visits)}</p>
                      <Delta change={countChange(r.visits, r.previous.visits)} previous={r.previous.visits === null ? 'sin dato' : `${num(r.previous.visits)} visitas`} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <p>{num(r.sales)}</p>
                      <Delta change={countChange(r.sales, r.previous.sales)} previous={`${num(r.previous.sales)} ${r.previous.sales === 1 ? 'venta' : 'ventas'}`} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <p>{pct(r.conversion)}</p>
                      <Delta change={pointsChange(r.conversion, r.previous.conversion)} previous={pct(r.previous.conversion)} />
                    </td>
                    <td className="px-3 py-2.5">
                      {r.lastCorrection ? (
                        <>
                          <p className="tabular-nums">{shortDate(r.lastCorrection.at, tz)}</p>
                          <p className="text-xs text-muted-foreground">{correctionText(r.lastCorrection.fields)}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Sin corrección</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Sparkline weeks={r.weeks} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </PageBody>
    </>
  );
}
