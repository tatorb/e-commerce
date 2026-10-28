import Link from 'next/link';
import { ExternalLink, KanbanSquare, Layers, Ruler } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddToPipelineButton } from '@/components/pipeline/AddToPipelineButton';
import { EntityLabel } from '@/components/navigation/EntityLabel';
import { ScoreBadge } from '@/components/stages/ScoreBadge';
import { ChannelStatusBadge, PipelineBadge } from '@/components/stages/StageBadge';
import { InfoStrip } from '@/components/ui/info-strip';
import { Thumb } from '@/components/ui/thumb';
import { codeOrUnpublished } from '@/domain/channel-status';
import { faceSummary, faceValues, fingerprintsOf } from '@/domain/channel-sync';
import { titleOrUntitled } from '@/domain/publication-title';
import type { ChannelInfo } from '@/channels';
import type { PublicationFigures } from '@/lib/publication-figures';
import { measuresText, type PublicationFacts } from '@/lib/publication-facts';
import { PublicationFactsRow } from '@/components/publication/PublicationFactsRow';
import { firstPhoto, type ProductDetail } from '@/lib/queries/products';
import { cn } from '@/lib/utils/cn';
import { plural } from '@/lib/format';

// Las publicaciones del producto, una tarjeta corta por cada una: qué es, en
// qué tienda, su precio, su cantidad y sus ventas, en qué estado está y a
// dónde ir. Lo de cada publicación se trabaja en su página.

type Publication = ProductDetail['publications'][number];

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

const missing = <span className="font-normal text-muted-foreground">Sin dato</span>;

/** Lo cambiado en la app que todavía no está en el canal. */
function Pending({ value }: { value: string | null }) {
  return value ? (
    <span className="block text-xs font-normal text-amber-700" title="Cambiado en la app: falta subirlo">
      → {value} por subir
    </span>
  ) : null;
}

function Figures({ f }: { f: PublicationFigures }) {
  return (
    <dl className="grid grid-cols-3 gap-x-3 gap-y-1 border-t pt-3 text-sm">
      <Figure label="Precio">
        {f.price ? (
          <>
            {f.price.now}
            {f.price.discount ? <span className="block text-xs font-normal text-muted-foreground">con {f.price.discount} de descuento</span> : null}
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
            {f.quantity.full ? <span className="block text-xs font-normal text-muted-foreground">Full</span> : null}
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
              <span className={cn('block', f.sales.sold !== null && 'text-xs font-normal text-muted-foreground')}>{f.sales.last90} en 90 días</span>
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
  cover,
}: {
  accountSlug: string;
  publications: Publication[];
  channels: Map<string, ChannelInfo>;
  scores: Map<string, number | null>;
  figures: Map<string, PublicationFigures>;
  facts: Map<string, PublicationFacts>;
  // La portada del producto, para las publicaciones que no tienen fotos leídas del canal.
  cover: string | null;
}) {
  // Las medidas de una familia van juntas, en un recuadro, donde aparece la primera.
  const groups: Publication[][] = [];
  const seen = new Map<string, Publication[]>();
  for (const pub of publications) {
    const familyId = pub.family?.id ?? null;
    const group = familyId ? seen.get(familyId) : undefined;
    if (group) group.push(pub);
    else {
      const fresh = [pub];
      if (familyId) seen.set(familyId, fresh);
      groups.push(fresh);
    }
  }
  return (
    <ul className="space-y-3">
      {groups.map((group) =>
        group.length > 1 || group[0].family ? (
          <li key={`familia-${group[0].family!.id}`} className="space-y-2 rounded-xl border border-dashed p-2 md:p-3">
            <p className="flex items-center gap-1.5 px-1 text-sm font-medium">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Familia de {plural(group[0].family!._count.members, 'medida', 'medidas')}
              <span className="font-normal text-muted-foreground">· se trabajan juntas en el pipeline</span>
            </p>
            <ul className="space-y-2">{group.map((pub) => card(pub))}</ul>
          </li>
        ) : (
          card(group[0])
        ),
      )}
    </ul>
  );

  function card(pub: Publication) {
    const channel = channels.get(pub.id)!;
    const summary = faceSummary(fingerprintsOf(faceValues(pub)), pub.channelCopy);
    const href = `/a/${accountSlug}/publicaciones/${pub.id}`;
    const fact = facts.get(pub.id)!;
    return (
      <li key={pub.id} className="space-y-3 rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <EntityLabel kind="publication" channelName={channel.name} accent={channel.accent} />
          <span className="flex shrink-0 items-center gap-1.5">
            <ChannelStatusBadge status={fact.status} />
            <ScoreBadge score={scores.get(pub.id) ?? null} />
          </span>
        </div>
        <Link href={href} className="flex items-start gap-3">
          <Thumb src={firstPhoto(pub.channelCopy?.photos) ?? cover} alt={titleOrUntitled(pub.title)} />
          <span className="min-w-0 space-y-1">
            <span className="block font-semibold leading-snug hover:underline">{titleOrUntitled(pub.title)}</span>
            <span className="block text-xs text-muted-foreground">
              {pub.store.name} · {codeOrUnpublished(pub.externalId)}
            </span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          <PipelineBadge state={pub} />
          {summary.draft.length > 0 ? <Badge variant="secondary">Cambios sin subir</Badge> : null}
          {summary.choose.length > 0 ? <Badge variant="destructive">Para elegir</Badge> : null}
          {summary.rejected.length > 0 ? <Badge variant="destructive">Rechazada</Badge> : null}
        </div>
        <Figures f={figures.get(pub.id)!} />
        {fact.measures.kind !== 'none' ? <InfoStrip icon={<Ruler />}>{measuresText(fact.measures)}</InfoStrip> : null}
        <PublicationFactsRow facts={fact} hideMeasures hideStatus />
        {/* Uno al lado del otro si entran; si no, uno debajo del otro. */}
        <div className="flex flex-wrap gap-2 [&>*]:flex-1 [&_button]:w-full sm:[&>*]:flex-none sm:[&_button]:w-auto">
          <Button size="sm" asChild>
            <Link href={href}>
              <ExternalLink />
              Abrir publicación
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
                    ? 'Volver al pipeline'
                    : 'Agregar al pipeline'
              }
            />
          )}
        </div>
      </li>
    );
  }
}
