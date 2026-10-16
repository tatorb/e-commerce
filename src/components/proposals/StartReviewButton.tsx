'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startReviewAction } from '@/app/a/[cuenta]/publicaciones/review-actions';

// Pasa la publicación a "En revisión" y abre la pantalla de revisión. La
// etapa cambia con este botón y no al abrir la página: el navegador a veces
// carga páginas por adelantado.
export function StartReviewButton({
  accountSlug,
  proposalId,
  href,
  size = 'sm',
}: {
  accountSlug: string;
  proposalId: string;
  href: string;
  size?: 'sm' | 'default';
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setError(null);
    startTransition(async () => {
      const r = await startReviewAction(accountSlug, proposalId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(href);
      router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <Button type="button" size={size} onClick={start} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
        Revisar propuesta
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
