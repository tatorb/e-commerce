import Link from 'next/link';
import { ArrowRight, KanbanSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddToPipelineButton } from '@/components/pipeline/AddToPipelineButton';
import { EntityLabel } from '@/components/navigation/EntityLabel';
import { ScoreBadge } from '@/components/stages/ScoreBadge';
import { PipelineBadge } from '@/components/stages/StageBadge';
import { codeOrUnpublished } from '@/domain/channel-status';
import { faceSummary, faceValues, fingerprintsOf } from '@/domain/channel-sync';
import { titleOrUntitled } from '@/domain/publication-title';
import type { ChannelInfo } from '@/channels';
import type { PublicationFigures } from '@/lib/publication-figures';
import type { PublicationFacts } from '@/lib/publication-facts';
import { PublicationFactsRow } from '@/components/publication/PublicationFactsRow';
import type { ProductDetail } from '@/lib/queries/products';
import { cn } from '@/lib/utils/cn';

// Las publicaciones del producto, una tarjeta corta por cada una: qué es, en
// qué tienda, su precio, su cantidad y sus ventas, en qué estado está y a
// dónde ir. Lo de cada publicación se trabaja en su página.

type Publication = ProductDetail['publications'][number];

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  );
}

const missing = <span className="font-normal text-muted-foreground">Sin dato</span>;

/** Lo cambiado en la app que todavía no está en el canal. */
function Pending({ value }: { value: string | null }) {
  return value ? (
    <span className="block font-normal text-amber-700" title="Cambiado en la app: falta subirlo">
      → {value} por subir
    </span>
  ) : null;
}

function Figures({ f }: { f: PublicationFigures }) {
  return (
    <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-sm">
      <Figure label="Precio">
        {f.price ? (
          <>
            {f.price.now}
            {f.price.discount ? <span className="block font-normal text-muted-foreground">con {f.price.discount} de descuento</span> : null}
            <Pending value={f.price.pending} />
          </>
        ) : (
          missing
        )}
      </Figure>
      <Figure label="Cantidad">
        {f.quantity ? (
          <>
            <span className={cn(f.quantity.empty && 'text-destructive')}>{f.quantity.now}</span>
            {f.quantity.full ? <span className="block font-normal text-muted-foreground">Full</span> : null}
            <Pending value={f.quantity.pending} />
          </>
        ) : (
          missing
        )}
      </Figure>
      <Figure label="Ventas">
        {f.sales.sold === null && f.sales.last90 === null ? (
          missing
        ) : (
          <>
            {f.sales.sold !== null ? `${f.sales.sold} en total` : null}
            {f.sales.last90 !== null ? (
              <span className={cn('block', f.sales.sold !== null && 'font-normal text-muted-foreground')}>{f.sales.last90} en 90 días</span>
            ) : null}
          </>
        )}
      </Figure>
    </dl>
  );
}

export function ProductPublications({
  accountSlug,
  publications,
  channels,
  scores,
  figures,
  facts,
}: {
  accountSlug: string;
  publications: Publication[];
  channels: Map<string, ChannelInfo>;
  scores: Map<string, number | null>;
  figures: Map<string, PublicationFigures>;
  facts: Map<string, PublicationFacts>;
}) {
  return (
    <ul className="space-y-3">
      {publications.map((pub) => {
        const channel = channels.get(pub.id)!;
        const summary = faceSummary(fingerprintsOf(faceValues(pub)), pub.channelCopy);
        const href = `/a/${accountSlug}/publicaciones/${pub.id}`;
        return (
          <li key={pub.id} className="space-y-3 rounded-lg border bg-card p-3 shadow-sm md:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <EntityLabel kind="publication" channelName={channel.name} accent={channel.accent} />
                <Link href={href} className="block font-medium leading-snug hover:underline">
                  {titleOrUntitled(pub.title)}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {pub.store.name} · {codeOrUnpublished(pub.externalId)}
                </p>
                <PublicationFactsRow facts={facts.get(pub.id)!} />
              </div>
              <ScoreBadge score={scores.get(pub.id) ?? null} className="shrink-0" />
            </div>
            <Figures f={figures.get(pub.id)!} />
            <div className="flex flex-wrap gap-1.5">
              <PipelineBadge state={pub} />
              {summary.draft.length > 0 ? <Badge variant="secondary">Cambios sin subir</Badge> : null}
              {summary.choose.length > 0 ? <Badge variant="destructive">Para elegir</Badge> : null}
              {summary.rejected.length > 0 ? <Badge variant="destructive">Rechazada</Badge> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link href={href}>
                  Abrir la publicación
                  <ArrowRight />
                </Link>
              </Button>
              {pub.pipelineStatus === 'IN_PIPELINE' ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/a/${accountSlug}/pipeline/${pub.id}`}>
                    <KanbanSquare />
                    Abrir su paso
                  </Link>
                </Button>
              ) : (
                <AddToPipelineButton
                  accountSlug={accountSlug}
                  publicationId={pub.id}
                  label={
                    pub.pipelineStatus === 'CORRECTED'
                      ? 'Volver a corregirla'
                      : pub.pipelineStatus === 'DISCARDED'
                        ? 'Volver a agregarla al pipeline'
                        : 'Agregar al pipeline'
                  }
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
