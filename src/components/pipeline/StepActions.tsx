'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { nextStep, PIPELINE_STEP_LABEL, previousStep } from '@/domain/pipeline';
import type { PipelineStep } from '@/generated/prisma/enums';
import { moveStepAction } from '@/app/a/[cuenta]/pipeline/actions';
import { RemoveFromPipelineDialog } from './RemoveFromPipelineDialog';

// Los botones de abajo de cada paso: volver, avanzar o, en el último, marcarla como corregida.
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {previous ? (
          <Button variant="outline" onClick={() => move('back')} disabled={pending}>
            <ArrowLeft className="h-4 w-4" />
            Volver a {PIPELINE_STEP_LABEL[previous]}
          </Button>
        ) : null}
        {next ? (
          <Button pending={pending} onClick={() => move('advance')} disabled={pending}>
            {pending ? 'Moviendo…' : `Avanzar a ${PIPELINE_STEP_LABEL[next]}`}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button pending={pending} onClick={() => move('complete')} disabled={pending || completeBlocked !== null}>
            <Check className="h-4 w-4" />
            {pending ? 'Guardando…' : 'Marcar como corregida'}
          </Button>
        )}
        {!next && completeBlocked ? <span className="text-sm text-muted-foreground">{completeBlocked}</span> : null}
        <span className="sm:ml-auto">
          <RemoveFromPipelineDialog accountSlug={accountSlug} publicationId={publicationId} title={title} step={step} />
        </span>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
