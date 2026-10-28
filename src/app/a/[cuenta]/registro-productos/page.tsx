import Link from 'next/link';
import { Camera, Check, ChevronRight, ClipboardList, Search, Video } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShootSession } from '@/components/shoot/ShootSession';
import { can } from '@/domain/access';
import { shotsPerStep } from '@/domain/shoot';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { formatDateTime, plural } from '@/lib/format';
import { searchShootProducts, shootPlan, type ShootPick, type ShootPlan } from '@/lib/shoot';

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
            </section>
          </div>
        </PageBody>
      </>
    );
  }

  const needsMeasure = plan.measures.length >= 2;
  const medida = one(sp.medida);
  const measure = needsMeasure ? (plan.measures.find((m) => m.key === medida) ?? null) : null;
  const measureChosen = !needsMeasure || medida === ALL || measure !== null;
  const measureText = needsMeasure ? (measure ? `Medida ${measure.label}` : 'Todas las medidas') : null;
  const protocolo = one(sp.protocolo);
  const protocol = plan.protocols.find((p) => p.id === protocolo) ?? null;
  const protocolChosen = protocolo === NONE || protocol !== null;
  const withProduct = `${base}?producto=${plan.product.id}`;
  const withMeasure = `${withProduct}${needsMeasure ? `&medida=${encodeURIComponent(measure?.key ?? ALL)}` : ''}`;

  if (!measureChosen || !protocolChosen) {
    const done = (key: string | null) => (p: ShootPlan['protocols'][number]) => {
      const counts = shotsPerStep(plan.shots, key);
      return p.steps.filter((s) => counts[s.id]).length;
    };
    return (
      <>
        {header}
        <PageBody>
          <div className="mx-auto w-full max-w-xl space-y-4">
            <ProductStrip product={plan.product} base={base} />
            {!measureChosen ? (
              <section className="space-y-3 rounded-2xl border bg-card shadow-card p-4">
                <h2 className="text-base font-semibold">2. Elegí la medida</h2>
                <p className="text-sm text-muted-foreground">Lo que saques queda marcado para esa medida en las publicaciones. Si sirve para todas, elegí Todas las medidas.</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {plan.measures.map((m) => (
                    <li key={m.key}>
                      <PickLink href={`${withProduct}&medida=${encodeURIComponent(m.key)}`} title={m.label} note={countText(plan.shots.filter((s) => s.variantKey === m.key))} />
                    </li>
                  ))}
                  <li className="sm:col-span-2">
                    <PickLink href={`${withProduct}&medida=${ALL}`} title="Todas las medidas" note={countText(plan.shots.filter((s) => s.variantKey === null))} />
                  </li>
                </ul>
              </section>
            ) : (
              <section className="space-y-3 rounded-2xl border bg-card shadow-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">{needsMeasure ? '3' : '2'}. Elegí el protocolo</h2>
                  {measureText ? (
                    <span className="inline-flex items-center gap-2 text-sm">
                      <Badge variant="secondary">{measureText}</Badge>
                      <Link href={withProduct} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
                        Cambiar
                      </Link>
                    </span>
                  ) : null}
                </div>
                {plan.protocols.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay protocolos armados. Podés seguir sin protocolo.</p> : null}
                <ul className="space-y-2">
                  {plan.protocols.map((p) => (
                    <li key={p.id}>
                      <PickLink
                        href={`${withMeasure}&protocolo=${p.id}`}
                        icon={<ClipboardList className="h-5 w-5" />}
                        title={p.name}
                        description={p.description}
                        note={`${plural(p.steps.length, 'paso')}${done(measure?.key ?? null)(p) > 0 ? `, ${done(measure?.key ?? null)(p)} ya hechos` : ''}`}
                      />
                    </li>
                  ))}
                  <li>
                    <PickLink href={`${withMeasure}&protocolo=${NONE}`} icon={<Camera className="h-5 w-5" />} title="Sin protocolo" description="Sacá las fotos y los videos que quieras, uno tras otro." />
                  </li>
                </ul>
              </section>
            )}
            <ShotHistory plan={plan} timezone={account.timezone} />
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
            shots={plan.shots.map((s) => ({ kind: s.kind, stepId: s.stepId, variantKey: s.variantKey }))}
          />
          <div className="mx-auto w-full max-w-xl space-y-4">
            <BeforeStarting collapsed />
            <ShotHistory plan={plan} timezone={account.timezone} />
          </div>
        </div>
      </PageBody>
    </>
  );
}

function countText(list: { kind: string }[]): string | undefined {
  if (list.length === 0) return undefined;
  const photos = list.filter((s) => s.kind === 'PHOTO').length;
  const videos = list.length - photos;
  return ['Ya tiene', [photos ? plural(photos, 'foto') : '', videos ? plural(videos, 'video') : ''].filter(Boolean).join(' y ')].join(' ');
}

function PickLink({ href, title, description, note, icon }: { href: string; title: string; description?: string; note?: string; icon?: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 rounded-lg border bg-background px-4 py-3 hover:bg-muted">
      {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {description ? <span className="block text-sm text-muted-foreground">{description}</span> : null}
        {note ? <span className="block text-xs text-muted-foreground">{note}</span> : null}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
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

function ShotHistory({ plan, timezone }: { plan: ShootPlan; timezone: string }) {
  if (plan.shots.length === 0) return null;
  const titles = new Map(plan.protocols.flatMap((p) => p.steps.map((s) => [s.id, s.title] as const)));
  return (
    <details className="rounded-2xl border bg-card shadow-card">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Lo que ya se registró de este producto ({plan.shots.length})</summary>
      <ul className="divide-y border-t">
        {plan.shots.map((s, i) => (
          <li key={i} className="flex items-start gap-2 px-4 py-2 text-sm">
            {s.kind === 'PHOTO' ? <Camera className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <Video className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{s.stepId ? (titles.get(s.stepId) ?? 'Paso que ya no está') : 'Sin protocolo'}</span>
              <span className="block text-xs text-muted-foreground">
                {s.variantLabel ? `Medida ${s.variantLabel}` : 'Todas las medidas'} · {formatDateTime(new Date(s.at), timezone)}
                {s.by ? ` · ${s.by}` : ''}
              </span>
            </span>
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          </li>
        ))}
      </ul>
    </details>
  );
}
