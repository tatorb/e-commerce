'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { PIPELINE_STEPS, PIPELINE_STEP_LABEL, PIPELINE_STEP_SLUG } from '@/domain/pipeline';
import type { PipelineStep } from '@/generated/prisma/enums';
import { cn } from '@/lib/utils/cn';

// La línea de los pasos, en una sola fila: cada uno con su número, su nombre
// y cómo está, alineados a la izquierda bajo su círculo, y una raya hasta el
// siguiente. Hecho: la publicación ya pasó por ahí; en curso: está ahí;
// pendiente: todavía no pasó, aunque haya pasos después que sí, porque se
// puede saltar a cualquiera. "active" es falso si la publicación no está en
// el pipeline: el paso guardado queda como "quedó acá". Cada paso es un link
// para verlo; el que se está mirando es el único en negrita, y su círculo lleva un aro.
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
        const last = i === PIPELINE_STEPS.length - 1;
        const nextReached = !last && stateOf(PIPELINE_STEPS[i + 1]) !== 'pending';
        return (
          <li
            key={step}
            data-viewing={isViewing}
            // El último no lleva raya: ocupa solo lo suyo, así los demás se reparten el ancho.
            className={cn('relative min-w-[8rem]', last ? 'flex-none' : 'flex-1')}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            {!last ? (
              <span
                aria-hidden
                className={cn('absolute left-9 right-2 top-[1.3125rem] h-0.5 rounded-full', reached && nextReached ? 'bg-primary/60' : 'bg-muted-foreground/25')}
              />
            ) : null}
            <Link
              href={`${baseHref}?paso=${PIPELINE_STEP_SLUG[step]}`}
              aria-label={`Ver ${PIPELINE_STEP_LABEL[step]}, ${STATE_LABEL[state].toLowerCase()}${isViewing ? ', es el que estás viendo' : ''}`}
              className="group relative flex flex-col items-start gap-1 rounded-md pt-2 pb-1.5 pr-3 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  'mb-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                  isViewing && state !== 'current' && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background',
                  state === 'done' && 'bg-primary text-primary-foreground',
                  state === 'current' && 'border-2 border-primary bg-background',
                  state === 'left' && 'border-2 border-primary/50 bg-background',
                  state === 'pending' && 'border border-muted-foreground/40 bg-background text-muted-foreground',
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
              {/* El número y el estado en el mismo renglón: si el nombre ocupa dos, no corre nada. */}
              <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                Paso {i + 1} ·{' '}
                <span
                  className={cn(
                    state === 'done' && 'text-emerald-700 dark:text-emerald-400',
                    state === 'current' && 'font-medium text-primary',
                  )}
                >
                  {STATE_LABEL[state]}
                </span>
              </span>
              <span
                className={cn(
                  'text-sm leading-tight group-hover:text-foreground',
                  isViewing ? 'font-semibold text-foreground' : reached ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {PIPELINE_STEP_LABEL[step]}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
