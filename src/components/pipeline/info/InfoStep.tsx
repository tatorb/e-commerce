import { SectionBody, SectionCard } from '@/components/ui/section-card';
import type { CatalogData } from '@/lib/catalog-data';
import type { ComboData } from '@/lib/queries/combos';
import { ComboItemsCard } from '@/components/products/ComboItemsCard';
import { InCombosCard } from '@/components/products/InCombosCard';
import type { ResearchData } from '@/lib/queries/research';
import type { TitleContext } from '@/lib/queries/title-step';
import { BuyerPainsCard } from './BuyerPainsCard';
import { CapturedMaterial } from './CapturedMaterial';
import { CatalogCard } from './CatalogCard';
import { ClarificationsCard } from './ClarificationsCard';
import { CompetitorsCard } from './CompetitorsCard';
import { ManufacturerCard } from './ManufacturerCard';
import { ProductInfoForm } from './ProductInfoForm';

// Paso Información, en este orden: los datos de la ficha (y los del combo), lo
// del fabricante, los datos de catálogo del canal, la competencia, los dolores
// del comprador, las aclaraciones para las imágenes y lo que se fue juntando
// en el paso Título. La
// investigación es del producto: la comparten todas sus publicaciones. Los
// datos de catálogo son de la publicación, porque cada canal tiene los suyos.
export function InfoStep({
  accountSlug,
  timeZone,
  ctx,
  research,
  catalog,
  combo,
  blobReady,
}: {
  accountSlug: string;
  timeZone: string;
  ctx: TitleContext;
  research: ResearchData;
  catalog: CatalogData | null;
  combo: ComboData | null;
  blobReady: boolean;
}) {
  const s = (v: string | null | undefined) => v ?? '';
  const p = ctx.product;
  const r = research.research;
  const publicationId = ctx.publication.id;
  return (
    <>
      <SectionCard
        title="Datos del producto"
        description={`Vienen de la ficha maestra de «${p.name}». Revisalos y completá lo que falte: lo que guardes queda en la ficha.`}
      >
        <SectionBody>
          <ProductInfoForm
            accountSlug={accountSlug}
            publicationId={publicationId}
            initial={{
              productType: s(p.productType),
              brand: s(p.brand),
              partNumber: s(p.partNumber),
              line: s(p.line),
              origin: s(p.origin),
              variants: p.variants.map((v) => ({ id: v.id, measure: s(v.measure), sku: s(v.sku) })),
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
            }}
          />
        </SectionBody>
      </SectionCard>
      {combo?.kind === 'COMBO' ? (
        <ComboItemsCard accountSlug={accountSlug} comboId={ctx.publication.productId} initial={combo.items} />
      ) : combo ? (
        <InCombosCard accountSlug={accountSlug} combos={combo.inCombos} />
      ) : null}
      <ManufacturerCard
        accountSlug={accountSlug}
        publicationId={publicationId}
        productId={ctx.publication.productId}
        initial={{ site: s(r?.manufacturerSite), productUrl: s(r?.manufacturerProductUrl), text: s(r?.manufacturerText) }}
        files={research.files.map((f) => ({ id: f.id, kind: f.kind, name: f.name, size: f.size }))}
        blobReady={blobReady}
      />
      {catalog ? (
        <CatalogCard
          accountSlug={accountSlug}
          publicationId={publicationId}
          data={catalog}
        />
      ) : null}
      <CompetitorsCard
        accountSlug={accountSlug}
        publicationId={publicationId}
        initial={ctx.competitors.map((c) => ({ url: c.url ?? '', title: c.title, soldQuantity: c.soldQuantity?.toString() ?? '' }))}
      />
      <BuyerPainsCard
        accountSlug={accountSlug}
        publicationId={publicationId}
        questions={{ own: s(r?.ownQuestions), competitors: s(r?.competitorQuestions) }}
        pains={research.pains.map((i) => ({ id: i.id, text: i.text }))}
        objections={research.objections.map((i) => ({ id: i.id, text: i.text }))}
      />
      <ClarificationsCard accountSlug={accountSlug} publicationId={publicationId} initial={s(r?.clarifications)} />
      <SectionCard title="Material capturado" description="Lo que se juntó en el paso Título, con su fecha.">
        <SectionBody>
          <CapturedMaterial captures={ctx.captures} positions={ctx.positions} timeZone={timeZone} />
        </SectionBody>
      </SectionCard>
    </>
  );
}
