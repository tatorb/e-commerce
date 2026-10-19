import { SectionBody, SectionCard } from '@/components/ui/section-card';
import type { CatalogData } from '@/lib/catalog-data';
import type { ResearchData } from '@/lib/queries/research';
import type { TitleContext } from '@/lib/queries/title-step';
import { BuyerPainsCard } from './BuyerPainsCard';
import { CapturedMaterial } from './CapturedMaterial';
import { CatalogCard } from './CatalogCard';
import { ClarificationsCard } from './ClarificationsCard';
import { CompetitorsForm } from './CompetitorsForm';
import { ManufacturerCard } from './ManufacturerCard';
import { ProductInfoForm } from './ProductInfoForm';

// Paso Información: los datos de la ficha, lo del fabricante, los datos de
// catálogo del canal, las aclaraciones para las imágenes, los dolores del
// comprador, la competencia y lo que se fue juntando en el paso Título. La
// investigación es del producto: la comparten todas sus publicaciones. Los
// datos de catálogo son de la publicación, porque cada canal tiene los suyos.
export function InfoStep({
  accountSlug,
  timeZone,
  ctx,
  research,
  catalog,
  blobReady,
}: {
  accountSlug: string;
  timeZone: string;
  ctx: TitleContext;
  research: ResearchData;
  catalog: CatalogData | null;
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
      <ClarificationsCard accountSlug={accountSlug} publicationId={publicationId} initial={s(r?.clarifications)} />
      <BuyerPainsCard
        accountSlug={accountSlug}
        publicationId={publicationId}
        questions={{ own: s(r?.ownQuestions), competitors: s(r?.competitorQuestions) }}
        pains={research.pains.map((i) => ({ id: i.id, text: i.text }))}
        objections={research.objections.map((i) => ({ id: i.id, text: i.text }))}
      />
      <SectionCard
        title="Competencia"
        count={ctx.competitors.length}
        description="Las publicaciones de otros vendedores que más venden este producto. Conviene cargar al menos 3. Sus títulos suman palabras al paso Título."
      >
        <SectionBody>
          <CompetitorsForm
            accountSlug={accountSlug}
            publicationId={publicationId}
            initial={ctx.competitors.map((c) => ({ url: c.url ?? '', title: c.title, soldQuantity: c.soldQuantity?.toString() ?? '' }))}
          />
        </SectionBody>
      </SectionCard>
      <SectionCard title="Material capturado" description="Lo que se juntó en el paso Título, con su fecha.">
        <SectionBody>
          <CapturedMaterial captures={ctx.captures} positions={ctx.positions} timeZone={timeZone} />
        </SectionBody>
      </SectionCard>
    </>
  );
}
