import Link from 'next/link';
import { ExternalLink, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import type { ResearchData } from '@/lib/queries/research';
import { KnowledgeCard } from '@/components/pipeline/info/KnowledgeCard';

// La investigación del producto, para leerla de un vistazo: lo del
// fabricante, las aclaraciones para las imágenes, las preguntas de la
// competencia y los dolores y objeciones de los compradores. Es del producto y
// la comparten todas sus publicaciones; se carga en el paso Información. Lo
// que sabe la tienda se edita también acá, sin pasar por el pipeline.

const Empty = () => <p className="text-sm text-muted-foreground">Sin cargar.</p>;

function Text({ value }: { value: string | null | undefined }) {
  return value?.trim() ? <p className="whitespace-pre-line text-sm">{value.trim()}</p> : <Empty />;
}

function Items({ list }: { list: { id: string; text: string }[] }) {
  if (list.length === 0) return <Empty />;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {list.map((i) => (
        <li key={i.id}>{i.text}</li>
      ))}
    </ul>
  );
}

export function ProductResearchPanel({
  accountSlug,
  productId,
  publications,
  research,
  editHref,
}: {
  accountSlug: string;
  productId: string;
  // Cuántas publicaciones tiene el producto, para avisar que lo comparten.
  publications: number;
  research: ResearchData;
  editHref: string | null;
}) {
  const r = research.research;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
        <p className="text-sm text-muted-foreground">
          Es del producto y la comparten todas sus publicaciones. Lo que sabe la tienda se edita acá. Lo demás, en el paso Información de cualquiera de ellas.
        </p>
        {editHref ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={editHref}>
              <Pencil />
              Editar en el paso Información
            </Link>
          </Button>
        ) : null}
      </div>
      <KnowledgeCard accountSlug={accountSlug} target={{ productId }} sharedWith={publications} initial={r?.storeKnowledge ?? ''} />
      <SectionCard title="Lo del fabricante">
        <SectionBody className="space-y-3">
          {r?.manufacturerSite || r?.manufacturerProductUrl ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {[r.manufacturerSite, r.manufacturerProductUrl].filter(Boolean).map((url) => (
                <a key={url} href={url!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {url!.replace(/^https?:\/\//, '').slice(0, 60)}
                </a>
              ))}
            </div>
          ) : null}
          <Text value={r?.manufacturerText} />
          {research.files.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {research.files.length === 1 ? '1 archivo' : `${research.files.length} archivos`}: {research.files.map((f) => f.name).join(', ')}
            </p>
          ) : null}
        </SectionBody>
      </SectionCard>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <SectionCard title="Dolores del comprador" count={research.pains.length}>
          <SectionBody>
            <Items list={research.pains} />
          </SectionBody>
        </SectionCard>
        <SectionCard title="Objeciones" count={research.objections.length}>
          <SectionBody>
            <Items list={research.objections} />
          </SectionBody>
        </SectionCard>
      </div>
      <SectionCard title="Preguntas de la competencia">
        <SectionBody>
          <Text value={r?.competitorQuestions} />
        </SectionBody>
      </SectionCard>
      <SectionCard title="Aclaraciones para las imágenes">
        <SectionBody>
          <Text value={r?.clarifications} />
        </SectionBody>
      </SectionCard>
    </>
  );
}
