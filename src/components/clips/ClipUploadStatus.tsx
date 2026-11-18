'use client';

import { useState } from 'react';
import { ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClipUploader } from './clip-uploader';

/** Cómo va la subida de un clip a Mercado Libre por la extensión. Nada si no se pidió. */
export function ClipUploadStatus({ videoId }: { videoId: string }) {
  const progress = useClipUploader().progress[videoId];
  const [copied, setCopied] = useState(false);
  if (!progress) return null;
  return (
    <div className="space-y-2">
      <p role="status" className={progress.error ? 'text-sm text-destructive' : progress.done ? 'text-sm font-medium' : 'text-sm text-muted-foreground'}>
        {progress.error ?? progress.text}
      </p>
      {progress.reports.length > 0 && !progress.uploaded ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(JSON.stringify(progress.reports, null, 2));
            setCopied(true);
          }}
        >
          <ClipboardCopy />
          {copied ? 'Informe copiado' : 'Copiar el informe de la pantalla'}
        </Button>
      ) : null}
    </div>
  );
}
