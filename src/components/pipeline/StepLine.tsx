'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { PIPELINE_STEPS, PIPELINE_STEP_LABEL, PIPELINE_STEP_SLUG } from '@/domain/pipeline';
import type { PipelineStep } from '@/generated/prisma/enums';
import { cn } from '@/lib/utils/cn';

// La línea de los pasos, en una sola fila: cada uno con su número, su nombre
// y cómo está. Hecho: la publicación ya pasó por ahí; en curso: está ahí;
// pendiente: todavía no pasó, aunque haya pasos después que sí, porque se
// puede saltar a cualquiera. "active" es falso si la publicación no está en
// el pipeline: el paso guardado queda como "quedó acá". Cada paso es un link
// para verlo; el que se está mirando va en negrita, subrayado y con un aro.
// Si no entra, se desliza de costado y arranca en el que se mira.

type State = 'done' | 'current' | 'left' | 'pending';

const STATE_LABEL: Record<State, string> = { done: 'Hecho', current: 'En curso', left: 'Quedó acá', pending: 'Pendiente' };

export function StepLine({
  current,
  active,
  visited,
  viewing,
  baseHref,
}: {
  current: PipelineStep | null;
  active: boolean;
  // Los pasos por los que ya pasó, según su historial.
  visited: PipelineStep[];
  viewing: PipelineStep | null;
  baseHref: string;
}) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const ol = list.current;
    const target = ol?.querySelector<HTMLElement>('[data-viewing="true"]');
    if (!ol || !target || ol.scrollWidth <= ol.clientWidth) return;
    ol.scrollLeft = target.offsetLeft - ol.clientWidth / 2 + target.clientWidth / 2;
  }, [viewing]);

  const been = new Set(visited);
  const stateOf = (step: PipelineStep): State =>
    step === current ? (active ? 'current' : 'left') : been.has(step) ? 'done' : 'pending';

  return (
    <ol ref={list} className="-mx-4 flex overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" aria-label="Pasos del pipeline">
      {PIPELINE_STEPS.map((step, i) => {
        const state = stateOf(step);
        const isViewing = step === viewing;
        const reached = state !== 'pending';
        const prevReached = i > 0 && stateOf(PIPELINE_STEPS[i - 1]) !== 'pending';
        return (
          <li
            key={step}
            data-viewing={isViewing}
            className="relative min-w-[6.5rem] flex-1"
            aria-current={state === 'current' ? 'step' : undefined}
          >
            {i > 0 ? (
              <span
                aria-hidden
                className={cn('absolute right-1/2 top-[1.3125rem] h-0.5 w-full', reached && prevReached ? 'bg-primary/60' : 'bg-border')}
              />
            ) : null}
            <Link
              href={`${baseHref}?paso=${PIPELINE_STEP_SLUG[step]}`}
              aria-label={`Ver ${PIPELINE_STEP_LABEL[step]}, ${STATE_LABEL[state].toLowerCase()}${isViewing ? ', es el que estás viendo' : ''}`}
              className="group relative flex flex-col items-center gap-1 rounded-md px-1 pt-2 pb-1.5 text-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                  isViewing && state !== 'current' && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background',
                  state === 'done' && 'bg-primary text-primary-foreground',
                  state === 'current' && 'border-2 border-primary bg-background',
                  state === 'left' && 'border-2 border-primary/50 bg-background',
                  state === 'pending' && 'border border-border bg-background text-muted-foreground',
                )}
              >
                {state === 'done' ? (
                  <Check className="h-4 w-4" />
                ) : state === 'current' || state === 'left' ? (
                  <span className={cn('h-2.5 w-2.5 rounded-full', state === 'current' ? 'bg-primary' : 'bg-primary/50')} />
                ) : (
                  i + 1
                )}
              </span>
              <span className="text-[11px] text-muted-foreground">Paso {i + 1}</span>
              <span
                className={cn(
                  'text-sm leading-tight underline-offset-4 group-hover:underline',
                  isViewing ? 'font-semibold text-foreground underline decoration-2' : reached ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {PIPELINE_STEP_LABEL[step]}
              </span>
              <span
                className={cn(
                  'text-xs',
                  state === 'done' && 'text-emerald-700 dark:text-emerald-400',
                  state === 'current' && 'font-medium text-primary',
                  (state === 'left' || state === 'pending') && 'text-muted-foreground',
                )}
              >
                {STATE_LABEL[state]}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
