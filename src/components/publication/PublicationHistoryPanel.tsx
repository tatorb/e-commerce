import { PipelineHistory } from '@/components/pipeline/PipelineHistory';
import { PublicationProposal } from '@/components/proposals/PublicationProposal';
import { PublicationForm } from '@/components/publications/PublicationForm';
import { TitleLockControl } from '@/components/publications/TitleLockControl';
import { ScoreDot } from '@/components/stages/ScoreBadge';
import { StageBadge } from '@/components/stages/StageBadge';
import { SectionBody, SectionCard, SubHeader } from '@/components/ui/section-card';
import { channelInfo, getChannelAdapter } from '@/channels';
import { METRICS, METRIC_KEYS, formatMetric, latestMetrics, parseMetrics } from '@/domain/measurements';
import { parseNameValueList } from '@/domain/name-value';
import { scorePublication, type RuleConfig } from '@/domain/standard';
import { resolveTitleLock } from '@/domain/title-lock';
import { formatDateTime, formatDuration } from '@/lib/format';
import type { ProductDetail } from '@/lib/queries/products';
import { toScoreInput } from '@/lib/queries/scoring';

// El puntaje y el historial de una publicación: qué le falta según el
// estándar, el candado del título, la propuesta con IA, por dónde pasó en el
// pipeline y las mediciones. Si la tienda no está conectada con el canal, sus
// datos se cargan a mano acá.

type Publication = ProductDetail['publications'][number];

// Precio guardado → texto con la costumbre argentina, para editarlo.
function priceToInput(price: { toString(): string } | null): string {
  if (price === null) return '';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(Number(price.toString()));
}

export function PublicationHistoryPanel({
  accountSlug,
  timeZone,
  product,
  pub,
  rules,
  aiReady,
  connected,
}: {
  accountSlug: string;
  timeZone: string;
  product: ProductDetail;
  pub: Publication;
  rules: RuleConfig[];
  aiReady: boolean;
  // Si la tienda está conectada con el canal: si no, los datos se cargan a mano.
  connected: boolean;
}) {
  const channel = channelInfo(pub.store.channel.kind, pub.store.channel.name);
  const score = scorePublication(rules, toScoreInput(product, pub));
  const titleLock = resolveTitleLock(getChannelAdapter(pub.store.channel.kind, pub.store.channel.name).titleLock(latestMetrics(pub.measurements)), pub.titleLockedManual);
  const now = new Date();
  return (
    <>
      <SectionCard
        title="Estándar"
        count={score.score}
        description={
          score.score === null
            ? 'Ninguna regla aplica.'
            : score.missing.length === 0
              ? `Puntaje ${score.score}. Cumple todo el estándar.`
              : `Puntaje ${score.score}. ${score.missing.length === 1 ? 'Le falta 1 cosa' : `Le faltan ${score.missing.length} cosas`}.`
        }
      >
        {score.results.length > 0 ? (
          <ul className="divide-y">
            {[...score.results]
              .sort((a, b) => {
                const order = { fail: 0, pass: 1, na: 2 };
                return order[a.status] - order[b.status] || b.weight - a.weight;
              })
              .map((r) => (
                <li key={r.ruleId} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <ScoreDot band={r.status === 'pass' ? 'high' : r.status === 'fail' ? 'low' : 'none'} className="mt-1.5" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{r.name}</span>
                    <span className="tabular-nums text-muted-foreground"> · peso {r.weight}</span>
                    {r.status === 'na' ? <span className="text-muted-foreground"> · no aplica</span> : null}
                    {r.detail ? <p className="text-muted-foreground">{r.detail}</p> : null}
                  </div>
                </li>
              ))}
          </ul>
        ) : null}
      </SectionCard>

      {/* Sin publicar, el título todavía no se puede bloquear. */}
      {pub.externalId ? (
        <SectionCard title="Título" description="Si tiene ventas, el canal no deja cambiar el título.">
          <SectionBody>
            <TitleLockControl accountSlug={accountSlug} publicationId={pub.id} lock={titleLock} />
          </SectionBody>
        </SectionCard>
      ) : null}

      <PublicationProposal
        accountSlug={accountSlug}
        timeZone={timeZone}
        publicationId={pub.id}
        stage={pub.stage}
        proposal={pub.proposals[0] ?? null}
        proposalCount={pub._count.proposals}
        aiReady={aiReady}
        channelName={channel.name}
        application={pub.applications[0] ?? null}
      />

      {pub.pipelineMovements.length > 0 ? (
        <div className="overflow-hidden rounded-md border bg-card">
          <SubHeader title="Historial del pipeline" />
          <PipelineHistory movements={pub.pipelineMovements} timeZone={timeZone} />
        </div>
      ) : null}

      {/* Sin propuestas todavía, el historial es solo el comienzo: no se muestra. */}
      {pub.stageMovements.length > 1 ? (
        <div className="overflow-hidden rounded-md border bg-card">
          <SubHeader title="Historial de la propuesta con IA" />
          <ul className="divide-y">
            {pub.stageMovements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <div className="w-40 shrink-0">
                  <StageBadge stage={m.stage} />
                </div>
                <span className="tabular-nums text-muted-foreground">
                  {formatDateTime(m.enteredAt, timeZone)}
                  {' → '}
                  {m.exitedAt ? formatDateTime(m.exitedAt, timeZone) : 'estado actual'}
                </span>
                <span className="tabular-nums text-muted-foreground">{formatDuration(m.enteredAt, m.exitedAt ?? now)}</span>
                <span className="text-muted-foreground sm:ml-auto">{m.user?.name ?? '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pub.measurements.length > 0 ? (
        <div className="overflow-hidden rounded-md border bg-card">
          <SubHeader title="Mediciones" />
          <div className="divide-y">
            {pub.measurements.map((m) => {
              const metrics = parseMetrics(m.metrics);
              const keys = METRIC_KEYS.filter((k) => metrics[k] !== undefined);
              return (
                <div key={m.id} className="space-y-2 px-4 py-3">
                  <p className="text-sm font-medium">
                    Datos del {new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' }).format(m.takenAt)}
                    <span className="font-normal text-muted-foreground">{m.source === 'IMPORT' ? ' · importados' : ''}</span>
                  </p>
                  <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    {keys.map((k) => (
                      <div key={k} className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">{METRICS[k].label}</dt>
                        <dd className="tabular-nums">{formatMetric(k, metrics[k]!)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Con la tienda conectada, esto llega solo del canal y se sube desde el borrador. */}
      {!connected ? (
        <SectionCard title="Datos cargados a mano" description={`La tienda no está conectada con ${channel.name}: el código, el link, el precio y el estado se cargan acá.`}>
          <SectionBody>
            <PublicationForm
              accountSlug={accountSlug}
              channel={channel}
              mode={{ kind: 'edit', publicationId: pub.id }}
              initial={{
                externalId: pub.externalId ?? '',
                url: pub.url ?? '',
                title: pub.title ?? '',
                description: pub.description ?? '',
                attributes: parseNameValueList(pub.attributes),
                price: priceToInput(pub.price),
                channelStatus: pub.channelStatus,
              }}
            />
          </SectionBody>
        </SectionCard>
      ) : null}
    </>
  );
}
