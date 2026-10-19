import { SectionBody, SectionCard } from '@/components/ui/section-card';
import type { ResearchData } from '@/lib/queries/research';
import type { TitleContext } from '@/lib/queries/title-step';
import { BuyerPainsCard } from './BuyerPainsCard';
import { CapturedMaterial } from './CapturedMaterial';
import { ClarificationsCard } from './ClarificationsCard';
import { CompetitorsForm } from './CompetitorsForm';
import { ManufacturerCard } from './ManufacturerCard';
import { ProductInfoForm } from './ProductInfoForm';

// Paso Información: los datos de la ficha, lo del fabricante, las aclaraciones
// para las imágenes, los dolores del comprador, la competencia y lo que se fue
// juntando en el paso Título. Lo nuevo es del producto: lo comparten todas sus
// publicaciones.
export function InfoStep({
  accountSlug,
  timeZone,
  ctx,
  research,
  blobReady,
}: {
  accountSlug: string;
  timeZone: string;
  ctx: TitleContext;
  research: ResearchData;
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
        description="De 3 a 5 publicaciones de otros vendedores que más venden este producto. Sus títulos suman palabras al paso Título."
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
