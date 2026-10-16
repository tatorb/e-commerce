'use client';

import { useState } from 'react';
import { ExternalLink, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getChannelAdapter } from '@/channels';
import { sameText } from '@/domain/titles';
import type { ChannelKind } from '@/generated/prisma/enums';
import { formatDateTime } from '@/lib/format';
import { readPositionAction, savePositionAction, setMainSearchesAction } from '@/app/a/[cuenta]/pipeline/step-actions';
import { useStepAction } from '../useStepAction';
import { StatusText } from '../StatusText';

// La posición actual en 3 a 5 búsquedas principales, como la foto del antes.

type Position = { id: string; query: string; page: number | null; position: number | null; source: 'AUTO' | 'MANUAL'; checkedAt: Date };

const MAX = 5;

function SearchRow({
  accountSlug,
  publicationId,
  query,
  last,
  auto,
  url,
  channelName,
  timeZone,
  onRemove,
  removing,
}: {
  accountSlug: string;
  publicationId: string;
  query: string;
  last: Position | null;
  auto: boolean;
  url: string | null;
  channelName: string;
  timeZone: string;
  onRemove: () => void;
  removing: boolean;
}) {
  const [page, setPage] = useState('1');
  const [position, setPosition] = useState('');
  const action = useStepAction();
  const notFound = page === 'no';

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5 text-sm">
          <p className="font-medium">«{query}»</p>
          <p className="text-muted-foreground">
            {last
              ? `${last.page ? `Página ${last.page}, posición ${last.position}` : 'No aparece en las primeras 3 páginas'} · ${
                  last.source === 'AUTO' ? 'leída por la app' : 'a mano'
                } el ${formatDateTime(last.checkedAt, timeZone)}`
              : 'Sin medir todavía.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {url ? (
            <Button size="sm" variant="ghost" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Ver en {channelName}
              </a>
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onRemove} disabled={removing} aria-label={`Quitar ${query}`}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Página
          <select
            className="block h-9 rounded-md border bg-background px-2 text-sm text-foreground"
            value={page}
            onChange={(e) => setPage(e.target.value)}
            aria-label={`Página para ${query}`}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="no">No aparece</option>
          </select>
        </label>
        {!notFound ? (
          <label className="space-y-1 text-xs text-muted-foreground">
            Posición
            <Input
              className="h-9 w-20"
              inputMode="numeric"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              aria-label={`Posición para ${query}`}
            />
          </label>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            action.run(
              () =>
                savePositionAction(accountSlug, publicationId, query, notFound ? null : Number(page), notFound ? null : Number(position)),
              () => setPosition(''),
            )
          }
          disabled={action.pending || (!notFound && !position.trim())}
        >
          Guardar
        </Button>
        {auto ? (
          <Button size="sm" variant="outline" onClick={() => action.run(() => readPositionAction(accountSlug, publicationId, query))} disabled={action.pending}>
            <Search className="h-3.5 w-3.5" />
            {action.pending ? 'Leyendo…' : 'Leer sola'}
          </Button>
        ) : null}
        <StatusText status={action.status} />
      </div>
    </li>
  );
}

export function PositionsPanel({
  accountSlug,
  publicationId,
  mainSearches,
  candidates,
  positions,
  auto,
  channelKind,
  channelName,
  timeZone,
}: {
  accountSlug: string;
  publicationId: string;
  mainSearches: string[];
  // Búsquedas sugeridas para elegir.
  candidates: string[];
  positions: Position[];
  auto: boolean;
  channelKind: ChannelKind;
  channelName: string;
  timeZone: string;
}) {
  const [custom, setCustom] = useState('');
  const action = useStepAction();
  const adapter = getChannelAdapter(channelKind, channelName);
  const save = (next: string[]) => action.run(() => setMainSearchesAction(accountSlug, publicationId, next), () => setCustom(''));
  const available = candidates.filter((c) => !mainSearches.some((m) => sameText(m, c))).slice(0, 30);
  const lastOf = (q: string) => positions.find((p) => sameText(p.query, q)) ?? null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Elegí de 3 a 5 búsquedas principales y anotá en qué página y posición aparece hoy la publicación, hasta la
        página 3.{' '}
        {auto ? 'La app también puede leerla sola.' : `Abrí la búsqueda en ${channelName}, buscá la publicación y cargá dónde está.`}
      </p>
      {mainSearches.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {mainSearches.map((q) => (
            <SearchRow
              key={q}
              accountSlug={accountSlug}
              publicationId={publicationId}
              query={q}
              last={lastOf(q)}
              auto={auto}
              url={adapter.searchUrl(q)}
              channelName={channelName}
              timeZone={timeZone}
              onRemove={() => save(mainSearches.filter((m) => m !== q))}
              removing={action.pending}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Todavía no elegiste búsquedas principales.</p>
      )}
      {mainSearches.length < 3 ? (
        <p className="text-sm text-amber-700">Faltan {3 - mainSearches.length} para llegar a 3.</p>
      ) : null}
      {mainSearches.length < MAX ? (
        <div className="space-y-2">
          {available.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {available.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                  onClick={() => save([...mainSearches, c])}
                  disabled={action.pending}
                >
                  + {c}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (custom.trim()) save([...mainSearches, custom]);
            }}
          >
            <Input
              className="w-full sm:w-80"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Otra búsqueda…"
              aria-label="Otra búsqueda principal"
            />
            <Button type="submit" variant="outline" disabled={action.pending || !custom.trim()}>
              Agregar
            </Button>
          </form>
        </div>
      ) : null}
      <StatusText status={action.status} />
    </div>
  );
}
