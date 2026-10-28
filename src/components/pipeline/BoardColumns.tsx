'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, GripVertical, Layers, ListTodo, Lock } from 'lucide-react';
import { ScoreBadge } from '@/components/stages/ScoreBadge';
import { KindBadge } from '@/components/products/KindBadge';
import { codeOrUnpublished } from '@/domain/channel-status';
import { PIPELINE_STEPS, PIPELINE_STEP_LABEL } from '@/domain/pipeline';
import { titleOrUntitled } from '@/domain/publication-title';
import type { PipelineStep, ProductKind } from '@/generated/prisma/enums';
import { formatDuration, plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { READ_ONLY_HINT, useReadOnly } from '@/components/access/AccessProvider';
import { jumpStepAction } from '@/app/a/[cuenta]/pipeline/actions';
import { RemoveFromPipelineDialog } from './RemoveFromPipelineDialog';

// Las columnas del tablero, una por paso. Cada tarjeta se arrastra a otra
// columna, o se mueve con su menú "Mover a" (en el celular, donde arrastrar
// es incómodo), a cualquier paso: los del medio se saltan. Se mueve en
// pantalla enseguida y, si la app no puede, vuelve a donde estaba con el motivo.

export type BoardCardData = {
  id: string;
  title: string | null;
  externalId: string | null;
  // El código del producto, por ejemplo SP-808.
  code: string | null;
  storeName: string;
  kind: ProductKind;
  score: number | null;
  sales: number | null;
  // Desde cuándo está en su paso, como texto ISO.
  stepSince: string | null;
  lock: string | null;
  step: PipelineStep;
  // Cuántas medidas tiene su familia; 0 si no es de una familia.
  familySize?: number;
};

export function BoardColumns({
  accountSlug,
  cards,
  now,
  showStore,
  openTasks,
}: {
  accountSlug: string;
  cards: BoardCardData[];
  now: string;
  showStore: boolean;
  openTasks: Record<string, number>;
}) {
  const router = useRouter();
  // Sin permiso para cambiar en el Pipeline, las tarjetas no se arrastran ni se mueven.
  const readOnly = useReadOnly();
  // Las que se movieron y la página todavía no volvió a cargar.
  const [moved, setMoved] = useState<Record<string, PipelineStep>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<PipelineStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Cuando la página vuelve a cargar, manda lo que dice la app.
  const [seen, setSeen] = useState(cards);
  if (seen !== cards) {
    setSeen(cards);
    setMoved({});
  }

  const stepOf = (c: BoardCardData) => moved[c.id] ?? c.step;

  function move(card: BoardCardData, to: PipelineStep) {
    const from = stepOf(card);
    if (to === from || busy) return;
    setError(null);
    setMoved((m) => ({ ...m, [card.id]: to }));
    setBusy(card.id);
    startTransition(async () => {
      const r = await jumpStepAction(accountSlug, card.id, from, to).catch(() => null);
      setBusy(null);
      if (r?.ok) return router.refresh();
      setMoved((m) => ({ ...m, [card.id]: from }));
      setError(`${titleOrUntitled(card.title)}: ${r ? r.error : 'se cortó la conexión con la app.'}`);
    });
  }

  const dropOn = (step: PipelineStep, id: string) => {
    const card = cards.find((c) => c.id === id);
    if (card) move(card, step);
  };

  return (
    <div className="space-y-2">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:snap-none md:px-0">
        {PIPELINE_STEPS.map((step) => {
          const inStep = cards.filter((c) => stepOf(c) === step);
          const target = over === step && dragging !== null && cards.some((c) => c.id === dragging && stepOf(c) !== step);
          return (
            <section
              key={step}
              aria-label={PIPELINE_STEP_LABEL[step]}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (over !== step) setOver(step);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === step ? null : o));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain') || dragging;
                setOver(null);
                setDragging(null);
                if (id) dropOn(step, id);
              }}
              className={cn(
                'flex w-[82vw] max-w-xs shrink-0 snap-start flex-col rounded-lg bg-muted/50 transition-colors md:w-auto md:min-w-60 md:max-w-none md:flex-1',
                target && 'bg-primary/10 ring-2 ring-primary/40',
              )}
            >
              <header className="flex items-center justify-between gap-2 px-3 py-2.5">
                <h2 className="text-sm font-semibold">{PIPELINE_STEP_LABEL[step]}</h2>
                <span className="rounded-full border bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{inStep.length}</span>
              </header>
              {inStep.length === 0 ? (
                <p className="mx-2 mb-2 rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  {target ? 'Soltala acá.' : 'Ninguna en este paso.'}
                </p>
              ) : (
                <ul className="space-y-2 px-2 pb-2">
                  {inStep.map((card) => (
                    <BoardCard
                      key={card.id}
                      accountSlug={accountSlug}
                      card={card}
                      step={step}
                      now={now}
                      showStore={showStore}
                      tasks={openTasks[card.id] ?? 0}
                      busy={busy === card.id}
                      readOnly={readOnly}
                      dragging={dragging === card.id}
                      onDragStart={() => setDragging(card.id)}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onMove={(to) => move(card, to)}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({
  accountSlug,
  card,
  step,
  now,
  showStore,
  tasks,
  busy,
  readOnly,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  accountSlug: string;
  card: BoardCardData;
  // El paso en que se muestra, que puede ser uno al que se acaba de mover.
  step: PipelineStep;
  now: string;
  showStore: boolean;
  // Sus tareas abiertas.
  tasks: number;
  busy: boolean;
  readOnly: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (to: PipelineStep) => void;
}) {
  const title = titleOrUntitled(card.title);
  return (
    <li
      draggable={!busy && !readOnly}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', card.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      aria-busy={busy || undefined}
      className={cn(
        'rounded-xl border bg-card text-card-foreground shadow-card transition-colors hover:border-foreground/25',
        !readOnly && 'md:cursor-grab',
        dragging && 'opacity-50',
        busy && 'opacity-70',
      )}
    >
      <Link href={`/a/${accountSlug}/pipeline/${card.id}`} draggable={false} className="block space-y-2 px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('line-clamp-3 text-sm font-medium leading-snug', !card.title && 'text-muted-foreground')}>{title}</p>
          {card.lock ? (
            <span title={card.lock} aria-label={card.lock} className="mt-0.5 shrink-0 text-amber-700">
              <Lock className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {card.code ? (
            <span title="Código del producto" className="rounded border bg-background px-1.5 py-px font-semibold tracking-wide text-foreground">
              {card.code}
            </span>
          ) : null}
          {card.familySize && card.familySize > 1 ? (
            <span title="Las medidas de la familia se mueven juntas" className="inline-flex items-center gap-1 font-medium text-foreground">
              <Layers className="h-3 w-3" />
              Familia de {card.familySize} medidas
            </span>
          ) : (
            codeOrUnpublished(card.externalId)
          )}
          {showStore ? <span>· {card.storeName}</span> : null}
          <KindBadge kind={card.kind} />
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <ScoreBadge score={card.score} />
          <span>{card.sales === null ? 'Ventas sin dato' : plural(card.sales, 'venta')}</span>
          {card.stepSince && step === card.step ? (
            <span className="inline-flex items-center gap-1" title="Tiempo en este paso">
              <Clock className="h-3 w-3" />
              {formatDuration(new Date(card.stepSince), new Date(now))}
            </span>
          ) : null}
          {tasks > 0 ? (
            <span className="inline-flex items-center gap-1 font-medium text-foreground" title={plural(tasks, 'tarea abierta', 'tareas abiertas')}>
              <ListTodo className="h-3 w-3" />
              {tasks}
            </span>
          ) : null}
        </div>
      </Link>
      <div className="flex items-center justify-between gap-1 border-t px-1 py-1">
        <span className="flex min-w-0 items-center gap-0.5">
          {!readOnly ? <GripVertical className="hidden h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground md:block" aria-hidden /> : null}
          <select
            value=""
            disabled={busy || readOnly}
            title={readOnly ? READ_ONLY_HINT : undefined}
            onChange={(e) => {
              if (e.target.value) onMove(e.target.value as PipelineStep);
            }}
            aria-label={`Mover ${title} a otro paso`}
            className="h-7 w-[6.5rem] min-w-0 rounded-md border-0 bg-transparent px-1.5 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">{busy ? 'Moviendo…' : 'Mover a…'}</option>
            {PIPELINE_STEPS.filter((s) => s !== step).map((s) => (
              <option key={s} value={s}>
                {PIPELINE_STEP_LABEL[s]}
              </option>
            ))}
          </select>
        </span>
        <RemoveFromPipelineDialog accountSlug={accountSlug} publicationId={card.id} title={title} step={step} compact />
      </div>
    </li>
  );
}
