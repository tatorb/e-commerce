import Link from 'next/link';
import { Clock, Lock } from 'lucide-react';
import { ScoreBadge } from '@/components/stages/ScoreBadge';
import { KindBadge } from '@/components/products/KindBadge';
import { codeOrUnpublished } from '@/domain/channel-status';
import { PIPELINE_STEPS, PIPELINE_STEP_LABEL } from '@/domain/pipeline';
import { titleLockText } from '@/domain/title-lock';
import type { BoardItem } from '@/lib/queries/pipeline';
import { formatDuration, plural } from '@/lib/format';
import { RemoveFromPipelineDialog } from './RemoveFromPipelineDialog';

// Tablero del pipeline: una columna por paso. En el celular se desliza de costado.

function BoardCard({ accountSlug, item, now, showStore }: { accountSlug: string; item: BoardItem; now: Date; showStore: boolean }) {
  const lock = item.titleLock.locked ? titleLockText(item.titleLock) : null;
  return (
    <li className="rounded-lg border bg-card text-card-foreground shadow-sm transition-colors hover:border-foreground/25">
      <Link href={`/a/${accountSlug}/pipeline/${item.id}`} className="block space-y-2 px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-3 text-sm font-medium leading-snug">{item.title}</p>
          {lock ? (
            <span title={lock} aria-label={lock} className="mt-0.5 shrink-0 text-amber-700">
              <Lock className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {codeOrUnpublished(item.externalId)}
          {showStore ? <span>· {item.storeName}</span> : null}
          <KindBadge kind={item.kind} />
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <ScoreBadge score={item.score} />
          <span>{item.sales === null ? 'Ventas sin dato' : plural(item.sales, 'venta')}</span>
          {item.stepSince ? (
            <span className="inline-flex items-center gap-1" title="Tiempo en este paso">
              <Clock className="h-3 w-3" />
              {formatDuration(item.stepSince, now)}
            </span>
          ) : null}
        </div>
      </Link>
      {item.pipelineStep ? (
        <div className="flex justify-end border-t px-1 py-1">
          <RemoveFromPipelineDialog
            accountSlug={accountSlug}
            publicationId={item.id}
            title={item.title}
            step={item.pipelineStep}
            compact
          />
        </div>
      ) : null}
    </li>
  );
}

export function PipelineBoard({
  accountSlug,
  items,
  showStore = false,
}: {
  accountSlug: string;
  items: BoardItem[];
  // La tienda de cada tarjeta, cuando la cuenta tiene más de una.
  showStore?: boolean;
}) {
  const now = new Date();
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:snap-none md:px-0">
      {PIPELINE_STEPS.map((step) => {
        const cards = items.filter((i) => i.pipelineStep === step);
        return (
          <section
            key={step}
            aria-label={PIPELINE_STEP_LABEL[step]}
            className="flex w-[82vw] max-w-xs shrink-0 snap-start flex-col rounded-lg bg-muted/50 md:w-64"
          >
            <header className="flex items-center justify-between gap-2 px-3 py-2.5">
              <h2 className="text-sm font-semibold">{PIPELINE_STEP_LABEL[step]}</h2>
              <span className="rounded-full border bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {cards.length}
              </span>
            </header>
            {cards.length === 0 ? (
              <p className="mx-2 mb-2 rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                Ninguna en este paso.
              </p>
            ) : (
              <ul className="space-y-2 px-2 pb-2">
                {cards.map((item) => (
                  <BoardCard key={item.id} accountSlug={accountSlug} item={item} now={now} showStore={showStore} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
