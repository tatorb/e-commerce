'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ChevronDown, MoveRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { nextStep, PIPELINE_STEP_LABEL, PIPELINE_STEPS, previousStep } from '@/domain/pipeline';
import type { PipelineStep } from '@/generated/prisma/enums';
import { jumpStepAction, moveStepAction } from '@/app/a/[cuenta]/pipeline/actions';
import { RemoveFromPipelineDialog } from './RemoveFromPipelineDialog';

// Los botones de abajo de cada paso: volver, avanzar o, en el último, marcarla
// como corregida. Pegada al botón principal, una flecha abre la lista de los
// pasos para llevarla a cualquier otro, saltando los del medio.
export function StepActions({
  accountSlug,
  publicationId,
  title,
  step,
  completeBlocked = null,
}: {
  accountSlug: string;
  publicationId: string;
  title: string;
  step: PipelineStep;
  // Por qué todavía no se puede marcar como corregida, por ejemplo si falta el ID.
  completeBlocked?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const next = nextStep(step);
  const previous = previousStep(step);

  function move(kind: 'advance' | 'back' | 'complete') {
    setError(null);
    startTransition(async () => {
      const r = await moveStepAction(accountSlug, publicationId, step, kind);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  // Lleva a otro paso y abre ese paso.
  function jump(to: PipelineStep) {
    setError(null);
    startTransition(async () => {
      const r = await jumpStepAction(accountSlug, publicationId, step, to).catch(() => null);
      if (!r) return setError('Se cortó la conexión con la app.');
      if (!r.ok) return setError(r.error);
      router.push(`/a/${accountSlug}/pipeline/${publicationId}`);
      router.refresh();
    });
  }

  const others = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={pending}
          aria-label="Elegir otro paso"
          title="Elegir otro paso"
          className="rounded-l-none border-l border-primary-foreground/25 px-2"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Mover a otro paso</DropdownMenuLabel>
        {PIPELINE_STEPS.map((s, i) =>
          s === step ? null : (
            <DropdownMenuItem key={s} onSelect={() => jump(s)}>
              <span className="w-4 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              {PIPELINE_STEP_LABEL[s]}
              {s === next ? <span className="ml-auto text-xs text-muted-foreground">siguiente</span> : null}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {previous ? (
          <Button variant="outline" onClick={() => move('back')} disabled={pending}>
            <ArrowLeft className="h-4 w-4" />
            Volver a {PIPELINE_STEP_LABEL[previous]}
          </Button>
        ) : null}
        <span className="inline-flex">
          {next ? (
            <Button className="rounded-r-none" pending={pending} onClick={() => move('advance')} disabled={pending}>
              {pending ? 'Moviendo…' : `Avanzar a ${PIPELINE_STEP_LABEL[next]}`}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button className="rounded-r-none" pending={pending} onClick={() => move('complete')} disabled={pending || completeBlocked !== null}>
              <Check className="h-4 w-4" />
              {pending ? 'Guardando…' : 'Marcar como corregida'}
            </Button>
          )}
          {others}
        </span>
        {!next && completeBlocked ? <span className="text-sm text-muted-foreground">{completeBlocked}</span> : null}
        <span className="sm:ml-auto">
          <RemoveFromPipelineDialog accountSlug={accountSlug} publicationId={publicationId} title={title} step={step} />
        </span>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

/** Lleva la publicación al paso que se está mirando, saltando los del medio. */
export function JumpHereButton({ accountSlug, publicationId, from, to }: { accountSlug: string; publicationId: string; from: PipelineStep; to: PipelineStep }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function jump() {
    setError(null);
    startTransition(async () => {
      const r = await jumpStepAction(accountSlug, publicationId, from, to).catch(() => null);
      if (!r) return setError('Se cortó la conexión con la app.');
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" pending={pending} onClick={jump} disabled={pending}>
        <MoveRight className="h-4 w-4" />
        {pending ? 'Moviendo…' : `Mover la publicación a ${PIPELINE_STEP_LABEL[to]}`}
      </Button>
      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
    </>
  );
}
