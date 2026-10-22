'use client';

import { useState } from 'react';
import { Archive, Images, Lock, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/pipeline/StatusText';
import { useStepAction } from '@/components/pipeline/useStepAction';
import { addChannelPhotosAction, archivePhotoAction, setPhotoAsIsAction } from '@/app/a/[cuenta]/pipeline/image-actions';

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
        pending={pending}
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
          <Button size="sm" variant="destructive" pending={pending} disabled={pending} onClick={() => run(() => archivePhotoAction(accountSlug, editId))}>
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

// Usar el original tal cual, porque ya viene editado, o volver a corregirlo en la Mac.
export function AsIsButton({
  accountSlug,
  publicationId,
  editId,
  asIs,
  problem,
}: {
  accountSlug: string;
  publicationId: string;
  editId: string;
  asIs: boolean;
  // Por qué el canal no la acepta tal cual, si es el caso.
  problem: string | null;
}) {
  const { run, pending, status } = useStepAction();
  const [confirming, setConfirming] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  if (asIs) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" pending={pending} disabled={pending} onClick={() => run(() => setPhotoAsIsAction(accountSlug, publicationId, editId, false))}>
          <Wand2 className="h-4 w-4" />
          Corregirla en la Mac
        </Button>
        <StatusText status={status} />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirming ? (
        <>
          <span className="text-sm">¿La usás tal cual? Si la Mac la estaba corrigiendo, se corta.</span>
          <Button
            size="sm"
            pending={pending}
            disabled={pending}
            onClick={() => run(() => setPhotoAsIsAction(accountSlug, publicationId, editId, true), () => setConfirming(false))}
          >
            Usar tal cual
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => (problem ? setWhy(problem) : setConfirming(true))}>
          <Lock className="h-4 w-4" />
          Usar el original tal cual
        </Button>
      )}
      {why ? <span className="text-sm text-destructive">{why}</span> : null}
      <StatusText status={status} />
    </div>
  );
}
