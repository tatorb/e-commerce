'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { plural } from '@/lib/format';
import { syncVideosAction } from '@/app/a/[cuenta]/pipeline/video-actions';
import { syncOriginalsAction } from '@/app/a/[cuenta]/pipeline/image-actions';

// Lee la carpeta del producto en el Drive al abrir el paso, así aparece lo que
// se agregó o se borró desde la Mac. También a pedido. Videos lee la carpeta
// Videos; Imágenes lee Originales, y las fotos nuevas entran a la línea.

type Target = { kind: 'videos'; productId: string } | { kind: 'fotos'; publicationId: string };
type Outcome = { ok: true; folderUrl: string | null; changed: boolean; text: string | null } | { ok: false; error: string };

async function syncTarget(accountSlug: string, target: Target): Promise<Outcome> {
  if (target.kind === 'videos') {
    const r = await syncVideosAction(accountSlug, target.productId);
    if (!r.ok) return r;
    const changes = [
      r.added ? `${plural(r.added, 'video nuevo', 'videos nuevos')} del Drive` : null,
      r.gone ? plural(r.gone, 'video que ya no está', 'videos que ya no están') : null,
    ].filter(Boolean);
    return { ok: true, folderUrl: r.folderUrl, changed: Boolean(r.added || r.gone || r.updated), text: changes.length > 0 ? `En la carpeta: ${changes.join(' y ')}.` : null };
  }
  const r = await syncOriginalsAction(accountSlug, target.publicationId);
  if (!r.ok) return r;
  const parts = [
    r.added ? `${plural(r.added, 'foto nueva', 'fotos nuevas')} en Originales: ${r.added === 1 ? 'entró' : 'entraron'} a la línea.` : null,
    ...r.skipped,
  ].filter(Boolean);
  return { ok: true, folderUrl: r.folderUrl, changed: r.added > 0, text: parts.length > 0 ? parts.join(' ') : null };
}

export function DriveSync({ accountSlug, target, folderUrl, label }: { accountSlug: string; target: Target; folderUrl: string | null; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(folderUrl);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const started = useRef(false);
  const key = JSON.stringify(target);

  const sync = useCallback(
    async (manual: boolean) => {
      setBusy(true);
      if (manual) setMessage(null);
      const r = await syncTarget(accountSlug, JSON.parse(key) as Target).catch(() => null);
      setBusy(false);
      if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
      if (!r.ok) return setMessage({ kind: 'error', text: r.error });
      setUrl(r.folderUrl);
      if (r.text) setMessage({ kind: 'ok', text: r.text });
      else if (manual) setMessage({ kind: 'ok', text: 'La carpeta está igual.' });
      if (r.changed) router.refresh();
    },
    [accountSlug, key, router],
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
          {label}
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
