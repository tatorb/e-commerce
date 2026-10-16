'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateProposalAction } from '@/app/a/[cuenta]/publicaciones/proposal-actions';

// Pide la propuesta de una publicación. Tarda entre medio minuto y un minuto y medio.
export function GenerateProposalButton({
  accountSlug,
  publicationId,
  hasProposal,
  disabledReason,
}: {
  accountSlug: string;
  publicationId: string;
  hasProposal: boolean;
  disabledReason: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await generateProposalAction(accountSlug, publicationId);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        router.refresh();
      } catch {
        setError('Se cortó la conexión con la app. Probá de nuevo.');
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant={hasProposal ? 'outline' : 'default'}
          onClick={generate}
          disabled={pending || disabledReason !== null}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
          {pending ? 'Generando…' : hasProposal ? 'Volver a generar' : 'Generar propuesta con IA'}
        </Button>
        {pending ? (
          <span className="text-sm text-muted-foreground">Puede tardar hasta un minuto y medio. No cierres esta pestaña.</span>
        ) : null}
      </div>
      {disabledReason ? <p className="text-sm text-muted-foreground">{disabledReason}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
