'use client';

import { KanbanSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addToPipelineAction } from '@/app/a/[cuenta]/publicaciones/pipeline-actions';
import { useAddToPipeline } from '@/components/catalog/useAddToPipeline';
import { cn } from '@/lib/utils/cn';

// Agregar una sola publicación al pipeline, desde su ficha o desde la pantalla del paso.
export function AddToPipelineButton({
  accountSlug,
  publicationId,
  label = 'Agregar al pipeline',
}: {
  accountSlug: string;
  publicationId: string;
  label?: string;
}) {
  const add = useAddToPipeline(accountSlug);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => add.run(() => addToPipelineAction(accountSlug, [publicationId], false))}
        disabled={add.pending}
      >
        <KanbanSquare className="h-4 w-4" />
        {add.pending ? 'Agregando…' : label}
      </Button>
      {add.message?.kind === 'error' ? (
        <span className={cn('text-xs text-destructive')} role="status">
          {add.message.text}
        </span>
      ) : null}
      {add.dialog}
    </span>
  );
}
