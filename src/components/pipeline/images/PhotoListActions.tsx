'use client';

import { useState } from 'react';
import { Archive, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { addChannelPhotosAction, archivePhotoAction } from '@/app/a/[cuenta]/pipeline/image-actions';

// Sumar las fotos que ya están publicadas en el canal.
export function ChannelPhotosButton({
  accountSlug,
  publicationId,
  count,
  channelName,
}: {
  accountSlug: string;
  publicationId: string;
  count: number;
  channelName: string;
}) {
  const { run, pending, status } = useStepAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending || count === 0}
        onClick={() => run(() => addChannelPhotosAction(accountSlug, publicationId))}
        title={count === 0 ? `El producto no tiene fotos publicadas en ${channelName}.` : undefined}
      >
        <Images className="h-4 w-4" />
        {pending ? 'Bajando…' : `Usar las fotos publicadas${count ? ` (${count})` : ''}`}
      </Button>
      <StatusText status={status} />
    </div>
  );
}

// Sacar una foto de la lista. El original queda guardado.
export function ArchivePhotoButton({ accountSlug, editId }: { accountSlug: string; editId: string }) {
  const { run, pending, status } = useStepAction();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirming ? (
        <>
          <span className="text-sm">¿La sacás? El original queda guardado.</span>
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => archivePhotoAction(accountSlug, editId))}>
            Sacar
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(true)}>
          <Archive className="h-4 w-4" />
          Sacar de la lista
        </Button>
      )}
      <StatusText status={status} />
    </div>
  );
}
