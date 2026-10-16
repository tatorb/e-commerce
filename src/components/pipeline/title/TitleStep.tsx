import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buildSeeds } from '@/domain/titles';
import { structureFor } from '@/domain/title-rules';
import type { TitleContext } from '@/lib/queries/title-step';
import { formatDateTime } from '@/lib/format';
import { LockPanel } from './LockPanel';
import { PositionsPanel } from './PositionsPanel';
import { SeedsPanel } from './SeedsPanel';
import { SuggestionsPanel } from './SuggestionsPanel';
import { TitleComposer } from './TitleComposer';
import { WordMapPanel } from './WordMapPanel';

// Paso Título: del bloqueo a las búsquedas, las palabras, la posición de hoy y
// el título nuevo.

function Section({ n, title, description, children }: { n: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs tabular-nums">{n}</span>
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function TitleStep({
  accountSlug,
  timeZone,
  ctx,
  auto,
  aiDisabledReason,
}: {
  accountSlug: string;
  timeZone: string;
  ctx: TitleContext;
  auto: { suggestions: boolean; positions: boolean };
  aiDisabledReason: string | null;
}) {
  const id = ctx.publication.id;
  const structure = structureFor(ctx.rules, ctx.product.productType);
  const words = ctx.words.map((w) => ({ ...w, order: Number.isFinite(w.order) ? w.order : 1e9 }));
  const usable = ctx.words.filter((w) => w.status === 'use').map((w) => w.word);
  const last = ctx.lastApproval;

  return (
    <>
      <Section n={1} title="Bloqueo del título">
        <LockPanel
          accountSlug={accountSlug}
          publicationId={id}
          lock={ctx.titleLock}
          decision={ctx.lockDecision}
          productHref={`/a/${accountSlug}/productos/${ctx.publication.productId}`}
        />
      </Section>
      <Section n={2} title="Semillas" description="Lo que se escribe en el buscador para ver qué sugiere. Salen de la ficha.">
        <SeedsPanel
          key={ctx.seeds.join('|')}
          accountSlug={accountSlug}
          publicationId={id}
          seeds={ctx.seeds}
          fromFicha={buildSeeds(ctx.product)}
          saved={ctx.seedsSaved}
        />
      </Section>
      <Section n={3} title="Sugerencias del buscador" description="Lo que completa el buscador para cada semilla, con su fecha.">
        <SuggestionsPanel
          accountSlug={accountSlug}
          publicationId={id}
          seeds={ctx.seeds}
          captures={ctx.captures}
          auto={auto.suggestions}
          channelName={ctx.channel.name}
          timeZone={timeZone}
        />
      </Section>
      <Section
        n={4}
        title="Mapa de palabras"
        description="Las palabras de las sugerencias y de la competencia. Tildá las que van en el título y descartá las que no."
      >
        <WordMapPanel key={ctx.words.length} accountSlug={accountSlug} publicationId={id} words={words} />
      </Section>
      <Section n={5} title="Posición actual" description="La foto del antes: dónde aparece hoy la publicación.">
        <PositionsPanel
          accountSlug={accountSlug}
          publicationId={id}
          mainSearches={ctx.mainSearches}
          candidates={ctx.suggestions}
          positions={ctx.positions}
          auto={auto.positions}
          channelKind={ctx.channel.kind}
          channelName={ctx.channel.name}
          timeZone={timeZone}
        />
      </Section>
      <Section
        n={6}
        title="Título nuevo"
        description={[
          ctx.rules.maxLength ? `Hasta ${ctx.rules.maxLength} caracteres.` : null,
          structure ? `Estructura sugerida: ${structure}.` : null,
          `Hoy: «${ctx.publication.title ?? 'sin título'}».`,
          last && last.title
            ? `Último aprobado: «${last.title}» el ${formatDateTime(last.createdAt, timeZone)}${last.user ? ` por ${last.user.name}` : ''}.`
            : null,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <TitleComposer
          accountSlug={accountSlug}
          publicationId={id}
          currentTitle={ctx.publication.title}
          proposals={ctx.proposals}
          rules={ctx.rules}
          suggestions={ctx.suggestions}
          usableWords={usable}
          locked={ctx.titleLock.locked}
          decision={ctx.lockDecision}
          aiDisabledReason={aiDisabledReason}
        />
      </Section>
    </>
  );
}
