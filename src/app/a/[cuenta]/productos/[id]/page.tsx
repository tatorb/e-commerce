import { notFound } from 'next/navigation';
import { ProductStockPanel } from '@/components/products/ProductStockPanel';
import { loadProductStock } from '@/lib/stock';
import { loadProductCosts } from '@/lib/costs';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { EntityLabel } from '@/components/navigation/EntityLabel';
import type { ProductFormValues } from '@/components/products/ProductForm';
import { DeleteProductButton } from '@/components/products/DeleteProductButton';
import { ComboItemsCard } from '@/components/products/ComboItemsCard';
import { InCombosCard } from '@/components/products/InCombosCard';
import { KindBadge } from '@/components/products/KindBadge';
import { ProductMediaPanel } from '@/components/products/ProductMediaPanel';
import { ProductPublications } from '@/components/products/ProductPublications';
import { ProductResearchPanel } from '@/components/products/ProductResearchPanel';
import { ProductTabs, type ProductTabKey } from '@/components/products/ProductTabs';
import { NewPublicationDialog } from '@/components/publications/NewPublicationDialog';
import { channelInfo } from '@/channels';
import { parseNameValueList } from '@/domain/name-value';
import { scorePublication } from '@/domain/standard';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { plural } from '@/lib/format';
import { loadPhotoLine } from '@/lib/photos';
import { loadCombo } from '@/lib/queries/combos';
import { getProduct, listStores, productCovers, type ProductDetail } from '@/lib/queries/products';
import { EntityHero, HeroStat } from '@/components/navigation/EntityHero';
import { ScoreBadge } from '@/components/stages/ScoreBadge';
import { BarChart3, KanbanSquare, Tag } from 'lucide-react';
import { loadResearch } from '@/lib/queries/research';
import { loadRulesByChannel, toScoreInput } from '@/lib/queries/scoring';
import { publicationFigures } from '@/lib/publication-figures';
import { publicationFacts } from '@/lib/publication-facts';
import { plansFor } from '@/lib/stock-plan';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string; id: string }> }) {
  const { cuenta, id } = await params;
  const account = await accountForTitle(cuenta);
  const product = account ? await getProduct(account.id, id) : null;
  return { title: product ? `${product.name} · ${account!.name}` : 'Producto' };
}

function toFormValues(p: ProductDetail): ProductFormValues {
  const s = (v: string | null) => v ?? '';
  return {
    name: p.name,
    kind: p.kind,
    brand: s(p.brand),
    partNumber: s(p.partNumber),
    productType: s(p.productType),
    engineSystem: s(p.engineSystem),
    line: s(p.line),
    origin: s(p.origin),
    warranty: s(p.warranty),
    kitContents: s(p.kitContents),
    notes: s(p.notes),
    specs: parseNameValueList(p.specs),
    variants: p.variants.map((v) => ({ measure: s(v.measure), sku: s(v.sku) })),
    compatibilities: p.compatibilities.map((c) => ({
      vehicleBrand: s(c.vehicleBrand),
      model: s(c.model),
      engine: s(c.engine),
      displacement: s(c.displacement),
      fuel: s(c.fuel),
      yearFrom: c.yearFrom?.toString() ?? '',
      yearTo: c.yearTo?.toString() ?? '',
      note: s(c.note),
    })),
    assets: p.assets.map((a) => ({ kind: a.kind, url: a.url })),
  };
}

const TAB_KEYS: ProductTabKey[] = ['publicaciones', 'stock', 'ficha', 'compatibilidades', 'investigacion', 'fotos', 'combos'];

// El producto: lo que es la pieza, y lo comparten todas sus publicaciones. Sus
// partes van en pestañas: las publicaciones, la ficha, las compatibilidades,
// la investigación, las fotos y videos, y los combos. Lo de cada publicación
// se trabaja en su propia página.
export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ cuenta: string; id: string }>;
  searchParams: Promise<{ seccion?: string }>;
}) {
  const [{ cuenta, id }, { seccion }] = await Promise.all([params, searchParams]);
  const { account, canWrite } = await requireAccount(cuenta, 'productos');
  const [product, stores, rules, combo, research, photos, videos, stock, covers, costs] = await Promise.all([
    getProduct(account.id, id),
    listStores(account.id),
    loadRulesByChannel(account.id),
    loadCombo(prisma, id),
    loadResearch(prisma, id),
    loadPhotoLine(prisma, id),
    prisma.productVideo.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, durationMs: true, width: true, height: true },
    }),
    loadProductStock(prisma, { accountId: account.id, productId: id }),
    productCovers([id]),
    loadProductCosts(prisma, { accountId: account.id, productId: id }),
  ]);
  if (!product || !combo || !stock || !costs) notFound();
  // Lo que le toca a cada publicación del stock del producto, para su cantidad.
  const plans = await plansFor(prisma, product.publications.map((p) => p.id));

  const base = `/a/${account.slug}/productos`;
  const storeOptions = stores.map((s) => ({ id: s.id, name: s.name, channel: channelInfo(s.channel.kind, s.channel.name) }));
  const pubs = product.publications;
  const channels = new Map(pubs.map((p) => [p.id, channelInfo(p.store.channel.kind, p.store.channel.name)]));
  const scores = new Map(pubs.map((p) => [p.id, scorePublication(rules.get(p.store.channelId) ?? [], toScoreInput(product, p)).score]));
  const figures = new Map(pubs.map((p) => [p.id, publicationFigures(p, product, plans.get(p.id) ?? null)]));
  const facts = new Map(pubs.map((p) => [p.id, publicationFacts(p, product)]));
  const known = [...scores.values()].filter((s): s is number => s !== null);
  const inPipeline = pubs.filter((p) => p.pipelineStatus === 'IN_PIPELINE').length;
  const measures = product.variants.map((v) => v.measure?.trim()).filter(Boolean);
  const subtitle = [product.brand, product.productType, product.partNumber, measures.length > 1 ? measures.join(', ') : null].filter(Boolean).join(' · ');
  // Para ir a trabajar lo del producto en el pipeline: la que ya está ahí o la primera.
  const worked = pubs.find((p) => p.pipelineStatus === 'IN_PIPELINE') ?? pubs[0] ?? null;
  const stepHref = worked ? (step: string) => `/a/${account.slug}/pipeline/${worked.id}?paso=${step}` : null;
  const isCombo = combo.kind === 'COMBO';
  const comboCount = isCombo ? combo.items.length : combo.inCombos.length;

  const tabs: { key: ProductTabKey; label: string; count?: number | null }[] = [
    { key: 'publicaciones', label: 'Publicaciones', count: pubs.length },
    // El total del producto; un combo no tiene stock propio.
    { key: 'stock', label: 'Costo y Stock', count: !isCombo && stock.managed ? stock.lines.reduce((sum, l) => sum + Math.max(l.quantity ?? 0, 0), 0) : null },
    { key: 'ficha', label: 'Ficha' },
    { key: 'compatibilidades', label: 'Compatibilidades', count: product.compatibilities.length },
    { key: 'investigacion', label: 'Investigación' },
    { key: 'fotos', label: 'Fotos y videos', count: photos.length + videos.length + product.assets.length },
    { key: 'combos', label: isCombo ? 'Productos del combo' : 'Combos', count: comboCount },
  ];
  const wanted = TAB_KEYS.find((k) => k === seccion);
  const initial: ProductTabKey = wanted ?? (pubs.length > 0 ? 'publicaciones' : 'ficha');
  const newPublication = (label: string, variant?: 'default') => (
    <NewPublicationDialog accountSlug={account.slug} productId={product.id} productName={product.name} stores={storeOptions} label={label} variant={variant} />
  );

  return (
    <>
      <PageHeader staticOnMobile>
        <div className="space-y-2">
          <Breadcrumb items={[{ label: account.name, href: base }, { label: 'Productos', href: base }, { label: product.name }]} />
          <EntityHero
            photo={{ src: covers.get(product.id) ?? null, alt: product.name }}
            label={
              <span className="flex flex-wrap items-center gap-1.5">
                <EntityLabel kind="product" />
                <KindBadge kind={product.kind} />
              </span>
            }
            title={product.name}
            meta={subtitle || null}
            stats={
              <>
                <HeroStat icon={<Tag />}>{plural(pubs.length, 'publicación', 'publicaciones')}</HeroStat>
                {inPipeline > 0 ? <HeroStat icon={<KanbanSquare />}>{inPipeline} en el pipeline</HeroStat> : null}
                {known.length > 0 ? (
                  <HeroStat icon={<BarChart3 />}>
                    Puntaje más bajo <ScoreBadge score={Math.min(...known)} />
                  </HeroStat>
                ) : null}
              </>
            }
            actions={pubs.length > 0 ? newPublication('Agregar publicación', 'default') : null}
          />
        </div>
      </PageHeader>
      <PageBody>
        <ProductTabs
          tabs={tabs}
          initial={initial}
          form={{ accountSlug: account.slug, productId: product.id, initial: toFormValues(product) }}
          panels={{
            publicaciones:
              pubs.length > 0 ? (
                <ProductPublications accountSlug={account.slug} publications={pubs} channels={channels} scores={scores} figures={figures} facts={facts} cover={covers.get(product.id) ?? null} />
              ) : (
                <div className="space-y-3 rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Todavía no tiene publicación en {stores.map((s) => s.name).join(' ni en ') || 'ninguna tienda'}.
                  </p>
                  {newPublication('Agregar publicación')}
                </div>
              ),
            stock: <ProductStockPanel accountSlug={account.slug} view={stock} costs={costs} timeZone={account.timezone} canEdit={canWrite} />,
            investigacion: (
              <ProductResearchPanel
                accountSlug={account.slug}
                productId={product.id}
                publications={pubs.length}
                research={research}
                editHref={stepHref ? stepHref('informacion') : null}
              />
            ),
            fotos: <ProductMediaPanel photos={photos} videos={videos} timeZone={account.timezone} stepHref={stepHref} />,
            combos: isCombo ? (
              <ComboItemsCard accountSlug={account.slug} comboId={product.id} initial={combo.items} />
            ) : (
              <InCombosCard accountSlug={account.slug} combos={combo.inCombos} />
            ),
          }}
          after={{
            ficha: (
              <div className="border-t pt-4">
                <DeleteProductButton accountSlug={account.slug} productId={product.id} productName={product.name} publicationCount={pubs.length} />
              </div>
            ),
          }}
        />
      </PageBody>
    </>
  );
}
