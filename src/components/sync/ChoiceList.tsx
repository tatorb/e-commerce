'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FACE_FIELD_LABEL } from '@/domain/channel-sync';
import { titleOrUntitled } from '@/domain/publication-title';
import type { ChoiceRow } from '@/lib/queries/sync';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { chooseFacesAction } from '@/app/a/[cuenta]/sincronizacion/actions';

// De a cuántas se muestran, para no armar una página enorme.
const PAGE = 30;

type Side = 'channel' | 'app';

// Las publicaciones con datos distintos en la app y en el canal, para elegir
// cuál queda. Lo del canal se trae a la app; lo de la app queda como borrador
// para subir más adelante.
export function ChoiceList({ accountSlug, rows }: { accountSlug: string; rows: ChoiceRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const untouched = useMemo(() => rows.filter((r) => !r.worked).map((r) => r.id), [rows]);
  const channelName = rows[0]?.channelName ?? 'el canal';

  async function choose(ids: string[], side: Side, key: string) {
    if (ids.length === 0) return;
    setBusy(key);
    setMessage(null);
    const r = await chooseFacesAction(accountSlug, { publicationIds: ids, side }).catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    setMessage({
      kind: 'ok',
      text:
        side === 'channel'
          ? `Listo: ${plural(r.publications, 'publicación', 'publicaciones')} tomaron lo de ${channelName}.`
          : `Listo: ${plural(r.publications, 'publicación', 'publicaciones')} quedaron con lo de la app, como borrador para subir.`,
    });
  }

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const chosen = [...selected];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 text-sm">
        <span className="text-muted-foreground">Seleccionar:</span>
        <button type="button" className="underline-offset-4 hover:underline" onClick={() => setSelected(new Set(rows.map((r) => r.id)))}>
          todas
        </button>
        {untouched.length > 0 && untouched.length < rows.length ? (
          <button type="button" className="underline-offset-4 hover:underline" onClick={() => setSelected(new Set(untouched))}>
            las que no pasaron por el pipeline
          </button>
        ) : null}
        {chosen.length > 0 ? (
          <button type="button" className="underline-offset-4 hover:underline" onClick={() => setSelected(new Set())}>
            ninguna
          </button>
        ) : null}
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
          <Button size="sm" disabled={chosen.length === 0 || busy !== null} pending={busy === 'bulk-channel'} onClick={() => choose(chosen, 'channel', 'bulk-channel')}>
            Usar lo de {channelName}
            {chosen.length > 0 ? ` (${chosen.length})` : ''}
          </Button>
          <Button size="sm" variant="outline" disabled={chosen.length === 0 || busy !== null} pending={busy === 'bulk-app'} onClick={() => choose(chosen, 'app', 'bulk-app')}>
            Mantener lo de la app
            {chosen.length > 0 ? ` (${chosen.length})` : ''}
          </Button>
        </div>
        {message ? (
          <p className={cn('basis-full text-sm', message.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
            {message.text}
          </p>
        ) : null}
      </div>

      <ul className="divide-y">
        {rows.slice(0, shown).map((row) => (
          <li key={row.id} className="space-y-3 px-4 py-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                aria-label={`Elegir ${titleOrUntitled(row.title)}`}
                className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                checked={selected.has(row.id)}
                onChange={(e) => toggle(row.id, e.target.checked)}
              />
              <div className="min-w-0 flex-1">
                <Link href={`/a/${accountSlug}/publicaciones/${row.id}`} className="font-medium hover:underline">
                  {titleOrUntitled(row.title)}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {row.externalId ?? 'Sin código'} · {row.storeName}
                </p>
              </div>
              {row.worked ? <Badge variant="secondary">Pasó por el pipeline</Badge> : null}
            </div>

            {row.fields.map((f) => (
              <div key={f.field} className="overflow-hidden rounded-md border sm:ml-7">
                <div className="border-b bg-muted/50 px-3 py-1.5 text-xs font-semibold">{FACE_FIELD_LABEL[f.field]}</div>
                <div className="grid gap-px bg-border sm:grid-cols-2">
                  <Side label="En la app" text={f.app} />
                  <Side label={`En ${row.channelName}`} text={f.channel} />
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2 sm:ml-7">
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                pending={busy === `${row.id}-channel`}
                onClick={() => choose([row.id], 'channel', `${row.id}-channel`)}
              >
                Usar lo de {row.channelName}
              </Button>
              <Button size="sm" variant="outline" disabled={busy !== null} pending={busy === `${row.id}-app`} onClick={() => choose([row.id], 'app', `${row.id}-app`)}>
                Mantener lo de la app
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {rows.length > shown ? (
        <div className="border-t px-4 py-3 text-center">
          <Button access="view" size="sm" variant="ghost" onClick={() => setShown((n) => n + PAGE)}>
            Ver {Math.min(PAGE, rows.length - shown)} más de {rows.length - shown}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Side({ label, text }: { label: string; text: string }) {
  return (
    <div className="min-w-0 bg-card px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 line-clamp-4 whitespace-pre-line break-words text-sm">{text || <span className="text-muted-foreground">Vacío</span>}</p>
    </div>
  );
}
