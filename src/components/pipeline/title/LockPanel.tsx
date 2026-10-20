'use client';

import Link from 'next/link';
import { Lock, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { titleLockText, type TitleLock } from '@/domain/title-lock';
import type { TitleLockDecision } from '@/generated/prisma/enums';
import { decideLockAction } from '@/app/a/[cuenta]/pipeline/step-actions';
import { useStepAction } from '../useStepAction';
import { StatusText } from '../StatusText';

// Arriba del paso Título: si el título está bloqueado, qué hacer con él.
export function LockPanel({
  accountSlug,
  publicationId,
  lock,
  decision,
  productHref,
}: {
  accountSlug: string;
  publicationId: string;
  lock: TitleLock;
  decision: TitleLockDecision | null;
  productHref: string;
}) {
  const action = useStepAction();
  const decide = (d: TitleLockDecision | null) => action.run(() => decideLockAction(accountSlug, publicationId, d), undefined, String(d));

  if (lock.locked === false) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <LockOpen className="h-4 w-4" />
        {titleLockText(lock)}
        {lock.source === 'unpublished' ? '' : ' Se puede cambiar.'}
      </p>
    );
  }
  if (lock.locked === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {titleLockText(lock)} Si sabés que tiene ventas,{' '}
        <Link href={productHref} className="text-primary underline-offset-4 hover:underline">
          marcalo en la ficha
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="flex items-start gap-2 text-sm">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <span>
          <strong>{titleLockText(lock)}</strong> El canal no deja cambiar el título de una publicación con ventas.
        </span>
      </p>
      {decision === 'TRY_IN_COPY' ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            Decidiste <strong>probar el título nuevo en la copia con cuotas</strong>. Al aprobarlo se guarda como título
            para la copia y esta publicación no cambia.
          </span>
          <Button size="sm" variant="ghost" pending={action.running('null')} onClick={() => decide(null)} disabled={action.pending}>
            Cambiar decisión
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">Elegí qué hacer:</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" pending={action.running('KEEP')} onClick={() => decide('KEEP')} disabled={action.pending}>
              Mantener título
            </Button>
            <Button size="sm" pending={action.running('TRY_IN_COPY')} onClick={() => decide('TRY_IN_COPY')} disabled={action.pending}>
              Probar en la copia con cuotas
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Mantener título completa este paso sin cambios y pasa a Imágenes. Probar en la copia sigue con el trabajo
            del título.
          </p>
        </div>
      )}
      <StatusText status={action.status} />
    </div>
  );
}
