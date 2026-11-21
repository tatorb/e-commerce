import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Badge } from '@/components/ui/badge';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { InsurApproveCard, InsurDoubtfulList, InsurExtensionCard, InsurSettingsForm } from '@/components/insur/InsurControls';
import { can } from '@/domain/access';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { formatDateTime, plural } from '@/lib/format';
import { INSUR_SLUG, loadInsurScreen, type InsurRunView } from '@/lib/insur';
import { toZonedInput } from '@/lib/zoned-input';

// Sistema de Insur: la última corrida de la extensión que lee el stock, el
// costo y la ficha de cada artículo de Insur, los cruces dudosos para
// confirmar, lo que no tiene producto en la app, lo que no apareció y la fecha
// de corte. Acá no se muestra ningún precio: de los costos, solo si cambian.

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Sistema de Insur · ${account.name}` : 'Sistema de Insur' };
}

const SHOWN = 200;

export default async function InsurSystemPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { user, account } = await requireAccount(cuenta, 'productos');
  if (account.slug !== INSUR_SLUG) notFound();
  const screen = await loadInsurScreen(prisma, account.id);
  const canEdit = can(user.access, 'productos', 'write');
  const testMode = screen.settings.approvedAt === null;
  const done = screen.last?.status === 'DONE' ? screen.last : screen.lastDone;
  const when = (d: Date) => formatDateTime(d, account.timezone);

  return (
    <>
      <PageHeader>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Sistema de Insur</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            El sistema de Insur es la fuente del stock y del costo de <strong>{account.name}</strong>. Una extensión de Chrome lo lee una vez por día y la app corrige
            cada medida cruzada: el stock es Córdoba más Santa Fe en Insur, menos las ventas de Mercado Libre desde la fecha de corte, y el costo de reposición sin
            IVA es el costo de Insur.
          </p>
        </div>
      </PageHeader>
      <PageBody>
        <InsurExtensionCard canRun={canEdit} />
        {testMode ? (
          <InsurApproveCard accountSlug={account.slug} hasRun={Boolean(done)} changes={done ? { stock: done.stockChanges, cost: done.costChanges } : null} />
        ) : null}

        <SectionCard
          title="Fecha de corte"
          description="Insur no registra las ventas de Mercado Libre: la app las resta desde esta fecha. Si Insur hace un conteo de inventario, la fecha se mueve al día del conteo."
        >
          <SectionBody>
            <InsurSettingsForm
              accountSlug={account.slug}
              cutoff={toZonedInput(screen.settings.cutoffAt, account.timezone)}
              fichaEveryDays={screen.settings.fichaEveryDays}
              canEdit={canEdit}
            />
            <p className="text-sm">
              Hoy se están restando <strong>{plural(screen.sales.sales, 'venta', 'ventas')}</strong> de Mercado Libre, {plural(screen.sales.units, 'unidad', 'unidades')} en
              total, desde el {when(screen.settings.cutoffAt)}. Las canceladas y las devueltas no se restan.
            </p>
          </SectionBody>
        </SectionCard>

        <SectionCard title="Última corrida" description={testMode ? 'En modo prueba: las corridas no cambian nada.' : undefined}>
          <SectionBody>
            {screen.last ? <RunFacts run={screen.last} when={when} /> : <p className="text-sm text-muted-foreground">Todavía no hubo ninguna corrida.</p>}
            {screen.lastDone ? (
              <>
                <p className="text-sm font-medium">La última que terminó</p>
                <RunFacts run={screen.lastDone} when={when} />
              </>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Cruces: {screen.links.auto} automáticos, {screen.links.confirmed} confirmados a mano, {screen.links.pending} esperando su ficha de Insur para confirmarse,{' '}
              {screen.links.doubtful} dudosos y {screen.links.ignored} ignorados.
            </p>
          </SectionBody>
        </SectionCard>

        <SectionCard
          title="Dudosos"
          count={screen.doubtful.total}
          description="Coincide el número de pieza, pero no se puede asegurar a qué medida va. No se tocan hasta que alguien elige la medida o lo ignora."
        >
          <SectionBody>
            <InsurDoubtfulList accountSlug={account.slug} links={screen.doubtful.links} total={screen.doubtful.total} canEdit={canEdit} />
          </SectionBody>
        </SectionCard>

        {done ? <RunLists run={done} accountSlug={account.slug} /> : null}
      </PageBody>
    </>
  );
}

const STATUS = { DONE: 'Terminada', FAILED: 'Cortada', OPEN: 'En curso' } as const;

/** Los números de una corrida. */
function RunFacts({ run, when }: { run: InsurRunView; when: (d: Date) => string }) {
  const s = run.summary;
  const facts: [string, string][] = [
    ['Fecha', when(run.startedAt)],
    ['Origen', run.origin === 'diaria' ? 'La corrida diaria' : 'El botón'],
    ['Duración', run.durationMs === null ? 'Sin dato' : `${Math.max(1, Math.round(run.durationMs / 60_000))} min`],
    ['Artículos leídos en Insur', run.read.toLocaleString('es-AR')],
    ['Cruzados', String(run.linked)],
    [run.preview ? 'Cambios de stock que haría' : 'Cambios de stock', `${run.stockChanges}${s.jumps > 0 ? `, ${s.jumps} de más de 50 unidades` : ''}`],
    [run.preview ? 'Cambios de costo que haría' : 'Cambios de costo', `${run.costChanges}${s.bigCosts > 0 ? `, ${s.bigCosts} de más de 30 %` : ''}`],
    ['Costos sospechosos', String(run.suspicious)],
    ['No aparecieron en Insur', String(s.missing.length)],
    ['Errores', String(run.errors.length)],
  ];
  if (s.pendingFichas) facts.push(['Fichas para la próxima corrida', String(s.pendingFichas)]);
  if (s.sync) facts.push(['Cantidades subidas a Mercado Libre', `${s.sync.sent}${s.sync.failed > 0 ? `, ${s.sync.failed} no se pudieron` : ''}${s.sync.pending ? ', el resto lo termina la pasada de cada hora' : ''}`]);
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={run.status === 'FAILED' ? 'destructive' : 'secondary'}>{STATUS[run.status as keyof typeof STATUS] ?? run.status}</Badge>
        {run.preview && run.status === 'DONE' ? <Badge variant="outline">Solo mostró: no cambió nada</Badge> : null}
      </p>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b py-1">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {run.errors.length > 0 ? (
        <ul className="list-inside list-disc text-sm text-destructive">
          {run.errors.slice(0, 20).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const more = (shown: number, total: number) => (total > shown ? <p className="text-xs text-muted-foreground">Se muestran {shown} de {total}. Claude las ve todas con get_insur_sync.</p> : null);
const cell = 'px-2 py-1.5 align-top';

/** Las listas de la última corrida que terminó. */
function RunLists({ run, accountSlug }: { run: InsurRunView; accountSlug: string }) {
  const s = run.summary;
  const flagged = s.changes.filter((c) => c.jump || c.cost === 'big');
  return (
    <>
      <SectionCard title="Cambios para mirar" count={flagged.length} description="Se aplican igual: stock que cambió más de 50 unidades en una medida, o costo que cambió más de 30 %." collapsible defaultOpen={flagged.length > 0}>
        <SectionBody>
          <Changes rows={flagged.slice(0, SHOWN)} accountSlug={accountSlug} />
          {more(Math.min(flagged.length, SHOWN), flagged.length)}
        </SectionBody>
      </SectionCard>
      <SectionCard title={run.preview ? 'Lo que cambiaría' : 'Lo que cambió'} count={s.changesTotal} collapsible>
        <SectionBody>
          <Changes rows={s.changes.slice(0, SHOWN)} accountSlug={accountSlug} />
          {more(Math.min(s.changes.length, SHOWN), s.changesTotal)}
        </SectionBody>
      </SectionCard>
      <SectionCard title="Costos sospechosos" count={s.suspicious.length} description="No se aplicaron: el costo de Insur está vacío, en 0, o es mayor que su precio del proveedor." collapsible>
        <SectionBody>
          <Listed rows={s.suspicious.slice(0, SHOWN)} empty="Ningún costo sospechoso." />
          {more(Math.min(s.suspicious.length, SHOWN), s.suspicious.length)}
        </SectionBody>
      </SectionCard>
      <SectionCard title="No apareció en Insur" count={s.missing.length} description="Medidas con cruce que no vinieron en la lectura. No se tocaron y el cruce pasó a dudoso." collapsible>
        <SectionBody>
          <Listed rows={s.missing.slice(0, SHOWN)} empty="Todo lo cruzado apareció en la lectura." />
        </SectionBody>
      </SectionCard>
      {s.skipped.length > 0 ? (
        <SectionCard title="No se cargaron" count={s.skipped.length} collapsible>
          <SectionBody>
            <Listed rows={s.skipped.slice(0, SHOWN)} empty="" />
          </SectionBody>
        </SectionCard>
      ) : null}
      <SectionCard
        title="Sin producto en la app"
        count={s.unmatchedTotal}
        description="Artículos de Insur con stock en Córdoba o Santa Fe, de marcas que la app ya tiene, sin un producto en la app. Solo para saberlo: no se crea nada."
        collapsible
      >
        <SectionBody>
          {s.unmatched.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className={cell}>Código</th>
                    <th className={cell}>Detalle</th>
                    <th className={cell}>Marca</th>
                    <th className={cell}>Rubro</th>
                    <th className={`${cell} text-right`}>Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {s.unmatched.slice(0, SHOWN).map((u) => (
                    <tr key={u.code}>
                      <td className={`${cell} whitespace-nowrap font-medium`}>{u.code}</td>
                      <td className={cell}>{u.detail}</td>
                      <td className={cell}>{u.brand}</td>
                      <td className={cell}>{u.category}</td>
                      <td className={`${cell} text-right tabular-nums`}>{u.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {more(Math.min(s.unmatched.length, SHOWN), s.unmatchedTotal)}
        </SectionBody>
      </SectionCard>
    </>
  );
}

function Changes({ rows, accountSlug }: { rows: InsurRunView['summary']['changes']; accountSlug: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nada.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className={cell}>Código de Insur</th>
            <th className={cell}>Producto</th>
            <th className={cell}>Medida</th>
            <th className={cell}>Stock</th>
            <th className={cell}>Costo</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((c) => (
            <tr key={c.code}>
              <td className={`${cell} whitespace-nowrap font-medium`}>{c.code}</td>
              <td className={cell}>
                <Link href={`/a/${accountSlug}/productos/${c.productId}?seccion=stock`} className="underline-offset-4 hover:underline">
                  {c.product}
                </Link>
              </td>
              <td className={cell}>{c.measure ?? ''}</td>
              <td className={`${cell} tabular-nums`}>
                {c.stockChanged ? (
                  <>
                    {c.before ?? 'sin stock en la app'} → {c.after}
                    {c.branches ? <span className="block text-xs text-muted-foreground">{c.branches}</span> : null}
                    {c.jump ? <span className="block text-xs font-medium text-amber-700 dark:text-amber-400">Más de 50 unidades</span> : null}
                  </>
                ) : (
                  'Igual'
                )}
              </td>
              <td className={cell}>{c.cost === 'big' ? <span className="font-medium text-amber-700 dark:text-amber-400">Cambia más de 30 %</span> : c.cost === 'changed' ? 'Cambia' : c.cost === 'same' ? 'Igual' : 'No se aplica'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Listed({ rows, empty }: { rows: { code: string; product: string | null; measure: string | null; reason: string }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y rounded-md border text-sm">
      {rows.map((r) => (
        <li key={`${r.code}|${r.reason}`} className="px-3 py-2">
          <span className="font-medium">{r.code}</span>
          {r.product ? <span className="text-muted-foreground"> · {r.product}{r.measure ? `, ${r.measure}` : ''}</span> : null}
          <span className="block text-muted-foreground">{r.reason}</span>
        </li>
      ))}
    </ul>
  );
}
