import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TitleContext } from '@/lib/queries/title-step';
import { CapturedMaterial } from './CapturedMaterial';
import { CompetitorsForm } from './CompetitorsForm';
import { ProductInfoForm } from './ProductInfoForm';

// Paso Información: los datos de la ficha que necesita el título, la
// competencia y lo que se fue juntando en el paso Título.
export function InfoStep({ accountSlug, timeZone, ctx }: { accountSlug: string; timeZone: string; ctx: TitleContext }) {
  const s = (v: string | null) => v ?? '';
  const p = ctx.product;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Datos del producto</CardTitle>
          <CardDescription>
            Vienen de la ficha maestra de «{p.name}». Revisalos y completá lo que falte: lo que guardes queda en la
            ficha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductInfoForm
            accountSlug={accountSlug}
            publicationId={ctx.publication.id}
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
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Competencia</CardTitle>
          <CardDescription>
            De 3 a 5 publicaciones de otros vendedores que más venden este producto. Sus títulos suman palabras al
            paso Título.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompetitorsForm
            accountSlug={accountSlug}
            publicationId={ctx.publication.id}
            initial={ctx.competitors.map((c) => ({ url: c.url ?? '', title: c.title, soldQuantity: c.soldQuantity?.toString() ?? '' }))}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Material capturado</CardTitle>
          <CardDescription>Lo que se juntó en el paso Título, con su fecha.</CardDescription>
        </CardHeader>
        <CardContent>
          <CapturedMaterial captures={ctx.captures} positions={ctx.positions} timeZone={timeZone} />
        </CardContent>
      </Card>
    </>
  );
}
