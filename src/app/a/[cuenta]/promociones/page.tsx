import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { TabLinks } from '@/components/ui/tab-links';
import { AccountBar } from '@/components/promo/AccountBar';
import { EventsCard, type EventRow } from '@/components/promo/EventsCard';
import { PromoList } from '@/components/promo/PromoList';
import { RulesForm } from '@/components/promo/RulesForm';
import { dateTime, inputDay, pct } from '@/components/promo/format';
import type { EventTier } from '@/domain/promo/plan';
import { COMPETITIONS, COMPETITION_LABEL, LIFECYCLES, LIFECYCLE_LABEL, PRIORITIES, PRIORITY_LABEL, type Competition, type Lifecycle, type Priority } from '@/domain/promo/tags';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { listEvents } from '@/lib/promo/manual';
import { loadOverview, OVERVIEW_STATES, OVERVIEW_STATE_LABEL, type OverviewFilter, type OverviewState } from '@/lib/promo/overview';
import { loadPromoSettings } from '@/lib/promo/settings';

// Promociones: todos los productos de la cuenta con sus etiquetas y cómo
// están sus ofertas, con filtros y acciones en lote; el calendario de
// eventos; y las reglas, con la rentabilidad saludable y el piso.

export const dynamic = 'force-dynamic';

const PAGE = 50;
const TABS = ['productos', 'calendario', 'reglas'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { productos: 'Productos', calendario: 'Calendario', reglas: 'Reglas' };
const SELECT = 'h-9 rounded-md border border-input bg-card px-2 text-sm shadow-sm';

type Search = { tab?: string; ciclo?: string; competencia?: string; prioridad?: string; stock?: string; marca?: string; estado?: string; q?: string; pagina?: string };

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Promociones · ${account.name}` : 'Promociones' };
}

const oneOf = <T extends string>(list: readonly T[], v: string | undefined): T | undefined => (v && (list as readonly string[]).includes(v) ? (v as T) : undefined);

export default async function PromotionsPage({ params, searchParams }: { params: Promise<{ cuenta: string }>; searchParams: Promise<Search> }) {
  const [{ cuenta }, search] = await Promise.all([params, searchParams]);
  const { account } = await requireAccount(cuenta, 'promociones');
  const tab: Tab = oneOf(TABS, search.tab) ?? 'productos';
  const settings = await loadPromoSettings(prisma, account.id);
  const now = new Date();
  const page = Math.max(1, Number(search.pagina) || 1);
  const filter: OverviewFilter = {
    lifecycle: search.ciclo === 'none' ? 'none' : (oneOf(LIFECYCLES, search.ciclo) as Lifecycle | undefined),
    competition: oneOf(COMPETITIONS, search.competencia) as Competition | undefined,
    priority: oneOf(PRIORITIES, search.prioridad) as Priority | undefined,
    stockControl: search.stock === 'si' ? true : search.stock === 'no' ? false : undefined,
    brand: search.marca || undefined,
    state: oneOf(OVERVIEW_STATES, search.estado) as OverviewState | undefined,
    query: search.q?.trim() || undefined,
  };
  const overview = await loadOverview(prisma, account.id, { ...filter, limit: PAGE, offset: (page - 1) * PAGE }, now);
  const base = `/a/${account.slug}/promociones`;
  const query = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...search, ...over })) if (v) q.set(k, v);
    const text = q.toString();
    return text ? `${base}?${text}` : base;
  };
  const events: EventRow[] =
    tab === 'calendario'
      ? (await listEvents(prisma, account.id)).map((e) => ({
          id: e.id,
          name: e.name,
          tier: e.tier as EventTier,
          start: inputDay(e.start, account.timezone),
          // El último día, incluido: se guarda hasta el primer momento del día siguiente.
          finish: inputDay(new Date(e.finish.getTime() - 1), account.timezone),
          match: e.match,
          notes: e.notes,
          past: e.finish <= now,
        }))
      : [];
  // Si hay algún filtro puesto: las acciones de arriba valen solo para lo filtrado.
  const hasFilter = Object.values(filter).some((v) => v !== undefined);
  const t = overview.totals;
  const pages = Math.max(1, Math.ceil(overview.total / PAGE));

  return (
    <>
      <PageHeader>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Promociones</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            El almanaque de ofertas de <strong>{account.name}</strong>. Cada producto lleva etiquetas; con ellas, el calendario de eventos y las invitaciones del canal se arman sus franjas, y cada
            forma de cobro entra o queda afuera según la rentabilidad que deja. Saludable {pct(settings.thresholds.healthyMarginPct)}, piso {pct(settings.thresholds.floorMarginPct)}.
          </p>
        </div>
        <TabLinks label="Partes de Promociones" items={TABS.map((key) => ({ key, href: key === 'productos' ? base : `${base}?tab=${key}`, label: TAB_LABEL[key], active: tab === key }))} />
      </PageHeader>
      <PageBody>
        <div className="space-y-4">
          {tab === 'productos' ? (
            <>
              <AccountBar key={`barra:${query({})}`} filter={filter} filtered={hasFilter ? overview.total : null} accountSlug={account.slug} autoApply={settings.autoApply} sweptAt={settings.sweptAt ? dateTime(settings.sweptAt, account.timezone) : 'todavía no'} classifiedAt={settings.classifiedAt ? dateTime(settings.classifiedAt, account.timezone) : 'todavía no'} />
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ['Productos', t.products],
                  ['Con ciclo de vida', t.tagged],
                  ['Formas de cobro adentro', t.on],
                  ['Por entrar', t.planned],
                  ['Afuera', t.out],
                  ['No se pudo', t.failed],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border bg-card px-4 py-3 shadow-card">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <form action={base} className="flex flex-wrap items-end gap-2 text-sm">
                <input type="search" name="q" defaultValue={search.q ?? ''} placeholder="Producto o código MLA" className="h-9 w-56 rounded-md border border-input bg-card px-3 shadow-sm" />
                <select name="ciclo" defaultValue={search.ciclo ?? ''} className={SELECT} aria-label="Ciclo de vida">
                  <option value="">Ciclo de vida</option>
                  {LIFECYCLES.map((l) => (
                    <option key={l} value={l}>
                      {LIFECYCLE_LABEL[l]}
                    </option>
                  ))}
                  <option value="none">Sin ciclo de vida</option>
                </select>
                <select name="competencia" defaultValue={search.competencia ?? ''} className={SELECT} aria-label="Competencia">
                  <option value="">Competencia</option>
                  {COMPETITIONS.map((c) => (
                    <option key={c} value={c}>
                      {COMPETITION_LABEL[c]}
                    </option>
                  ))}
                </select>
                <select name="prioridad" defaultValue={search.prioridad ?? ''} className={SELECT} aria-label="Prioridad">
                  <option value="">Prioridad</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
                <select name="stock" defaultValue={search.stock ?? ''} className={SELECT} aria-label="Control de stock">
                  <option value="">Control de stock</option>
                  <option value="si">Con control de stock</option>
                  <option value="no">Sin control de stock</option>
                </select>
                <select name="marca" defaultValue={search.marca ?? ''} className={SELECT} aria-label="Marca">
                  <option value="">Marca</option>
                  {overview.brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <select name="estado" defaultValue={search.estado ?? ''} className={SELECT} aria-label="Estado">
                  <option value="">Estado</option>
                  {OVERVIEW_STATES.map((s) => (
                    <option key={s} value={s}>
                      {OVERVIEW_STATE_LABEL[s]}
                    </option>
                  ))}
                </select>
                <button type="submit" className="h-9 rounded-md border border-input bg-background px-3 font-medium hover:bg-accent">
                  Filtrar
                </button>
                {Object.entries(search).some(([k, v]) => v && k !== 'tab' && k !== 'pagina') ? (
                  <a href={base} className="px-2 text-muted-foreground hover:underline">
                    Sacar filtros
                  </a>
                ) : null}
              </form>
              <PromoList key={query({})} accountSlug={account.slug} timeZone={account.timezone} rows={overview.rows} total={overview.total} filter={filter} />
              {pages > 1 ? (
                <nav className="flex items-center justify-between text-sm" aria-label="Páginas">
                  {page > 1 ? <a className="hover:underline" href={query({ pagina: String(page - 1) })}>Anterior</a> : <span />}
                  <span className="text-muted-foreground">
                    Página {page} de {pages}
                  </span>
                  {page < pages ? <a className="hover:underline" href={query({ pagina: String(page + 1) })}>Siguiente</a> : <span />}
                </nav>
              ) : null}
            </>
          ) : null}
          {tab === 'calendario' ? <EventsCard accountSlug={account.slug} events={events} /> : null}
          {tab === 'reglas' ? <RulesForm accountSlug={account.slug} thresholds={settings.thresholds} rules={settings.rules} /> : null}
        </div>
      </PageBody>
    </>
  );
}
