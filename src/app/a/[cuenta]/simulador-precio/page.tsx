import Link from 'next/link';
import { ChevronRight, ExternalLink, Search } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PriceWorkspace } from '@/components/pipeline/price/PriceWorkspace';
import { SalesHistoryCard } from '@/components/sales/SalesHistoryCard';
import { can } from '@/domain/access';
import { todayIn } from '@/domain/applications';
import { CHANNEL_STATUS_LABEL, codeOrUnpublished } from '@/domain/channel-status';
import { PIPELINE_STEP_SLUG } from '@/domain/pipeline';
import { titleOrUntitled } from '@/domain/publication-title';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { familyOf } from '@/lib/families';
import { loadPriceStep } from '@/lib/pricing';
import { searchForSimulator } from '@/lib/queries/price-simulator';
import { salesHistory } from '@/lib/sales/queries';

// Simulador de precio: buscar cualquier publicación de la cuenta y trabajar su
// precio como en el paso Precio del Pipeline, con lo mismo. Además de guardar,
// se puede subir al canal en el momento.

export const dynamic = 'force-dynamic';

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Simulador de precio · ${account.name}` : 'Simulador de precio' };
}

export default async function PriceSimulatorPage({ params, searchParams }: { params: Promise<{ cuenta: string }>; searchParams: Search }) {
  const { cuenta } = await params;
  const sp = await searchParams;
  const { user, account } = await requireAccount(cuenta, 'pipeline');
  const base = `/a/${account.slug}/simulador-precio`;
  const q = one(sp.q);
  const chosen = one(sp.publicacion);

  const [results, price] = await Promise.all([
    searchForSimulator(prisma, account.id, q),
    chosen ? loadPriceStep(prisma, account.id, chosen).catch(() => null) : null,
  ]);
  const pub = price
    ? await prisma.publication.findFirst({
        where: { id: chosen, product: { accountId: account.id } },
        select: { id: true, title: true, externalId: true, url: true, channelStatus: true, product: { select: { id: true, name: true } } },
      })
    : null;
  const family = pub ? await familyOf(prisma, pub.id) : null;
  const sales =
    pub && can(user.access, 'ventas', 'read') ? await salesHistory(prisma, account.id, family ? family.members.map((m) => m.id) : [pub.id]).catch(() => null) : null;
  const withQuery = (extra: Record<string, string>) => `${base}?${new URLSearchParams({ ...(q ? { q } : {}), ...extra })}`;

  return (
    <>
      <PageHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Simulador de precio</h1>
            <p className="text-sm text-muted-foreground">
              Buscá una publicación y probá su precio, cuotas y descuento, como en el paso Precio del Pipeline. Podés guardarlo o subirlo al canal en el momento.
            </p>
          </div>
          <form action={base} className="flex max-w-2xl gap-2">
            <Input name="q" defaultValue={q} placeholder="SKU, código del canal, título de la publicación o nombre del producto" autoComplete="off" />
            <Button type="submit" access="view">
              <Search />
              Buscar
            </Button>
          </form>
        </div>
      </PageHeader>
      <PageBody>
        {q.trim().length > 0 && q.trim().length < 2 ? <p className="text-sm text-muted-foreground">Escribí al menos 2 letras o números.</p> : null}
        {q.trim().length >= 2 && results.length === 0 ? <p className="text-sm text-muted-foreground">No encontramos publicaciones con «{q.trim()}».</p> : null}
        {results.length > 0 && !pub ? (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
            {results.map((r) => (
              <li key={r.id}>
                <Link href={withQuery({ publicacion: r.id })} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{titleOrUntitled(r.title)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[codeOrUnpublished(r.externalId), r.skus.join(' / '), r.product, r.store].filter(Boolean).join(' · ')}
                      {r.channelStatus !== 'ACTIVE' ? <span className="font-medium text-amber-700"> · {CHANNEL_STATUS_LABEL[r.channelStatus]}</span> : null}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {chosen && !pub ? <p className="text-sm text-destructive">Esa publicación no está en la cuenta. Buscala de nuevo.</p> : null}
        {pub && price ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 shadow-card">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{titleOrUntitled(pub.title)}</p>
                <p className="text-sm text-muted-foreground">
                  {codeOrUnpublished(pub.externalId)} · {pub.product.name}
                  {pub.channelStatus !== 'ACTIVE' ? <span className="font-medium text-amber-700"> · {CHANNEL_STATUS_LABEL[pub.channelStatus]}</span> : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/a/${account.slug}/publicaciones/${pub.id}`}>Abrir la publicación</Link>
                </Button>
                {pub.url ? (
                  <Button size="sm" variant="outline" asChild>
                    <a href={pub.url} target="_blank" rel="noreferrer">
                      <ExternalLink />
                      Ver en {price.channelName}
                    </a>
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" asChild>
                  <Link href={q ? `${base}?q=${encodeURIComponent(q)}` : base}>Elegir otra</Link>
                </Button>
              </div>
            </div>
            <PriceWorkspace
              key={pub.id}
              accountSlug={account.slug}
              data={price}
              today={todayIn(account.timezone)}
              timeZone={account.timezone}
              infoHref={`/a/${account.slug}/pipeline/${pub.id}?paso=${PIPELINE_STEP_SLUG.INFO}`}
              settingsHref={`/a/${account.slug}/precios`}
              push={can(user.access, 'subir', 'write')}
            />
            {sales ? (
              <SalesHistoryCard
                accountSlug={account.slug}
                history={sales}
                timeZone={account.timezone}
                of={family && family.members.length > 1 ? 'las medidas de la familia' : 'esta publicación'}
                search={pub.externalId}
                defaultOpen={false}
              />
            ) : null}
          </>
        ) : null}
      </PageBody>
    </>
  );
}
