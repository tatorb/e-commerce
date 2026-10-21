'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { plural } from '@/lib/format';
import { syncVideosAction } from '@/app/a/[cuenta]/pipeline/video-actions';

// Lee la carpeta del producto en el Drive al abrir el paso, así aparecen los
// videos que se agregaron o se borraron desde la Mac. También a pedido.

export function DriveSync({ accountSlug, productId, folderUrl }: { accountSlug: string; productId: string; folderUrl: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(folderUrl);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const started = useRef(false);

  const sync = useCallback(
    async (manual: boolean) => {
      setBusy(true);
      if (manual) setMessage(null);
      const r = await syncVideosAction(accountSlug, productId).catch(() => null);
      setBusy(false);
      if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
      if (!r.ok) return setMessage({ kind: 'error', text: r.error });
      setUrl(r.folderUrl);
      const changes = [
        r.added ? `${plural(r.added, 'video nuevo', 'videos nuevos')} del Drive` : null,
        r.gone ? `${plural(r.gone, 'video que ya no está', 'videos que ya no están')}` : null,
      ].filter(Boolean);
      if (changes.length > 0) setMessage({ kind: 'ok', text: `En la carpeta: ${changes.join(' y ')}.` });
      else if (manual) setMessage({ kind: 'ok', text: 'La carpeta está igual.' });
      if (r.added || r.gone || r.updated) router.refresh();
    },
    [accountSlug, productId, router],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void sync(false);
  }, [sync]);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir la carpeta en el Drive
        </a>
      ) : null}
      <Button size="sm" variant="ghost" onClick={() => void sync(true)} pending={busy} disabled={busy}>
        <RefreshCw />
        {busy ? 'Revisando la carpeta…' : 'Revisar la carpeta'}
      </Button>
      {message ? (
        <span role="status" className={message.kind === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
