'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { titleLockText, type TitleLock } from '@/domain/title-lock';
import { setTitleLockAction } from '@/app/a/[cuenta]/publicaciones/pipeline-actions';

// Si el título está bloqueado en el canal. Lo dicen las ventas de la última
// medición; si no hay datos, se marca a mano.
export function TitleLockControl({
  accountSlug,
  publicationId,
  lock,
}: {
  accountSlug: string;
  publicationId: string;
  lock: TitleLock;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function mark(value: boolean | null) {
    setError(null);
    startTransition(async () => {
      const r = await setTitleLockAction(accountSlug, publicationId, value);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  const Icon = lock.locked ? Lock : LockOpen;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className={lock.locked ? 'inline-flex items-center gap-1.5 text-amber-700' : 'inline-flex items-center gap-1.5 text-muted-foreground'}>
        <Icon className="h-3.5 w-3.5" />
        {titleLockText(lock)}
      </span>
      {lock.source !== 'data' ? (
        <span className="flex flex-wrap gap-1.5">
          {lock.locked !== true ? (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => mark(true)} disabled={pending}>
              Marcar como bloqueado
            </Button>
          ) : null}
          {lock.locked !== false ? (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => mark(false)} disabled={pending}>
              Marcar como libre
            </Button>
          ) : null}
          {lock.source === 'manual' ? (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => mark(null)} disabled={pending}>
              Quitar la marca
            </Button>
          ) : null}
        </span>
      ) : null}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
