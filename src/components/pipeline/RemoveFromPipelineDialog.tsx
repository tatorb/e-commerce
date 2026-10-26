'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CircleSlash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PIPELINE_REMOVALS, PIPELINE_REMOVAL_LABEL, PIPELINE_STEP_LABEL } from '@/domain/pipeline';
import type { PipelineRemoval, PipelineStep } from '@/generated/prisma/enums';
import { removeFromPipelineAction } from '@/app/a/[cuenta]/pipeline/actions';
import { cn } from '@/lib/utils/cn';

// Sacar una publicación del pipeline, con un motivo. No borra nada: si se
// vuelve a agregar, retoma en el mismo paso.
export function RemoveFromPipelineDialog({
  accountSlug,
  publicationId,
  title,
  step,
  compact,
}: {
  accountSlug: string;
  publicationId: string;
  title: string;
  step: PipelineStep;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<PipelineRemoval | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      const r = await removeFromPipelineAction(accountSlug, publicationId, step, reason);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setReason(null);
          setError(null);
        }
      }}
    >
      <Button
        size="sm"
        variant="ghost"
        className={compact ? 'h-7 px-2 text-xs text-muted-foreground' : undefined}
        aria-label={compact ? 'Sacar del pipeline' : undefined}
        title={compact ? 'Sacar del pipeline' : undefined}
        onClick={() => setOpen(true)}
      >
        <CircleSlash className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        {compact ? 'Sacar' : 'Sacar del pipeline'}
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sacar del pipeline</DialogTitle>
          <DialogDescription>
            «{title}». No se borra nada. Si la volvés a agregar, retoma en {PIPELINE_STEP_LABEL[step]}.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">¿Por qué la sacás?</legend>
          {PIPELINE_REMOVALS.map((r) => (
            <label
              key={r}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors',
                reason === r ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
              )}
            >
              <input
                type="radio"
                name="motivo"
                value={r}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
                checked={reason === r}
                onChange={() => setReason(r)}
              />
              {PIPELINE_REMOVAL_LABEL[r]}
            </label>
          ))}
        </fieldset>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button pending={pending} onClick={submit} disabled={pending || !reason}>
            {pending ? 'Sacando…' : 'Sacar del pipeline'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
