import Link from 'next/link';
import { ArrowRight, KanbanSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddToPipelineButton } from '@/components/pipeline/AddToPipelineButton';
import { EntityLabel } from '@/components/navigation/EntityLabel';
import { ScoreBadge } from '@/components/stages/ScoreBadge';
import { ChannelStatusBadge, PipelineBadge } from '@/components/stages/StageBadge';
import { codeOrUnpublished } from '@/domain/channel-status';
import { faceSummary, faceValues, fingerprintsOf } from '@/domain/channel-sync';
import { parseVariantListings } from '@/domain/media';
import { titleOrUntitled } from '@/domain/publication-title';
import type { ChannelInfo } from '@/channels';
import type { ProductDetail } from '@/lib/queries/products';

// Las publicaciones del producto, una tarjeta corta por cada una: qué es, en
// qué tienda, en qué estado está y a dónde ir. Lo de cada publicación se
// trabaja en su página.

type Publication = ProductDetail['publications'][number];

export function ProductPublications({
  accountSlug,
  publications,
  channels,
  scores,
}: {
  accountSlug: string;
  publications: Publication[];
  channels: Map<string, ChannelInfo>;
  scores: Map<string, number | null>;
}) {
  return (
    <ul className="space-y-3">
      {publications.map((pub) => {
        const channel = channels.get(pub.id)!;
        const summary = faceSummary(fingerprintsOf(faceValues(pub)), pub.channelCopy);
        const family = parseVariantListings(pub.variantListings);
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
                  {family.length >= 2 ? ` · ${family.length} medidas en publicaciones aparte` : ''}
                </p>
              </div>
              <ScoreBadge score={scores.get(pub.id) ?? null} className="shrink-0" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <ChannelStatusBadge status={pub.channelStatus} />
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
