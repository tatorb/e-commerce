import Link from 'next/link';
import { Check, ChevronRight, Search } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PickLink } from '@/components/shoot/PickLink';
import { AddMeasuresForm, NewProductForm } from '@/components/shoot/ProductForms';
import { ProtocolPicker } from '@/components/shoot/ProtocolPicker';
import { ShootSession } from '@/components/shoot/ShootSession';
import { ShotThumb, type SessionShot } from '@/components/shoot/ShotViewer';
import { can } from '@/domain/access';
import { shotsPerStep } from '@/domain/shoot';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { formatDateTime, plural } from '@/lib/format';
import { searchShootProducts, shootPipelineState, shootPlan, type ShootPick, type ShootPlan } from '@/lib/shoot';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Registro de productos · ${account.name}` : 'Registro de productos' };
}

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

// Lo que se elige antes de empezar, en orden: el producto, la medida y el protocolo.
const ALL = 'todas';
const NONE = 'ninguno';

export default async function ShootPage({ params, searchParams }: { params: Promise<{ cuenta: string }>; searchParams: Search }) {
  const { cuenta } = await params;
  const sp = await searchParams;
  const { user, account } = await requireAccount(cuenta, 'captura');
  const base = `/a/${account.slug}/registro-productos`;
  const productId = one(sp.producto);
  const plan = productId ? await shootPlan(prisma, account.id, productId) : null;
  // Lo ya registrado como lo muestra el celular, con la hora de la cuenta.
  const shots: SessionShot[] = (plan?.shots ?? []).map((s) => ({
    id: s.id,
    kind: s.kind,
    stepId: s.stepId,
    variantKey: s.variantKey,
    variantLabel: s.variantLabel,
    thumb: s.thumb,
    src: s.src,
    by: s.by,
    when: formatDateTime(new Date(s.at), account.timezone),
  }));

  const header = (
    <PageHeader>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Registro de productos</h1>
        <p className="text-sm text-muted-foreground">
          Sacá las fotos y los videos de cada producto con el celular. Se suben tal como salen de la cámara y van a los pasos Imágenes y Videos.
          {can(user.access, 'protocolos', 'read') ? (
            <>
              {' '}
              Los pasos se arman en{' '}
              <Link href={`/a/${account.slug}/protocolos`} className="font-medium text-foreground underline-offset-4 hover:underline">
                Protocolos de fotos
              </Link>
              .
            </>
          ) : null}
        </p>
      </div>
    </PageHeader>
  );

  if (!plan) {
    const q = one(sp.q);
    const products = await searchShootProducts(prisma, account.id, q);
    return (
      <>
        {header}
        <PageBody>
          <div className="mx-auto w-full max-w-xl space-y-4">
            <BeforeStarting />
            {productId ? <p className="text-sm text-destructive">Ese producto no está en la cuenta. Buscalo de nuevo.</p> : null}
            <section className="space-y-3 rounded-2xl border bg-card shadow-card p-4">
              <h2 className="text-base font-semibold">1. Elegí el producto</h2>
              <form action={base} className="flex gap-2">
                <Input name="q" defaultValue={q} placeholder="Código, nombre o SKU. Por ejemplo SP-914" autoComplete="off" className="h-11 text-base" />
                <Button type="submit" size="lg" className="h-11 px-4" access="view">
                  <Search />
                  Buscar
                </Button>
              </form>
              {q.trim().length > 0 && q.trim().length < 2 ? <p className="text-sm text-muted-foreground">Escribí al menos 2 letras o números.</p> : null}
              {q.trim().length >= 2 && products.length === 0 ? <p className="text-sm text-muted-foreground">No encontramos productos con «{q.trim()}».</p> : null}
              {q.trim().length < 2 && products.length > 0 ? <p className="text-xs font-medium text-muted-foreground">Los últimos registrados</p> : null}
              <ProductList products={products} base={base} />
              {/* Si no está, se crea acá con lo básico, con lo buscado ya cargado. */}
              <NewProductForm key={q} accountSlug={account.slug} base={base} search={q.trim()} startOpen={q.trim().length >= 2 && products.length === 0} />
            </section>
          </div>
        </PageBody>
      </>
    );
  }

  // La medida se elige siempre, aunque el producto tenga una sola o ninguna. Todas: con varias, lo que
  // sirve para todas; sin medidas cargadas, sin medida.
  const measures = plan.measures;
  const medida = one(sp.medida);
  const measure = measures.find((m) => m.key === medida) ?? null;
  const measureChosen = medida === ALL || measure !== null;
  const measureText = measures.length === 0 ? null : measure ? `${measure.named ? 'Medida' : 'SKU'} ${measure.label}` : 'Todas las medidas';
  const protocolo = one(sp.protocolo);
  const protocol = plan.protocols.find((p) => p.id === protocolo) ?? null;
  const protocolChosen = protocolo === NONE || protocol !== null;
  const withProduct = `${base}?producto=${plan.product.id}`;
  const withMeasure = `${withProduct}&medida=${encodeURIComponent(measure?.key ?? ALL)}`;
  // El producto en el pipeline: para el interruptor al elegir el protocolo y la marca durante el registro.
  const inPipeline = measureChosen ? await shootPipelineState(prisma, account.id, plan.product.id) : null;
  const pipelineHref = inPipeline?.openId && can(user.access, 'pipeline', 'read') ? `/a/${account.slug}/pipeline/${inPipeline.openId}` : null;

  if (!measureChosen || !protocolChosen) {
    const done = (key: string | null) => (p: ShootPlan['protocols'][number]) => {
      const counts = shotsPerStep(plan.shots, key);
      return p.steps.filter((s) => counts[s.id]).length;
    };
    // Las tiendas, solo si hay que crear la publicación y hay más de una para elegir.
    const stores =
      inPipeline?.state === 'none'
        ? await prisma.store.findMany({ where: { accountId: account.id }, orderBy: { name: 'asc' }, select: { id: true, name: true, channel: { select: { name: true } } } })
        : [];
    return (
      <>
        {header}
        <PageBody>
          <div className="mx-auto w-full max-w-xl space-y-4">
            <ProductStrip product={plan.product} base={base} />
            {!measureChosen ? (
              <section className="space-y-3 rounded-2xl border bg-card shadow-card p-4">
                <h2 className="text-base font-semibold">2. Elegí la medida</h2>
                <p className="text-sm text-muted-foreground">
                  {measures.length >= 2
                    ? 'Lo que saques queda marcado para esa medida en las publicaciones. Si sirve para todas, elegí Todas las medidas.'
                    : measures.length === 1
                      ? 'Lo que saques queda marcado para esa medida. Si el producto tiene otra, agregala abajo.'
                      : 'Este producto todavía no tiene medidas cargadas. Podés seguir sin medida o agregar las que tenga.'}
                </p>
                <ul className={measures.length >= 2 ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-2'}>
                  {measures.map((m) => (
                    <li key={m.key}>
                      <PickLink
                        href={`${withProduct}&medida=${encodeURIComponent(m.key)}`}
                        title={m.named ? m.label : `SKU ${m.label}`}
                        description={m.named ? null : 'Sin nombre de medida'}
                        note={countText(plan.shots.filter((s) => s.variantKey === m.key))}
                      />
                    </li>
                  ))}
                  {measures.length !== 1 ? (
                    <li className="sm:col-span-2">
                      <PickLink
                        href={`${withProduct}&medida=${ALL}`}
                        title={measures.length === 0 ? 'Sin medida' : 'Todas las medidas'}
                        note={countText(plan.shots.filter((s) => s.variantKey === null))}
                      />
                    </li>
                  ) : null}
                </ul>
                <AddMeasuresForm
                  accountSlug={account.slug}
                  productId={plan.product.id}
                  label="Agregar una medida"
                  hint={measures.length === 0 ? 'Si ya vendía una medida, cargala también, por ejemplo STD.' : undefined}
                />
              </section>
            ) : (
              <section className="space-y-3 rounded-2xl border bg-card shadow-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">3. Elegí el protocolo</h2>
                  <span className="inline-flex items-center gap-2 text-sm">
                    <Badge variant="secondary">{measureText ?? 'Sin medida'}</Badge>
                    <Link href={withProduct} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
                      Cambiar
                    </Link>
                  </span>
                </div>
                {plan.protocols.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay protocolos armados. Podés seguir sin protocolo.</p> : null}
                <ProtocolPicker
                  accountSlug={account.slug}
                  productId={plan.product.id}
                  pipeline={{
                    state: inPipeline?.state ?? 'none',
                    href: pipelineHref,
                    stores: stores.length > 1 ? stores.map((st) => ({ id: st.id, label: `${st.name} · ${st.channel.name}` })) : [],
                    byMeasure: measures.length >= 2,
                  }}
                  options={[
                    ...plan.protocols.map((p) => ({
                      key: p.id,
                      href: `${withMeasure}&protocolo=${p.id}`,
                      title: p.name,
                      description: p.description,
                      note: `${plural(p.steps.length, 'paso')}${done(measure?.key ?? null)(p) > 0 ? `, ${done(measure?.key ?? null)(p)} ya hechos` : ''}`,
                      withProtocol: true,
                    })),
                    { key: NONE, href: `${withMeasure}&protocolo=${NONE}`, title: 'Sin protocolo', description: 'Sacá las fotos y los videos que quieras, uno tras otro.', withProtocol: false },
                  ]}
                />
              </section>
            )}
            <ShotHistory plan={plan} shots={shots} />
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      {header}
      <PageBody>
        <div className="space-y-4">
          <ShootSession
            accountSlug={account.slug}
            base={base}
            product={plan.product}
            measure={measure}
            measureText={measureText}
            protocol={protocol}
            shots={shots}
            pipeline={inPipeline?.openId ? { href: pipelineHref } : null}
          />
          <div className="mx-auto w-full max-w-xl space-y-4">
            <BeforeStarting collapsed />
            <ShotHistory plan={plan} shots={shots} />
          </div>
        </div>
      </PageBody>
    </>
  );
}

function countText(list: { kind: string }[]): string | undefined {
  if (list.length === 0) return undefined;
  const count = (kind: string) => list.filter((s) => s.kind === kind).length;
  const parts = [
    count('PHOTO') ? plural(count('PHOTO'), 'foto') : '',
    count('VIDEO') ? plural(count('VIDEO'), 'video') : '',
    count('CHECK') ? plural(count('CHECK'), 'paso hecho', 'pasos hechos') : '',
  ].filter(Boolean);
  return `Ya tiene ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : parts[0]}`;
}

function ProductList({ products, base }: { products: ShootPick[]; base: string }) {
  if (products.length === 0) return null;
  return (
    <ul className="divide-y rounded-lg border">
      {products.map((p) => (
        <li key={p.id}>
          <Link href={`${base}?producto=${p.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted">
            {p.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumb} alt="" className="h-12 w-12 shrink-0 rounded border bg-white object-contain" />
            ) : (
              <div className="h-12 w-12 shrink-0 rounded border bg-muted" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {p.code ? <Badge variant="outline">{p.code}</Badge> : null}
                {p.measures >= 2 ? plural(p.measures, 'medida') : 'Sin medidas'}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ProductStrip({ product, base }: { product: ShootPick; base: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card shadow-card p-3">
      {product.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.thumb} alt="" className="h-12 w-12 shrink-0 rounded border bg-white object-contain" />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded border bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{product.name}</p>
        {product.code ? <Badge variant="outline" className="mt-0.5">{product.code}</Badge> : null}
      </div>
      <Link href={base} className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline">
        Otro producto
      </Link>
    </div>
  );
}

/** Cómo poner la cámara del celular en la mayor calidad. */
function BeforeStarting({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <details open={!collapsed} className="rounded-2xl border bg-card shadow-card">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Antes de empezar: la cámara en la mayor calidad</summary>
      <div className="space-y-2 border-t px-4 py-3 text-sm">
        <p>La app sube cada foto y cada video tal como sale de la cámara, sin achicarlo. La calidad la pone el celular.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>iPhone:</strong> Ajustes, Cámara, Grabar video, y elegí 4K a 30 cps. En Formatos, Más compatible guarda las fotos en JPG.
          </li>
          <li>
            <strong>Android:</strong> en la cámara, tocá el engranaje y elegí la resolución más alta para fotos y 4K o UHD para videos.
          </li>
          <li>Con wifi sube mucho más rápido. Un video 4K de un minuto pesa unos 400 MB.</li>
        </ul>
        <p className="text-muted-foreground">Si algo sale por debajo de HD, la app no lo deja subir y te avisa.</p>
      </div>
    </details>
  );
}

function ShotHistory({ plan, shots }: { plan: ShootPlan; shots: SessionShot[] }) {
  if (shots.length === 0) return null;
  const titles = new Map(plan.protocols.flatMap((p) => p.steps.map((s) => [s.id, s.title] as const)));
  return (
    <details className="rounded-2xl border bg-card shadow-card">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Lo que ya se registró de este producto ({shots.length})</summary>
      <ul className="divide-y border-t">
        {shots.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
            <ShotThumb shot={s} className="h-11 w-11" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{s.stepId ? (titles.get(s.stepId) ?? 'Paso que ya no está') : 'Sin protocolo'}</span>
              <span className="block text-xs text-muted-foreground">
                {s.kind === 'CHECK' ? 'Hecho · ' : ''}
                {s.variantLabel ? `Medida ${s.variantLabel}` : 'Todas las medidas'} · {s.when}
                {s.by ? ` · ${s.by}` : ''}
              </span>
            </span>
            <Check className="h-4 w-4 shrink-0 text-primary" />
          </li>
        ))}
      </ul>
    </details>
  );
}
