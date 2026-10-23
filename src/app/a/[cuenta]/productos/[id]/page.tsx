import { notFound } from 'next/navigation';
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
import { getProduct, listStores, type ProductDetail } from '@/lib/queries/products';
import { loadResearch } from '@/lib/queries/research';
import { loadRulesByChannel, toScoreInput } from '@/lib/queries/scoring';

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

const TAB_KEYS: ProductTabKey[] = ['publicaciones', 'ficha', 'compatibilidades', 'investigacion', 'fotos', 'combos'];

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
  const { account } = await requireAccount(cuenta);
  const [product, stores, rules, combo, research, photos, videos] = await Promise.all([
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
  ]);
  if (!product || !combo) notFound();

  const base = `/a/${account.slug}/productos`;
  const storeOptions = stores.map((s) => ({ id: s.id, name: s.name, channel: channelInfo(s.channel.kind, s.channel.name) }));
  const pubs = product.publications;
  const channels = new Map(pubs.map((p) => [p.id, channelInfo(p.store.channel.kind, p.store.channel.name)]));
  const scores = new Map(pubs.map((p) => [p.id, scorePublication(rules.get(p.store.channelId) ?? [], toScoreInput(product, p)).score]));
  const known = [...scores.values()].filter((s): s is number => s !== null);
  const inPipeline = pubs.filter((p) => p.pipelineStatus === 'IN_PIPELINE').length;
  const measures = product.variants.map((v) => v.measure?.trim()).filter(Boolean);
  const subtitle = [product.brand, product.productType, product.partNumber, measures.length > 1 ? measures.join(', ') : null].filter(Boolean).join(' · ');
  const summary = [
    plural(pubs.length, 'publicación', 'publicaciones'),
    inPipeline > 0 ? `${inPipeline} en el pipeline` : null,
    known.length > 0 ? `puntaje más bajo ${Math.min(...known)}` : null,
  ].filter(Boolean);

  // Para ir a trabajar lo del producto en el pipeline: la que ya está ahí o la primera.
  const worked = pubs.find((p) => p.pipelineStatus === 'IN_PIPELINE') ?? pubs[0] ?? null;
  const stepHref = worked ? (step: string) => `/a/${account.slug}/pipeline/${worked.id}?paso=${step}` : null;
  const isCombo = combo.kind === 'COMBO';
  const comboCount = isCombo ? combo.items.length : combo.inCombos.length;

  const tabs: { key: ProductTabKey; label: string; count?: number | null }[] = [
    { key: 'publicaciones', label: 'Publicaciones', count: pubs.length },
    { key: 'ficha', label: 'Ficha' },
    { key: 'compatibilidades', label: 'Compatibilidades', count: product.compatibilities.length },
    { key: 'investigacion', label: 'Investigación' },
    { key: 'fotos', label: 'Fotos y videos', count: photos.length + videos.length + product.assets.length },
    { key: 'combos', label: isCombo ? 'Productos del combo' : 'Combos', count: comboCount },
  ];
  const wanted = TAB_KEYS.find((k) => k === seccion);
  const initial: ProductTabKey = wanted ?? (pubs.length > 0 ? 'publicaciones' : 'ficha');
  const newPublication = (label: string) => (
    <NewPublicationDialog accountSlug={account.slug} productId={product.id} productName={product.name} stores={storeOptions} label={label} />
  );

  return (
    <>
      <PageHeader staticOnMobile className="max-w-5xl">
        <div className="space-y-2">
          <Breadcrumb items={[{ label: account.name, href: base }, { label: 'Productos', href: base }, { label: product.name }]} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <EntityLabel kind="product" />
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight md:text-2xl">
                {product.name}
                <KindBadge kind={product.kind} />
              </h1>
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
              <p className="text-sm">{summary.join(' · ')}</p>
            </div>
            {pubs.length > 0 ? newPublication('Agregar publicación') : null}
          </div>
        </div>
      </PageHeader>
      <PageBody className="max-w-5xl">
        <ProductTabs
          tabs={tabs}
          initial={initial}
          form={{ accountSlug: account.slug, productId: product.id, initial: toFormValues(product) }}
          panels={{
            publicaciones:
              pubs.length > 0 ? (
                <ProductPublications accountSlug={account.slug} publications={pubs} channels={channels} scores={scores} />
              ) : (
                <div className="space-y-3 rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Todavía no tiene publicación en {stores.map((s) => s.name).join(' ni en ') || 'ninguna tienda'}.
                  </p>
                  {newPublication('Agregar publicación')}
                </div>
              ),
            investigacion: <ProductResearchPanel research={research} editHref={stepHref ? stepHref('informacion') : null} />,
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
